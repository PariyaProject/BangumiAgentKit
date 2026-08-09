from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path


ARTIFACT_ID_PATTERN = re.compile(r'^art_[A-Za-z0-9_-]+$')
PNG_SIGNATURE = b'\x89PNG\r\n\x1a\n'


class ArtifactResolutionError(ValueError):
    """Raised only for invalid resolver configuration, never for user-facing output."""


def _parse_expiry(raw: object) -> datetime | None:
    if not isinstance(raw, str):
        return None
    try:
        value = datetime.fromisoformat(raw.replace('Z', '+00:00'))
    except ValueError:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


class ArtifactResolver:
    """Resolve model-visible capability IDs without trusting metadata file paths."""

    def __init__(self, artifact_root: Path, max_bytes: int = 16 * 1024 * 1024):
        if max_bytes < len(PNG_SIGNATURE):
            raise ValueError('max_bytes is too small for a PNG')
        self.artifact_root = Path(artifact_root).expanduser().resolve()
        self.max_bytes = max_bytes

    def _safe_path(self, artifact_id: str, suffix: str) -> Path | None:
        if not isinstance(artifact_id, str) or not ARTIFACT_ID_PATTERN.fullmatch(artifact_id):
            return None
        candidate = (self.artifact_root / f'{artifact_id}{suffix}').resolve()
        try:
            candidate.relative_to(self.artifact_root)
        except ValueError:
            return None
        return candidate

    def resolve(self, artifact_id: str) -> Path | None:
        """Return a validated local PNG handle, or None for any invalid artifact."""
        image_path = self._safe_path(artifact_id, '.png')
        metadata_path = self._safe_path(artifact_id, '.json')
        if image_path is None or metadata_path is None:
            return None
        if not image_path.is_file() or not metadata_path.is_file():
            return None
        try:
            metadata = json.loads(metadata_path.read_text(encoding='utf-8'))
            if not isinstance(metadata, dict):
                return None
            if metadata.get('id') != artifact_id or metadata.get('mimeType') != 'image/png':
                return None
            expires_at = _parse_expiry(metadata.get('expiresAt'))
            if expires_at is None or datetime.now(timezone.utc) >= expires_at:
                return None
            stat = image_path.stat()
            if stat.st_size > self.max_bytes or stat.st_size < len(PNG_SIGNATURE):
                return None
            with image_path.open('rb') as handle:
                if handle.read(len(PNG_SIGNATURE)) != PNG_SIGNATURE:
                    return None
        except (OSError, ValueError, TypeError, json.JSONDecodeError):
            return None
        return image_path


__all__ = ['ARTIFACT_ID_PATTERN', 'ArtifactResolver', 'ArtifactResolutionError']
