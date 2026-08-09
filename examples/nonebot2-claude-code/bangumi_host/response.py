from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Mapping


ARTIFACT_ID_PATTERN = re.compile(r'^art_[A-Za-z0-9_-]+$')
CONFIRMATION_ID_PATTERN = re.compile(r'^cfm_[A-Za-z0-9_-]+$')


class HostResponseError(ValueError):
    """Raised when Claude's structured output cannot be safely delivered."""


@dataclass(frozen=True)
class ArtifactOutput:
    id: str
    mime_type: str
    alt: str | None = None

    def to_dict(self) -> dict[str, str]:
        result = {'id': self.id, 'mimeType': self.mime_type}
        if self.alt is not None:
            result['alt'] = self.alt
        return result


@dataclass(frozen=True)
class PendingConfirmationOutput:
    confirmation_id: str
    summary: str

    def to_dict(self) -> dict[str, str]:
        return {'confirmationId': self.confirmation_id, 'summary': self.summary}


@dataclass(frozen=True)
class HostResponse:
    text: str
    artifacts: tuple[ArtifactOutput, ...]
    pending_confirmation: PendingConfirmationOutput | None

    def to_dict(self) -> dict[str, object]:
        return {
            'text': self.text,
            'artifacts': [artifact.to_dict() for artifact in self.artifacts],
            'pendingConfirmation': (
                self.pending_confirmation.to_dict()
                if self.pending_confirmation is not None
                else None
            ),
        }


def _require_exact_keys(value: Mapping[str, object], allowed: set[str], label: str) -> None:
    unexpected = set(value) - allowed
    if unexpected:
        raise HostResponseError(f'{label} contains unsupported fields')


def validate_structured_output(value: object) -> HostResponse:
    if not isinstance(value, dict):
        raise HostResponseError('structured_output must be an object')
    _require_exact_keys(value, {'text', 'artifacts', 'pendingConfirmation'}, 'structured_output')

    text = value.get('text')
    if not isinstance(text, str) or len(text) > 64 * 1024:
        raise HostResponseError('structured_output.text must be a string of at most 64 KiB')

    raw_artifacts = value.get('artifacts')
    if not isinstance(raw_artifacts, list) or len(raw_artifacts) > 8:
        raise HostResponseError('structured_output.artifacts must contain at most 8 items')
    artifacts: list[ArtifactOutput] = []
    for raw in raw_artifacts:
        if not isinstance(raw, dict):
            raise HostResponseError('artifact must be an object')
        _require_exact_keys(raw, {'id', 'mimeType', 'alt'}, 'artifact')
        artifact_id = raw.get('id')
        mime_type = raw.get('mimeType')
        alt = raw.get('alt')
        if not isinstance(artifact_id, str) or not ARTIFACT_ID_PATTERN.fullmatch(artifact_id):
            raise HostResponseError('artifact id is invalid')
        if mime_type != 'image/png':
            raise HostResponseError('artifact mimeType must be image/png')
        if alt is not None and (not isinstance(alt, str) or len(alt) > 512):
            raise HostResponseError('artifact alt is invalid')
        artifacts.append(ArtifactOutput(artifact_id, 'image/png', alt))

    raw_pending = value.get('pendingConfirmation')
    pending: PendingConfirmationOutput | None = None
    if raw_pending is not None:
        if not isinstance(raw_pending, dict):
            raise HostResponseError('pendingConfirmation must be null or an object')
        _require_exact_keys(raw_pending, {'confirmationId', 'summary'}, 'pendingConfirmation')
        confirmation_id = raw_pending.get('confirmationId')
        summary = raw_pending.get('summary')
        if not isinstance(confirmation_id, str) or not CONFIRMATION_ID_PATTERN.fullmatch(
            confirmation_id
        ):
            raise HostResponseError('pendingConfirmation.confirmationId is invalid')
        if not isinstance(summary, str) or len(summary) > 4096:
            raise HostResponseError('pendingConfirmation.summary is invalid')
        pending = PendingConfirmationOutput(confirmation_id, summary)

    return HostResponse(text, tuple(artifacts), pending)


def parse_claude_output(stdout: str) -> tuple[str, HostResponse]:
    try:
        wrapper = json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise HostResponseError('Claude returned invalid JSON') from exc
    if not isinstance(wrapper, dict):
        raise HostResponseError('Claude JSON wrapper must be an object')
    session_id = wrapper.get('session_id')
    if not isinstance(session_id, str) or not session_id or len(session_id) > 256:
        raise HostResponseError('Claude JSON wrapper is missing a valid session_id')
    if 'structured_output' not in wrapper:
        raise HostResponseError('Claude JSON wrapper is missing structured_output')
    return session_id, validate_structured_output(wrapper['structured_output'])
