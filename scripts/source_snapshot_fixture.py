"""Test-only historical source snapshots, independent of current checkout bytes.

The small interface returns verified bytes; callers own their temporary output.
This does not grant acceptance, change a receipt or substitute a Git tree.
"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path, PurePosixPath
import re
import subprocess

MAX_FILE_BYTES = 8 * 1024 * 1024
MAX_TOTAL_BYTES = 64 * 1024 * 1024
MAX_FILES = 512


def read_source_snapshot(repository: Path, manifest: dict) -> dict[str, bytes]:
    """Read sealed Git blobs; reject bad paths, objects, sizes or content hashes.

    Uses two bounded local Git reads, never HEAD/worktree source or the network.
    Git repository/config overrides and object replacement are disabled.
    """
    if not isinstance(manifest, dict) or not 1 <= len(manifest) <= MAX_FILES:
        raise ValueError('Invalid snapshot file inventory')
    entries = []
    for name, entry in manifest.items():
        if (not isinstance(name, str) or not name or len(name) > 1024
                or any(c in name for c in ('\0', '\n', '\r', '\\', ':'))
                or not PurePosixPath(name).parts
                or PurePosixPath(name).is_absolute()
                or str(PurePosixPath(name)) != name
                or any(p in ('.', '..', '.git') for p in PurePosixPath(name).parts)
                or not isinstance(entry, dict)
                or not isinstance(entry.get('gitBlob'), str)
                or re.fullmatch(r'[0-9a-f]{40}', entry['gitBlob']) is None
                or not isinstance(entry.get('sha256'), str)
                or re.fullmatch(r'[0-9a-f]{64}', entry['sha256']) is None):
            raise ValueError('Invalid snapshot file descriptor')
        entries.append((name, entry['gitBlob'], entry['sha256']))
    env = {k: v for k, v in os.environ.items() if not k.startswith('GIT_')}
    env.update(GIT_CONFIG_GLOBAL=os.devnull, GIT_CONFIG_SYSTEM=os.devnull,
               GIT_CONFIG_NOSYSTEM='1', GIT_NO_REPLACE_OBJECTS='1',
               GIT_NO_LAZY_FETCH='1', GIT_TERMINAL_PROMPT='0')
    request = ''.join(blob + '\n' for _, blob, _ in entries).encode('ascii')

    def batch(flag):
        return subprocess.run(
            ['git', '-C', str(repository), 'cat-file', flag], input=request,
            capture_output=True, check=True, timeout=20, env=env,
        ).stdout

    headers = batch('--batch-check').splitlines()
    if len(headers) != len(entries):
        raise ValueError('Incomplete snapshot object inventory')
    sizes = []
    for (_, blob, _), header in zip(entries, headers):
        fields = header.split()
        if len(fields) != 3 or fields[:2] != [blob.encode(), b'blob'] or not fields[2].isdigit():
            raise ValueError('Snapshot object is missing or not a blob')
        size = int(fields[2])
        if size > MAX_FILE_BYTES:
            raise ValueError('Snapshot file exceeds bound')
        sizes.append(size)
    if sum(sizes) > MAX_TOTAL_BYTES:
        raise ValueError('Snapshot exceeds total bound')
    payload = batch('--batch')
    result, offset = {}, 0
    for (name, blob, expected), size in zip(entries, sizes):
        header = f'{blob} blob {size}\n'.encode()
        if not payload.startswith(header, offset):
            raise ValueError('Snapshot object header changed')
        offset += len(header)
        data = payload[offset:offset + size]
        offset += size
        if (len(data) != size or payload[offset:offset + 1] != b'\n'
                or hashlib.sha256(data).hexdigest() != expected):
            raise ValueError('Snapshot content does not match its seal')
        offset += 1
        result[name] = data
    if offset != len(payload):
        raise ValueError('Unexpected snapshot bytes')
    return result
