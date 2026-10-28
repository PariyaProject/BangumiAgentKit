"""Admit one fixed, completed native episode read; no private execution path.

This is a reviewed operator-evidence anchor, not an execution signature. The
partial one-row observation cannot establish complete subject/account progress.
All frozen A1-A6 consumers and the separate qs55 compatibility remain unchanged.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess

from . import real_account_a1_evidence as receipts
from .real_account_a3_evidence import _current_sources_match, RUNTIME_PATHS, MAX_SOURCE_BYTES

BUNDLE = 'docs/live-probes/run95-a7-native-episode-collection-read-2026-10-28'
IMPORT_SHA256 = '6391caf66124e94a003763180ddebc69f40b580aab9aa03abfaa337a440e1a17'
SOURCE_REVISION = 'bfe1229d03edac0c7e218f442b2d746254cb4c4c'
TOOL = 'bangumi.get_episode_collections'
REFERENCE = BUNDLE + '/a7-result.json'


def real_account_episode_sources(root: Path, catalog: list[dict]) -> dict[str, set[str]]:
    """Credit only the sealed bounded A7 page, or none on any receipt/source drift."""
    root = Path(root)
    try:
        raw = receipts._read_regular(root, BUNDLE + '/import.json')
        if hashlib.sha256(raw).hexdigest() != IMPORT_SHA256:
            return {}
        manifest = json.loads(raw)
        evidence = {}
        for name, expected in manifest['evidenceFiles'].items():
            raw = receipts._read_regular(root, BUNDLE + '/' + name)
            if hashlib.sha256(raw).hexdigest() != expected:
                return {}
            evidence[name] = json.loads(raw)
        # The shared pure checker retains its historical ancestor contract;
        # additionally require the actual A7 executed business revision here.
        receipts._git(root, 'merge-base', '--is-ancestor', SOURCE_REVISION, 'HEAD')
        if not _current_sources_match(root, manifest, evidence['source-files.json'],
                                      evidence['root-package-runtime.json']):
            return {}
        if catalog != json.loads(receipts._read_regular(root, 'docs/tool-catalog.json', 4 * 1024 * 1024)):
            return {}
        eligible = {tool['name'] for tool in catalog if tool['name'] == TOOL
                    and tool.get('auth') != 'none' and tool.get('risk') == 'read'}
        return {TOOL: {REFERENCE}} if eligible == {TOOL} else {}
    except (OSError, ValueError, KeyError, TypeError, AttributeError, subprocess.SubprocessError):
        return {}
