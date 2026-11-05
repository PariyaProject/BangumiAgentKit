"""Historical fixture isolation through the same sealed snapshot interface."""
import hashlib
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from source_snapshot_fixture import MAX_FILE_BYTES, read_source_snapshot


class SourceSnapshotFixtureTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='sealed-source-fixture-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        subprocess.run(['git', 'init', '-q', '--object-format=sha1', str(self.root)], check=True)

    def descriptor(self, data):
        result = subprocess.run(['git', '-C', str(self.root), 'hash-object', '-w', '--stdin'],
                                input=data, capture_output=True, check=True)
        return {'gitBlob': result.stdout.decode().strip(),
                'sha256': hashlib.sha256(data).hexdigest()}

    def test_snapshot_uses_old_binary_blobs_after_current_source_changes(self):
        old = b'original\0binary\n\xff'
        sources = {'packages/calendar.bin': self.descriptor(old),
                   'empty.ts': self.descriptor(b'')}
        current = self.root / 'packages/calendar.bin'
        current.parent.mkdir()
        current.write_bytes(b'changed current source')
        result = read_source_snapshot(self.root, sources)
        self.assertEqual(result, {'packages/calendar.bin': old, 'empty.ts': b''})
        self.assertEqual(current.read_bytes(), b'changed current source')

    def test_wrong_sha_or_missing_blob_never_returns_fixture_bytes(self):
        entry = self.descriptor(b'pinned')
        with self.assertRaisesRegex(ValueError, 'seal'):
            read_source_snapshot(self.root, {'file': {**entry, 'sha256': 'f' * 64}})
        with self.assertRaisesRegex(ValueError, 'missing'):
            read_source_snapshot(self.root, {'file': {**entry, 'gitBlob': 'f' * 40}})

    def test_unsafe_descriptors_refuse_before_any_git_call(self):
        entry = self.descriptor(b'pinned')
        for name in ('.', '../outside', '/absolute', '.git/config', 'a\nb', 'a\\b', 'a//b', 'C:/file'):
            with self.subTest(path=name), patch('source_snapshot_fixture.subprocess.run',
                                               side_effect=AssertionError('Unexpected Git read')):
                with self.assertRaises(ValueError):
                    read_source_snapshot(self.root, {name: entry})

    def test_size_is_checked_before_reading_content(self):
        entry = self.descriptor(b'x' * (MAX_FILE_BYTES + 1))
        original = subprocess.run
        calls = []
        def run(args, **kwargs):
            calls.append(args[-1])
            return original(args, **kwargs)
        with patch('source_snapshot_fixture.subprocess.run', side_effect=run):
            with self.assertRaisesRegex(ValueError, 'bound'):
                read_source_snapshot(self.root, {'oversized': entry})
        self.assertEqual(calls, ['--batch-check'])

    def test_git_environment_cannot_redirect_the_snapshot_repository(self):
        entry = self.descriptor(b'pinned')
        with patch.dict(os.environ, {'GIT_DIR': '/does-not-exist', 'GIT_CONFIG_COUNT': '1',
                                     'GIT_CONFIG_KEY_0': 'core.worktree',
                                     'GIT_CONFIG_VALUE_0': '/does-not-exist'}):
            self.assertEqual(read_source_snapshot(self.root, {'file': entry}), {'file': b'pinned'})


if __name__ == '__main__':
    unittest.main()
