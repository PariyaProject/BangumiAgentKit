from __future__ import annotations

import asyncio
import logging
import re
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from .artifacts import ArtifactResolver
from .claude_cli import ClaudeCli, ClaudeInvocationError, ClaudeRunResult
from .config import HostConfig, HostConfigError
from .identity import ExternalIdentity
from .response import HostResponse, HostResponseError, parse_claude_output
from .session_store import HostSession, HostSessionStore, HostSessionStoreError


LOGGER = logging.getLogger(__name__)


class ClaudeRunner(Protocol):
    async def run(
        self,
        message: str,
        identity_env: dict[str, str],
        session_id: str | None = None,
    ) -> ClaudeRunResult:
        ...


@dataclass(frozen=True)
class HostResult:
    """Public response plus local artifact handles for the adapter process."""

    response: HostResponse
    artifact_paths: tuple[Path, ...] = ()
    error_code: str | None = None

    def to_public_dict(self) -> dict[str, object]:
        """Never include local filesystem paths in model/QQ-facing data."""
        return self.response.to_dict()


def _safe_response(text: str, error_code: str) -> HostResult:
    return HostResult(
        response=HostResponse(text=text, artifacts=(), pending_confirmation=None),
        error_code=error_code,
    )


def _looks_like_explicit_confirmation(message: str) -> bool:
    normalized = re.sub(r'\s+', ' ', message.strip().lower())
    if not normalized or any(token in normalized for token in ('取消', '拒绝', '不要', 'cancel', 'no')):
        return False
    return normalized in {
        '确认',
        '确认执行',
        '同意',
        '继续',
        '执行',
        'confirm',
        'confirm it',
        'yes',
        'proceed',
        'do it',
    }


def _looks_like_missing_session(result: ClaudeRunResult) -> bool:
    diagnostic = f'{result.stdout}\n{result.stderr}'.lower()
    return any(
        marker in diagnostic
        for marker in (
            'session not found',
            'session_not_found',
            'conversation not found',
            'no conversation found',
            'unknown session',
            'resume session does not exist',
        )
    )


class ClaudeHostService:
    """NoneBot-independent orchestration for one external Claude host profile."""

    def __init__(
        self,
        config: HostConfig | None = None,
        runner: ClaudeRunner | None = None,
        session_store: HostSessionStore | None = None,
        artifact_resolver: ArtifactResolver | None = None,
    ):
        self.config = config or HostConfig.from_env()
        self.config.ensure_runtime_dirs()
        self.runner = runner or ClaudeCli(self.config)
        self.session_store = session_store or HostSessionStore(
            self.config.data_dir / 'host-bridge.sqlite',
            session_ttl_seconds=self.config.session_ttl_hours * 60 * 60,
        )
        self.artifact_resolver = artifact_resolver or ArtifactResolver(self.config.artifact_dir)
        self._conversation_locks: dict[str, asyncio.Lock] = {}

    @classmethod
    def from_env(cls) -> 'ClaudeHostService':
        return cls(HostConfig.from_env())

    @staticmethod
    def conversation_key(identity: ExternalIdentity) -> str:
        return f'{identity.provider}:{identity.bot_instance_id}:{identity.conversation_id}'

    @staticmethod
    def _pending_context(session: HostSession) -> str:
        return (
            'Host-generated context (not authorization): a pending Bangumi confirmation exists.\n'
            f'Confirmation ID: {session.pending_confirmation_id}\n'
            f'Summary: {session.pending_confirmation_summary}\n'
            'Only use this ID if the user clearly confirms this exact pending operation. '
            'Never invent an ID, change the original payload, or auto-confirm an unrelated message.\n\n'
        )

    def _message_for_claude(self, message: str, session: HostSession | None) -> str:
        if session and session.pending_confirmation_id and session.pending_confirmation_summary:
            return self._pending_context(session) + 'Current user message:\n' + message
        return message

    async def _run_once(
        self,
        message: str,
        identity: ExternalIdentity,
        session_id: str | None,
    ) -> ClaudeRunResult:
        return await self.runner.run(message, identity.to_mcp_environment(), session_id=session_id)

    def _finish_response(
        self,
        response: HostResponse,
    ) -> HostResult:
        valid_artifacts = []
        artifact_paths = []
        for artifact in response.artifacts:
            path = self.artifact_resolver.resolve(artifact.id)
            if path is None:
                LOGGER.warning('host artifact rejected id=%s', artifact.id)
                continue
            valid_artifacts.append(artifact)
            artifact_paths.append(path)
        if len(valid_artifacts) == len(response.artifacts):
            return HostResult(response=response, artifact_paths=tuple(artifact_paths))
        return HostResult(
            response=HostResponse(
                text=response.text,
                artifacts=tuple(valid_artifacts),
                pending_confirmation=response.pending_confirmation,
            ),
            artifact_paths=tuple(artifact_paths),
        )

    async def handle_message(self, identity: ExternalIdentity, message_text: str) -> HostResult:
        if not isinstance(message_text, str) or not message_text.strip():
            return _safe_response('请输入要发送给 Bangumi Agent 的内容。', 'EMPTY_MESSAGE')

        conversation_key = self.conversation_key(identity)
        lock = self._conversation_locks.setdefault(conversation_key, asyncio.Lock())
        async with lock:
            owner_id = f'host_{uuid.uuid4().hex}'
            try:
                acquired = self.session_store.acquire_lease(
                    conversation_key,
                    owner_id,
                    ttl_seconds=max(30, self.config.timeout_seconds + 30),
                )
            except HostSessionStoreError:
                LOGGER.exception('host lease acquisition failed')
                return _safe_response('会话暂时无法使用，请稍后重试。', 'HOST_LEASE_ERROR')
            if not acquired:
                return _safe_response('该会话正在处理中，请稍后重试。', 'CONVERSATION_BUSY')

            try:
                return await self._handle_locked(identity, conversation_key, message_text)
            finally:
                try:
                    self.session_store.release_lease(conversation_key, owner_id)
                except HostSessionStoreError:
                    LOGGER.exception('host lease release failed')

    async def _handle_locked(
        self,
        identity: ExternalIdentity,
        conversation_key: str,
        message_text: str,
    ) -> HostResult:
        try:
            session = self.session_store.get(conversation_key)
            pending_before = bool(
                session
                and session.pending_confirmation_id
                and session.pending_confirmation_summary
            )
            result = await self._run_once(
                self._message_for_claude(message_text, session),
                identity,
                session.claude_session_id if session else None,
            )

            if result.timed_out:
                self.session_store.record_error(conversation_key, 'CLAUDE_TIMEOUT')
                return _safe_response('请求处理超时，请稍后重试。', 'CLAUDE_TIMEOUT')
            if result.output_limited:
                self.session_store.record_error(conversation_key, 'CLAUDE_OUTPUT_LIMIT')
                return _safe_response('模型响应过大，已安全终止本次请求。', 'CLAUDE_OUTPUT_LIMIT')

            if result.returncode != 0:
                if session and _looks_like_missing_session(result):
                    self.session_store.clear_session(conversation_key)
                    if pending_before:
                        return _safe_response(
                            '上一轮确认上下文已失效，请重新发起该操作。',
                            'CLAUDE_SESSION_LOST_PENDING',
                        )
                    # Ordinary conversational/read requests may be retried once,
                    # but the retry is a fresh session and never reconstructs a write.
                    result = await self._run_once(message_text, identity, session_id=None)
                    if result.timed_out:
                        return _safe_response('请求处理超时，请稍后重试。', 'CLAUDE_TIMEOUT')
                    if result.output_limited:
                        return _safe_response(
                            '模型响应过大，已安全终止本次请求。',
                            'CLAUDE_OUTPUT_LIMIT',
                        )
                if result.returncode != 0:
                    self.session_store.record_error(conversation_key, 'CLAUDE_PROCESS_ERROR')
                    return _safe_response('Bangumi Agent 暂时不可用，请稍后重试。', 'CLAUDE_PROCESS_ERROR')

            try:
                new_session_id, response = parse_claude_output(result.stdout)
            except HostResponseError:
                self.session_store.record_error(conversation_key, 'CLAUDE_INVALID_RESPONSE')
                return _safe_response('模型返回了无法识别的响应，请稍后重试。', 'CLAUDE_INVALID_RESPONSE')

            pending = response.pending_confirmation
            pending_id = pending.confirmation_id if pending else None
            pending_summary = pending.summary if pending else None
            if not pending and pending_before and _looks_like_explicit_confirmation(message_text):
                pending_id = None
                pending_summary = None
            elif not pending and session:
                pending_id = session.pending_confirmation_id
                pending_summary = session.pending_confirmation_summary

            self.session_store.upsert_session(
                conversation_key,
                new_session_id,
                pending_confirmation_id=pending_id,
                pending_confirmation_summary=pending_summary,
            )
            return self._finish_response(response)
        except (ClaudeInvocationError, HostConfigError):
            LOGGER.exception('host Claude invocation failed')
            return _safe_response('Bangumi Agent 暂时不可用，请稍后重试。', 'CLAUDE_UNAVAILABLE')
        except HostSessionStoreError:
            LOGGER.exception('host session store failed')
            return _safe_response('会话状态暂时无法保存，请稍后重试。', 'HOST_SESSION_STORE_ERROR')
        except OSError:
            LOGGER.exception('host filesystem operation failed')
            return _safe_response('宿主运行环境暂时不可用，请稍后重试。', 'HOST_FILESYSTEM_ERROR')

    def close(self) -> None:
        self.session_store.close()


__all__ = ['ClaudeHostService', 'ClaudeRunner', 'HostResult']
