"""Admit only the four fixed, completed A4 backlog/schedule read/PNG proofs.

The reviewed operator anchor performs no private operation. Frozen A1/A2/A3
consumers and bundles retain their independent exact receipts.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess
from . import real_account_a1_evidence as receipts
from .real_account_a3_evidence import (
    SOURCE_REVISION, RUNTIME_PATHS, RENDER_ASSETS, MAX_SOURCE_BYTES, _current_sources_match,
)

BUNDLE = 'docs/live-probes/run95-a4-backlog-schedule-and-private-pngs-2026-10-27'
IMPORT_SHA256 = '99d5444211be4995d0afee50530ec1110ccccd36523c9d75f2e9f08e69a7894f'
TOOLS = (
    'bangumi.get_collection_backlog',
    'bangumi.render_collection_backlog',
    'bangumi.get_collection_schedule',
    'bangumi.render_collection_schedule',
)
REFERENCE = BUNDLE + "/a4-result.json"


def real_account_backlog_schedule_sources(root: Path, catalog: list[dict]) -> dict[str, set[str]]:
    """Credit these four conflict/partial bounded observations, or none on any drift."""
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
