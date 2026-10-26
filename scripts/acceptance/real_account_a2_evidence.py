"""Admit one successful selection from the fixed, failed and spent A2 batch.

This is reviewed operator evidence, not a signature or a new account call.
Reuse the frozen A1 import's bounded file/source primitives, never its credit
mapping or older execution revision as the authority for this receipt.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess

from . import real_account_a1_evidence as receipts


BUNDLE = 'docs/live-probes/run95-a2-partial-account-read-2026-10-27'
IMPORT_SHA256 = 'dd7147b813fd0694e3357bd339dead8123e4a8710eb97eeb2f6247540e428379'
SOURCE_REVISION = '2ec9b165900f538aeafd3ce897528b58d759f31b'
TOOL = 'bangumi.list_collections'
REFERENCE = BUNDLE + '/a2-result.json'


def real_account_collection_sources(root: Path, catalog: list[dict]) -> dict[str, set[str]]:
    """Return only the bounded selection credit, or none on any relevant drift.

    The exact pinned failed-total receipt plus the pinned operator entry's
    ordered control flow establish selection success before render attempt.
    They do not establish a successful render or the cause of its failure.
    This consumer opens no runtime state, credentials, network or private data.
    """
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
        # The shared primitive also requires historical A1 ancestry. This
        # additional exact A2 ancestry requirement must precede its reuse.
        receipts._git(root, 'merge-base', '--is-ancestor', SOURCE_REVISION, 'HEAD')
        if not receipts._current_sources_match(root, evidence['source-files.json']):
            return {}
        if catalog != json.loads(receipts._read_regular(root, 'docs/tool-catalog.json', 4 * 1024 * 1024)):
            return {}
        eligible = {tool['name'] for tool in catalog if tool['name'] == TOOL
                    and tool.get('auth') != 'none' and tool.get('risk') == 'read'}
        if eligible != {TOOL}:
            return {}
        return {TOOL: {REFERENCE}}
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError):
        return {}
