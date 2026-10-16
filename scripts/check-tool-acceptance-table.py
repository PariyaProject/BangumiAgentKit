#!/usr/bin/env python3
"""Validate the generated 96-tool acceptance table without network access."""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'docs/tool-catalog.json'
TABLE = ROOT / 'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md'
sys.path.insert(0, str(ROOT / 'scripts'))
from client_evidence import tool_client_e2e_sources
TOOL_ROW = re.compile(r'^\| `(bangumi\.[a-z0-9_]+)` \|')
SOURCE_REFERENCE = re.compile(r'`(?P<path>tests/[^`|:]+):(?P<line>[1-9][0-9]*)`')
LIVE_EVIDENCE_REFERENCE = re.compile(r'`(?P<path>docs/live-probes/[^`|]+\.json)`')
VALID_LIVE = {'◐', '—', '⬜'}
VALID_MARK = {'✅', '⬜', '—'}
R01_OFFLINE_TOOL_NAME = 'bangumi.get_subject_relations'
R01_OFFLINE_REPORT_PATH = 'docs/live-probes/r01-relations-offline-agent-mcp-run95.json'
R01_OFFLINE_REPORT_KIND = 'codex_cli_r01_subject_relations_offline_agent_mcp_matrix'
R01_OFFLINE_PROFILE_ID = 'r01-subject-relations-offline-agent-mcp-v1'
R01_OFFLINE_EPOCH_ID = 'run95-r01-subject-relations-matrix-offline-20261016'
R01_OFFLINE_ARGUMENT_PROFILE = 'fixed-r01-offline-relations-990902-one-row-v1'
R01_OFFLINE_ANSWER_CHECK_METHOD = 'r01-synthetic-direct-relation-execution-only-v1'
R01_OFFLINE_NETWORK_MODE = 'run95-r01-relations-offline-v1'
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
    assertions = report.get('assertions')
    return bool(
        tool
        and tool.get('auth') == 'required'
        and tool.get('risk') in {'read', 'write', 'destructive'}
        and report.get('schemaVersion') == 1
        and report.get('evidenceKind') == 'tool_registry_no_account_auth_denial_test'
        and report.get('profile') == LOCAL_AUTH_DENIAL_TEST_PROFILE
        and report.get('catalogSha256') == hashlib.sha256(catalog_bytes).hexdigest()
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
            r01_offline_matches = r01_offline_agent_mcp_matches(
                name, relative_path, report,
            )
            r02_positive_matches = r02_positive_agent_mcp_matches(
                name, relative_path, report,
            )
            matches = (
                scenario_matches or c04_matches or title_query_render_matches
                or r01_offline_matches or r02_positive_matches
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
