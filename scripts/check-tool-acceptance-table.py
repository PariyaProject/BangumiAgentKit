#!/usr/bin/env python3
"""Validate the generated 96-tool acceptance table and claim-bound evidence."""

from __future__ import annotations

import hashlib
import json
import re
import runpy
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'docs/tool-catalog.json'
TABLE = ROOT / 'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md'
PROFILE_REGISTRY = json.loads(
    (ROOT / 'scripts/acceptance/agent-mcp-profile-registry.json').read_text(encoding='utf-8'),
)
G01_RENDER_QUERY_PROFILE_VERSIONS = {
    'g01-render-query-subjects-offline-agent-mcp-v1': 'v1',
    'g01-render-query-subjects-offline-agent-mcp-v2': 'v2',
}
G01_RENDER_QUERY_PROFILES = {
    profile.get('id'): profile
    for profile in PROFILE_REGISTRY.get('profiles', [])
    if isinstance(profile, dict)
    and profile.get('id') in G01_RENDER_QUERY_PROFILE_VERSIONS
    and profile.get('frontierId') == 'G01'
    and profile.get('toolName') == 'bangumi.render_query_subjects'
    and profile.get('acceptanceScope') == 'agent-mcp-matrix-only'
}
C03_PERSON_ACTIVITY_OFFLINE_V2_PROFILE = next(
    profile for profile in PROFILE_REGISTRY.get('profiles', [])
    if isinstance(profile, dict)
    and profile.get('id') == 'c03-person-activity-offline-agent-mcp-matrix-v2'
)
P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_PROFILE = next(
    profile for profile in PROFILE_REGISTRY.get('profiles', [])
    if isinstance(profile, dict)
    and profile.get('id') == 'p01-person-director-offline-matrix-v1-20261023'
)
RENDER_SUBJECT_CARD_OFFLINE_PROFILE = next(
    profile for profile in PROFILE_REGISTRY.get('profiles', [])
    if isinstance(profile, dict)
    and profile.get('id') == 'render-subject-card-compact-typography-agent-mcp-v3'
)
P03_V4_AGENT_MCP_PROFILE = next(
    profile for profile in PROFILE_REGISTRY.get('profiles', [])
    if isinstance(profile, dict)
    and profile.get('id') == 'p03-person-name-cn-agent-mcp-v4'
)
sys.path.insert(0, str(ROOT / 'scripts'))
from acceptance.c03_person_activity_offline_v2_acceptance import (
    c03_person_activity_offline_v2_signed_report_matches,
)
from acceptance.p01_person_activity_director_offline_acceptance import (
    p01_person_activity_director_offline_signed_report_matches,
)
from client_evidence import tool_client_e2e_sources
P06_V3_PROFILE_ID = 'p06-render-person-profile-offline-agent-mcp-v3'
P06_V3_PROFILE = next(
    profile for profile in PROFILE_REGISTRY.get('profiles', [])
    if isinstance(profile, dict) and profile.get('id') == P06_V3_PROFILE_ID
)
P06_ACCEPTANCE_GENERATOR = runpy.run_path(
    str(ROOT / 'scripts/generate-tool-acceptance-tasks.py'),
)
TOOL_ROW = re.compile(r'^\| `(bangumi\.[a-z0-9_]+)` \|')
SOURCE_REFERENCE = re.compile(r'`(?P<path>tests/[^`|:]+):(?P<line>[1-9][0-9]*)`')
LIVE_EVIDENCE_REFERENCE = re.compile(r'`(?P<path>docs/live-probes/[^`|]+\.json)`')
VALID_LIVE = {'◐', '—', '⬜'}
VALID_MARK = {'✅', '⬜', '—'}


def g01_render_query_report_matches(name: str, relative_path: str, report: object) -> bool:
    if not isinstance(report, dict):
        return False
    profile_id = report.get('profileId')
    profile = G01_RENDER_QUERY_PROFILES.get(profile_id)
    if profile is None:
        return False
    profile_version = G01_RENDER_QUERY_PROFILE_VERSIONS.get(profile_id)
    if profile_version is None:
        return False
    acknowledgement = (
        'G01_RENDER_QUERY_SYNTHETIC_OFFLINE_V2_OK'
        if profile_version == 'v2'
        else 'G01_RENDER_QUERY_SYNTHETIC_OFFLINE_OK'
    )
    fixture = report.get('offlineFixture')
    artifact = report.get('artifact')
    checks = report.get('answerChecks')
    return bool(
        name == profile['toolName']
        and relative_path == profile['reportPath']
        and report.get('evidenceKind') == profile['evidenceKind']
        and report.get('profile') == f'codex-luna-max-offline-agent-mcp-matrix-{profile_version}'
        and report.get('epochId') == profile['epochId']
        and report.get('runNumber') == 95
        and report.get('frontierId') == 'G01'
        and report.get('scenarioId') is None
        and report.get('resultStatus') == 'SUCCESS'
        and report.get('codexMcpToolEventCount') == 1
        and (
            (profile_version == 'v2' and report.get('mcpToolErrorResultCount') == 0)
            or (profile_version == 'v1' and 'mcpToolErrorResultCount' not in report)
        )
        and report.get('codexErrorItemCount') == 0
        and report.get('allowedCallCount') == 1
        and report.get('deniedCallCount') == 0
        and report.get('nonMcpToolEventCount') == 0
        and report.get('nonMcpToolTypes') == []
        and report.get('shellToolCallCount') == 0
        and report.get('toolName') == profile['toolName']
        and report.get('serverToolNames') == [profile['toolName']]
        and report.get('mcpServerNames') == ['bgk_g01_render_query']
        and report.get('networkMode') == profile['networkMode']
        and isinstance(fixture, dict)
        and fixture == {
            'profile': profile['networkMode'],
            'requestCount': 2,
            'searchRequestCount': 1,
            'subjectDetailRequestCount': 1,
            'duplicateRequestCount': 0,
            'unexpectedRequestCount': 0,
            'authorizationHeaderCount': 0,
            'expectedOperationsComplete': True,
            'rawFixturePayloadStored': False,
        }
        and report.get('offlineAssetBoundary') == {
            'assetResolutionCallCount': 0,
            'nonEmptyAssetUrlCount': 0,
            'blockedAssetRequestCount': 0,
        }
        and isinstance(report.get('networkBoundary'), dict)
        and report['networkBoundary'].get('liveBangumiApiRequestCount') == 0
        and report['networkBoundary'].get('rendererAssetRequestCount') == 0
        and isinstance(artifact, dict)
        and artifact.get('returned') is True
        and artifact.get('persisted') is False
        and artifact.get('mimeType') == 'image/png'
        and type(artifact.get('width')) is int
        and 0 < artifact['width'] <= 3000
        and type(artifact.get('height')) is int
        and 0 < artifact['height'] <= 5000
        and type(artifact.get('byteLength')) is int
        and 0 < artifact['byteLength'] <= 5_000_000
        and artifact.get('pngSignatureValid') is True
        and isinstance(checks, dict)
        and len(checks) == 10
        and all(value is True for value in checks.values())
        and report.get('answerCheckMethod') == profile['answerCheckMethod']
        and report.get('answerSha256') == hashlib.sha256(acknowledgement.encode()).hexdigest()
        and report.get('answerUtf8Bytes') == len(acknowledgement.encode())
    )


def render_subject_card_offline_agent_mcp_matches(
    name: str, relative_path: str, report: object,
) -> bool:
    """Map only the fixed synthetic render_subject_card call to its Agent/MCP cell."""
    if not isinstance(report, dict):
        return False
    profile = RENDER_SUBJECT_CARD_OFFLINE_PROFILE
    calls = profile.get('calls')
    expected_arguments = calls[0].get('arguments') if isinstance(calls, list) and len(calls) == 1 else None
    if not isinstance(expected_arguments, dict):
        return False
    registry_sha256 = hashlib.sha256(json.dumps(
        profile, sort_keys=True, separators=(',', ':'), ensure_ascii=False,
    ).encode('utf-8')).hexdigest()
    arguments_sha256 = hashlib.sha256(json.dumps(
        [call.get('arguments') for call in calls] if isinstance(calls, list) else None,
        sort_keys=True, separators=(',', ':'), ensure_ascii=False,
    ).encode('utf-8')).hexdigest()
    fixture = report.get('offlineFixture')
    asset = report.get('offlineAssetBoundary')
    artifact = report.get('artifact')
    checks = report.get('answerChecks')
    receipt = report.get('runnerReceipt')
    acknowledgement = b'RENDER_SUBJECT_CARD_SYNTHETIC_ARTIFACT_READY'
    expected_fixture = {
        'profile': profile.get('networkMode'),
        'expectedOperation': f"GET /v0/subjects/{expected_arguments['subjectId']}",
        'requestCount': 1,
        'expectedRequestCount': 1,
        'unexpectedRequestCount': 0,
        'authorizationHeaderCount': 0,
        'collectionRequestCount': 0,
        'expectedOperationComplete': True,
        'rawFixturePayloadStored': False,
    }
    expected_asset = {
        'assetResolutionCallCount': 0,
        'nonEmptyAssetUrlCount': 0,
        'blockedAssetRequestCount': 0,
        'localFallbackUsed': True,
    }
    expected_checks = {
        'exactRegisteredProfile', 'oneAllowedMcpTool', 'fixedArguments', 'exactCandidateBundle',
        'offlineFixtureOnly', 'noAuthorizationOrCollection', 'noAssetResolution',
        'artifactReturned', 'exactAcknowledgement', 'privacyPreserved',
    }
    expected_privacy = {
        'authProfile': 'anonymous', 'oauthAttempted': False, 'accountDataRead': False,
        'writesAttempted': False, 'communityRead': False, 'qqPipelineTested': False,
        'timClientTested': False, 'promptStored': False, 'answerStored': False,
        'rawFixtureRowsStored': False, 'rawToolResultStored': False,
        'artifactImageBytesStored': False, 'credentialsStored': False,
    }
    source_revision = report.get('sourceRevision')
    pr_number = report.get('prNumber')
    return bool(
        profile.get('acceptanceScope') == 'agent-mcp-matrix-only'
        and name == profile.get('toolName')
        and relative_path == profile.get('reportPath')
        and type(report.get('schemaVersion')) is int and report.get('schemaVersion') == 1
        and report.get('evidenceKind') == profile.get('evidenceKind')
        and report.get('profileId') == profile.get('id')
        and report.get('epochId') == profile.get('epochId')
        and type(report.get('runNumber')) is int and report.get('runNumber') == 95
        and report.get('frontierId') == 'OP-008' and report.get('scenarioId') is None
        and report.get('profile') == 'codex-luna-max-offline-agent-mcp-matrix-v3'
        and report.get('model') == 'gpt-6-luna' and report.get('reasoningEffort') == 'max'
        and report.get('toolName') == profile.get('toolName')
        and report.get('argumentProfile') == profile.get('argumentProfile')
        and expected_arguments == {'subjectId': 991903, 'includeCollection': False}
        and report.get('expectedArgumentsSha256') == arguments_sha256
        and report.get('registrySha256') == registry_sha256
        and report.get('networkMode') == profile.get('networkMode')
        and report.get('serverToolNames') == [profile.get('toolName')]
        and type(report.get('serverToolCount')) is int and report.get('serverToolCount') == 1
        and report.get('mcpServerNames') == ['bgk_render_subject_card_offline']
        and report.get('resultStatus') == 'SUCCESS'
        and type(report.get('processExitCode')) is int and report.get('processExitCode') == 0
        and report.get('eventStreamParsed') is True and report.get('turnCompleted') is True
        and type(report.get('codexMcpToolEventCount')) is int and report.get('codexMcpToolEventCount') == 1
        and type(report.get('codexErrorItemCount')) is int and report.get('codexErrorItemCount') == 0
        and type(report.get('nonMcpToolEventCount')) is int and report.get('nonMcpToolEventCount') == 0
        and report.get('nonMcpToolTypes') == []
        and type(report.get('shellToolCallCount')) is int and report.get('shellToolCallCount') == 0
        and type(report.get('allowedCallCount')) is int and report.get('allowedCallCount') == 1
        and type(report.get('deniedCallCount')) is int and report.get('deniedCallCount') == 0
        and fixture == expected_fixture and asset == expected_asset
        and report.get('networkBoundary') == {
            'liveBangumiApiRequestCount': 0,
            'rendererAssetRequestCount': 0,
            'fullCodexHarnessNetworkSandboxed': False,
        }
        and isinstance(artifact, dict)
        and artifact.get('returned') is True and artifact.get('persisted') is False
        and artifact.get('mimeType') == 'image/png'
        and type(artifact.get('width')) is int and artifact.get('width') == 720
        and type(artifact.get('height')) is int and 0 < artifact['height'] <= 5000
        and type(artifact.get('byteLength')) is int and 0 < artifact['byteLength'] <= 5_000_000
        and isinstance(artifact.get('sha256'), str)
        and re.fullmatch(r'[0-9a-f]{64}', artifact['sha256']) is not None
        and artifact.get('pngSignatureValid') is True
        and report.get('answerCheckMethod') == profile.get('answerCheckMethod')
        and report.get('answerSha256') == hashlib.sha256(acknowledgement).hexdigest()
        and report.get('answerUtf8Bytes') == len(acknowledgement)
        and isinstance(checks, dict) and set(checks) == expected_checks
        and all(value is True for value in checks.values())
        and report.get('privacy') == expected_privacy
        and isinstance(source_revision, str)
        and re.fullmatch(r'[0-9a-f]{40}', source_revision) is not None
        and report.get('ciSha') == source_revision and report.get('ciStatus') == 'SUCCESS'
        and isinstance(report.get('ciRunId'), str)
        and re.fullmatch(r'[1-9][0-9]{3,}', report['ciRunId']) is not None
        and isinstance(report.get('baseSha'), str)
        and re.fullmatch(r'[0-9a-f]{40}', report['baseSha']) is not None
        and type(pr_number) is int and pr_number > 0
        and isinstance(report.get('reviewerId'), str)
        and re.fullmatch(rf'gpt-6-luna-max-run95-pr{pr_number}-round[1-9][0-9]*', report['reviewerId']) is not None
        and isinstance(report.get('claimId'), str)
        and re.fullmatch(rf'profile-run-95-pr-{pr_number}-{source_revision[:12]}-[0-9]+', report['claimId']) is not None
        and isinstance(report.get('mcpBundleSha256'), str)
        and re.fullmatch(r'[0-9a-f]{64}', report['mcpBundleSha256']) is not None
        and report.get('ciChecks') == [
            {'name': check, 'status': 'COMPLETED', 'conclusion': 'SUCCESS'}
            for check in (
                'harness-control', 'sqlite-default', 'host-integration', 'standalone-release-smoke',
                'postgres-compat', 'provider-foundation', 'discovery-foundation',
            )
        ]
        and isinstance(receipt, dict)
        and receipt.get('kind') == 'render-subject-card-offline-agent-mcp-runner-receipt-v1'
        and isinstance(receipt.get('payload'), dict)
        and isinstance(receipt.get('signature'), str)
    )


def p03_v4_agent_mcp_matches(name: str, relative_path: str, report: object) -> bool:
    """Map the signed bounded P03 v4 report only to get_person_profile Agent/MCP."""
    if not isinstance(report, dict):
        return False
    profile = P03_V4_AGENT_MCP_PROFILE
    calls = profile.get('calls')
    expected_arguments = calls[0].get('arguments') if isinstance(calls, list) and len(calls) == 1 else None
    if not isinstance(expected_arguments, dict):
        return False
    arguments_sha256 = hashlib.sha256(json.dumps(
        [call.get('arguments') for call in calls] if isinstance(calls, list) else None,
        sort_keys=True, separators=(',', ':'), ensure_ascii=False,
    ).encode('utf-8')).hexdigest()
    registry_sha256 = hashlib.sha256(json.dumps(
        profile, sort_keys=True, separators=(',', ':'), ensure_ascii=False,
    ).encode('utf-8')).hexdigest()
    receipt = report.get('runnerReceipt')
    receipt_payload = receipt.get('payload') if isinstance(receipt, dict) else None
    counters = report.get('resultCounters')
    checks = report.get('answerChecks')
    privacy = report.get('privacy')
    source_revision = report.get('sourceRevision')
    base_sha = report.get('baseSha')
    return bool(
        name == profile.get('toolName')
        and relative_path == profile.get('reportPath')
        and type(report.get('schemaVersion')) is int
        and report.get('schemaVersion') == 1
        and report.get('evidenceKind') == profile.get('evidenceKind')
        and report.get('profileId') == profile.get('id')
        and report.get('epochId') == profile.get('epochId')
        and report.get('runNumber') == 95
        and report.get('prNumber') == 261
        and report.get('frontierId') == 'P03'
        and report.get('scenarioId') is None
        and report.get('acceptanceScope') == 'agent-mcp-matrix-only'
        and report.get('profile') == 'codex-luna-max-agent-mcp-matrix-v4'
        and report.get('model') == 'gpt-6-luna'
        and report.get('reasoningEffort') == 'max'
        and report.get('toolName') == profile.get('toolName')
        and report.get('argumentProfile') == profile.get('argumentProfile')
        and report.get('expectedArgumentsSha256') == arguments_sha256
        and report.get('registrySha256') == registry_sha256
        and isinstance(receipt_payload, dict)
        and report.get('baseSha') == receipt_payload.get('baseSha')
        and isinstance(source_revision, str)
        and re.fullmatch(r'[0-9a-f]{40}', source_revision) is not None
        and isinstance(base_sha, str)
        and re.fullmatch(r'[0-9a-f]{40}', base_sha) is not None
        and report.get('ciSha') == source_revision
        and report.get('ciStatus') == 'SUCCESS'
        and report.get('resultStatus') == 'SUCCESS'
        and report.get('processExitCode') == 0
        and report.get('codexMcpToolEventCount') == 1
        and report.get('nonMcpToolEventCount') == 0
        and report.get('shellToolCallCount') == 0
        and report.get('allowedCallCount') == 1
        and report.get('deniedCallCount') == 0
        and report.get('serverToolNames') == [profile.get('toolName')]
        and report.get('mcpServerNames') == ['bgk_p03_name_cn']
        and report.get('mcpTextProjectionValid') is True
        and report.get('structuredContentCompatible') is True
        and report.get('sourceCompletenessDocumented') is False
        and isinstance(counters, dict)
        and counters.get('subjectsReturned') == counters.get('returnedCreditRowsObserved')
        and type(counters.get('subjectsReturned')) is int
        and 0 <= counters['subjectsReturned'] <= expected_arguments.get('maxSubjects', -1)
        and type(counters.get('subjectsObserved')) is int
        and counters['subjectsObserved'] >= counters['subjectsReturned']
        and counters.get('subjectsTruncated') is (
            counters['subjectsObserved'] > counters['subjectsReturned']
        )
        and type(counters.get('positiveNameCnRowsObserved')) is int
        and counters['positiveNameCnRowsObserved'] > 0
        and isinstance(checks, dict)
        and bool(checks)
        and all(value is True for value in checks.values())
        and isinstance(privacy, dict)
        and privacy.get('authProfile') == 'anonymous'
        and all(value is False for key, value in privacy.items() if key != 'authProfile')
        and receipt_payload.get('kind') == 'p03-person-name-cn-agent-mcp-runner-receipt-v4'
        and receipt_payload.get('profileId') == profile.get('id')
        and receipt_payload.get('claimId') == report.get('claimId')
        and receipt_payload.get('runNumber') == 95
        and receipt_payload.get('prNumber') == 261
        and receipt_payload.get('sourceRevision') == source_revision
        and receipt_payload.get('ciSha') == source_revision
        and receipt_payload.get('ciStatus') == 'SUCCESS'
        and receipt_payload.get('toolName') == profile.get('toolName')
        and receipt_payload.get('argumentProfile') == profile.get('argumentProfile')
        and isinstance(receipt.get('signature'), str)
        and bool(receipt['signature'])
    )


def p06_v3_agent_mcp_matches(
    name: str, relative_path: str, report: object, report_path: Path | None = None,
) -> bool:
    """Use the canonical P06 validator to map v3 only to its renderer matrix cell."""
    if (
        not isinstance(report, dict)
        or report.get('profileId') != P06_V3_PROFILE_ID
        or P06_V3_PROFILE.get('acceptanceScope') != 'agent-mcp-matrix-only'
        or name != P06_V3_PROFILE.get('toolName')
        or relative_path != P06_V3_PROFILE.get('reportPath')
    ):
        return False
    validator = P06_ACCEPTANCE_GENERATOR.get('codex_p06_profile_report_is_valid')
    return callable(validator) and validator(report, report_path=report_path)


def c03_person_activity_offline_v2_report_matches(
    name: str,
    relative_path: str,
    report: object,
    *,
    report_path: Path | None = None,
    harness_status: object = None,
    root: Path = ROOT,
) -> bool:
    if not isinstance(report, dict):
        return False
    profile = C03_PERSON_ACTIVITY_OFFLINE_V2_PROFILE

    def exact_int(value: object, expected: int) -> bool:
        return type(value) is int and value == expected

    def canonical_json(value: object) -> str:
        return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)

    result = report.get('resultSummary')
    fixture = report.get('offlineFixture')
    checks = report.get('answerChecks')
    privacy = report.get('privacy')
    result_keys = {'resultState', 'windowMonths', 'uniqueSubjects', 'roleCounts', 'coverage'}
    answer_check_fields = {
        'exactRegisteredProfile', 'oneAllowedMcpTool', 'fixedArguments',
        'exactCandidateBundle', 'offlineFixtureOnly', 'resultReadbackMatched',
        'answerEchoedToolResult', 'outputSchemaApplied', 'noScenarioCredit',
        'privacyPreserved',
    }
    coverage_keys = {
        'relationRowsObserved', 'relationRowsSelected', 'relationRowsDroppedAtLimit',
        'subjectDetailsSucceeded', 'subjectDetailsFailed', 'rowsEligible', 'rowsReturned',
        'unknownRoleRows', 'outputTruncated', 'truncated',
    }
    roles = result.get('roleCounts') if isinstance(result, dict) else None
    coverage = result.get('coverage') if isinstance(result, dict) else None
    counts = [
        result.get('uniqueSubjects') if isinstance(result, dict) else None,
        *(roles.values() if isinstance(roles, dict) else []),
        *(
            [coverage.get(key) for key in coverage_keys - {'outputTruncated', 'truncated'}]
            if isinstance(coverage, dict)
            else []
        ),
    ]
    try:
        selection_sha256 = hashlib.sha256(
            (root / profile['selectionEvidencePath']).read_bytes(),
        ).hexdigest()
    except OSError:
        return False
    return bool(
        name == profile['toolName']
        and relative_path == profile['reportPath']
        and exact_int(report.get('schemaVersion'), 1)
        and report.get('evidenceKind') == profile['evidenceKind']
        and report.get('profileId') == profile['id']
        and report.get('epochId') == profile['epochId']
        and exact_int(report.get('runNumber'), 95)
        and report.get('frontierId') == 'C03'
        and report.get('scenarioId') is None
        and report.get('profile') == 'codex-luna-max-offline-agent-mcp-matrix-v2'
        and report.get('model') == 'gpt-6-luna'
        and report.get('reasoningEffort') == 'max'
        and report.get('resultStatus') == 'SUCCESS'
        and exact_int(report.get('processExitCode'), 0)
        and report.get('eventStreamParsed') is True
        and report.get('turnCompleted') is True
        and exact_int(report.get('codexMcpToolEventCount'), 1)
        and exact_int(report.get('codexErrorItemCount'), 0)
        and exact_int(report.get('nonMcpToolEventCount'), 0)
        and report.get('nonMcpToolTypes') == []
        and exact_int(report.get('shellToolCallCount'), 0)
        and exact_int(report.get('allowedCallCount'), 1)
        and exact_int(report.get('deniedCallCount'), 0)
        and report.get('toolName') == profile['toolName']
        and report.get('argumentProfile') == profile['argumentProfile']
        and report.get('expectedArgumentsSha256') == hashlib.sha256(json.dumps(
            [call['arguments'] for call in profile['calls']],
            sort_keys=True, separators=(',', ':'), ensure_ascii=False,
        ).encode('utf-8')).hexdigest()
        and report.get('registrySha256') == hashlib.sha256(json.dumps(
            profile, sort_keys=True, separators=(',', ':'), ensure_ascii=False,
        ).encode('utf-8')).hexdigest()
        and report.get('selectionEvidenceSha256') == selection_sha256
        and report.get('serverToolNames') == [profile['toolName']]
        and exact_int(report.get('serverToolCount'), 1)
        and report.get('mcpServerNames') == ['bgk_c03_person_activity_offline_v2']
        and report.get('networkMode') == profile['networkMode']
        and isinstance(result, dict)
        and set(result) == result_keys
        and isinstance(result.get('resultState'), str)
        and result.get('resultState') in {'complete', 'partial', 'unavailable', 'not_computable', 'unknown'}
        and type(result.get('windowMonths')) is int
        and result.get('windowMonths') == 12
        and all(value is None or (type(value) is int and value >= 0) for value in counts)
        and isinstance(roles, dict)
        and set(roles) == {'main', 'support', 'unknown'}
        and isinstance(coverage, dict)
        and set(coverage) == coverage_keys
        and all(
            value is None or type(value) is bool
            for value in (coverage.get('outputTruncated'), coverage.get('truncated'))
        )
        and isinstance(fixture, dict)
        and canonical_json(fixture) == canonical_json({
            'profile': profile['networkMode'],
            'requestCount': 3,
            'personRequestCount': 1,
            'characterRequestCount': 1,
            'subjectDetailRequestCount': 1,
            'unexpectedRequestCount': 0,
            'authorizationHeaderCount': 0,
            'expectedOperationsComplete': True,
            'operations': ['person', 'characters', 'subject_detail'],
        })
        and canonical_json(report.get('networkBoundary')) == canonical_json({
            'liveBangumiApiRequestCount': 0,
            'unexpectedNetworkRequestCount': 0,
            'rendererAssetRequestCount': 0,
            'fullCodexHarnessNetworkSandboxed': False,
        })
        and isinstance(checks, dict)
        and set(checks) == answer_check_fields
        and all(value is True for value in checks.values())
        and report.get('answerCheckMethod') == profile['answerCheckMethod']
        and isinstance(report.get('answerSha256'), str)
        and re.fullmatch(r'[0-9a-f]{64}', report['answerSha256']) is not None
        and type(report.get('answerUtf8Bytes')) is int
        and 0 < report['answerUtf8Bytes'] <= profile['maxAnswerBytes']
        and isinstance(privacy, dict)
        and canonical_json(privacy) == canonical_json({
            'authProfile': 'anonymous',
            'oauthAttempted': False,
            'accountDataRead': False,
            'writesAttempted': False,
            'communityRead': False,
            'qqPipelineTested': False,
            'timClientTested': False,
            'promptStored': False,
            'answerStored': False,
            'rawFixtureRowsStored': False,
            'rawToolResultStored': False,
            'artifactImageBytesStored': False,
            'credentialsStored': False,
        })
        and c03_person_activity_offline_v2_signed_report_matches(
            report,
            report_path or (ROOT / relative_path),
            harness_status=harness_status,
            root=root,
        )
    )


def p01_person_activity_director_offline_report_matches(
    name: str,
    relative_path: str,
    report: object,
    *,
    report_path: Path | None = None,
    harness_status: object = None,
    root: Path = ROOT,
) -> bool:
    if not isinstance(report, dict):
        return False
    profile = P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_PROFILE
    result = report.get('resultSummary')
    fixture = report.get('offlineFixture')
    checks = report.get('answerChecks')
    privacy = report.get('privacy')
    result_keys = {
        'resultState', 'windowMonths', 'matchedDirectorRows', 'excludedOtherRoleRows',
        'unknownRoleRows', 'coverage',
    }
    coverage_keys = {
        'relationRowsObserved', 'relationRowsSelected', 'relationRowsDroppedAtLimit',
        'subjectDetailsSucceeded', 'subjectDetailsFailed', 'rowsEligible', 'rowsReturned',
        'outputTruncated', 'truncated',
    }
    answer_check_fields = {
        'exactRegisteredProfile', 'oneAllowedMcpTool', 'fixedArguments',
        'exactCandidateBundle', 'offlineFixtureOnly', 'resultReadbackMatched',
        'answerEchoedToolResult', 'outputSchemaApplied', 'noScenarioCredit',
        'privacyPreserved',
    }
    coverage = result.get('coverage') if isinstance(result, dict) else None
    count_values = [
        result.get(key) if isinstance(result, dict) else None
        for key in ('matchedDirectorRows', 'excludedOtherRoleRows', 'unknownRoleRows')
    ]
    if isinstance(coverage, dict):
        count_values.extend(
            coverage.get(key)
            for key in coverage_keys - {'outputTruncated', 'truncated'}
        )
    try:
        selection_sha256 = hashlib.sha256(
            (root / profile['selectionEvidencePath']).read_bytes(),
        ).hexdigest()
    except OSError:
        return False
    canonical_json = lambda value: json.dumps(
        value, sort_keys=True, separators=(',', ':'), ensure_ascii=False,
    )
    expected_fixture = {
        'profile': profile['networkMode'],
        'requestCount': 3,
        'personRequestCount': 1,
        'subjectsRequestCount': 1,
        'subjectDetailRequestCount': 1,
        'unexpectedRequestCount': 0,
        'authorizationHeaderCount': 0,
        'expectedOperationsComplete': True,
        'operations': ['person', 'subjects', 'subject_detail'],
    }
    return bool(
        name == profile['toolName']
        and relative_path == profile['reportPath']
        and type(report.get('schemaVersion')) is int and report.get('schemaVersion') == 1
        and report.get('evidenceKind') == profile['evidenceKind']
        and report.get('profileId') == profile['id']
        and report.get('epochId') == profile['epochId']
        and type(report.get('runNumber')) is int and report.get('runNumber') == 95
        and report.get('frontierId') == 'P01'
        and report.get('scenarioId') is None
        and report.get('profile') == 'codex-luna-max-offline-agent-mcp-matrix-v1'
        and report.get('model') == 'gpt-6-luna'
        and report.get('reasoningEffort') == 'max'
        and report.get('resultStatus') == 'SUCCESS'
        and type(report.get('processExitCode')) is int and report.get('processExitCode') == 0
        and report.get('eventStreamParsed') is True
        and report.get('turnCompleted') is True
        and type(report.get('codexMcpToolEventCount')) is int and report.get('codexMcpToolEventCount') == 1
        and type(report.get('codexErrorItemCount')) is int and report.get('codexErrorItemCount') == 0
        and type(report.get('nonMcpToolEventCount')) is int and report.get('nonMcpToolEventCount') == 0
        and report.get('nonMcpToolTypes') == []
        and type(report.get('shellToolCallCount')) is int and report.get('shellToolCallCount') == 0
        and type(report.get('allowedCallCount')) is int and report.get('allowedCallCount') == 1
        and type(report.get('deniedCallCount')) is int and report.get('deniedCallCount') == 0
        and report.get('toolName') == profile['toolName']
        and report.get('argumentProfile') == profile['argumentProfile']
        and report.get('registrySha256') == hashlib.sha256(canonical_json(profile).encode()).hexdigest()
        and report.get('selectionEvidenceSha256') == selection_sha256
        and report.get('serverToolNames') == [profile['toolName']]
        and type(report.get('serverToolCount')) is int and report.get('serverToolCount') == 1
        and report.get('mcpServerNames') == ['bgk_p01_person_activity_director_offline_v1']
        and report.get('networkMode') == profile['networkMode']
        and isinstance(result, dict)
        and set(result) == result_keys
        and result.get('resultState') in {'complete', 'partial', 'unavailable', 'not_computable', 'unknown'}
        and type(result.get('windowMonths')) is int and result.get('windowMonths') == 36
        and all(type(value) is int and value >= 0 for value in count_values)
        and result.get('matchedDirectorRows') == 1
        and result.get('excludedOtherRoleRows') == 1
        and result.get('unknownRoleRows') == 1
        and isinstance(coverage, dict)
        and set(coverage) == coverage_keys
        and coverage == {
            'relationRowsObserved': 3,
            'relationRowsSelected': 1,
            'relationRowsDroppedAtLimit': 0,
            'subjectDetailsSucceeded': 1,
            'subjectDetailsFailed': 0,
            'rowsEligible': 1,
            'rowsReturned': 1,
            'outputTruncated': False,
            'truncated': False,
        }
        and fixture == expected_fixture
        and report.get('networkBoundary') == {
            'liveBangumiApiRequestCount': 0,
            'unexpectedNetworkRequestCount': 0,
            'rendererAssetRequestCount': 0,
            'fullCodexHarnessNetworkSandboxed': False,
        }
        and isinstance(checks, dict)
        and set(checks) == answer_check_fields
        and all(value is True for value in checks.values())
        and report.get('answerCheckMethod') == profile['answerCheckMethod']
        and isinstance(report.get('answerSha256'), str)
        and re.fullmatch(r'[0-9a-f]{64}', report['answerSha256']) is not None
        and type(report.get('answerUtf8Bytes')) is int
        and 0 < report['answerUtf8Bytes'] <= profile['maxAnswerBytes']
        and privacy == {
            'authProfile': 'anonymous',
            'oauthAttempted': False,
            'accountDataRead': False,
            'writesAttempted': False,
            'communityRead': False,
            'qqPipelineTested': False,
            'timClientTested': False,
            'promptStored': False,
            'answerStored': False,
            'rawFixtureRowsStored': False,
            'rawToolResultStored': False,
            'artifactImageBytesStored': False,
            'credentialsStored': False,
        }
        and p01_person_activity_director_offline_signed_report_matches(
            report,
            report_path or (ROOT / relative_path),
            harness_status=harness_status,
            root=root,
        )
    )


R01_OFFLINE_TOOL_NAME = 'bangumi.get_subject_relations'
R01_OFFLINE_REPORT_PATH = 'docs/live-probes/r01-relations-offline-agent-mcp-run95.json'
R01_OFFLINE_REPORT_KIND = 'codex_cli_r01_subject_relations_offline_agent_mcp_matrix'
R01_OFFLINE_PROFILE_ID = 'r01-subject-relations-offline-agent-mcp-v1'
R01_OFFLINE_EPOCH_ID = 'run95-r01-subject-relations-matrix-offline-20261016'
R01_OFFLINE_ARGUMENT_PROFILE = 'fixed-r01-offline-relations-990902-one-row-v1'
R01_OFFLINE_ANSWER_CHECK_METHOD = 'r01-synthetic-direct-relation-execution-only-v1'
R01_OFFLINE_NETWORK_MODE = 'run95-r01-relations-offline-v1'
G06_CAST_OFFLINE_V2_PROFILE = next(
    profile for profile in PROFILE_REGISTRY.get('profiles', [])
    if isinstance(profile, dict) and profile.get('id') == 'g06-cast-offline-agent-mcp-matrix-v2'
)
G06_CAST_OFFLINE_V2_TOOL_NAME = G06_CAST_OFFLINE_V2_PROFILE['toolName']
G06_CAST_OFFLINE_V2_REPORT_PATH = G06_CAST_OFFLINE_V2_PROFILE['reportPath']
G06_CAST_OFFLINE_V2_REPORT_KIND = G06_CAST_OFFLINE_V2_PROFILE['evidenceKind']
G06_CAST_OFFLINE_V2_EPOCH_ID = G06_CAST_OFFLINE_V2_PROFILE['epochId']
G06_CAST_OFFLINE_V2_ARGUMENT_PROFILE = G06_CAST_OFFLINE_V2_PROFILE['argumentProfile']
G06_CAST_OFFLINE_V2_ANSWER_CHECK_METHOD = G06_CAST_OFFLINE_V2_PROFILE['answerCheckMethod']
G06_CAST_OFFLINE_V2_NETWORK_MODE = G06_CAST_OFFLINE_V2_PROFILE['networkMode']
G06_CAST_OFFLINE_V2_EXPECTED_ARGUMENTS_SHA256 = hashlib.sha256(json.dumps(
    [call['arguments'] for call in G06_CAST_OFFLINE_V2_PROFILE['calls']],
    sort_keys=True,
    separators=(',', ':'),
    ensure_ascii=False,
).encode('utf-8')).hexdigest()
G06_CAST_OFFLINE_V2_REGISTRY_SHA256 = hashlib.sha256(json.dumps(
    G06_CAST_OFFLINE_V2_PROFILE,
    sort_keys=True,
    separators=(',', ':'),
    ensure_ascii=False,
).encode('utf-8')).hexdigest()
G06_CAST_OFFLINE_V2_REQUIRED_CI_CHECKS = [
    'harness-control', 'sqlite-default', 'host-integration', 'standalone-release-smoke',
    'postgres-compat', 'provider-foundation', 'discovery-foundation',
]
G06_CAST_OFFLINE_V2_ANSWER_CHECK_FIELDS = {
    'exactRegisteredProfile', 'oneAllowedMcpTool', 'fixedArguments', 'exactCandidateBundle',
    'offlineFixtureOnly', 'singleExpectedLocalResponse', 'boundedResultSummary',
    'exactAcknowledgement', 'noRealSourceClaim', 'privacyPreserved',
}
G06_CAST_OFFLINE_V2_TOOL_RESULT_SUMMARY = {
    'status': 'ok', 'subjectIdMatches': True, 'rowsObserved': 2, 'rowsReturned': 2,
    'multiRoleVoiceActorCount': 1, 'truncated': False, 'schemaDriftRows': 0,
    'invalidActorIdRows': 0, 'sourceStatus': 'observed', 'paginationAvailable': False,
    'totalCountAvailable': False,
}
G06_CAST_OFFLINE_V2_FIXTURE = {
    'profile': G06_CAST_OFFLINE_V2_NETWORK_MODE, 'requestCount': 1,
    'allowedRequestCount': 1, 'duplicateRequestCount': 0, 'unexpectedRequestCount': 0,
    'authorizationHeaderCount': 0, 'queryParameterCount': 0, 'requestBodyCount': 0,
    'rowsReturned': 2, 'expectedOperationComplete': True,
}
G06_CAST_OFFLINE_V2_NETWORK_BOUNDARY = {
    'liveBangumiApiRequestCount': 0, 'externalProductRequestCount': 0,
    'rendererAssetRequestCount': 0, 'fullCodexHarnessNetworkSandboxed': False,
}
G06_CAST_OFFLINE_V2_PRIVACY = {
    'authProfile': 'anonymous', 'oauthAttempted': False, 'accountDataRead': False,
    'writesAttempted': False, 'communityRead': False, 'qqPipelineTested': False,
    'timClientTested': False, 'promptStored': False, 'answerStored': False,
    'syntheticNamesOrIdsStored': False, 'rawFixtureRowsStored': False,
    'rawToolResultStored': False, 'artifactImageBytesStored': False, 'credentialsStored': False,
}
R04_RENDER_V2_PROFILE = next(
    profile for profile in PROFILE_REGISTRY.get('profiles', [])
    if isinstance(profile, dict)
    and profile.get('id') == 'r04-render-series-watch-order-offline-agent-mcp-matrix-v2'
)
R04_RENDER_V2_TOOL_NAME = R04_RENDER_V2_PROFILE['toolName']
R04_RENDER_V2_REPORT_PATH = R04_RENDER_V2_PROFILE['reportPath']
R04_RENDER_V2_REPORT_KIND = R04_RENDER_V2_PROFILE['evidenceKind']
R04_RENDER_V2_PROFILE_ID = R04_RENDER_V2_PROFILE['id']
R04_RENDER_V2_EPOCH_ID = R04_RENDER_V2_PROFILE['epochId']
R04_RENDER_V2_ARGUMENT_PROFILE = R04_RENDER_V2_PROFILE['argumentProfile']
R04_RENDER_V2_NETWORK_MODE = R04_RENDER_V2_PROFILE['networkMode']
R04_RENDER_V2_ANSWER_CHECK_METHOD = R04_RENDER_V2_PROFILE['answerCheckMethod']
R04_RENDER_V2_EXPECTED_ARGUMENTS_SHA256 = hashlib.sha256(json.dumps(
    [call['arguments'] for call in R04_RENDER_V2_PROFILE['calls']],
    sort_keys=True,
    separators=(',', ':'),
    ensure_ascii=False,
).encode('utf-8')).hexdigest()
R04_RENDER_V2_REGISTRY_SHA256 = hashlib.sha256(json.dumps(
    R04_RENDER_V2_PROFILE,
    sort_keys=True,
    separators=(',', ':'),
    ensure_ascii=False,
).encode('utf-8')).hexdigest()
R04_RENDER_V2_ANSWER_CHECK_FIELDS = {
    'exactRegisteredProfile', 'oneAllowedMcpTool', 'fixedArguments', 'exactCandidateBundle',
    'offlineFixtureOnly', 'twoExpectedLocalResponses', 'noRendererAssetRequests',
    'artifactMetadataVerified', 'safeTextReadback', 'exactAcknowledgement', 'privacyPreserved',
}
R04_RENDER_V2_PRIVACY = {
    'authProfile': 'anonymous', 'oauthAttempted': False, 'accountDataRead': False,
    'writesAttempted': False, 'communityRead': False, 'qqPipelineTested': False,
    'timClientTested': False, 'promptStored': False, 'answerStored': False,
    'rawFixtureRowsStored': False, 'rawToolResultStored': False,
    'artifactImageBytesStored': False, 'credentialsStored': False,
}
R02_POSITIVE_TOOL_NAME = 'bangumi.get_subject_relations'
R02_POSITIVE_REPORT_PATH = 'docs/live-probes/r02-positive-direct-relations-agent-mcp-run95.json'
R02_POSITIVE_REPORT_KIND = 'codex_cli_r02_positive_direct_relations_agent_mcp'
R02_POSITIVE_PROFILE_ID = 'r02-positive-direct-relations-agent-mcp-v1'
R02_POSITIVE_EPOCH_ID = 'run95-r02-positive-direct-relations-agent-mcp-20261016'
R02_POSITIVE_ARGUMENT_PROFILE = 'fixed-r02-positive-direct-relations-4923-315-1428-v1'
R02_POSITIVE_ANSWER_CHECK_METHOD = 'r02-positive-direct-relations-observed-rows-only-v1'
R02_POSITIVE_NETWORK_MODE = 'run95-r02-positive-direct-relations-public-v1'
R02_POSITIVE_RESULT_SUMMARIES = [
    {
        'state': 'observed', 'subjectId': 4923,
        'sourceDirection': 'source_subject_to_returned_target',
        'responseRowsObserved': 53, 'rowsReturned': 53, 'schemaDriftRows': 0,
        'truncated': False, 'paginationAvailable': False, 'totalCountAvailable': False,
        'completeness': 'not_provided_by_source',
        'directRelations': [
            {'sourceSubjectId': 4923, 'targetSubjectId': 315, 'relationLabel': '动画'},
            {'sourceSubjectId': 4923, 'targetSubjectId': 1428, 'relationLabel': '动画'},
        ],
    },
    {
        'state': 'observed', 'subjectId': 315,
        'sourceDirection': 'source_subject_to_returned_target',
        'responseRowsObserved': 33, 'rowsReturned': 33, 'schemaDriftRows': 0,
        'truncated': False, 'paginationAvailable': False, 'totalCountAvailable': False,
        'completeness': 'not_provided_by_source',
        'directRelations': [
            {'sourceSubjectId': 315, 'targetSubjectId': 1935, 'relationLabel': '续集'},
        ],
    },
    {
        'state': 'observed', 'subjectId': 1428,
        'sourceDirection': 'source_subject_to_returned_target',
        'responseRowsObserved': 41, 'rowsReturned': 41, 'schemaDriftRows': 0,
        'truncated': False, 'paginationAvailable': False, 'totalCountAvailable': False,
        'completeness': 'not_provided_by_source',
        'directRelations': [
            {'sourceSubjectId': 1428, 'targetSubjectId': 10799, 'relationLabel': '衍生'},
        ],
    },
]
R02_POSITIVE_REQUEST_SCOPE = {
    'requestCount': 3, 'allowedRequestCount': 3, 'deniedRequestCount': 0,
    'credentialHeaderCount': 0, 'credentialModeCount': 0, 'forbiddenHeaderCount': 0,
    'authorizationHeaderCount': 0, 'writeAttemptCount': 0,
    'unexpectedRouteCount': 0, 'sequenceMismatchCount': 0, 'subjectIds': [4923, 315, 1428],
    'maxRequests': 3, 'requestsComplete': True, 'anonymousOnly': True,
    'officialV0Only': True, 'redirectPolicy': 'error',
}
R02_POSITIVE_NETWORK_BOUNDARY = {
    'liveBangumiApiRequestCount': 3,
    'rendererAssetRequestCount': 0,
    'fullCodexHarnessNetworkSandboxed': False,
}
R02_POSITIVE_PRIVACY = {
    'authProfile': 'anonymous', 'oauthAttempted': False, 'accountDataRead': False,
    'writesAttempted': False, 'communityRead': False, 'qqPipelineTested': False,
    'timClientTested': False, 'promptStored': False, 'answerStored': False,
    'rawRelationRowsStored': False, 'rawToolResultStored': False,
    'artifactImageBytesStored': False, 'credentialsStored': False,
}
R02_POSITIVE_ANSWER_CHECK_FIELDS = {
    'exactRegisteredProfile', 'orderedThreeCalls', 'exactCandidateBundle',
    'exactAnonymousRequestScope', 'positiveRowsMatchSourceContract', 'boundedClaimsOnly',
    'exactAcknowledgement', 'privacyPreserved',
}
R01_OFFLINE_RESULT_SUMMARY = {
    'state': 'observed',
    'sourceDirection': 'source_subject_to_returned_target',
    'responseRowsObserved': 1,
    'rowsReturned': 1,
    'schemaDriftRows': 0,
    'truncated': False,
    'paginationAvailable': False,
    'totalCountAvailable': False,
    'completeness': 'not_provided_by_source',
    'relationLabels': ['改编'],
}
R01_OFFLINE_FIXTURE = {
    'profile': R01_OFFLINE_NETWORK_MODE,
    'requestCount': 1,
    'relationRequestCount': 1,
    'duplicateRequestCount': 0,
    'unexpectedRequestCount': 0,
    'authorizationHeaderCount': 0,
    'expectedOperationsComplete': True,
}
R01_OFFLINE_NETWORK_BOUNDARY = {
    'liveBangumiApiRequestCount': 0,
    'rendererAssetRequestCount': 0,
    'fullCodexHarnessNetworkSandboxed': False,
}
R01_OFFLINE_PRIVACY = {
    'authProfile': 'anonymous',
    'oauthAttempted': False,
    'accountDataRead': False,
    'writesAttempted': False,
    'communityRead': False,
    'qqPipelineTested': False,
    'timClientTested': False,
    'promptStored': False,
    'answerStored': False,
    'rawFixtureRowsStored': False,
    'rawToolResultStored': False,
    'artifactImageBytesStored': False,
    'credentialsStored': False,
}
R01_OFFLINE_ANSWER_CHECK_FIELDS = {
    'exactRegisteredProfile', 'oneAllowedMcpTool', 'fixedArguments',
    'exactCandidateBundle', 'offlineFixtureOnly', 'oneExpectedLocalResponse',
    'noAssetRequests', 'exactAcknowledgement', 'privacyPreserved',
}
LOCAL_AUTH_DENIAL_TEST_PROFILE = 'bangumi-tool-registry-no-account-auth-denial-v1'
LOCAL_AUTH_DENIAL_TESTS = {
    'bangumi.manage_index': {
        'sourcePath': 'tests/unit/manage-index-actions.test.ts',
        'testName': 'rejects an unbound principal before issuing any index request',
        'testCommand': 'pnpm exec vitest run tests/unit/manage-index-actions.test.ts',
        'sourceFragments': (
            "externalUserId: 'user-without-account'",
            "rejects.toMatchObject({ code: 'AUTH_REQUIRED' })",
            'expect(mockFetch).not.toHaveBeenCalled()',
            'expect(capturedRequests).toHaveLength(0)',
        ),
    },
}


def source_reference_error(name: str, cell: str) -> str | None:
    references = list(SOURCE_REFERENCE.finditer(cell))
    parts = cell.split('<br>')
    if not references:
        return f'{name}: missing direct execute test source reference'
    if len(references) != len(parts):
        return f'{name}: malformed direct execute test source reference'
    test_root = (ROOT / 'tests').resolve()
    for reference in references:
        source_path = (ROOT / reference.group('path')).resolve()
        try:
            source_path.relative_to(test_root)
        except ValueError:
            return f'{name}: test source reference escapes tests/'
        if not source_path.is_file():
            return f'{name}: test source {reference.group("path")} does not exist'
        line = int(reference.group('line'))
        line_count = len(source_path.read_text(encoding='utf-8', errors='ignore').splitlines())
        if line > line_count:
            return f'{name}: test source line {line} is out of range'
    return None


def local_tool_auth_denial_report_matches(name: str, report: dict) -> bool:
    expected = LOCAL_AUTH_DENIAL_TESTS.get(name)
    if expected is None:
        return False
    try:
        catalog_bytes = CATALOG.read_bytes()
        source_path = (ROOT / expected['sourcePath']).resolve()
        source_path.relative_to((ROOT / 'tests').resolve())
        source_bytes = source_path.read_bytes()
        source_text = source_bytes.decode('utf-8')
        source_sha256 = hashlib.sha256(source_bytes).hexdigest()
        catalog = json.loads(catalog_bytes)
    except (OSError, UnicodeError, ValueError):
        return False
    tool = next((item for item in catalog if item.get('name') == name), None)
    catalog_sha256 = report.get('catalogSha256')
    evidence_catalog = None
    if isinstance(catalog_sha256, str) and re.fullmatch(r'[0-9a-f]{64}', catalog_sha256):
        if hashlib.sha256(catalog_bytes).hexdigest() == catalog_sha256:
            evidence_catalog = catalog
        else:
            snapshot_path = (
                ROOT / 'docs/live-probes' / 'catalog-snapshots' / f'{catalog_sha256}.json'
            )
            try:
                snapshot_bytes = snapshot_path.read_bytes()
                snapshot = json.loads(snapshot_bytes)
            except (OSError, ValueError):
                snapshot = None
                snapshot_bytes = b''
            if (
                hashlib.sha256(snapshot_bytes).hexdigest() == catalog_sha256
                and isinstance(snapshot, list)
            ):
                evidence_catalog = snapshot
    evidence_tool = (
        next((
            item for item in evidence_catalog
            if isinstance(item, dict) and item.get('name') == name
        ), None)
        if evidence_catalog is not None
        else None
    )
    assertions = report.get('assertions')
    return bool(
        tool
        and evidence_tool == tool
        and tool.get('auth') == 'required'
        and tool.get('risk') in {'read', 'write', 'destructive'}
        and report.get('schemaVersion') == 1
        and report.get('evidenceKind') == 'tool_registry_no_account_auth_denial_test'
        and report.get('profile') == LOCAL_AUTH_DENIAL_TEST_PROFILE
        and report.get('tool') == name
        and report.get('testSourcePath') == expected['sourcePath']
        and report.get('testSourceSha256') == source_sha256
        and all(fragment in source_text for fragment in expected['sourceFragments'])
        and report.get('testCommand') == expected['testCommand']
        and report.get('testName') == expected['testName']
        and report.get('testResult') == 'PASS'
        and report.get('accountBound') is False
        and report.get('observedErrorCode') == 'AUTH_REQUIRED'
        and isinstance(assertions, dict)
        and assertions.get('authRequiredGateObserved') is True
        and assertions.get('operationExecuted') is False
        and assertions.get('accountDataReturned') is False
        and assertions.get('networkAccessBlocked') is True
        and assertions.get('networkRequestAttempts') == 0
        and assertions.get('externalApiCalled') is False
    )


def catalog_schema_reference_error(name: str, cell: str, expected_index: int) -> str | None:
    expected = f'`docs/tool-catalog.json#/{expected_index}`'
    if cell != expected:
        return f'{name}: expected {expected} for its registration/schema entry'
    return None


def status_mark(cell: str) -> str:
    return cell.split('<br>', 1)[0]


def r01_offline_agent_mcp_matches(name: str, relative_path: str, report: object) -> bool:
    """Accept only the matrix-only R01 report for its single fixed tool.

    The generator performs the full candidate, Harness, report-signature, and
    receipt validation. This table-level check independently prevents the
    artifact from crediting another tool or evidence column.
    """
    if not isinstance(report, dict):
        return False
    error_count = report.get('codexErrorItemCount')
    answer_checks = report.get('answerChecks')
    return (
        name == R01_OFFLINE_TOOL_NAME
        and relative_path == R01_OFFLINE_REPORT_PATH
        and type(report.get('schemaVersion')) is int
        and report.get('schemaVersion') == 1
        and report.get('evidenceKind') == R01_OFFLINE_REPORT_KIND
        and type(report.get('runNumber')) is int
        and report.get('runNumber') == 95
        and report.get('frontierId') == 'R01'
        and report.get('scenarioId') is None
        and report.get('acceptanceScope') == 'agent-mcp-matrix-only'
        and report.get('epochId') == R01_OFFLINE_EPOCH_ID
        and report.get('profileId') == R01_OFFLINE_PROFILE_ID
        and report.get('profile') == 'codex-luna-max-offline-agent-mcp-matrix-v1'
        and report.get('model') == 'gpt-6-luna'
        and report.get('reasoningEffort') == 'max'
        and report.get('toolName') == R01_OFFLINE_TOOL_NAME
        and report.get('argumentProfile') == R01_OFFLINE_ARGUMENT_PROFILE
        and report.get('serverToolNames') == [R01_OFFLINE_TOOL_NAME]
        and type(report.get('serverToolCount')) is int
        and report.get('serverToolCount') == 1
        and report.get('mcpServerNames') == ['bgk_r01_relations']
        and report.get('resultStatus') == 'SUCCESS'
        and type(report.get('processExitCode')) is int
        and report.get('processExitCode') == 0
        and report.get('eventStreamParsed') is True
        and report.get('turnCompleted') is True
        and type(report.get('codexMcpToolEventCount')) is int
        and report.get('codexMcpToolEventCount') == 1
        and type(error_count) is int
        and 0 <= error_count <= 3
        and type(report.get('blockedWebSearchErrorItemCount')) is int
        and report.get('blockedWebSearchErrorItemCount') == error_count
        and type(report.get('unexpectedCodexErrorItemCount')) is int
        and report.get('unexpectedCodexErrorItemCount') == 0
        and type(report.get('nonMcpToolEventCount')) is int
        and report.get('nonMcpToolEventCount') == 0
        and report.get('nonMcpToolTypes') == []
        and type(report.get('shellToolCallCount')) is int
        and report.get('shellToolCallCount') == 0
        and type(report.get('allowedCallCount')) is int
        and report.get('allowedCallCount') == 1
        and type(report.get('deniedCallCount')) is int
        and report.get('deniedCallCount') == 0
        and report.get('networkMode') == R01_OFFLINE_NETWORK_MODE
        and report.get('answerCheckMethod') == R01_OFFLINE_ANSWER_CHECK_METHOD
        and report.get('resultSummary') == R01_OFFLINE_RESULT_SUMMARY
        and report.get('offlineFixture') == R01_OFFLINE_FIXTURE
        and report.get('networkBoundary') == R01_OFFLINE_NETWORK_BOUNDARY
        and report.get('privacy') == R01_OFFLINE_PRIVACY
        and isinstance(answer_checks, dict)
        and set(answer_checks) == R01_OFFLINE_ANSWER_CHECK_FIELDS
        and all(value is True for value in answer_checks.values())
    )


def g06_cast_offline_v2_agent_mcp_matches(
    name: str, relative_path: str, report: object,
) -> bool:
    """Map only the signed synthetic G06 v2 result to get_subject_cast Agent/MCP."""
    if not isinstance(report, dict):
        return False
    source_revision = report.get('sourceRevision')
    base_sha = report.get('baseSha')
    pr_number = report.get('prNumber')
    claim_id = report.get('claimId')
    error_count = report.get('codexErrorItemCount')
    answer_checks = report.get('answerChecks')
    receipt = report.get('runnerReceipt')
    acknowledgement = 'G06_SYNTHETIC_CAST_MATRIX_EXECUTED'
    return bool(
        name == G06_CAST_OFFLINE_V2_TOOL_NAME
        and relative_path == G06_CAST_OFFLINE_V2_REPORT_PATH
        and type(report.get('schemaVersion')) is int and report.get('schemaVersion') == 1
        and report.get('evidenceKind') == G06_CAST_OFFLINE_V2_REPORT_KIND
        and type(report.get('runNumber')) is int and report.get('runNumber') == 95
        and report.get('frontierId') == 'G06' and report.get('scenarioId') is None
        and report.get('acceptanceScope') == 'agent-mcp-matrix-only'
        and report.get('epochId') == G06_CAST_OFFLINE_V2_EPOCH_ID
        and report.get('profileId') == G06_CAST_OFFLINE_V2_PROFILE['id']
        and report.get('profile') == 'codex-luna-max-offline-agent-mcp-matrix-v2'
        and report.get('model') == 'gpt-6-luna'
        and report.get('reasoningEffort') == 'max'
        and report.get('toolName') == G06_CAST_OFFLINE_V2_TOOL_NAME
        and report.get('argumentProfile') == G06_CAST_OFFLINE_V2_ARGUMENT_PROFILE
        and report.get('expectedArgumentsSha256') == G06_CAST_OFFLINE_V2_EXPECTED_ARGUMENTS_SHA256
        and report.get('registrySha256') == G06_CAST_OFFLINE_V2_REGISTRY_SHA256
        and report.get('serverToolNames') == [G06_CAST_OFFLINE_V2_TOOL_NAME]
        and type(report.get('serverToolCount')) is int and report.get('serverToolCount') == 1
        and report.get('mcpServerNames') == ['bgk_g06_cast_offline_profile']
        and report.get('resultStatus') == 'SUCCESS'
        and type(report.get('processExitCode')) is int and report.get('processExitCode') == 0
        and report.get('eventStreamParsed') is True and report.get('turnCompleted') is True
        and type(report.get('codexMcpToolEventCount')) is int
        and report.get('codexMcpToolEventCount') == 1
        and type(error_count) is int and 0 <= error_count <= 10_000_000
        and type(report.get('nonMcpToolEventCount')) is int
        and report.get('nonMcpToolEventCount') == 0
        and report.get('nonMcpToolTypes') == []
        and type(report.get('shellToolCallCount')) is int and report.get('shellToolCallCount') == 0
        and type(report.get('allowedCallCount')) is int and report.get('allowedCallCount') == 1
        and type(report.get('deniedCallCount')) is int and report.get('deniedCallCount') == 0
        and report.get('networkMode') == G06_CAST_OFFLINE_V2_NETWORK_MODE
        and report.get('ciStatus') == 'SUCCESS'
        and report.get('ciChecks') == [
            {'name': check, 'status': 'COMPLETED', 'conclusion': 'SUCCESS'}
            for check in G06_CAST_OFFLINE_V2_REQUIRED_CI_CHECKS
        ]
        and isinstance(report.get('ciRunId'), str)
        and re.fullmatch(r'[1-9][0-9]{3,}', report['ciRunId']) is not None
        and isinstance(source_revision, str)
        and re.fullmatch(r'[0-9a-f]{40}', source_revision) is not None
        and isinstance(base_sha, str) and re.fullmatch(r'[0-9a-f]{40}', base_sha) is not None
        and report.get('ciSha') == source_revision
        and type(pr_number) is int and pr_number > 0
        and isinstance(claim_id, str)
        and re.fullmatch(rf'profile-run-95-pr-{pr_number}-{source_revision[:12]}-[0-9]+', claim_id) is not None
        and isinstance(report.get('mcpBundleSha256'), str)
        and re.fullmatch(r'[0-9a-f]{64}', report['mcpBundleSha256']) is not None
        and report.get('answerCheckMethod') == G06_CAST_OFFLINE_V2_ANSWER_CHECK_METHOD
        and report.get('answerSha256') == hashlib.sha256(acknowledgement.encode()).hexdigest()
        and report.get('answerUtf8Bytes') == len(acknowledgement.encode())
        and isinstance(answer_checks, dict)
        and set(answer_checks) == G06_CAST_OFFLINE_V2_ANSWER_CHECK_FIELDS
        and all(value is True for value in answer_checks.values())
        and report.get('toolResultSummary') == G06_CAST_OFFLINE_V2_TOOL_RESULT_SUMMARY
        and report.get('offlineFixture') == G06_CAST_OFFLINE_V2_FIXTURE
        and report.get('networkBoundary') == G06_CAST_OFFLINE_V2_NETWORK_BOUNDARY
        and report.get('privacy') == G06_CAST_OFFLINE_V2_PRIVACY
        and isinstance(report.get('selectionEvidenceSha256'), str)
        and re.fullmatch(r'[0-9a-f]{64}', report['selectionEvidenceSha256']) is not None
        and isinstance(receipt, dict)
        and receipt.get('kind') == 'g06-cast-offline-agent-mcp-runner-receipt-v1'
        and isinstance(receipt.get('payload'), dict)
        and isinstance(receipt.get('signature'), str)
    )


def r04_render_v2_agent_mcp_matches(
    name: str, relative_path: str, report: object,
) -> bool:
    """Map only the signed synthetic R04 v2 render result to its renderer matrix cell."""
    if not isinstance(report, dict):
        return False
    result = report.get('resultSummary')
    artifact = result.get('artifact') if isinstance(result, dict) else None
    fixture = report.get('offlineFixture')
    checks = report.get('answerChecks')
    receipt = report.get('runnerReceipt')
    acknowledgement = 'R04_RENDER_V2_SYNTHETIC_CARD_READY'
    return bool(
        name == R04_RENDER_V2_TOOL_NAME
        and relative_path == R04_RENDER_V2_REPORT_PATH
        and report.get('schemaVersion') == 1
        and report.get('evidenceKind') == R04_RENDER_V2_REPORT_KIND
        and report.get('runNumber') == 95
        and report.get('frontierId') == 'R04'
        and report.get('scenarioId') is None
        and report.get('epochId') == R04_RENDER_V2_EPOCH_ID
        and report.get('profileId') == R04_RENDER_V2_PROFILE_ID
        and report.get('profile') == 'codex-luna-max-offline-agent-mcp-matrix-v2'
        and report.get('model') == 'gpt-6-luna'
        and report.get('reasoningEffort') == 'max'
        and report.get('toolName') == R04_RENDER_V2_TOOL_NAME
        and report.get('argumentProfile') == R04_RENDER_V2_ARGUMENT_PROFILE
        and report.get('expectedArgumentsSha256') == R04_RENDER_V2_EXPECTED_ARGUMENTS_SHA256
        and report.get('registrySha256') == R04_RENDER_V2_REGISTRY_SHA256
        and report.get('networkMode') == R04_RENDER_V2_NETWORK_MODE
        and report.get('ciStatus') == 'SUCCESS'
        and report.get('ciSha') == report.get('sourceRevision')
        and report.get('resultStatus') == 'SUCCESS'
        and report.get('processExitCode') == 0
        and report.get('eventStreamParsed') is True
        and report.get('turnCompleted') is True
        and report.get('codexMcpToolEventCount') == 1
        and report.get('mcpToolErrorResultCount') == 0
        and report.get('nonMcpToolEventCount') == 0
        and report.get('nonMcpToolTypes') == []
        and report.get('shellToolCallCount') == 0
        and report.get('allowedCallCount') == 1
        and report.get('deniedCallCount') == 0
        and report.get('serverToolNames') == [R04_RENDER_V2_TOOL_NAME]
        and report.get('serverToolCount') == 1
        and report.get('mcpServerNames') == ['bgk_r04_render_watch_order_v2']
        and report.get('answerCheckMethod') == R04_RENDER_V2_ANSWER_CHECK_METHOD
        and report.get('answerSha256') == hashlib.sha256(acknowledgement.encode()).hexdigest()
        and report.get('answerUtf8Bytes') == len(acknowledgement.encode())
        and fixture == {
            'profile': R04_RENDER_V2_NETWORK_MODE,
            'requestCount': 2,
            'subjectRequestCount': 1,
            'relationsRequestCount': 1,
            'duplicateRequestCount': 0,
            'unexpectedRequestCount': 0,
            'authorizationHeaderCount': 0,
            'expectedOperationsComplete': True,
        }
        and report.get('rendererAssetBoundary') == {'requestCount': 0}
        and report.get('networkBoundary') == {
            'liveBangumiApiRequestCount': 0,
            'rendererAssetRequestCount': 0,
            'fullCodexHarnessNetworkSandboxed': False,
        }
        and isinstance(result, dict)
        and set(result) == {'resultState', 'artifact'}
        and result.get('resultState') == 'artifact_returned'
        and isinstance(artifact, dict)
        and artifact.get('returned') is True
        and artifact.get('persisted') is False
        and artifact.get('mimeType') == 'image/png'
        and type(artifact.get('width')) is int and 320 <= artifact['width'] <= 1200
        and type(artifact.get('height')) is int and artifact['height'] > 0
        and type(artifact.get('byteLength')) is int and 8 < artifact['byteLength'] <= 5_000_000
        and isinstance(artifact.get('sha256'), str)
        and re.fullmatch(r'[0-9a-f]{64}', artifact['sha256']) is not None
        and artifact.get('pngSignatureValid') is True
        and artifact.get('decoded') is True
        and artifact.get('dimensionsMatch') is True
        and report.get('privacy') == R04_RENDER_V2_PRIVACY
        and isinstance(checks, dict)
        and set(checks) == R04_RENDER_V2_ANSWER_CHECK_FIELDS
        and all(value is True for value in checks.values())
        and isinstance(receipt, dict)
        and receipt.get('kind') == 'r04-render-series-watch-order-offline-v2-runner-receipt-v1'
        and isinstance(receipt.get('signature'), str)
        and isinstance(receipt.get('publicKeyBase64'), str)
    )


def r02_positive_agent_mcp_matches(name: str, relative_path: str, report: object) -> bool:
    """Accept the exact bounded R02 report only for get_subject_relations Agent/MCP."""
    if not isinstance(report, dict):
        return False
    error_count = report.get('codexErrorItemCount')
    answer_checks = report.get('answerChecks')
    return (
        name == R02_POSITIVE_TOOL_NAME
        and relative_path == R02_POSITIVE_REPORT_PATH
        and type(report.get('schemaVersion')) is int and report.get('schemaVersion') == 1
        and report.get('evidenceKind') == R02_POSITIVE_REPORT_KIND
        and type(report.get('runNumber')) is int and report.get('runNumber') == 95
        and report.get('frontierId') == 'R02' and report.get('scenarioId') is None
        and report.get('acceptanceScope') == 'agent-mcp-matrix-only'
        and report.get('epochId') == R02_POSITIVE_EPOCH_ID
        and report.get('profileId') == R02_POSITIVE_PROFILE_ID
        and report.get('profile') == 'codex-luna-max-public-agent-mcp-matrix-v1'
        and report.get('model') == 'gpt-6-luna' and report.get('reasoningEffort') == 'max'
        and report.get('toolName') == R02_POSITIVE_TOOL_NAME
        and report.get('argumentProfile') == R02_POSITIVE_ARGUMENT_PROFILE
        and report.get('serverToolNames') == [R02_POSITIVE_TOOL_NAME]
        and type(report.get('serverToolCount')) is int and report.get('serverToolCount') == 1
        and report.get('mcpServerNames') == ['bgk_r02_direct_relations']
        and report.get('resultStatus') == 'SUCCESS'
        and type(report.get('processExitCode')) is int and report.get('processExitCode') == 0
        and report.get('eventStreamParsed') is True and report.get('turnCompleted') is True
        and type(report.get('codexMcpToolEventCount')) is int and report.get('codexMcpToolEventCount') == 3
        and type(error_count) is int and 0 <= error_count <= 3
        and type(report.get('blockedWebSearchErrorItemCount')) is int
        and report.get('blockedWebSearchErrorItemCount') == error_count
        and type(report.get('unexpectedCodexErrorItemCount')) is int
        and report.get('unexpectedCodexErrorItemCount') == 0
        and type(report.get('nonMcpToolEventCount')) is int and report.get('nonMcpToolEventCount') == 0
        and report.get('nonMcpToolTypes') == []
        and type(report.get('shellToolCallCount')) is int and report.get('shellToolCallCount') == 0
        and type(report.get('allowedCallCount')) is int and report.get('allowedCallCount') == 3
        and type(report.get('deniedCallCount')) is int and report.get('deniedCallCount') == 0
        and report.get('networkMode') == R02_POSITIVE_NETWORK_MODE
        and report.get('answerCheckMethod') == R02_POSITIVE_ANSWER_CHECK_METHOD
        and report.get('resultSummary') == R02_POSITIVE_RESULT_SUMMARIES
        and report.get('publicRequestScope') == R02_POSITIVE_REQUEST_SCOPE
        and report.get('networkBoundary') == R02_POSITIVE_NETWORK_BOUNDARY
        and report.get('privacy') == R02_POSITIVE_PRIVACY
        and isinstance(answer_checks, dict)
        and set(answer_checks) == R02_POSITIVE_ANSWER_CHECK_FIELDS
        and all(value is True for value in answer_checks.values())
    )


def evidence_reference_error(name: str, cell: str, kind: str) -> str | None:
    mark = status_mark(cell)
    expected_mark = {
        'public': '◐', 'auth_denial': '✅', 'agent_mcp': '✅',
        'qq_pipeline': '✅', 'tim_client': '✅',
    }[kind]
    parts = cell.split('<br>')
    references = list(LIVE_EVIDENCE_REFERENCE.finditer(cell))
    if mark != expected_mark:
        if len(parts) > 1:
            return f'{name}: incomplete evidence status must not include a report reference'
        return None
    if len(references) != len(parts) - 1 or not references:
        return f'{name}: {kind} evidence status requires report paths'

    live_root = (ROOT / 'docs/live-probes').resolve()
    for reference in references:
        relative_path = reference.group('path')
        path = (ROOT / relative_path).resolve()
        try:
            path.relative_to(live_root)
        except ValueError:
            return f'{name}: live evidence path escapes docs/live-probes/'
        if not path.is_file():
            return f'{name}: live evidence report {relative_path} does not exist'
        try:
            report = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            return f'{name}: live evidence report {relative_path} is invalid JSON'

        if kind == 'public':
            matches = (
                isinstance(report, dict)
                and name in report.get('selectedTools', [])
                and any(isinstance(result, dict) and result.get('tool') == name
                        for result in report.get('results', []))
            )
        elif kind == 'auth_denial':
            legacy_agent_matches = (
                isinstance(report, dict)
                and report.get('profile') == 'bangumi-full-auth-denial-qa-v1'
                and any(isinstance(scenario, dict)
                        and scenario.get('id') == name
                        and scenario.get('passed') is True
                        and scenario.get('toolCalls') == [{'name': name, 'state': 'DONE'}]
                        and isinstance(scenario.get('assertions'), dict)
                        and scenario['assertions'].get('authRequiredGateObserved') is True
                        and scenario['assertions'].get('operationExecuted') is False
                        and scenario['assertions'].get('accountDataReturned') is False
                        and scenario['assertions'].get('networkAccessBlocked') is True
                        and scenario['assertions'].get('networkRequestAttempts') == 0
                        and scenario['assertions'].get('externalApiCalled') is False
                        for scenario in report.get('scenarios', []))
            )
            matches = legacy_agent_matches or local_tool_auth_denial_report_matches(name, report)
        elif kind == 'agent_mcp':
            scenario_matches = (
                isinstance(report, dict)
                and any(
                    isinstance(scenario, dict)
                    and scenario.get('passed') is True
                    and isinstance(scenario.get('toolCalls'), list)
                    and any(isinstance(call, dict)
                            and call.get('name') == name
                            and call.get('state') == 'DONE'
                            for call in scenario['toolCalls'])
                    for scenario in report.get('scenarios', [])
                )
            )
            c04_tool_names = [
                'bangumi.compare_subject_cohorts',
                'bangumi.render_subject_cohort_comparison',
            ]
            c04_results = report.get('resultSummaries') if isinstance(report, dict) else None
            c04_matches = (
                isinstance(report, dict)
                and report.get('evidenceKind') == 'codex_cli_c04_cohort_comparison_agent_mcp_matrix'
                and report.get('profileId') == 'c04-cohort-comparison-agent-mcp-matrix-v1'
                and report.get('runNumber') == 95
                and report.get('frontierId') == 'A01'
                and report.get('scenarioId') is None
                and report.get('resultStatus') == 'SUCCESS'
                and report.get('codexRunCount') == 2
                and report.get('codexMcpToolEventCount') == 2
                and report.get('allowedCallCount') == 2
                and report.get('deniedCallCount') == 0
                and report.get('nonMcpToolEventCount') == 0
                and report.get('nonMcpToolTypes') == []
                and report.get('shellToolCallCount') == 0
                and report.get('toolNames') == c04_tool_names
                and report.get('serverToolNames') == c04_tool_names
                and isinstance(c04_results, list)
                and [
                    item.get('toolName') if isinstance(item, dict) else None
                    for item in c04_results
                ] == c04_tool_names
                and name in c04_tool_names
            )
            title_query_render_tool_names = [
                'bangumi.query_subjects',
                'bangumi.render_query_subjects',
            ]
            title_query_render_results = report.get('resultSummaries') if isinstance(report, dict) else None
            title_query_render_scope = report.get('publicRequestScope') if isinstance(report, dict) else None
            title_query_render_query = (
                title_query_render_results[0].get('summary')
                if isinstance(title_query_render_results, list)
                and len(title_query_render_results) == 2
                and isinstance(title_query_render_results[0], dict)
                else None
            )
            title_query_render_artifact = (
                title_query_render_results[1].get('summary', {}).get('artifact')
                if isinstance(title_query_render_results, list)
                and len(title_query_render_results) == 2
                and isinstance(title_query_render_results[1], dict)
                and isinstance(title_query_render_results[1].get('summary'), dict)
                else None
            )
            title_query_render_checks = report.get('answerChecks') if isinstance(report, dict) else None
            title_query_render_matches = (
                isinstance(report, dict)
                and relative_path == 'docs/live-probes/title-query-render-agent-mcp-run95.json'
                and report.get('evidenceKind') == 'codex_cli_title_query_render_agent_mcp_matrix'
                and report.get('profileId') == 'query-render-title-agent-mcp-v1'
                and report.get('runNumber') == 95
                and report.get('frontierId') == 'G01'
                and report.get('scenarioId') is None
                and report.get('resultStatus') == 'SUCCESS'
                and report.get('codexRunCount') == 1
                and report.get('codexMcpToolEventCount') == 2
                and report.get('allowedCallCount') == 2
                and report.get('deniedCallCount') == 0
                and report.get('nonMcpToolEventCount') == 0
                and report.get('nonMcpToolTypes') == []
                and report.get('shellToolCallCount') == 0
                and report.get('toolNames') == title_query_render_tool_names
                and report.get('serverToolNames') == title_query_render_tool_names
                and isinstance(title_query_render_results, list)
                and [
                    item.get('toolName') if isinstance(item, dict) else None
                    for item in title_query_render_results
                ] == title_query_render_tool_names
                and isinstance(title_query_render_query, dict)
                and set(title_query_render_query) == {
                    'resultState', 'returnedItems', 'coverage', 'warningCodes',
                }
                and title_query_render_query.get('resultState') in {'ok', 'partial'}
                and type(title_query_render_query.get('returnedItems')) is int
                and 0 <= title_query_render_query['returnedItems'] <= 1
                and isinstance(title_query_render_query.get('coverage'), dict)
                and isinstance(title_query_render_query.get('warningCodes'), list)
                and isinstance(title_query_render_artifact, dict)
                and title_query_render_results[1].get('summary', {}).get('resultState') == 'artifact_returned'
                and title_query_render_artifact.get('returned') is True
                and title_query_render_artifact.get('persisted') is False
                and title_query_render_artifact.get('mimeType') == 'image/png'
                and type(title_query_render_artifact.get('width')) is int
                and 0 < title_query_render_artifact['width'] <= 3000
                and type(title_query_render_artifact.get('height')) is int
                and 0 < title_query_render_artifact['height'] <= 5000
                and type(title_query_render_artifact.get('byteLength')) is int
                and 0 < title_query_render_artifact['byteLength'] <= 5_000_000
                and title_query_render_artifact.get('pngSignatureValid') is True
                and title_query_render_artifact.get('decoded') is True
                and title_query_render_artifact.get('dimensionsMatch') is True
                and report.get('rendererAssetBoundary') == {
                    'assetNetworkRequestCount': 0,
                    'remoteAssetResolutionDisabled': True,
                }
                and isinstance(title_query_render_scope, dict)
                and type(title_query_render_scope.get('requestCount')) is int
                and 0 <= title_query_render_scope.get('requestCount', -1) <= 8
                and title_query_render_scope.get('allowedRequestCount') == title_query_render_scope.get('requestCount')
                and title_query_render_scope.get('deniedRequestCount') == 0
                and title_query_render_scope.get('credentialAttemptCount') == 0
                and title_query_render_scope.get('unexpectedRouteCount') == 0
                and title_query_render_scope.get('budgetExceeded') is False
                and title_query_render_scope.get('maxRequests') == 8
                and title_query_render_scope.get('anonymousOnly') is True
                and title_query_render_scope.get('officialV0Only') is True
                and title_query_render_scope.get('redirectPolicy') == 'error'
                and isinstance(title_query_render_checks, dict)
                and len(title_query_render_checks) == 10
                and all(value is True for value in title_query_render_checks.values())
                and name in title_query_render_tool_names
            )
            g01_render_query_matches = g01_render_query_report_matches(name, relative_path, report)
            g01_query_subjects_fixture = report.get('offlineFixture') if isinstance(report, dict) else None
            g01_query_subjects_result = report.get('resultSummary') if isinstance(report, dict) else None
            g01_query_subjects_network = report.get('networkBoundary') if isinstance(report, dict) else None
            g01_query_subjects_checks = report.get('answerChecks') if isinstance(report, dict) else None
            g01_query_subjects_privacy = report.get('privacy') if isinstance(report, dict) else None
            g01_query_subjects_profile = None
            if (
                isinstance(report, dict)
                and report.get('profileId') == 'g01-query-subjects-offline-agent-mcp-matrix-v1'
                and report.get('evidenceKind') == 'codex_cli_g01_query_subjects_offline_agent_mcp'
            ):
                g01_query_subjects_profile = {
                    'profileId': 'g01-query-subjects-offline-agent-mcp-matrix-v1',
                    'evidenceKind': 'codex_cli_g01_query_subjects_offline_agent_mcp',
                    'reportPath': 'docs/live-probes/g01-query-subjects-offline-agent-mcp-run95.json',
                    'serverId': 'bgk_g01_query_subjects_offline',
                    'networkMode': 'run95-g01-query-subjects-synthetic-offline-v1',
                    'maxErrors': 0,
                }
            elif (
                isinstance(report, dict)
                and report.get('profileId') == 'g01-query-subjects-offline-agent-mcp-matrix-v2'
                and report.get('evidenceKind') == 'codex_cli_g01_query_subjects_offline_agent_mcp_v2'
            ):
                g01_query_subjects_profile = {
                    'profileId': 'g01-query-subjects-offline-agent-mcp-matrix-v2',
                    'evidenceKind': 'codex_cli_g01_query_subjects_offline_agent_mcp_v2',
                    'reportPath': 'docs/live-probes/g01-query-subjects-offline-agent-mcp-v2-run95.json',
                    'serverId': 'bgk_g01_query_subjects_offline_v2',
                    'networkMode': 'run95-g01-query-subjects-synthetic-offline-v2',
                    'maxErrors': 3,
                }
            g01_query_subjects_error_count = (
                report.get('codexErrorItemCount') if isinstance(report, dict) else None
            )
            g01_query_subjects_errors_valid = bool(
                g01_query_subjects_profile is not None
                and (
                    type(g01_query_subjects_error_count) is int
                    and g01_query_subjects_error_count == 0
                    if g01_query_subjects_profile['maxErrors'] == 0
                    else (
                        type(g01_query_subjects_error_count) is int
                        and 0 <= g01_query_subjects_error_count <= 3
                        and type(report.get('blockedWebSearchErrorItemCount')) is int
                        and report.get('blockedWebSearchErrorItemCount') == g01_query_subjects_error_count
                        and type(report.get('unexpectedCodexErrorItemCount')) is int
                        and report.get('unexpectedCodexErrorItemCount') == 0
                    )
                )
            )
            g01_query_subjects_offline_matches = (
                isinstance(report, dict)
                and g01_query_subjects_profile is not None
                and relative_path == g01_query_subjects_profile['reportPath']
                and report.get('evidenceKind') == g01_query_subjects_profile['evidenceKind']
                and report.get('profileId') == g01_query_subjects_profile['profileId']
                and report.get('runNumber') == 95
                and report.get('frontierId') == 'G01'
                and report.get('scenarioId') is None
                and report.get('resultStatus') == 'SUCCESS'
                and report.get('codexMcpToolEventCount') == 1
                and report.get('allowedCallCount') == 1
                and report.get('deniedCallCount') == 0
                and report.get('nonMcpToolEventCount') == 0
                and report.get('nonMcpToolTypes') == []
                and report.get('shellToolCallCount') == 0
                and g01_query_subjects_errors_valid
                and report.get('toolName') == 'bangumi.query_subjects'
                and report.get('serverToolNames') == ['bangumi.query_subjects']
                and report.get('mcpServerNames') == [g01_query_subjects_profile['serverId']]
                and report.get('networkMode') == g01_query_subjects_profile['networkMode']
                and g01_query_subjects_fixture == {
                    'profile': g01_query_subjects_profile['networkMode'],
                    'requestCount': 1,
                    'searchRequestCount': 1,
                    'duplicateRequestCount': 0,
                    'unexpectedRequestCount': 0,
                    'rejectedHeaderCount': 0,
                    'expectedOperationsComplete': True,
                    'rawFixturePayloadStored': False,
                }
                and isinstance(g01_query_subjects_result, dict)
                and set(g01_query_subjects_result) == {
                    'resultState', 'returnedItems', 'coverageState', 'requested', 'returned',
                    'pagesScanned', 'totalKind', 'warningCount',
                }
                and g01_query_subjects_result.get('resultState') == 'ok'
                and g01_query_subjects_result.get('returnedItems') == 1
                and g01_query_subjects_result.get('coverageState') in {
                    'complete', 'partial', 'unavailable', 'not_computable', 'unknown',
                }
                and g01_query_subjects_result.get('requested') == 1
                and g01_query_subjects_result.get('returned') == 1
                and g01_query_subjects_result.get('pagesScanned') == 1
                and g01_query_subjects_result.get('totalKind') in {
                    'exact', 'estimated', 'unknown', 'unavailable',
                }
                and type(g01_query_subjects_result.get('warningCount')) is int
                and 0 <= g01_query_subjects_result['warningCount'] <= 8
                and g01_query_subjects_network == {
                    'liveBangumiApiRequestCount': 0,
                    'unexpectedNetworkRequestCount': 0,
                    'rendererAssetRequestCount': 0,
                    'fullCodexHarnessNetworkSandboxed': False,
                }
                and isinstance(g01_query_subjects_checks, dict)
                and len(g01_query_subjects_checks) == 9
                and all(value is True for value in g01_query_subjects_checks.values())
                and isinstance(g01_query_subjects_privacy, dict)
                and g01_query_subjects_privacy.get('authProfile') == 'anonymous'
                and all(
                    value is False
                    for key, value in g01_query_subjects_privacy.items()
                    if key != 'authProfile'
                )
                and name == 'bangumi.query_subjects'
            )
            r01_offline_matches = r01_offline_agent_mcp_matches(
                name, relative_path, report,
            )
            r04_render_v2_matches = r04_render_v2_agent_mcp_matches(
                name, relative_path, report,
            )
            g06_cast_offline_v2_matches = g06_cast_offline_v2_agent_mcp_matches(
                name, relative_path, report,
            )
            r02_positive_matches = r02_positive_agent_mcp_matches(
                name, relative_path, report,
            )
            c03_person_activity_offline_v2_matches = c03_person_activity_offline_v2_report_matches(
                name, relative_path, report, report_path=path,
            )
            p01_person_activity_director_offline_matches = (
                p01_person_activity_director_offline_report_matches(
                    name, relative_path, report, report_path=path,
                )
            )
            render_subject_card_offline_matches = render_subject_card_offline_agent_mcp_matches(
                name, relative_path, report,
            )
            p03_v4_matches = p03_v4_agent_mcp_matches(name, relative_path, report)
            p06_v3_matches = p06_v3_agent_mcp_matches(
                name, relative_path, report, report_path=path,
            )
            matches = (
                scenario_matches or c04_matches or title_query_render_matches
                or g01_render_query_matches or g01_query_subjects_offline_matches
                or r01_offline_matches or r04_render_v2_matches
                or g06_cast_offline_v2_matches or r02_positive_matches
                or c03_person_activity_offline_v2_matches or render_subject_card_offline_matches
                or p01_person_activity_director_offline_matches
                or p03_v4_matches or p06_v3_matches
            )
        else:
            try:
                catalog = json.loads(CATALOG.read_text(encoding='utf-8'))
                qq_sources, tim_sources = tool_client_e2e_sources(
                    catalog, catalog_path=CATALOG,
                    report_dir=ROOT / 'docs/live-probes', root=ROOT,
                )
                sources = qq_sources if kind == 'qq_pipeline' else tim_sources
                matches = name in sources and relative_path in sources[name]
            except (OSError, ValueError, TypeError):
                matches = False
        if not matches:
            return f'{name}: live evidence report {relative_path} does not contain evidence for {name}'
    return None


def main() -> int:
    catalog = json.loads(CATALOG.read_text(encoding='utf-8'))
    expected = {item['name'] for item in catalog}
    catalog_index = {item['name']: index for index, item in enumerate(catalog)}
    rows: dict[str, list[str]] = {}
    for line in TABLE.read_text(encoding='utf-8').splitlines():
        match = TOOL_ROW.match(line)
        if not match:
            continue
        fields = [part.strip() for part in line.strip('|').split('|')]
        if len(fields) != 13:
            raise SystemExit(f'bad acceptance row shape: {line}')
        name = match.group(1)
        if name in rows:
            raise SystemExit(f'duplicate acceptance row: {name}')
        rows[name] = fields

    missing = sorted(expected - set(rows))
    extra = sorted(set(rows) - expected)
    if missing or extra:
        raise SystemExit(f'acceptance table mismatch: missing={missing}, extra={extra}')

    for name, fields in rows.items():
        catalog_error = catalog_schema_reference_error(name, fields[3], catalog_index[name])
        if catalog_error:
            raise SystemExit(catalog_error)
        if fields[5] not in VALID_MARK:
            raise SystemExit(f'{name}: directory/schema/direct execute status is invalid')
        if fields[5] == '✅':
            reference_error = source_reference_error(name, fields[4])
            if reference_error:
                raise SystemExit(reference_error)
        elif fields[4] != '⬜':
            raise SystemExit(f'{name}: pending direct execute must not claim source references')
        if status_mark(fields[6]) not in VALID_LIVE:
            raise SystemExit(f'{name}: invalid public API status {fields[6]!r}')
        if status_mark(fields[7]) not in VALID_MARK:
            raise SystemExit(f'{name}: invalid unauthenticated gate status')
        if status_mark(fields[8]) not in VALID_MARK:
            raise SystemExit(f'{name}: invalid account-auth status')
        if any(status_mark(fields[index]) not in VALID_MARK for index in (9, 10, 11)):
            raise SystemExit(f'{name}: invalid auth gate, account auth, Agent/MCP, QQ pipeline, or TIM status')
        for index, kind in (
            (6, 'public'), (7, 'auth_denial'), (9, 'agent_mcp'),
            (10, 'qq_pipeline'), (11, 'tim_client'),
        ):
            reference_error = evidence_reference_error(name, fields[index], kind)
            if reference_error:
                raise SystemExit(reference_error)

    print(json.dumps({
        'catalog': len(expected),
        'rows': len(rows),
        'direct_execute': sum(fields[5] == '✅' for fields in rows.values()),
        'public_evidence': sum(status_mark(fields[6]) == '◐' for fields in rows.values()),
        'public_not_applicable': sum(status_mark(fields[6]) == '—' for fields in rows.values()),
        'public_pending': sum(status_mark(fields[6]) == '⬜' for fields in rows.values()),
        'auth_gate_denial': sum(status_mark(fields[7]) == '✅' for fields in rows.values()),
        'auth_gate_pending': sum(status_mark(fields[7]) == '⬜' for fields in rows.values()),
        'auth_pending': sum(status_mark(fields[8]) == '⬜' for fields in rows.values()),
        'agent_mcp_e2e': sum(status_mark(fields[9]) == '✅' for fields in rows.values()),
        'qq_pipeline_e2e': sum(status_mark(fields[10]) == '✅' for fields in rows.values()),
        'tim_client_e2e': sum(status_mark(fields[11]) == '✅' for fields in rows.values()),
        'qq_pipeline_pending': sum(status_mark(fields[10]) == '⬜' for fields in rows.values()),
        'tim_client_pending': sum(status_mark(fields[11]) == '⬜' for fields in rows.values()),
    }, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
