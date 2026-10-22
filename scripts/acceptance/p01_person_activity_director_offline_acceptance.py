"""Shared verifier for the signed, Harness-acknowledged P01 director matrix report."""

from __future__ import annotations

import base64
import hashlib
import json
import subprocess
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
PROFILE_REGISTRY_PATH = ROOT / 'scripts/acceptance/agent-mcp-profile-registry.json'
PROFILE_REGISTRY = json.loads(PROFILE_REGISTRY_PATH.read_text(encoding='utf-8'))
PROFILE_ID = 'p01-person-director-offline-matrix-v1-20261023'
PROFILE = next(
    item for item in PROFILE_REGISTRY.get('profiles', [])
    if isinstance(item, dict) and item.get('id') == PROFILE_ID
)
REPORT_VALIDATOR = ROOT / 'scripts/acceptance/validate-p01-person-activity-director-offline-report.mjs'


def _canonical_sha256(value: Any) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    return hashlib.sha256(encoded.encode('utf-8')).hexdigest()


def p01_person_activity_director_offline_harness_status(
    pr_number: object,
    *,
    root: Path = ROOT,
) -> dict[str, Any] | None:
    """Read the durable profile disposition and both permanent Harness latches."""
    if type(pr_number) is not int or pr_number < 1:
        return None
    try:
        result = subprocess.run(
            [
                'node', str(root / 'scripts/agent-harness.mjs'),
                'epoch:agent-mcp-profile-status',
                '--run', '95', '--pr', str(pr_number), '--profile-id', PROFILE_ID,
            ],
            cwd=root,
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        if result.returncode != 0:
            return None
        value = json.loads(result.stdout)
    except (OSError, subprocess.TimeoutExpired, ValueError):
        return None
    return value if isinstance(value, dict) else None


def p01_person_activity_director_offline_acknowledged_claim(
    report: object,
    harness_status: object,
    report_sha256: object,
) -> dict[str, Any] | None:
    """Match the report's exact bytes and identity to the active terminal Harness claim."""
    if not isinstance(report, dict) or not isinstance(harness_status, dict):
        return None
    receipt = report.get('runnerReceipt')
    disposition = harness_status.get('disposition')
    if (
        harness_status.get('state') != 'REPORT_WRITTEN'
        or harness_status.get('profile_id') != PROFILE_ID
        or harness_status.get('run') != 95
        or harness_status.get('pr') != report.get('prNumber')
        or harness_status.get('epoch_id') != PROFILE.get('epochId')
        or harness_status.get('frontier_id') != 'P01'
        or harness_status.get('tool_name') != PROFILE.get('toolName')
        or harness_status.get('argument_profile') != PROFILE.get('argumentProfile')
        or harness_status.get('expected_arguments_sha256') != _canonical_sha256(
            [call['arguments'] for call in PROFILE.get('calls', [])]
        )
        or harness_status.get('registry_sha256') != _canonical_sha256(PROFILE)
        or harness_status.get('claim_label_present') is not True
        or harness_status.get('terminal_label_present') is not True
        or not isinstance(disposition, dict)
        or not isinstance(receipt, dict)
        or type(report_sha256) is not str
        or len(report_sha256) != 64
    ):
        return None

    expected = {
        'claimId': report.get('claimId'),
        'profileId': PROFILE_ID,
        'frontierId': 'P01',
        'epochId': PROFILE['epochId'],
        'runNumber': 95,
        'prNumber': report.get('prNumber'),
        'state': 'REPORT_WRITTEN',
        'sourceCandidateSha': report.get('sourceRevision'),
        'baseSha': report.get('baseSha'),
        'ciSha': report.get('ciSha'),
        'ciStatus': report.get('ciStatus'),
        'ciRunId': report.get('ciRunId'),
        'ciChecks': report.get('ciChecks'),
        'reviewerId': report.get('reviewerId'),
        'bundleSha256': report.get('mcpBundleSha256'),
        'registrySha256': report.get('registrySha256'),
        'toolName': PROFILE['toolName'],
        'argumentProfile': PROFILE['argumentProfile'],
        'expectedArgumentsSha256': _canonical_sha256(
            [call['arguments'] for call in PROFILE.get('calls', [])]
        ),
        'reportWritten': True,
        'reportPath': PROFILE['reportPath'],
        'reportSha256': report_sha256,
        'retryAllowed': False,
        'runnerReceiptPublicKey': receipt.get('publicKeyBase64'),
        'runnerReceiptPublicKeySha256': receipt.get('publicKeySha256'),
        'runnerReceiptSha256': _canonical_sha256(receipt),
    }
    if any(disposition.get(key) != value for key, value in expected.items()):
        return None
    return disposition


def p01_person_activity_director_offline_signed_report_matches(
    report: object,
    report_path: Path,
    *,
    harness_status: object = None,
    root: Path = ROOT,
) -> bool:
    """Require exact report bytes, the active REPORT_WRITTEN latch, and Ed25519 validation."""
    if not isinstance(report, dict):
        return False
    try:
        path = report_path.resolve()
        relative_path = path.relative_to(root.resolve()).as_posix()
        report_bytes = path.read_bytes()
        persisted_report = json.loads(report_bytes)
    except (OSError, ValueError, TypeError):
        return False
    if (
        relative_path != PROFILE.get('reportPath')
        or persisted_report != report
        or len(report_bytes) > 64 * 1024
    ):
        return False

    status = harness_status
    if status is None:
        status = p01_person_activity_director_offline_harness_status(report.get('prNumber'), root=root)
    report_sha256 = hashlib.sha256(report_bytes).hexdigest()
    claim = p01_person_activity_director_offline_acknowledged_claim(report, status, report_sha256)
    if claim is None:
        return False

    try:
        validation = subprocess.run(
            ['node', str(REPORT_VALIDATOR)],
            cwd=ROOT,
            input=json.dumps({
                'claim': claim,
                'reportBytesBase64': base64.b64encode(report_bytes).decode('ascii'),
                'root': str(root.resolve()),
            }),
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        if validation.returncode != 0:
            return False
        result = json.loads(validation.stdout)
    except (OSError, subprocess.TimeoutExpired, ValueError):
        return False
    return result.get('passed') is True and result.get('reportSha256') == report_sha256
