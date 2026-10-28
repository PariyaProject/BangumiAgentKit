"""Sealed source compatibility for eleven old stdio observations; no new execution.

The original consumers remain strict and byte-identical. This separate reviewed
operator anchor admits old execution + new dependency-compatibility references
only for the closed, natively exercised source/input graph below. It is not a
runner signature, new account acceptance, or proof for HTTP/browser/all inputs.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess

from . import real_account_a1_evidence as receipts
from .real_account_a3_evidence import _current_sources_match, MAX_SOURCE_BYTES

BUNDLE = 'docs/live-probes/run95-qs55-stdio-compatibility-2026-10-28'
IMPORT_SHA256 = '0d8a8eea37a20f8a9ebf20dd04667dd95cfb0623fc22d78a76f19ad0a26eec58'
REFERENCE = BUNDLE + '/import.json'
TOOLS = frozenset((
    'bangumi.list_collections',
    'bangumi.get_collection_intelligence', 'bangumi.render_collection_intelligence',
    'bangumi.get_collection_backlog', 'bangumi.render_collection_backlog',
    'bangumi.get_collection_schedule', 'bangumi.render_collection_schedule',
    'bangumi.get_collection_dashboard', 'bangumi.render_collection_dashboard',
    'bangumi.get_collection_series_groups', 'bangumi.render_collection_series_groups',
))


def _fixed_files(root, files):
    """Match reviewed bytes/modes in HEAD AND on disk, without following links."""
    tree = receipts._git(root, 'ls-tree', '-r', 'HEAD', '--', *files)
    entries = {}
    for line in tree.splitlines():
        metadata, name = line.split('\t', 1)
        mode, kind, blob = metadata.split(' ')
        if mode != '100644' or kind != 'blob':
            return False
        entries[name] = blob
    if set(entries) != set(files):
        return False
    for name, expected in files.items():
        raw = receipts._read_regular(root, name, MAX_SOURCE_BYTES)
        if (hashlib.sha256(raw).hexdigest() != expected or
                hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() != entries[name]):
            return False
    return True


def _native_proof_matches(proof, inputs):
    if (proof.get('schema') != 'qs55-isolated-compiled-proof/v1' or proof.get('passed') is not True or
            proof.get('version') != '6.16.1' or proof.get('containerNetwork') != 'none' or
            proof.get('realDataMounts') != 0 or proof.get('actualAccountActions') != 0 or
            proof.get('modelCalls') != 0 or proof.get('clientMessages') != 0 or
            proof.get('originalParentPreserved') is not True or proof.get('containerRemoved') is not True):
        return False
    runs = proof['runs']
    if [r['mode'] for r in runs] != ['normal', 'require', 'import', 'preloaded'] or any(r['passed'] is not True for r in runs):
        return False
    normal = runs[0]
    native = normal['native']
    if (normal['exitStatus'] != 0 or native['passed'] is not True or native['exactInputs'] != inputs or
            native['fakeStorage'] is not True or native['mcpClosed'] is not True or native['workspaceRemoved'] is not True or
            native['failureStage'] is not None or len(native['results']) != 11):
        return False
    if [r['name'] for r in native['results']] != [i['name'] for i in inputs]:
        return False
    if any(r['ok'] is not True or r['nativePngDecoded'] is not r['name'].startswith('bangumi.render_') for r in native['results']):
        return False
    for role in ('controller', 'server'):
        trace = normal[role]
        if (trace['role'] != role or trace['started'] is not True or trace['hooksReady'] is not True or
                trace['initialCached'] != 0 or trace['finalCached'] != 0 or trace['attempts'] != 0 or
                trace['finalized'] is not True or trace['cleanExit'] is not True):
            return False
    provider = normal['provider']
    if (provider['denied'] != 0 or provider['assetAttempts'] != 0 or provider['renderCalls'] != 5 or
            provider['cacheWrites'] != 0 or provider['privateCacheDisabled'] is not True or not provider['calls']):
        return False
    for run in runs[1:]:
        if (run['exitStatus'] == 0 or run['native']['passed'] is not False or
                run['native']['workspaceRemoved'] is not True or run['native']['results']):
            return False
        if run['mode'] == 'preloaded':
            if run['server']['initialCached'] < 1 or run['server']['hooksReady'] is not False:
                return False
        elif run['server']['attempts'] < 1:
            return False
    return proof['imageDelta']['onlyQsArtifactAndResolutionLinksChanged'] is True


def qs55_compatible_account_sources(root: Path, catalog: list[dict]) -> dict[str, set[str]]:
    """Return exactly old eleven receipts + compatibility ref, or no credit."""
    root = Path(root)
    try:
        raw = receipts._read_regular(root, REFERENCE)
        if hashlib.sha256(raw).hexdigest() != IMPORT_SHA256:
            return {}
        manifest = json.loads(raw)
        loaded = {}
        for name, expected in manifest['evidenceFiles'].items():
            data = receipts._read_regular(root, BUNDLE + '/' + name)
            if hashlib.sha256(data).hexdigest() != expected:
                return {}
            loaded[name] = json.loads(data)
        frozen = loaded['frozen-files.json']
        if len(frozen) != 53 or not _fixed_files(root, frozen):
            return {}
        proof = loaded['native-proof.json']
        if not _fixed_files(root, proof['producerFiles']):
            return {}
        # Verify the complete original graph first: only the exact known lock
        # bytes and root override may differ; the new graph is separately pinned.
        old_bundle = 'docs/live-probes/run95-a3-bound-overview-and-private-png-2026-10-27'
        old_sources = json.loads(receipts._read_regular(root, old_bundle + '/source-files.json'))
        sources = loaded['source-files.json']
        if (set(sources) != set(old_sources) or len(sources) != 285 or
                {p: s for p, s in sources.items() if p != 'pnpm-lock.yaml'} !=
                {p: s for p, s in old_sources.items() if p != 'pnpm-lock.yaml'}):
            return {}
        package = loaded['root-package-runtime.json']
        old_package = json.loads(receipts._read_regular(root, old_bundle + '/root-package-runtime.json'))
        old_package['pnpm']['overrides']['qs'] = '6.16.1'
        if package != old_package or not _current_sources_match(root, manifest, sources, package):
            return {}
        inputs, references = [], {}
        for path in sorted(p for p in frozen if p.endswith('/import.json') and '/run95-a1-' not in p):
            historical = json.loads(receipts._read_regular(root, path))
            group = Path(path).parent
            label = group.name.split('-')[1]
            for item in historical['admittedTools']:
                inputs.append(item)
                references[item['name']] = str(group / (label + '-result.json'))
        if (len(inputs) != 11 or set(references) != TOOLS or not _native_proof_matches(proof, inputs) or
                catalog != json.loads(receipts._read_regular(root, 'docs/tool-catalog.json', 4 * 1024 * 1024))):
            return {}
        eligible = {t['name'] for t in catalog if t['name'] in TOOLS and t.get('auth') != 'none' and t.get('risk') == 'read'}
        if eligible != TOOLS:
            return {}
        return {name: {reference, REFERENCE} for name, reference in references.items()}
    except (OSError, ValueError, KeyError, TypeError, AttributeError, subprocess.SubprocessError):
        return {}
