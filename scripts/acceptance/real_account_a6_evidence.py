"""Admit only the two fixed, completed A6 non-anime series read/PNG proofs.

The reviewed operator anchor performs no private operation. Frozen A1/A2/A3/A4/A5
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

BUNDLE = 'docs/live-probes/run95-a6-series-and-private-png-2026-10-28'
IMPORT_SHA256 = '79ef447e941e32b2b42ea9a7b3ed49bd2cd698fd5e32d70a4db9dc37d3152e78'
TOOLS = ('bangumi.get_collection_series_groups', 'bangumi.render_collection_series_groups')
REFERENCE = BUNDLE + '/a6-result.json'


def real_account_series_sources(root: Path, catalog: list[dict]) -> dict[str, set[str]]:
    """Credit these two bounded partial non-anime-sample observations, or none on any drift."""
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
