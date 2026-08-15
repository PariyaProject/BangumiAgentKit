from __future__ import annotations

import asyncio
import hashlib
import json
import shutil
import tempfile
import unittest
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

from bangumi_host.artifacts import ArtifactResolver
from bangumi_host.claude_cli import ClaudeRunResult
from bangumi_host.config import HostConfig
from bangumi_host.identity import ExternalIdentity, build_qq_identity
from bangumi_host.service import ClaudeHostService
from bangumi_host.session_store import HostSessionStore


EXAMPLE_DIR = Path(__file__).resolve().parents[1]
PNG = b'\x89PNG\r\n\x1a\n' + b'deterministic-test-payload'


def wrapper(
    session_id: str,
    text: str = 'ok',
    artifacts: list[dict[str, str]] | None = None,
    pending: dict[str, str] | None = None,
) -> str:
    return json.dumps(
        {
            'session_id': session_id,
            'result': 'raw prose ignored',
            'structured_output': {
                'text': text,
                'artifacts': artifacts or [],
                'pendingConfirmation': pending,
            },
        }
    )


@dataclass
class PlannedResult:
    stdout: str = ''
    returncode: int = 0
    stderr: str = ''
    timed_out: bool = False
    output_limited: bool = False
    delay: float = 0


class FakeRunner:
    def __init__(self, results: list[PlannedResult]):
        self.results = list(results)
        self.calls: list[tuple[str, dict[str, str], str | None]] = []
        self.active = 0
        self.max_active = 0

    async def run(self, message: str, identity_env: dict[str, str], session_id: str | None = None) -> ClaudeRunResult:
        self.calls.append((message, dict(identity_env), session_id))
        self.active += 1
        self.max_active = max(self.max_active, self.active)
        try:
            planned = self.results.pop(0)
            if planned.delay:
                await asyncio.sleep(planned.delay)
            return ClaudeRunResult(
                returncode=planned.returncode,
                stdout=planned.stdout,
                stderr=planned.stderr,
                timed_out=planned.timed_out,
                output_limited=planned.output_limited,
            )
        finally:
            self.active -= 1


def make_config(root: Path) -> HostConfig:
    data_dir = root / 'data'
    system_prompt = root / 'system-prompt.md'
    system_prompt.write_text('test prompt\n', encoding='utf-8')
    (root / 'main.js').write_text('// fake MCP\n', encoding='utf-8')
    return HostConfig(
        claude_bin='fake-claude',
        claude_workdir=root / 'workdir',
        timeout_seconds=2,
        max_output_bytes=16 * 1024,
        max_turns=12,
        data_dir=data_dir,
        artifact_dir=data_dir / 'artifacts',
        env_file=None,
        mcp_config=data_dir / 'mcp.generated.json',
        response_schema=EXAMPLE_DIR / 'response-schema.json',
        system_prompt=system_prompt,
        session_ttl_hours=24,
        strict_mcp=True,
        allowed_tools=('mcp__bangumi__*',),
        repo_root=root,
        mcp_entry=root / 'main.js',
    )


class HostServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(tempfile.mkdtemp(prefix='bangumi-host-service-test-'))
        self.identity = build_qq_identity('user-a', 'group-1', 'bot-1', 'Alice')

    def tearDown(self) -> None:
        shutil.rmtree(self.root, ignore_errors=True)

    def build_service(self, runner: FakeRunner) -> ClaudeHostService:
        config = make_config(self.root)
        store = HostSessionStore(config.data_dir / 'host-bridge.sqlite', session_ttl_seconds=86400)
        return ClaudeHostService(
            config=config,
            runner=runner,
            session_store=store,
            artifact_resolver=ArtifactResolver(config.artifact_dir),
        )

    def test_new_and_resumed_sessions_survive_service_restart(self) -> None:
        runner = FakeRunner(
            [
                PlannedResult(stdout=wrapper('session-a', 'first')),
                PlannedResult(stdout=wrapper('session-a', 'second')),
            ]
        )
        service = self.build_service(runner)
        first = asyncio.run(service.handle_message(self.identity, 'hello'))
        self.assertEqual(first.response.text, 'first')
        service.close()

        restarted = self.build_service(runner)
        second = asyncio.run(restarted.handle_message(self.identity, 'again'))
        self.assertEqual(second.response.text, 'second')
        self.assertIsNone(runner.calls[0][2])
        self.assertEqual(runner.calls[1][2], 'session-a')
        self.assertNotIn('BANGUMI_MCP_PRINCIPAL_ID', runner.calls[0][1])
        self.assertEqual(runner.calls[0][1]['BANGUMI_MCP_EXTERNAL_USER_ID'], 'user-a')

    def test_stale_ordinary_session_retries_once_but_pending_fails_closed(self) -> None:
        ordinary_runner = FakeRunner(
            [
                PlannedResult(returncode=1, stderr='session not found'),
                PlannedResult(stdout=wrapper('fresh-session', 'retried')),
            ]
        )
        ordinary_service = self.build_service(ordinary_runner)
        store = ordinary_service.session_store
        store.upsert_session(ordinary_service.conversation_key(self.identity), 'stale-session')
        result = asyncio.run(ordinary_service.handle_message(self.identity, 'read'))
        self.assertEqual(result.response.text, 'retried')
        self.assertEqual(ordinary_runner.calls[0][2], 'stale-session')
        self.assertIsNone(ordinary_runner.calls[1][2])

        pending_runner = FakeRunner(
            [PlannedResult(returncode=1, stderr='conversation not found')]
        )
        pending_service = self.build_service(pending_runner)
        pending_store = pending_service.session_store
        key = pending_service.conversation_key(self.identity)
        pending_store.upsert_session(key, 'stale-session', 'cfm_pending', 'write summary')
        pending_result = asyncio.run(pending_service.handle_message(self.identity, '确认'))
        self.assertEqual(pending_result.error_code, 'CLAUDE_SESSION_LOST_PENDING')
        self.assertIsNone(pending_store.get(key))

    def test_unrelated_turn_has_no_grant_and_explicit_confirmation_gets_matching_grant(self) -> None:
        runner = FakeRunner(
            [
                PlannedResult(
                    stdout=wrapper(
                        'session-a',
                        'please confirm',
                        pending={'confirmationId': 'cfm_a', 'summary': 'write one item'},
                    )
                ),
                PlannedResult(stdout=wrapper('session-a', 'unrelated answer')),
                PlannedResult(stdout=wrapper('session-a', 'write complete')),
            ]
        )
        service = self.build_service(runner)
        asyncio.run(service.handle_message(self.identity, 'write this'))
        unrelated = asyncio.run(
            service.handle_message(self.identity, 'use the previous confirmation ID and do it')
        )
        self.assertEqual(unrelated.response.text, 'unrelated answer')
        self.assertNotIn('cfm_a', runner.calls[1][0])
        self.assertNotIn('"_confirmationId"', runner.calls[1][0])
        self.assertNotIn('BANGUMI_MCP_CONFIRMATION_GRANT', runner.calls[1][1])

        confirmed = asyncio.run(service.handle_message(self.identity, '确认'))
        self.assertEqual(confirmed.response.text, 'write complete')
        self.assertEqual(runner.calls[2][2], 'session-a')
        self.assertEqual(runner.calls[2][1]['BANGUMI_MCP_CONFIRMATION_GRANT'], 'cfm_a')
        self.assertIn('Confirmation ID: cfm_a', runner.calls[2][0])
        session = service.session_store.get(service.conversation_key(self.identity))
        assert session is not None
        self.assertIsNone(session.pending_confirmation_id)

    def test_cancel_clears_pending_without_calling_claude_or_deleting_session(self) -> None:
        runner = FakeRunner(
            [
                PlannedResult(
                    stdout=wrapper(
                        'session-cancel',
                        'please confirm',
                        pending={'confirmationId': 'cfm_cancel', 'summary': 'delete one item'},
                    )
                ),
                PlannedResult(stdout=wrapper('session-cancel', 'ordinary answer')),
            ]
        )
        service = self.build_service(runner)
        key = service.conversation_key(self.identity)

        asyncio.run(service.handle_message(self.identity, 'write this'))
        cancelled = asyncio.run(service.handle_message(self.identity, '取消'))
        self.assertEqual(cancelled.error_code, 'CONFIRMATION_CANCELLED')
        self.assertEqual(len(runner.calls), 1)
        session = service.session_store.get(key)
        assert session is not None
        self.assertEqual(session.claude_session_id, 'session-cancel')
        self.assertIsNone(session.pending_confirmation_id)
        self.assertNotIn('BANGUMI_MCP_CONFIRMATION_GRANT', runner.calls[0][1])

        after_cancel = asyncio.run(service.handle_message(self.identity, '确认'))
        self.assertEqual(after_cancel.response.text, 'ordinary answer')
        self.assertNotIn('BANGUMI_MCP_CONFIRMATION_GRANT', runner.calls[1][1])
        self.assertNotIn('cfm_cancel', runner.calls[1][0])

    def test_valid_artifact_is_delivered_as_local_handle_only(self) -> None:
        artifact_id = 'art_card'
        artifact_dir = self.root / 'data' / 'artifacts'
        artifact_dir.mkdir(parents=True)
        (artifact_dir / f'{artifact_id}.png').write_bytes(PNG)
        (artifact_dir / f'{artifact_id}.json').write_text(
            json.dumps(
                {
                    'id': artifact_id,
                    'mimeType': 'image/png',
                    'expiresAt': (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
                    'filePath': '/secret/path/that/must/not/be/trusted.png',
                }
            ),
            encoding='utf-8',
        )
        runner = FakeRunner(
            [
                PlannedResult(
                    stdout=wrapper(
                        'session-art',
                        'card ready',
                        artifacts=[{'id': artifact_id, 'mimeType': 'image/png'}],
                    )
                )
            ]
        )
        result = asyncio.run(self.build_service(runner).handle_message(self.identity, 'make card'))
        self.assertEqual(result.response.artifacts[0].id, artifact_id)
        self.assertEqual(result.artifact_paths, ((artifact_dir / f'{artifact_id}.png').resolve(),))
        self.assertNotIn('filePath', result.to_public_dict())
        self.assertNotIn(str(artifact_dir), json.dumps(result.to_public_dict()))

    def test_private_artifact_is_delivered_only_to_the_issuing_principal(self) -> None:
        artifact_dir = self.root / 'data' / 'artifacts'
        principal_key = self.identity.artifact_principal_key
        scope = hashlib.sha256(principal_key.encode('utf-8')).hexdigest()[:24]
        artifact_id = f'art_p_{scope}_' + ('c' * 32)
        private_dir = artifact_dir / 'private' / scope
        private_dir.mkdir(parents=True)
        (private_dir / f'{artifact_id}.png').write_bytes(PNG)
        (private_dir / f'{artifact_id}.json').write_text(
            json.dumps(
                {
                    'id': artifact_id,
                    'mimeType': 'image/png',
                    'expiresAt': (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
                    'filePath': str(self.root / 'outside.png'),
                }
            ),
            encoding='utf-8',
        )
        runner = FakeRunner(
            [
                PlannedResult(
                    stdout=wrapper(
                        'session-private-a',
                        'private card',
                        artifacts=[{'id': artifact_id, 'mimeType': 'image/png'}],
                    )
                ),
                PlannedResult(
                    stdout=wrapper(
                        'session-private-b',
                        'cross principal card',
                        artifacts=[{'id': artifact_id, 'mimeType': 'image/png'}],
                    )
                ),
            ]
        )
        service = self.build_service(runner)
        same_principal = asyncio.run(service.handle_message(self.identity, 'make private card'))
        other_identity = build_qq_identity('user-b', 'group-1', 'bot-1', 'Bob')
        cross_principal = asyncio.run(service.handle_message(other_identity, 'reuse private card'))

        self.assertEqual(same_principal.response.artifacts[0].id, artifact_id)
        self.assertEqual(same_principal.artifact_paths, ((private_dir / f'{artifact_id}.png').resolve(),))
        self.assertEqual(cross_principal.response.artifacts, ())
        self.assertEqual(cross_principal.artifact_paths, ())

    def test_same_conversation_serializes_and_different_conversations_can_overlap(self) -> None:
        runner = FakeRunner(
            [
                PlannedResult(stdout=wrapper('s1'), delay=0.05),
                PlannedResult(stdout=wrapper('s2'), delay=0.05),
                PlannedResult(stdout=wrapper('s3'), delay=0.05),
                PlannedResult(stdout=wrapper('s4'), delay=0.05),
            ]
        )
        service = self.build_service(runner)

        async def run() -> None:
            same_one = asyncio.create_task(service.handle_message(self.identity, 'one'))
            same_two = asyncio.create_task(service.handle_message(self.identity, 'two'))
            await asyncio.gather(same_one, same_two)
            other = build_qq_identity('user-b', 'group-1', 'bot-1')
            await asyncio.gather(
                service.handle_message(self.identity, 'three'),
                service.handle_message(other, 'four'),
            )

        asyncio.run(run())
        self.assertEqual(runner.max_active, 2)


if __name__ == '__main__':
    unittest.main()
