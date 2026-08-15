from __future__ import annotations

import json
import hashlib
import shutil
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from bangumi_host.artifacts import ArtifactResolver


PNG = b'\x89PNG\r\n\x1a\n' + b'deterministic-test-payload'


def write_artifact(root: Path, artifact_id: str, expires_at: datetime, file_name: str | None = None) -> None:
    (root / f'{artifact_id}.png').write_bytes(PNG)
    (root / f'{artifact_id}.json').write_text(
        json.dumps(
            {
                'id': artifact_id,
                'mimeType': 'image/png',
                'filePath': str(root / (file_name or f'{artifact_id}.png')),
                'expiresAt': expires_at.isoformat(),
            }
        ),
        encoding='utf-8',
    )


def write_private_artifact(
    root: Path,
    artifact_id: str,
    principal_key: str,
    expires_at: datetime,
    file_name: str | None = None,
) -> Path:
    scope = hashlib.sha256(principal_key.encode('utf-8')).hexdigest()[:24]
    private_root = root / 'private' / scope
    private_root.mkdir(parents=True)
    write_artifact(private_root, artifact_id, expires_at, file_name=file_name)
    return (private_root / f'{artifact_id}.png').resolve()


class ArtifactResolverTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(tempfile.mkdtemp(prefix='bangumi-host-artifact-test-'))
        self.resolver = ArtifactResolver(self.root, max_bytes=1024)

    def tearDown(self) -> None:
        shutil.rmtree(self.root, ignore_errors=True)

    def test_valid_png_is_resolved_without_using_metadata_path(self) -> None:
        artifact_id = 'art_valid'
        write_artifact(
            self.root,
            artifact_id,
            datetime.now(timezone.utc) + timedelta(minutes=5),
            file_name='../outside.png',
        )
        resolved = self.resolver.resolve(artifact_id)
        self.assertEqual(resolved, (self.root / f'{artifact_id}.png').resolve())

    def test_traversal_and_fake_ids_are_rejected(self) -> None:
        self.assertIsNone(self.resolver.resolve('../art_escape'))
        self.assertIsNone(self.resolver.resolve('art_missing'))
        self.assertIsNone(self.resolver.resolve('art_bad/child'))

    def test_expired_or_invalid_png_is_rejected(self) -> None:
        expired_id = 'art_expired'
        write_artifact(self.root, expired_id, datetime.now(timezone.utc) - timedelta(seconds=1))
        self.assertIsNone(self.resolver.resolve(expired_id))

        bad_id = 'art_bad_png'
        (self.root / f'{bad_id}.png').write_bytes(b'not-a-png')
        (self.root / f'{bad_id}.json').write_text(
            json.dumps(
                {
                    'id': bad_id,
                    'mimeType': 'image/png',
                    'expiresAt': (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
                }
            ),
            encoding='utf-8',
        )
        self.assertIsNone(self.resolver.resolve(bad_id))

    def test_private_artifact_requires_matching_principal_and_expected_scope_path(self) -> None:
        principal_a = 'qq\x00qq:bot-1\x00user-a'
        principal_b = 'qq\x00qq:bot-1\x00user-b'
        scope_a = hashlib.sha256(principal_a.encode('utf-8')).hexdigest()[:24]
        artifact_id = f'art_p_{scope_a}_' + ('a' * 32)
        expected_path = write_private_artifact(
            self.root,
            artifact_id,
            principal_a,
            datetime.now(timezone.utc) + timedelta(minutes=5),
            file_name='../../outside.png',
        )

        self.assertIsNone(self.resolver.resolve(artifact_id))
        self.assertIsNone(self.resolver.resolve_for_principal(artifact_id, principal_b))
        self.assertEqual(self.resolver.resolve_for_principal(artifact_id, principal_a), expected_path)

        # A private-looking ID in the public root must never become a fallback.
        write_artifact(
            self.root,
            artifact_id,
            datetime.now(timezone.utc) + timedelta(minutes=5),
        )
        self.assertIsNone(self.resolver.resolve(artifact_id))

    def test_malformed_private_id_is_not_resolved_as_public_artifact(self) -> None:
        malformed_id = 'art_p_not-a-scope_' + ('b' * 32)
        write_artifact(
            self.root,
            malformed_id,
            datetime.now(timezone.utc) + timedelta(minutes=5),
        )
        self.assertIsNone(self.resolver.resolve(malformed_id))


if __name__ == '__main__':
    unittest.main()
