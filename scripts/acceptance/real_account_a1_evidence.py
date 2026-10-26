"""Import one historical live A1 receipt; this module cannot execute account calls.

The reviewed digest is an explicit operator-evidence trust anchor, not a runner
signature. Other reports, new names, and future executions are never discovered.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess


BUNDLE = 'docs/live-probes/run95-a1-bound-reads-2026-10-26'
IMPORT_SHA256 = '36520755f9ab480bf36721306c6550687118824b61d8b6930573ab677b1b5c20'
SOURCE_REVISION = 'e0810dad9e57f35cbeca63de35cf7a97d745d712'
TOOLS = ('bangumi.get_my_profile', 'bangumi.list_collections')
REFERENCE = BUNDLE + '/a1-result.json'
SQLITE_MIGRATIONS = 'packages/db/src/drizzle/sqlite/migrations'


def _read_regular(root: Path, relative: str, limit: int = 64 * 1024) -> bytes:
    """Bound reads and reject links/nonregular objects, including parent links."""
    parts = Path(relative).parts
    if not parts or Path(relative).is_absolute() or any(p in ('.', '..') for p in parts):
        raise ValueError('Invalid evidence path')
    current = root
    for part in parts:
        current = current / part
        if current.is_symlink():
            raise ValueError('Evidence links are not accepted')
    fd = os.open(current, os.O_RDONLY | os.O_NONBLOCK | getattr(os, 'O_NOFOLLOW', 0))
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_size > limit:
            raise ValueError('Invalid evidence file')
        with os.fdopen(fd, 'rb') as stream:
            fd = None
            raw = stream.read(limit + 1)
        if len(raw) > limit:
            raise ValueError('Evidence is too large')
        return raw
    finally:
        if fd is not None:
            os.close(fd)


def _git(root: Path, *args: str) -> str:
    return subprocess.run(
        ['git', '-C', str(root), *args], capture_output=True, text=True,
        timeout=10, check=True,
    ).stdout


def _current_sources_match(root: Path, sources: dict) -> bool:
    # Historical evidence remains useful across unrelated commits, but neither
    # committed nor uncommitted changes to the executed contracts inherit it.
    _git(root, 'merge-base', '--is-ancestor', SOURCE_REVISION, 'HEAD')
    # The migrator discovers .sql files dynamically. Query the whole tracked
    # directory as well as known files, and compare the on-disk membership, so
    # an added committed or untracked migration cannot inherit old evidence.
    directory = root / SQLITE_MIGRATIONS
    if directory.is_symlink() or not directory.is_dir():
        return False
    expected_sql = {name for name in sources
                    if name.startswith(SQLITE_MIGRATIONS + '/') and name.endswith('.sql')}
    current_sql = {str(path.relative_to(root)) for path in directory.iterdir()
                   if path.name.endswith('.sql')}
    if current_sql != expected_sql:
        return False
    tree = _git(root, 'ls-tree', '-r', 'HEAD', '--', *sources, SQLITE_MIGRATIONS)
    blobs = {}
    for line in tree.splitlines():
        mode_kind_blob, name = line.split('\t', 1)
        mode, kind, blob = mode_kind_blob.split(' ')
        if mode not in ('100644', '100755') or kind != 'blob':
            return False
        blobs[name] = blob
    if set(blobs) != set(sources):
        return False
    return all(
        blobs[name] == expected['gitBlob']
        and hashlib.sha256(_read_regular(root, name, 4 * 1024 * 1024)).hexdigest()
        == expected['sha256']
        for name, expected in sources.items()
    )


def real_account_read_sources(root: Path, catalog: list[dict]) -> dict[str, set[str]]:
    """Credit exactly the two bounded reads, or return no credit on any drift.

    No runtime DB/config, credentials, GitHub API or user data is opened. This
    consumes byte-identical, previously sanitized evidence only.
    """
    root = Path(root)
    try:
        raw = _read_regular(root, BUNDLE + '/import.json')
        if hashlib.sha256(raw).hexdigest() != IMPORT_SHA256:
            return {}
        manifest = json.loads(raw)
        # The pinned manifest is a closed historical allowlist, not an arbitrary
        # path/digest manifest supplied by a report author at generation time.
        evidence = {}
        for name, digest in manifest['evidenceFiles'].items():
            raw = _read_regular(root, BUNDLE + '/' + name)
            if hashlib.sha256(raw).hexdigest() != digest:
                return {}
            evidence[name] = json.loads(raw)
        sources = evidence['source-files.json']
        if not _current_sources_match(root, sources):
            return {}
        if catalog != json.loads(_read_regular(root, 'docs/tool-catalog.json', 4 * 1024 * 1024)):
            return {}
        # Result/plan/postconditions are byte-pinned above. They prove the live
        # two-tool batch, current trusted binding, COMPLETE claim and cleanup;
        # synthetic/partial/extra-field mutations fail before this mapping.
        eligible = {tool['name'] for tool in catalog if tool['name'] in TOOLS
                    and tool.get('auth') != 'none' and tool.get('risk') == 'read'}
        if eligible != set(TOOLS):
            return {}
        return {name: {REFERENCE} for name in TOOLS}
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError):
        return {}
