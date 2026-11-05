"""One sealed real-TIM observation; no client, runner or execution capability.

Keep the legacy public-render/m1 reader independent. This reviewed operator
anchor admits only the completed November 5 native calendar journey, with the
same executed runtime graph. It is not generic future-image compatibility or
cryptographic execution attestation.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess

from . import real_account_a1_evidence as receipts
from .real_account_a3_evidence import _current_sources_match, RUNTIME_PATHS

REFERENCE = 'docs/live-probes/pariya-agent-production-client-e2e-2026-11-05-native-tim-calendar.json'
IMPORT_SHA256 = 'ca9c6ca24a5e3bed9c26fa3dc921ff4c379248fa76dd6b89eeeaf49790cd01ca'
BUNDLE = 'docs/live-probes/run95-native-tim-calendar-2026-11-05'
SOURCE_BUNDLE = 'docs/live-probes/run95-a7-native-episode-collection-read-2026-10-28'
SOURCE_REVISION = 'bfe1229d03edac0c7e218f442b2d746254cb4c4c'
IMAGE = 'sha256:9c0784bff3ef39fa5c30639f07e3b86b4be634c2cecf854679e9920f9517014a'
TOOL = 'bangumi.render_calendar'
PHASES = ['candidate', 'received', 'submitted', 'result', 'rendering', 'sending', 'sent']


def native_tim_calendar_status(root: Path, catalog: list[dict], relative: str) -> tuple[bool, bool]:
    """Credit the fixed QQ + TIM pair, or neither on any provenance drift."""
    if relative != REFERENCE:
        return False, False
    root = Path(root)
    try:
        raw = receipts._read_regular(root, REFERENCE)
        if hashlib.sha256(raw).hexdigest() != IMPORT_SHA256:
            return False, False
        report = json.loads(raw)
        loaded = {}
        for name, digest in report['evidenceFiles'].items():
            raw = receipts._read_regular(root, name)
            if hashlib.sha256(raw).hexdigest() != digest:
                return False, False
            loaded[name] = json.loads(raw)
        receipts._git(root, 'merge-base', '--is-ancestor', SOURCE_REVISION, 'HEAD')
        sources = loaded[SOURCE_BUNDLE + '/source-files.json']
        # Optional selected files absent at execution must stay absent on disk.
        # Git's tree cannot detect a newly added untracked .npmrc (or a link,
        # directory, FIFO, etc.). The two source-directory roots are different:
        # their manifested entries are checked by the shared matcher below.
        for relative_path in RUNTIME_PATHS:
            if relative_path in ('apps', 'packages') or relative_path in sources:
                continue
            path = root / relative_path
            if path.exists() or path.is_symlink():
                return False, False
        if not _current_sources_match(
            root, report, sources,
            loaded[SOURCE_BUNDLE + '/root-package-runtime.json'],
        ):
            return False, False
        # The shared historical checker excludes root scripts. For this import
        # permit only the acceptance command added to exercise this consumer;
        # build/start and every other script remain bound to the executed source.
        executed_package = json.loads(receipts._git(root, 'show', SOURCE_REVISION + ':package.json'))
        expected_scripts = executed_package['scripts']
        expected_scripts.pop('acceptance:check', None)
        for package in (json.loads(receipts._git(root, 'show', 'HEAD:package.json')),
                        json.loads(receipts._read_regular(root, 'package.json'))):
            scripts = package['scripts']
            scripts.pop('acceptance:check', None)
            if scripts != expected_scripts:
                return False, False
        raw_catalog = receipts._read_regular(root, 'docs/tool-catalog.json', 4 * 1024 * 1024)
        if (hashlib.sha256(raw_catalog).hexdigest() != report['catalogSha256']
                or catalog != json.loads(raw_catalog)
                or not any(t.get('name') == TOOL and t.get('auth') == 'none'
                           and t.get('risk') == 'read' for t in catalog)):
            return False, False
        observation = loaded[BUNDLE + '/native-ui-evidence.json']
        source = observation['productionSource']
        pipeline = observation['qqPipeline']
        client = observation['computerUse']
        passed = (
            observation['tool'] == TOOL
            and observation['client'] == 'TIM'
            and observation['gatewayStatus'] == 'OK'
            and observation['toolCalls'] == [{'server': 'bangumi', 'name': TOOL, 'state': 'DONE'}]
            and type(observation['toolErrors']) is int and observation['toolErrors'] == 0
            and type(observation['modelsDelta']) is int and observation['modelsDelta'] == 1
            and source['nativeImage'] == IMAGE and source['nativeUpstream'] == SOURCE_REVISION
            and pipeline['phases'] == PHASES
            and pipeline['duplicates'] is False and pipeline['uncertain'] is False
            and type(pipeline['orderingViolations']) is int and pipeline['orderingViolations'] == 0
            and all(client.get(key) is True for key in (
                'inputObserved', 'textDisplayed', 'imageDisplayed', 'imageOpened',
                'topAndBottomInspected', 'recipientIsOriginalBot', 'onlyAuthorizedConversation',
            ))
            and all(observation['privacy'].get(key) is False for key in (
                'messageBodyStored', 'replyBodyStored', 'qqIdStored', 'screenshotStored',
                'credentialsStored', 'sessionIdentityStored',
            ))
        )
        return passed, passed
    except (OSError, ValueError, KeyError, TypeError, AttributeError, subprocess.SubprocessError):
        return False, False
