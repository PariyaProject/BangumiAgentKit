from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path


ARTIFACT_ID_PATTERN = re.compile(r'^art_[A-Za-z0-9_-]+$')
PRIVATE_ARTIFACT_ID_PATTERN = re.compile(r'^art_p_([a-f0-9]{24})_[a-f0-9]{32}$')
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
    """Resolve public and principal-scoped capability IDs safely."""

    def __init__(self, artifact_root: Path, max_bytes: int = 16 * 1024 * 1024):
        if max_bytes < len(PNG_SIGNATURE):
            raise ValueError('max_bytes is too small for a PNG')
        self.artifact_root = Path(artifact_root).expanduser().resolve()
        self.max_bytes = max_bytes

    @staticmethod
    def _principal_scope(principal_key: str | None) -> str | None:
        if not isinstance(principal_key, str) or not principal_key:
            return None
        return hashlib.sha256(principal_key.encode('utf-8')).hexdigest()[:24]

    @staticmethod
    def _is_private_prefix(artifact_id: object) -> bool:
        return isinstance(artifact_id, str) and artifact_id.startswith('art_p_')

    def _safe_path(self, directory: Path, artifact_id: str, suffix: str) -> Path | None:
        if not isinstance(artifact_id, str) or not ARTIFACT_ID_PATTERN.fullmatch(artifact_id):
            return None
        directory = directory.resolve()
        candidate = (directory / f'{artifact_id}{suffix}').resolve()
        try:
            candidate.relative_to(directory)
        except ValueError:
            return None
        return candidate

    def _resolve_in_directory(self, directory: Path, artifact_id: str) -> Path | None:
        image_path = self._safe_path(directory, artifact_id, '.png')
        metadata_path = self._safe_path(directory, artifact_id, '.json')
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

    def resolve(self, artifact_id: str, principal_key: str | None = None) -> Path | None:
        """Resolve a public artifact, or a private artifact with trusted scope context."""
        if self._is_private_prefix(artifact_id):
            return self.resolve_for_principal(artifact_id, principal_key)
        return self._resolve_in_directory(self.artifact_root, artifact_id)

    def resolve_for_principal(self, artifact_id: str, principal_key: str | None) -> Path | None:
        """Resolve an artifact while enforcing the caller's principal scope."""
        if not isinstance(artifact_id, str) or self._is_private_prefix(artifact_id):
            match = (
                PRIVATE_ARTIFACT_ID_PATTERN.fullmatch(artifact_id)
                if isinstance(artifact_id, str)
                else None
            )
            scope = self._principal_scope(principal_key)
            if match is None or scope is None or match.group(1) != scope:
                return None
            private_root = (self.artifact_root / 'private' / scope).resolve()
            try:
                private_root.relative_to(self.artifact_root)
            except ValueError:
                return None
            return self._resolve_in_directory(private_root, artifact_id)
        return self._resolve_in_directory(self.artifact_root, artifact_id)


__all__ = [
    'ARTIFACT_ID_PATTERN',
    'PRIVATE_ARTIFACT_ID_PATTERN',
    'ArtifactResolver',
    'ArtifactResolutionError',
]
