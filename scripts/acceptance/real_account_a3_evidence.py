"""Admit only the fixed, completed bounded A3 read and private PNG receipt.

This reviewed operator anchor cannot perform or discover account operations.
The historical A1/A2 consumers and their receipt bytes stay independent.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess

from . import real_account_a1_evidence as receipts


BUNDLE = 'docs/live-probes/run95-a3-bound-overview-and-private-png-2026-10-27'
IMPORT_SHA256 = 'dfc5a9f0c9fc4e97f4f4a26d95458e8b36a20efe4756c849a5bbd1d4dab73743'
SOURCE_REVISION = '2ec9b165900f538aeafd3ce897528b58d759f31b'
TOOLS = ('bangumi.get_collection_intelligence', 'bangumi.render_collection_intelligence')
REFERENCE = BUNDLE + '/a3-result.json'
RUNTIME_PATHS = ('apps', 'packages', 'pnpm-lock.yaml', 'docs/tool-catalog.json',
                 'tsconfig.base.json', 'tsconfig.json', 'pnpm-workspace.yaml', '.npmrc')
RENDER_ASSETS = 'packages/renderer/assets'
MAX_SOURCE_BYTES = 8 * 1024 * 1024


def _current_sources_match(root, manifest, sources, package_runtime):
    receipts._git(root, 'merge-base', '--is-ancestor', SOURCE_REVISION, 'HEAD')
    tree = receipts._git(root, 'ls-tree', '-r', 'HEAD', '--', *RUNTIME_PATHS).strip()
    if hashlib.sha256(tree.encode()).hexdigest() != manifest['runtimeTreeSha256']:
        return False
    blobs = {}
    for line in tree.splitlines():
        metadata, name = line.split('\t', 1)
        mode, kind, blob = metadata.split(' ')
        if mode not in ('100644', '100755') or kind != 'blob':
            return False
        blobs[name] = blob
    if set(blobs) != set(sources):
        return False
    for name, expected in sources.items():
        if (blobs[name] != expected['gitBlob'] or
                hashlib.sha256(receipts._read_regular(root, name, MAX_SOURCE_BYTES)).hexdigest()
                != expected['sha256']):
            return False
    # These source loaders discover files dynamically. Untracked additions must
    # not inherit evidence merely because Git's tree still matches.
    migrations = root / receipts.SQLITE_MIGRATIONS
    assets = root / RENDER_ASSETS
    if any(p.is_symlink() or not p.is_dir() for p in (migrations, assets)):
        return False
    expected_sql = {p for p in sources if p.startswith(receipts.SQLITE_MIGRATIONS + '/') and p.endswith('.sql')}
    if {str(p.relative_to(root)) for p in migrations.iterdir() if p.name.endswith('.sql')} != expected_sql:
        return False
    expected_assets = {p for p in sources if p.startswith(RENDER_ASSETS + '/')}
    actual_assets = {str(p.relative_to(root)) for p in assets.rglob('*') if p.is_symlink() or not p.is_dir()}
    if actual_assets != expected_assets:
        return False
    # Governance/test commands may evolve without changing the executed graph.
    # Every other root package field remains pinned in both HEAD and on disk.
    for package in (json.loads(receipts._git(root, 'show', 'HEAD:package.json')),
                    json.loads(receipts._read_regular(root, 'package.json'))):
        package.pop('scripts', None)
        if package != package_runtime:
            return False
    return True


def real_account_overview_sources(root: Path, catalog: list[dict]) -> dict[str, set[str]]:
    """Credit these two partial-sample observations, or none on any drift."""
    root = Path(root)
    try:
        raw = receipts._read_regular(root, BUNDLE + '/import.json')
        if hashlib.sha256(raw).hexdigest() != IMPORT_SHA256:
            return {}
        manifest = json.loads(raw)
        evidence = {}
        for name, digest in manifest['evidenceFiles'].items():
            raw = receipts._read_regular(root, BUNDLE + '/' + name)
            if hashlib.sha256(raw).hexdigest() != digest:
                return {}
            evidence[name] = json.loads(raw)
        if not _current_sources_match(root, manifest, evidence['source-files.json'],
                                      evidence['root-package-runtime.json']):
            return {}
        if catalog != json.loads(receipts._read_regular(root, 'docs/tool-catalog.json', 4 * 1024 * 1024)):
            return {}
        eligible = {tool['name'] for tool in catalog if tool['name'] in TOOLS
                    and tool.get('auth') != 'none' and tool.get('risk') == 'read'}
        if eligible != set(TOOLS):
            return {}
        return {name: {REFERENCE} for name in TOOLS}
    except (OSError, ValueError, KeyError, TypeError, AttributeError, subprocess.SubprocessError):
        return {}
