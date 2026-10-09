#!/usr/bin/env python3
"""Generate the per-tool Bangumi acceptance checklist from the catalog and tests."""
import argparse
import base64
import functools
import hashlib
import json
import math
import os
import re
from pathlib import Path
import subprocess
import sys
import urllib.error
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parent))
from client_evidence import tool_client_e2e_sources

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'docs/tool-catalog.json'
OUTPUT = ROOT / 'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md'
LIVE_PROBE_DIR = ROOT / 'docs/live-probes'
NON_PUBLIC_API_TOOLS = {
    'bangumi.auth_disconnect',
    'bangumi.auth_list_accounts',
    'bangumi.auth_remove_account',
    'bangumi.auth_start',
    'bangumi.auth_status',
    'bangumi.auth_switch_account',
    'bangumi.describe_operation',
    'bangumi.get_subject_stats_history',
    'bangumi.list_operations',
    'bangumi.render_subject_stats_history',
    'bangumi.resolve_subject_concept',
}
PUBLIC_API_FAILURE_STATES = {
    'auth_required',
    'error',
    'not_computable',
    'not_found',
    'permission_denied',
    'unavailable',
    'unsupported',
    'upstream_error',
}
PUBLIC_API_REQUIRED_ASSERTIONS = {
    'httpRequestObserved',
    'nonEmptySummary',
    'noErrorResult',
    'nonNegativeCounts',
    'countConsistency',
    'passed',
}
def test_source() -> str:
    chunks = []
    for path in (ROOT / 'tests').rglob('*'):
        if path.suffix in {'.ts', '.tsx', '.js', '.mjs'} and path.is_file():
            chunks.append(path.read_text(encoding='utf-8', errors='ignore'))
    return '\n'.join(chunks)


def direct_execute_occurrences(source: str) -> dict[str, set[int]]:
    occurrences: dict[str, set[int]] = {}

    def record(name: str, position: int) -> None:
        line = source.count('\n', 0, position) + 1
        occurrences.setdefault(name, set()).add(line)

    accessor = re.compile(
        r"(?:reads|auth|authTools|renderTools|tools|registry|toolMap|writeTools|readTools)"
        r"\.get\(['\"](?P<name>bangumi\.[a-z_]+)['\"]\)"
    )
    for match in accessor.finditer(source):
        suffix = source[match.end():]
        prefix = source[max(0, match.start() - 100):match.start()]
        called_execute = re.match(r"\s*!?\s*\.execute\b", suffix) is not None
        passed_to_fixture_wrapper = re.search(
            r"(?:await\s+)?(?:run|expectControlled)\s*\(\s*$", prefix
        ) is not None
        if called_execute or passed_to_fixture_wrapper:
            record(match.group('name'), match.start('name'))
    explicit = re.compile(
        r"(?:executeTool|execute)\(\s*['\"](?P<name>bangumi\.[a-z_]+)['\"]"
    )
    for match in explicit.finditer(source):
        record(match.group('name'), match.start('name'))
    return occurrences


def direct_execute_names(source: str) -> set[str]:
    return set(direct_execute_occurrences(source))


def direct_execute_source_refs(sources: list[tuple[str, str]]) -> dict[str, set[str]]:
    refs: dict[str, set[str]] = {}
    for path, source in sources:
        for name, lines in direct_execute_occurrences(source).items():
            refs.setdefault(name, set()).update(f'{path}:{line}' for line in lines)
    return refs


def direct_execute_sources() -> dict[str, set[str]]:
    sources = []
    for path in (ROOT / 'tests').rglob('*'):
        if path.suffix in {'.ts', '.tsx', '.js', '.mjs'} and path.is_file():
            sources.append((path.relative_to(ROOT).as_posix(), path.read_text(encoding='utf-8', errors='ignore')))
    return direct_execute_source_refs(sources)


def report_source_ref(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT.resolve()).as_posix()
    except ValueError:
        # Test harnesses may deliberately point LIVE_PROBE_DIR at a temporary directory.
        return path.name


def public_api_smoke_sources(catalog: list[dict]) -> dict[str, set[str]]:
    """Trust hash-bound public probes per tool, not per unrelated catalog entry."""
    catalog_bytes = CATALOG.read_bytes()
    catalog_sha256 = hashlib.sha256(catalog_bytes).hexdigest()
    current_by_name = {item['name']: item for item in catalog}
    probe_source_sha256 = hashlib.sha256(
        (ROOT / 'scripts/smoke-public-tools-online.ts').read_bytes()
    ).hexdigest()
    current_names = {item['name'] for item in catalog}
    public_candidates = {
        item['name'] for item in catalog
        if item.get('auth') != 'required' and item['name'] not in NON_PUBLIC_API_TOOLS
    }
    sources: dict[str, set[str]] = {}
    for path in LIVE_PROBE_DIR.glob('public-tools-*.json'):
        try:
            report = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            continue
        if (
            not isinstance(report, dict)
            or report.get('schemaVersion') != 1
            or report.get('evidenceKind') != 'bangumi_public_api_tool_registry_smoke'
            or report.get('mode') != 'read_only_public_api_smoke'
            or report.get('sourceProgram') != 'scripts/smoke-public-tools-online.ts'
            or report.get('probeScriptSha256') != probe_source_sha256
        ):
            continue
        evidence_catalog_sha256 = report.get('catalogSha256')
        if evidence_catalog_sha256 == catalog_sha256:
            evidence_by_name = current_by_name
        elif isinstance(evidence_catalog_sha256, str) and re.fullmatch(r'[0-9a-f]{64}', evidence_catalog_sha256):
            snapshot_path = LIVE_PROBE_DIR / 'catalog-snapshots' / f'{evidence_catalog_sha256}.json'
            try:
                snapshot_bytes = snapshot_path.read_bytes()
                snapshot = json.loads(snapshot_bytes)
            except (OSError, ValueError):
                continue
            if hashlib.sha256(snapshot_bytes).hexdigest() != evidence_catalog_sha256 or not isinstance(snapshot, list):
                continue
            evidence_by_name = {
                item['name']: item
                for item in snapshot
                if isinstance(item, dict) and isinstance(item.get('name'), str)
            }
        else:
            continue
        selected = report.get('selectedTools')
        results = report.get('results')
        if (
            not isinstance(selected, list)
            or not selected
            or not all(isinstance(name, str) for name in selected)
            or len(set(selected)) != len(selected)
            or type(report.get('probeCount')) is not int
            or report['probeCount'] != len(selected)
            or not isinstance(results, list)
            or len(results) != len(selected)
        ):
            continue
        result_by_name = {
            item.get('tool'): item for item in results
            if isinstance(item, dict) and isinstance(item.get('tool'), str)
        }
        if set(result_by_name) != set(selected):
            continue
        for name in selected:
            evidence_tool = evidence_by_name.get(name)
            current_tool = current_by_name.get(name)
            if (
                name not in current_names
                or name not in public_candidates
                or evidence_tool is None
                or current_tool is None
                or json.dumps(evidence_tool, sort_keys=True, separators=(',', ':'))
                != json.dumps(current_tool, sort_keys=True, separators=(',', ':'))
            ):
                continue
            result = result_by_name[name]
            summary = result.get('result')
            assertions = result.get('assertions')
            request_count = result.get('httpRequests')
            recorded_input = result.get('input')
            if (
                not isinstance(summary, dict)
                or not summary
                or summary.get('state') in PUBLIC_API_FAILURE_STATES
                or 'error' in summary
                or not isinstance(assertions, dict)
                or not PUBLIC_API_REQUIRED_ASSERTIONS.issubset(assertions)
                or not all(value is True for value in assertions.values())
                or type(request_count) is not int
                or request_count < 1
                or not isinstance(recorded_input, dict)
                or 'username' in recorded_input
            ):
                continue
            sources.setdefault(name, set()).add(report_source_ref(path))
    d05_path = LIVE_PROBE_DIR / CODEX_D05_REPORT_RELATIVE_PATH.split('/')[-1]
    try:
        d05_report = json.loads(d05_path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        d05_report = None
    if (
        codex_d05_report_is_valid(d05_report)
        and codex_d05_report_matches_candidate_revision(d05_path, d05_report.get('sourceRevision'))
    ):
        sources.setdefault('bangumi.query_subjects', set()).add(report_source_ref(d05_path))
    s03_path = LIVE_PROBE_DIR / CODEX_S03_REPORT_RELATIVE_PATH.split('/')[-1]
    try:
        s03_report = json.loads(s03_path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        s03_report = None
    if (
        codex_s03_report_is_valid(s03_report)
        and codex_s03_report_matches_candidate_revision(s03_path, s03_report.get('sourceRevision'))
    ):
        sources.setdefault('bangumi.get_series_watch_order', set()).add(report_source_ref(s03_path))
    a01_path = LIVE_PROBE_DIR / Path(CODEX_A01_REPORT_RELATIVE_PATH).name
    try:
        a01_report = json.loads(a01_path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        a01_report = None
    current_by_name = {item['name']: item for item in catalog}
    if (
        codex_a01_report_is_valid(a01_report, current_by_name)
        and codex_a01_report_matches_candidate_revision(
            a01_path, a01_report.get('sourceRevision'),
        )
    ):
        sources.setdefault('bangumi.compare_subject_cohorts', set()).add(
            report_source_ref(a01_path),
        )
    return sources


def public_api_smoke_names(catalog: list[dict]) -> set[str]:
    return set(public_api_smoke_sources(catalog))


CODEX_G23_PROBE_ARGUMENTS = {
    'bangumi.get_subject_stats_intelligence': {'subjectId': 218707},
    'bangumi.render_subject_stats_intelligence': {'subjectId': 218707},
}
CODEX_G20_PROBE_ARGUMENTS = {
    'bangumi.get_subject_relations': {'subjectId': 227245, 'includeEvidence': True},
}
CODEX_A01_QUERY_ARGUMENTS = {
    'cohorts': [
        {
            'label': '目标作品',
            'query': {
                'keyword': '少女终末旅行',
                'media': 'anime',
                'categories': 'tv',
                'season': '2017-autumn',
                'resultMode': 'all',
                'nsfw': 'exclude',
            },
        },
        {
            'label': '2017-autumn 动画返回样本',
            'query': {
                'media': 'anime',
                'season': '2017-autumn',
                'resultMode': 'all',
                'nsfw': 'exclude',
            },
        },
    ],
    'maxSubjects': 8,
}
CODEX_A01_REPORT_RELATIVE_PATH = (
    'docs/live-probes/pariya-agent-codex-luna-e2e-A01.json'
)
CODEX_A01_ARGUMENT_PROFILE = 'a01-2017-autumn-cohort-rating-sd-v1'
CODEX_A01_AGGREGATE_ARGUMENTS = {
    'cohort': {'query': {'media': 'anime', 'year': 2012, 'resultMode': 'all'}},
    'maxSubjects': 1,
}
CODEX_A01_AGGREGATE_ARGUMENT_PROFILE = 'a01-aggregate-2012-anime-sample-v1'
CODEX_A01_AGGREGATE_REPORT_RELATIVE_PATH = (
    'docs/live-probes/pariya-agent-codex-luna-e2e-A01-aggregate.json'
)
CODEX_A01_AGGREGATE_PR_NUMBER = 126
CODEX_G02_QUERY_ARGUMENTS = {
    'media': 'anime',
    'from': '2024-01-01',
    'to': '2025-01-01',
    'concepts': ['异世界'],
    'sort': 'heat',
    'order': 'desc',
    'resultMode': 'top',
    'limit': 10,
    'explain': 'full',
}
CODEX_G02_PROBE_ARGUMENTS = {
    'bangumi.query_subjects': CODEX_G02_QUERY_ARGUMENTS,
    'bangumi.render_query_subjects': CODEX_G02_QUERY_ARGUMENTS,
}
CODEX_G02_ARGUMENT_PROFILES = {
    'bangumi.query_subjects': 'g02-2024-isekai-query-v1',
    'bangumi.render_query_subjects': 'g02-2024-isekai-render-v1',
}
CODEX_G02_REPORT_RELATIVE_PATHS = {
    'bangumi.query_subjects': 'docs/live-probes/pariya-agent-codex-luna-e2e-G02-query.json',
    'bangumi.render_query_subjects': 'docs/live-probes/pariya-agent-codex-luna-e2e-G02-render.json',
}
CODEX_G26_EXPECTED_ARGUMENTS = {
    'media': 'anime',
    'from': '2019-01-01',
    'to': '2025-01-01',
    'ratingCount': {'min': 10001},
    'tags': ['女性向'],
    'categories': 'tv',
    'resultMode': 'all',
    'limit': 100,
    'explain': 'full',
}
CODEX_G26_REPORT_RELATIVE_PATH = 'docs/live-probes/g26-exact-tag-agent-mcp-run95.json'
CODEX_G26_BUNDLE_ATTESTATION_RELATIVE_PATH = 'docs/product/g26-mcp-bundle-attestation.json'
CODEX_S02_EXPECTED_ARGUMENTS = {
    'personId': 3474,
    'rankingMode': 'top_rated_main_voice',
    'media': 'all',
}
CODEX_S02_REPORT_RELATIVE_PATH = 'docs/live-probes/s02-top-rated-main-voice-run95.json'
CODEX_S02_BUNDLE_ATTESTATION_RELATIVE_PATH = 'docs/product/s02-mcp-bundle-attestation.json'
CODEX_S03_EXPECTED_ARGUMENTS = {
    'subjectId': 329906,
    'depth': 0,
    'maxNodes': 8,
    'media': 'anime',
    'voiceActorPersonId': 7602,
    'maxVoiceCredits': 120,
}
CODEX_S03_REPORT_RELATIVE_PATH = 'docs/live-probes/s03-series-voice-overlap-agent-mcp-run95.json'
CODEX_S03_BUNDLE_ATTESTATION_RELATIVE_PATH = 'docs/product/s03-mcp-bundle-attestation.json'
CODEX_S03_ATTESTATION_PUBLIC_KEY_RELATIVE_PATH = 'docs/product/s03-run95-attestation-ed25519.pub'
CODEX_D05_EXPECTED_ARGUMENTS = {
    'media': 'anime',
    'season': 'current',
    'tags': ['校园', '恋爱'],
    'sort': 'heat',
    'order': 'desc',
    'resultMode': 'top',
    'limit': 8,
    'explain': 'compact',
}
CODEX_D05_REPORT_RELATIVE_PATH = 'docs/live-probes/d05-current-season-multitag-heat-agent-mcp-run95.json'
CODEX_D05_BUNDLE_ATTESTATION_RELATIVE_PATH = 'docs/product/d05-mcp-bundle-attestation.json'
CODEX_D05_ANSWER_CHECK_FIELDS = {
    'queryArgumentsMatch', 'exactSingleToolCall', 'resultReadbackAvailable',
    'rowsReadbackComplete', 'sourceRowsValid', 'sourceRowsUnique', 'sourceRowsNonEmpty',
    'rowsMatchAnimeMedia', 'requestFilterMatches', 'planContractMatches',
    'coverageConsistent', 'experimentalSourceWarningPresent', 'textBudgetVerified',
    'answerShapeAndRowsMatch', 'answerCoverageCountersMatch',
    'answerRangeMatchesResolvedSeason', 'experimentalSearchDisclosure',
    'estimatedTotalDisclosure', 'boundedCoverageDisclosure',
    'nonCompletenessDisclosure', 'noUnsupportedCompletenessClaim',
}
CODEX_D05_RESULT_COUNTER_FIELDS = {
    'state', 'season', 'totalKind', 'scanned', 'matched', 'returned',
    'sourceRowsValid', 'sourceRowsInvalid', 'sourceRowsDuplicate',
    'textRowsOmitted', 'displayNamesClipped', 'textUtf8Bytes', 'answerRows',
}
CODEX_D05_PRIVACY_FIELDS = {
    'authProfile', 'oauthAttempted', 'accountDataRead', 'writesAttempted',
    'qqPipelineTested', 'timClientTested', 'promptStored', 'answerStored',
    'rawResultStored', 'artifactImageBytesStored', 'credentialsStored',
}
CODEX_D05_REPORT_FIELDS = {
    'schemaVersion', 'evidenceKind', 'runNumber', 'scenarioId', 'profile',
    'frontierId', 'sourceRevision', 'mcpBundleSha256', 'prNumber', 'baseSha',
    'observedAt', 'model', 'reasoningEffort', 'codexCliVersion', 'toolName',
    'argumentProfile', 'expectedArgumentsSha256', 'catalogSha256',
    'toolDescriptionSha256', 'inputSchemaSha256', 'serverToolNames',
    'mcpServerNames', 'serverToolCount', 'processExitCode', 'resultCount',
    'eventStreamParsed', 'codexMcpToolEventCount', 'nonMcpToolEventCount',
    'shellToolCallCount', 'allowedCallCount', 'deniedCallCount', 'resultStatus',
    'qqPipelineTested', 'timClientTested', 'toolCalls', 'answerCheckMethod',
    'toolTextUtf8Bytes', 'resultCounters', 'answerChecks', 'warningCodes',
    'privacy', 'rawAnswerPersisted', 'rawToolResultPersisted',
}
CODEX_D04_PROBE_ARGUMENTS = {
    'bangumi.query_subjects': {
        'media': 'anime',
        'tags': ['科幻'],
        'ratingCount': {'min': 3001},
        'reportedEpisodeCount': {'max': 12},
        'resultMode': 'all',
        'limit': 100,
        'explain': 'full',
    },
}
CODEX_PROBE_ARGUMENTS = (
    CODEX_G23_PROBE_ARGUMENTS
    | CODEX_G20_PROBE_ARGUMENTS
    | {'bangumi.compare_subject_cohorts': CODEX_A01_QUERY_ARGUMENTS}
    | {'bangumi.aggregate_subject_cohort': CODEX_A01_AGGREGATE_ARGUMENTS}
    | CODEX_D04_PROBE_ARGUMENTS
    | CODEX_G02_PROBE_ARGUMENTS
)
CODEX_ARGUMENT_PROFILES = {
    **{name: 'fixed-public-subject-218707-v1' for name in CODEX_G23_PROBE_ARGUMENTS},
    **{name: 'fixed-g20-subject-227245-include-evidence-v1' for name in CODEX_G20_PROBE_ARGUMENTS},
    'bangumi.compare_subject_cohorts': CODEX_A01_ARGUMENT_PROFILE,
    'bangumi.aggregate_subject_cohort': CODEX_A01_AGGREGATE_ARGUMENT_PROFILE,
    'bangumi.query_subjects': 'd04-reported-episode-count-discovery-v1',
}
CODEX_PRIVACY_FLAGS = (
    'oauthAttempted', 'accountDataRead', 'writesAttempted', 'qqPipelineTested',
    'timClientTested', 'promptStored', 'answerStored', 'rawResultStored',
    'artifactImageBytesStored', 'credentialsStored',
)
CODEX_REPORT_FIELDS = {
    'schemaVersion', 'evidenceKind', 'sourceRevision', 'codexCliVersion', 'catalogSha256',
    'profile', 'model', 'reasoningEffort', 'toolName', 'toolDescriptionSha256',
    'inputSchemaSha256', 'argumentProfile', 'expectedArgumentsSha256', 'serverToolNames',
    'serverToolCount', 'processExitCode', 'resultStatus', 'resultCount', 'eventStreamParsed',
    'codexMcpToolEventCount', 'nonMcpToolEventCount', 'shellToolCallCount',
    'allowedCallCount', 'deniedCallCount', 'qqPipelineTested', 'timClientTested',
    'privacy', 'scenarios',
}
CODEX_A01_AGGREGATE_REPORT_FIELDS = CODEX_REPORT_FIELDS | {
    'runNumber', 'frontierId', 'epochId', 'mcpBundleSha256', 'prNumber', 'baseSha',
    'observedAt', 'mcpServerNames', 'candidateGate', 'queryArguments',
    'answerSha256', 'answerUtf8Bytes', 'state',
}
CODEX_A01_AGGREGATE_GATE_FIELDS = {
    'candidateSha', 'baseSha', 'ciSha', 'ciStatus', 'reviewPassSha',
    'reviewVerdict', 'reviewerId',
}
CODEX_A01_AGGREGATE_RESULT_FIELDS = {
    'toolName', 'resultState', 'resultByteLength', 'resultSha256', 'summary',
}
CODEX_A01_AGGREGATE_SUMMARY_FIELDS = {
    'state', 'formulaVersion', 'query', 'coverage', 'metrics', 'officialOperations',
}
CODEX_A01_AGGREGATE_QUERY_SUMMARY_FIELDS = {
    'state', 'scanned', 'matched', 'returned', 'totalKind', 'budgetExceeded',
    'upstreamExhausted',
}
CODEX_A01_AGGREGATE_COVERAGE_FIELDS = {
    'maxSubjectsPerCohort', 'totalSubjectsReturned', 'cohortsComplete', 'cohortsPartial',
    'detailHydrationsAttempted', 'detailHydrationsSucceeded', 'detailHydrationsFailed',
    'truncated',
}
CODEX_A01_AGGREGATE_METRIC_FIELDS = {
    'key', 'state', 'value', 'valid', 'partial', 'missing', 'conflicts', 'notComputable',
}
CODEX_A01_AGGREGATE_METRIC_KEYS = (
    'score', 'heat', 'episodesReported', 'ratingStandardDeviation',
)
CODEX_A01_AGGREGATE_PRIVACY_FIELDS = set(CODEX_PRIVACY_FLAGS) | {
    'authProfile', 'communityRead',
}
CODEX_SCENARIO_FIELDS = {
    'id', 'passed', 'exactArgumentsMatched', 'oneToolAllowlistVerified',
    'resultReadbackVerified', 'answerCheckPassed', 'answerChecks', 'toolCalls', 'result',
}
CODEX_BASE_ANSWER_CHECK_FIELDS = {
    'typedFieldsMatch', 'subjectIdMentioned', 'currentSnapshotMentioned',
    'ratingAndBandMentioned', 'collectionMentioned', 'officialV0Mentioned',
    'coverageStateMentioned', 'singleParagraphNoMarkdown', 'noUnsupportedPositiveClaim',
}
CODEX_STATS_ANSWER_CHECK_FIELDS = CODEX_BASE_ANSWER_CHECK_FIELDS | {
    'metricStatesMentioned', 'limitationsMentioned', 'ratingDistributionClaimsMatch',
    'collectionDistributionClaimsMatch',
}
CODEX_RENDERER_ANSWER_CHECK_FIELDS = CODEX_BASE_ANSWER_CHECK_FIELDS | {'artifactMentioned'}
CODEX_ANSWER_CHECK_FIELDS = CODEX_STATS_ANSWER_CHECK_FIELDS | CODEX_RENDERER_ANSWER_CHECK_FIELDS
CODEX_A01_AGGREGATE_ANSWER_CHECK_FIELDS = {
    'fixedArguments', 'structuredResultReadback', 'exactAggregateAnswer',
    'boundedSampleDisclosure', 'nonCausalLimitations', 'plainTextNoMarkdown',
}
CODEX_G20_ANSWER_CHECK_FIELDS = {
    'queryArgumentsMatch', 'exactSingleToolCall', 'resultReadbackAvailable',
    'sourceScopeVerified', 'coverageConsistent', 'textProjectionConsistent',
    'textBudgetVerified', 'boundedSourceDisclosurePresent',
    'responseCountsDisclosurePresent', 'omissionNotAbsenceDisclosurePresent',
    'nonCanonicalOrderDisclosurePresent', 'schemaDriftDisclosurePresent',
    'noUnsupportedCompletenessClaim', 'noUnsupportedCanonicalOrderClaim',
    'noUnsupportedAbsenceClaim', 'noUnsupportedReverseClaim', 'noMarkdownFormatting',
}
CODEX_A01_ANSWER_CHECK_FIELDS = {
    'fixedArguments', 'resultStructuredContent', 'targetIdentity', 'queryPlan',
    'queryCoverage', 'sampleBound', 'returnedRowCount', 'metricFormula', 'metricCoverage',
    'hydrationCoverage', 'comparisonState',
    'overlap', 'officialProvenance', 'officialPublicOperations', 'answerPresent',
    'exactRows', 'exactMetricLine', 'exactScopeLine', 'rejectsUnsupportedSignificance',
    'rejectsUnsupportedCompleteness', 'rejectsUnsupportedInterpretation',
}
CODEX_A01_REPORT_FIELDS = {
    'schemaVersion', 'evidenceKind', 'profile', 'scenarioId', 'runNumber',
    'frontierId', 'epochId', 'state', 'observedAt', 'model', 'reasoningEffort',
    'codexCliVersion', 'sourceRevision', 'baseSha', 'prNumber', 'mcpBundleSha256',
    'candidateGate', 'toolName', 'argumentProfile', 'expectedArgumentsSha256',
    'queryArguments', 'catalogSha256', 'toolDescriptionSha256', 'inputSchemaSha256',
    'serverToolNames', 'serverToolCount', 'mcpServerNames', 'processExitCode',
    'resultCount', 'eventStreamParsed', 'codexMcpToolEventCount',
    'nonMcpToolEventCount', 'shellToolCallCount', 'allowedCallCount',
    'deniedCallCount', 'resultStatus', 'qqPipelineTested', 'timClientTested',
    'serverSummaryMatchesCandidate', 'sameCandidateAfterCall', 'result',
    'answerSha256', 'answerUtf8Bytes', 'answerCheckMethod', 'answerChecks',
    'toolCalls', 'privacy', 'acceptanceLimit',
}
CODEX_A01_CANDIDATE_GATE_FIELDS = {
    'candidateSha', 'baseSha', 'reviewPassSha', 'reviewVerdict', 'reviewerId',
    'ciSha', 'ciStatus',
}
CODEX_A01_PRIVACY_FIELDS = set(CODEX_PRIVACY_FLAGS) | {'authProfile'}
CODEX_A01_RESULT_FIELDS = {
    'state', 'comparisonMetrics', 'formulaVersion', 'cohorts', 'ratingStandardDeviation',
    'coverage', 'source', 'retrievedAt', 'evidence', 'warnings', 'limitations',
}
CODEX_A01_COHORT_FIELDS = {
    'label', 'query', 'querySummary', 'queryPlan', 'queryState', 'queryCoverage',
    'detailHydrations', 'ratingStandardDeviationCoverage', 'subjects',
}
CODEX_A01_QUERY_COVERAGE_FIELDS = {
    'state', 'requested', 'scanned', 'matched', 'returned', 'pagesRequested',
    'pagesScanned', 'upstreamExhausted', 'budgetExceeded', 'postFilterCount',
    'totalKind', 'hydrationsAttempted', 'hydrationsSucceeded', 'hydrationsFailed',
    'hydrationsUnresolved', 'hydrationBudgetExceeded', 'missing', 'reason',
    'unresolvedCandidates', 'outputCap',
}
CODEX_A01_QUERY_BUDGET = {
    'maxPages': 6,
    'maxCandidates': 300,
    'maxHydrations': 60,
    'concurrency': 6,
    'maxConceptProbes': 8,
    'maxReturnedItems': 8,
}
CODEX_A01_PLAN_LIMITATIONS = [
    'Enumeration is bounded by maxPages and maxCandidates.',
    'Official subject search is experimental; estimated totals do not establish completeness of the entire Bangumi database.',
    'all requests a complete attempt; budget exhaustion is reported as partial.',
]


def codex_a01_expected_query_plan(index: int) -> dict:
    """Exact compiler plan/request for one of the fixed A01 cohorts."""
    if index not in (0, 1):
        raise ValueError('A01 has exactly two fixed cohort plans')

    def filter_row(field: str, operator: str, value: object, classification: str = 'PUSHDOWN') -> dict:
        return {
            'field': field,
            'classification': classification,
            'operator': operator,
            'value': value,
            'source': 'official_v0',
            'operation': 'searchSubjects',
        }

    pushdown = [
        *([filter_row('keyword', 'eq', '少女终末旅行')] if index == 0 else []),
        filter_row('media', 'in', ['anime']),
        filter_row('dateRange', 'range', {
            'from': '2017-10-01',
            'to': '2018-01-01',
        }),
        filter_row('nsfw', 'eq', False),
        filter_row('sort:relevance', 'eq', 'relevance'),
    ]
    post_filters = (
        [filter_row('categories', 'in', ['tv'], 'POST_FILTER')]
        if index == 0 else []
    )
    hydration_requirements = [
        {'reason': 'nsfw_filter', 'fields': ['nsfw'], 'source': 'candidate_or_detail'},
        *([{'reason': 'category_filter', 'fields': ['platform'], 'source': 'candidate_or_detail'}]
          if index == 0 else []),
    ]
    return {
        'source': 'official_v0',
        'operation': 'searchSubjects',
        'season': '2017-autumn',
        'sort': 'relevance',
        'order': 'desc',
        'totalKind': 'estimated',
        'pushdown': pushdown,
        'postFilters': post_filters,
        'derivedFilters': [],
        'unsupported': [],
        'hydrationRequired': True,
        'hydrationRequirements': hydration_requirements,
        'requestedTopN': CODEX_A01_QUERY_ARGUMENTS['maxSubjects'],
        'resultMode': 'all',
        'quality': 'bounded_exact',
        'budget': dict(CODEX_A01_QUERY_BUDGET),
        'steps': [{
            'kind': 'search',
            'source': 'official_v0',
            'operation': 'searchSubjects',
            'page': 0,
            'request': {
                'keyword': '少女终末旅行' if index == 0 else '',
                'limit': 20,
                'offset': 0,
                'sort': 'match',
                'filter': {
                    'type': [2],
                    'airDate': ['>=2017-10-01', '<2018-01-01'],
                    'nsfw': False,
                },
            },
        }],
        'limitations': list(CODEX_A01_PLAN_LIMITATIONS),
    }
CODEX_A01_METRIC_FIELDS = {
    'key', 'label', 'sourceField', 'averages', 'partialAverages', 'validCounts',
    'partialCounts', 'missingCounts', 'conflictCounts', 'notComputableCounts',
    'formula', 'delta', 'state',
}
CODEX_A01_RESULT_COVERAGE_FIELDS = {
    'maxSubjectsPerCohort', 'totalSubjectsReturned', 'cohortsComplete',
    'cohortsPartial', 'detailHydrationsAttempted', 'detailHydrationsSucceeded',
    'detailHydrationsFailed', 'truncated', 'overlap', 'evidence', 'warnings',
}
CODEX_A01_OVERLAP_FIELDS = {'count', 'subjectIds'}
CODEX_A01_EVIDENCE_COVERAGE_FIELDS = {
    'retained', 'omitted', 'deduplicated', 'omittedByBound', 'bytes',
    'maxRefs', 'maxBytes', 'truncated',
}
CODEX_A01_WARNING_COVERAGE_FIELDS = {'retained', 'omitted', 'max', 'truncated'}
CODEX_A01_SOURCE_SUMMARY_FIELDS = {'class', 'operations', 'attemptedAt', 'retrievedAt'}
CODEX_A01_EVIDENCE_SOURCE_FIELDS = {
    'class', 'provider', 'version', 'operation', 'experimental',
}
CODEX_A01_OFFICIAL_OPERATIONS = {
    'searchSubjects', 'getSubjectById',
}
CODEX_A01_SUBJECT_FIELDS = {
    'id', 'name', 'displayName', 'date', 'ratingCount', 'ratingCountState',
    'ratingHistogramPopulation', 'ratingStandardDeviation',
    'ratingStandardDeviationState', 'ratingStandardDeviationConflicts',
    'ratingHistogramTotalValidation',
}
CODEX_G26_REPORT_FIELDS = {
    'schemaVersion', 'evidenceKind', 'runNumber', 'frontierId', 'scenarioId',
    'sourceRevision', 'mcpBundleSha256', 'observedAt', 'codexCliVersion', 'profile', 'model',
    'reasoningEffort', 'toolName', 'argumentProfile', 'expectedArgumentsSha256',
    'catalogSha256', 'toolDescriptionSha256', 'inputSchemaSha256', 'processExitCode',
    'resultStatus', 'eventStreamParsed', 'codexMcpToolEventCount',
    'nonMcpToolEventCount', 'shellToolCallCount', 'allowedCallCount', 'deniedCallCount',
    'toolCalls', 'answerCheckMethod', 'answerChecks', 'resultCounters', 'warningCodes',
    'privacy',
}
CODEX_G26_ANSWER_CHECK_FIELDS = {
    'queryArgumentsMatch', 'exactSingleToolCall', 'resultReadbackAvailable',
    'resultRowsReadbackAvailable', 'textProjectionConsistent', 'textBudgetVerified',
    'sourceScopeVerified', 'coverageConsistent', 'experimentalSourceWarningPresent',
    'exactTagDisclosurePresent', 'demographicLimitDisclosurePresent',
    'experimentalSearchDisclosurePresent', 'estimatedTotalDisclosurePresent',
    'dateScopeDisclosurePresent', 'ratingCountDisclosurePresent', 'tvDisclosurePresent',
    'boundedCoverageDisclosurePresent', 'coverageCountsDisclosurePresent',
    'partialStateDisclosurePresent', 'textOmissionDisclosurePresent',
    'titleClippingDisclosurePresent', 'noUnsupportedCompletenessClaim',
    'noMarkdownFormatting', 'passed',
}
CODEX_G26_RESULT_COUNTER_FIELDS = {
    'resultState', 'coverageState', 'totalKind', 'scanned', 'matched', 'returned',
    'pagesRequested', 'pagesScanned', 'upstreamExhausted', 'budgetExceeded',
    'hydrationsAttempted', 'hydrationsSucceeded', 'hydrationsFailed',
    'hydrationsUnresolved', 'hydrationBudgetExceeded', 'outputCap',
    'visibleSourceRows', 'invalidSourceRowsCount', 'duplicateSourceRowsCount',
    'textRowsIncluded', 'textRowsOmitted', 'displayNamesClipped', 'textUtf8Bytes',
    'answerRowsParsed', 'rowsMatched', 'missingRowsCount', 'mismatchedRowsCount',
    'unmatchedRowsCount', 'duplicateAnswerRowsCount', 'unstructuredAnswerLinesCount',
}
CODEX_G26_PRIVACY_FIELDS = {
    'authProfile', 'oauthAttempted', 'accountDataRead', 'writesAttempted',
    'qqPipelineTested', 'timClientTested', 'promptStored', 'answerStored',
    'rawResultStored', 'credentialsStored',
}
CODEX_S02_REPORT_FIELDS = {
    'schemaVersion', 'evidenceKind', 'runNumber', 'frontierId', 'scenarioId',
    'sourceRevision', 'mcpBundleSha256', 'observedAt', 'codexCliVersion', 'profile', 'model',
    'reasoningEffort', 'toolName', 'argumentProfile', 'expectedArgumentsSha256',
    'catalogSha256', 'toolDescriptionSha256', 'inputSchemaSha256', 'processExitCode',
    'resultStatus', 'eventStreamParsed', 'codexMcpToolEventCount', 'nonMcpToolEventCount',
    'shellToolCallCount', 'allowedCallCount', 'deniedCallCount', 'toolCalls',
    'answerCheckMethod', 'answerChecks', 'answerCounters', 'resultSummary', 'privacy',
}
CODEX_S02_ANSWER_CHECK_FIELDS = {
    'queryArgumentsMatch', 'exactSingleToolCall', 'resultReadbackAvailable',
    'resultRowsValid', 'distinctSubjects', 'deterministicScoreOrder',
    'completeStateCoverageConsistent', 'answerRowsMatch',
    'rankingStateMatches', 'coverageMatches', 'boundedScopeDisclosurePresent',
    'careerHistoryLimitDisclosurePresent', 'noUnsupportedCareerOrHistoryClaim',
    'noMarkdownFormatting',
}
CODEX_G02_QUERY_ANSWER_CHECK_FIELDS = {
    'queryArgumentsMatch', 'exactSingleToolCall', 'resultReadbackAvailable',
    'exact2024DateWindow', 'exactAnimeAndConcept', 'uniqueSourceRows',
    'currentCollectionHeatOrder', 'sourceRowsMatchAnswer', 'returnedRowsWithinLimit',
    'coverageIsUnknownOrPartial', 'experimentalSourceDisclosed',
    'estimatedTotalNotPresentedAsComplete', 'noUnsupportedGlobalTopTenClaim',
    'noUnsupportedTrendClaim', 'plainTextNoMarkdown',
}
CODEX_G02_RENDERER_ANSWER_CHECK_FIELDS = {
    'queryArgumentsMatch', 'artifactReturnedInMemory', 'artifactMentioned',
    'exactDateAndConceptScopeDisclosed', 'currentCollectionHeatMeaningDisclosed',
    'experimentalSourceAndEstimatedCoverageDisclosed', 'nonExhaustiveScopeDisclosed',
    'notClaimedAsGlobalTopTen', 'noTrendClaim', 'plainTextNoMarkdown',
}
CODEX_G02_REPORT_FIELDS = CODEX_REPORT_FIELDS | {
    'runNumber', 'frontierId', 'mcpBundleSha256', 'prNumber', 'baseSha',
    'observedAt', 'resultCounters',
}
CODEX_G02_QUERY_RESULT_COUNTER_FIELDS = {
    'resultState', 'coverageState', 'totalKind', 'requested', 'scanned', 'matched',
    'returned', 'warningCodes', 'sourceRowsValidated', 'answerRowsMatched',
}
CODEX_G02_RENDER_RESULT_COUNTER_FIELDS = {'resultState', 'artifactReturned'}
CODEX_G02_MAX_CANDIDATES = 500
CODEX_G02_WARNING_CODES = {
    'PARTIAL_PAGE_SCAN', 'STALE_SOURCE', 'SOURCE_DISAGREEMENT', 'EXPERIMENTAL_SOURCE',
    'FORMULA_EMPIRICALLY_VERIFIED', 'MISSING_FIELD', 'MISSING_DATE', 'AUTH_SCOPE_LIMITED',
    'SCHEMA_DRIFT', 'SOURCE_DISABLED', 'SOURCE_NOT_CONFIGURED', 'UPSTREAM_NOT_FOUND',
    'UPSTREAM_TIMEOUT', 'UPSTREAM_RATE_LIMITED', 'UPSTREAM_ERROR', 'RESPONSE_TOO_LARGE',
    'INFOBOX_MALFORMED', 'INFOBOX_TRUNCATED', 'IDENTITY_LIST_TRUNCATED', 'ALIAS_UNKNOWN',
    'DISCOVERY_AMBIGUOUS_CONCEPT', 'DISCOVERY_UNKNOWN_CONCEPT', 'DISCOVERY_BUDGET_EXCEEDED',
    'DISCOVERY_HYDRATION_BUDGET_EXCEEDED', 'DISCOVERY_HYDRATION_UNRESOLVED',
    'DISCOVERY_OUTPUT_TRUNCATED', 'DISCOVERY_UNSUPPORTED_FILTER',
}
CODEX_G02_PRIVACY_FIELDS = set(CODEX_PRIVACY_FLAGS) | {'authProfile', 'communityRead'}
CODEX_S02_ANSWER_COUNTER_FIELDS = {
    'sourceRows', 'answerRows', 'rowsMatched', 'missingRowsCount', 'extraRowsCount',
    'duplicateAnswerRowsCount', 'coverageFieldsMatched',
}
CODEX_S02_RESULT_SUMMARY_FIELDS = {'state', 'scope', 'media', 'truncated', 'rows', 'coverage'}
CODEX_S02_RESULT_ROW_FIELDS = {'subjectId', 'ratingScore', 'ratingTotal'}
CODEX_S03_ANSWER_CHECK_FIELDS = {
    'queryArgumentsMatch', 'exactSingleToolCall', 'structuredResultReadbackAvailable',
    'sourceOperationValid', 'answerPersonIdMatches', 'answerMatchStatusMatches',
    'answerDistinctWorkCountMatches', 'twoDistinctWorksMatched', 'expectedDirectRelationPreserved',
    'boundedCoverageValid', 'coverageMatches', 'answerRowsMatch', 'noMatchCaveatPresent',
    'observedScopeCaveatPresent', 'careerAndCanonicalOrderCaveatsPresent',
    'noUnsupportedCompletenessClaim', 'noMarkdownFormatting',
}
CODEX_S03_RESULT_COUNTER_FIELDS = {
    'distinctWorks', 'answerWorks', 'matchedCreditRows', 'personRowsObserved',
    'personRowsReturned', 'directAnimeWorksOmitted', 'coverageFieldsMatched',
}
CODEX_S03_RESULT_SUMMARY_FIELDS = {
    'rootSubjectId', 'matchStatus', 'distinctWorks', 'subjectIds', 'characterIds',
    'state', 'coverage', 'sourceOperationStatus',
}
CODEX_S03_COVERAGE_FIELDS = {
    'relationRowsObserved', 'eligibleDirectAnimeWorksObserved',
    'eligibleDirectAnimeWorksSelected', 'eligibleDirectAnimeWorksOmitted',
    'personRowsObserved', 'personRowsReturned', 'personRowsOmitted', 'matchedCreditRows',
    'duplicateRows', 'schemaDriftRows', 'maxRelatedAnimeWorks', 'maxVoiceCredits',
    'maxResponseBytes', 'truncated',
}
CODEX_S03_PRIVACY_FIELDS = {
    'authProfile', 'oauthAttempted', 'accountDataRead', 'communityRead', 'writesAttempted',
    'qqPipelineTested', 'timClientTested', 'promptStored', 'answerStored', 'rawResultStored',
    'credentialsStored',
}
CODEX_S03_REPORT_FIELDS = {
    'schemaVersion', 'evidenceKind', 'runNumber', 'scenarioId', 'profile', 'frontierId',
    'sourceRevision', 'mcpBundleSha256', 'prNumber', 'baseSha', 'observedAt', 'model',
    'reasoningEffort', 'codexCliVersion', 'toolName', 'argumentProfile',
    'expectedArgumentsSha256', 'catalogSha256', 'toolDescriptionSha256', 'inputSchemaSha256',
    'serverToolNames', 'mcpServerNames', 'serverToolCount', 'processExitCode', 'resultCount',
    'eventStreamParsed', 'codexMcpToolEventCount', 'nonMcpToolEventCount', 'shellToolCallCount',
    'allowedCallCount', 'deniedCallCount', 'resultStatus', 'toolCalls', 'answerCheckMethod',
    'toolTextUtf8Bytes', 'answerChecks', 'resultCounters', 'resultSummary', 'privacy',
    'rawAnswerPersisted', 'rawToolResultPersisted', 'evidenceProvenance',
}
CODEX_S03_PROVENANCE_FIELDS = {
    'schemaVersion', 'kind', 'algorithm', 'reviewerId', 'keyIdSha256', 'summaryPathSha256',
    'serverSummarySha256', 'eventsSha256', 'proofSha256', 'signature',
}
CODEX_S03_PROBE_IMPLEMENTATION_MARKERS = {
    'packages/bangumi-core/src/services/series-service.ts': (
        'voiceActorPersonId',
        'makeVoiceActorPresence(',
        'MAX_VOICE_RESPONSE_BYTES = 1_048_576',
    ),
    'apps/mcp/src/result-presenter.ts': (
        'function projectSeriesVoiceActorPresence(',
        "answerScope:",
    ),
    'scripts/acceptance/run-s03-codex-agent-mcp.mjs': (
        'assertS03CandidateReviewGate(',
        'createS03OneShotClaim(',
        'function prepareS03ReportClaim(',
        "'features.shell_tool=false'",
        'review?.reviewed_base_sha === currentBaseSha',
        'pr?.baseRefOid === currentBaseSha',
        'round1$/u.exec(review.reviewer_id)',
        'summaryPathSha256: sha256(path.resolve(summaryPath))',
        'loadS03EvidenceSigningKey()',
        'PARIYA_S03_EVIDENCE_SIGNING_KEY_PATH',
        'S03 runner attestation trust:',
    ),
    'scripts/lib/s03-one-shot-authorization.mjs': (
        'function assertClaimPath(',
        'const lockPath = `${claimPath}.server-call-claimed`;',
        'claim.summaryPathSha256 !== summaryPathSha256',
        'export function verifyS03ReportClaim(',
    ),
    'apps/mcp/s03-one-tool-mcp-server.mjs': (
        'verifyS03ServerAuthorization(',
        'claimS03ServerCall(',
        'captureS03ServerResult(',
    ),
    'scripts/acceptance/write-s03-agent-mcp-report.mjs': (
        'verifyS03ReportClaim(',
        's03EventEvidenceSha256(',
        'evidenceProvenance.proofSha256 = sha256(canonicalJson(proofPayload))',
        'evidenceProvenance.signature = sign(',
    ),
    'scripts/acceptance/s03-agent-answer-check.mjs': (
        'export function verifyS03VoiceActorOverlapAnswer(',
        '未命中不证明没有其他演出',
        'careerAndCanonicalOrderCaveatsPresent',
        'Object.keys(parsedAnswer).sort()',
        'noUnsupportedCompletenessClaim: !hasUnsupportedCompletenessClaim(parsedAnswer)',
        'negatedClaimPrefix.test(clause.trim())',
        '|于是|因为|但|且|却|而/u',
    ),
    CODEX_S03_ATTESTATION_PUBLIC_KEY_RELATIVE_PATH: ('-----BEGIN PUBLIC KEY-----',),
    'scripts/generate-tool-acceptance-tasks.py': (
        'def codex_s03_report_provenance_is_valid(',
        'def codex_s03_harness_control_record_trusts_attestation(',
        'CODEX_S03_ATTESTATION_PUBLIC_KEY_RELATIVE_PATH',
        'verify(null, Buffer.from(input.proofSha256',
        'https://api.github.com/repos/PariyaProject/BangumiAgentKit/pulls/',
    ),
}
CODEX_S02_COVERAGE_FIELDS = {
    'relationRowsObserved', 'relationRowsSelected', 'relationRowsDroppedAtLimit',
    'subjectDetailRequests', 'subjectDetailsSucceeded', 'subjectDetailsFailed',
    'subjectDetailIdsDroppedAtLimit', 'mainRoleSubjectsSelected', 'scoreableMainRoleSubjects',
    'zeroRatingScoreSubjects', 'unknownRoleRows', 'missingRatingScoreSubjects',
    'missingRatingTotalSubjects', 'mediaUnknownSubjects', 'missingSubjectIdRows',
    'mainRoleSubjectsMissingDetail', 'rowsReturned',
}
CODEX_S02_PRIVACY_FIELDS = {
    'authProfile', 'oauthAttempted', 'accountDataRead', 'writesAttempted',
    'qqPipelineTested', 'timClientTested', 'communityRead', 'promptStored', 'answerStored',
    'rawResultStored', 'credentialsStored',
}
CODEX_RESULT_FIELDS = {
    'toolName', 'resultState', 'resultByteLength', 'resultSha256', 'sourceOperations', 'artifact',
}
CODEX_G20_RESULT_FIELDS = {
    'toolName', 'resultState', 'resultByteLength', 'resultSha256', 'sourceOperations',
    'artifact', 'sourceSubjectId', 'source', 'coverage', 'limitationsCount', 'visibleRows',
    'textProjection', 'answerCounters',
}
CODEX_G20_SOURCE_FIELDS = {'api', 'operation', 'direction', 'scope', 'retrievedAt'}
CODEX_G20_COVERAGE_FIELDS = {
    'responseRowsObserved', 'rowsReturned', 'schemaDriftRows', 'truncated',
    'paginationAvailable', 'totalCountAvailable', 'completeness',
}
CODEX_D04_ANSWER_CHECK_FIELDS = {
    'exactTargetToolCalledOnce', 'exactQueryArguments',
    'mcpTextProjectionPreservesFullStructuredResult',
    'officialExperimentalSourceAndEstimatedCoverage', 'coverageStateConsistent',
    'exactAnimeTagAndRatingFilters',
    'reportedEpisodeCountIsLocalPostFilter', 'reportedEpisodeEvidenceVisible',
    'withinResourceCeilings', 'allObservedRowsMatchRequestedFilters',
    'answerRowsMatchVisibleSourceRows', 'queryConditionsDisclosed',
    'boundedExperimentalEstimatedScopeDisclosed', 'partialCoverageDisclosure',
    'reportedEpsMeaningDisclosed',
    'nonExhaustiveBoundaryDisclosed', 'textProjectionOmissionDisclosed',
    'emptyResultNotOverclaimed', 'unsupportedCompletenessOrAbsenceClaim',
    'numericClaimsMatchObservedSource', 'markdownFormattingDetected',
}
CODEX_D04_COVERAGE_FIELDS = {
    'resultState', 'operation', 'officialV0Plan', 'totalKind', 'coverageState',
    'counters', 'flags', 'queryChecks', 'rows', 'experimentalDisclosure',
    'reportedEpsDisclosure', 'warningCodes',
}
CODEX_D04_COVERAGE_COUNTER_FIELDS = {
    'requested', 'scanned', 'matched', 'returned', 'pagesRequested', 'pagesScanned',
    'hydrationsAttempted', 'hydrationsSucceeded', 'hydrationsFailed',
    'hydrationsUnresolved', 'outputCap',
}
CODEX_D04_COVERAGE_FLAGS = {
    'upstreamExhausted', 'budgetExceeded', 'hydrationBudgetExceeded',
}
CODEX_D04_QUERY_CHECKS = {
    'animeTypePushedDown', 'exactScienceFictionTagPushedDown',
    'strictRatingCountLowerBoundPushedDown', 'reportedEpisodeMaximumIsLocal',
    'reportedEpisodeWasNotSentUpstream',
}
CODEX_D04_ROW_COUNTERS = {'observed', 'valid', 'withReportedEpisodeEvidence'}
CODEX_D04_REPORT_FIELDS = CODEX_REPORT_FIELDS | {
    'runNumber', 'frontierId', 'mcpBundleSha256', 'prNumber', 'baseSha',
    'observedAt', 'coverage', 'warningCodes', 'resultHash', 'resultByteLength',
}
CODEX_D04_PRIVACY_FIELDS = set(CODEX_PRIVACY_FLAGS) | {'authProfile', 'communityRead'}
CODEX_D04_PROBE_IMPLEMENTATION_MARKERS = {
    'apps/mcp/d04-one-tool-mcp-server.mjs': (
        "serverProfile: 'one-tool-anonymous-public-v1'",
        'filterAllowedTools(registry.getTools(), D04_DISCOVERY_TOOL)',
        'authorizeToolCall({',
        'claimSingleToolCall(',
        'summarizeD04DiscoveryFacts(result)',
    ),
    'scripts/acceptance/run-d04-codex-agent-mcp.mjs': (
        'assertD04CandidateReviewGate(',
        'createD04OneShotClaim(',
        'physicalPathForComparison(',
        'isPathWithin(',
        "'features.shell_tool=false'",
        "'features.web_search=false'",
    ),
    'scripts/acceptance/d04-discovery-answer-check.mjs': (
        'export function verifyD04DiscoveryAnswer(',
        'reportedEpisodeEvidenceVisible',
        'const unsupportedCompletenessClaim',
        'mcpTextProjectionPreservesFullStructuredResult',
    ),
}
CODEX_G02_PROBE_IMPLEMENTATION_MARKERS = {
    'scripts/acceptance/run-g02-codex-agent-mcp.mjs': (
        'export function assertG02CandidateReviewGate(',
        'createG02OneShotClaim(',
        'G02_TOOL_PROFILES',
        "'features.shell_tool=false'",
        "'features.web_search=false'",
    ),
    'scripts/acceptance/write-g02-agent-mcp-report.mjs': (
        'export function writeG02AgentMcpReports(',
        'G02_EXPECTED_ARGUMENTS_BY_TOOL',
        'verifyG02QueryAnswer(',
        'verifyG02RendererAnswer(',
    ),
    'scripts/acceptance/g02-discovery-answer-check.mjs': (
        'export function verifyG02QueryAnswer(',
        'export function verifyG02RendererAnswer(',
        'coverageIsUnknownOrPartial',
        'currentCollectionHeatOrder',
    ),
    'scripts/generate-tool-acceptance-tasks.py': (
        'def codex_g02_report_matches_candidate_revision(',
        'CODEX_G02_REPORT_RELATIVE_PATHS',
        "if report.get('frontierId') == 'G02' and (",
    ),
}
CODEX_G20_VISIBLE_ROW_FIELDS = {'id', 'name', 'nameCn', 'relation'}
CODEX_G20_TEXT_PROJECTION_FIELDS = {
    'textUtf8Bytes', 'rowsIncluded', 'rowsOmitted', 'displayNamesClipped',
    'relationLabelsClipped', 'limitationsClipped', 'imageFieldsOmitted',
    'fullStructuredContentAvailable',
}
CODEX_G20_ANSWER_COUNTER_FIELDS = {
    'visibleSourceRows', 'invalidSourceRowsCount', 'duplicateSourceRowsCount',
    'answerRowsParsed', 'rowsMatched', 'missingRowsCount', 'mismatchedRowsCount',
    'unmatchedRowsCount', 'duplicateAnswerRowsCount', 'unstructuredAnswerLinesCount',
    'toolTextUtf8Bytes',
}
CODEX_SOURCE_OPERATION_FIELDS = {'operation', 'attempted', 'succeeded', 'failed'}
CODEX_ARTIFACT_FIELDS = {
    'returned', 'persisted', 'mimeType', 'width', 'height', 'byteLength', 'sha256', 'pngSignatureValid',
}
CODEX_PROBE_IMPLEMENTATION_MARKERS = {
    'apps/mcp/codex-one-tool-mcp-server.mjs': (
        "serverProfile: 'one-tool-anonymous-public-v1'",
        'new MemoryStorage()',
        "baseUrl: 'https://api.bgm.tv'",
        'filterAllowedTools(registry.getTools(), config.toolName)',
        'authorizeToolCall({',
        'claimSingleToolCall(',
        'writeSanitizedSummary(',
    ),
    'scripts/lib/codex-one-tool-evidence.mjs': (
        'export function filterAllowedTools(',
        'export function publicReadOnlyToolAnnotations(',
        'export function authorizeToolCall(',
        'export function claimSingleToolCall(',
        'export function summarizeToolResult(',
        'export function checkStatsAnswer(',
        'export function checkRendererAnswer(',
        'function statsCollectionStatusCountsMatch(',
        'function statsRatingHistogramSequenceMatches(',
        'function hasUnsupportedPositiveStatsClaim(',
        'function isStatsClaimNegated(',
        'CLAIM_NEGATION_PREFIX',
        'CLAIM_NEGATION_PREDICATE',
        'CLAIM_NEGATION_PATTERNS',
        'answer.toLowerCase()',
        "'双峰'",
    ),
}
CODEX_A01_AGGREGATE_PROBE_IMPLEMENTATION_MARKERS = {
    'scripts/acceptance/a01-aggregate-subject-cohort-answer-check.mjs': (
        "export const A01_AGGREGATE_TARGET_TOOL = 'bangumi.aggregate_subject_cohort'",
        'export function summarizeA01AggregateResult(',
        'export function verifyA01AggregateAnswer(',
        'boundedSampleDisclosure:',
    ),
    'scripts/acceptance/run-a01-aggregate-codex-agent-mcp.mjs': (
        "const EPOCH_ID = 'run95-a01-aggregate-subject-cohort-codex-current-evidence'",
        'export function buildCodexExecArgs(',
        'createA01AggregateOneShotClaim(',
        'postGateMatches',
        "'features.shell_tool=false'",
    ),
    'scripts/generate-tool-acceptance-tasks.py': (
        'def codex_a01_aggregate_result_is_valid(',
        'def _codex_a01_aggregate_expected_metric_state(',
        'def codex_a01_aggregate_report_is_valid(',
        'def codex_a01_aggregate_report_matches_candidate_revision(',
        'CODEX_A01_AGGREGATE_PR_NUMBER = 126',
        "query['returned'] != coverage['totalSubjectsReturned']",
        "query['state'] == 'not_found' and coverage['totalSubjectsReturned'] != 0",
        "summary['state'] != expected_state",
        "_run_repository_git(ROOT, 'hash-object', str(report_path))",
        'CODEX_A01_AGGREGATE_ARGUMENTS',
    ),
}
CODEX_G20_PROBE_IMPLEMENTATION_MARKERS = {
    'scripts/generate-tool-acceptance-tasks.py': (
        'def codex_g20_report_matches_candidate_revision(',
    ),
    'packages/tools/src/definitions/read-tools.ts': (
        "name: 'bangumi.get_subject_relations'",
        'includeEvidence',
        'getSubjectRelationsWithCoverage',
        'visible_direct_rows_returned_for_source_subject',
    ),
    'apps/mcp/src/result-presenter.ts': (
        'function compactSubjectRelations(',
        'rowsOmitted:',
        'fullStructuredContentAvailable: true',
    ),
    'scripts/acceptance/g20-direct-relations-answer-check.mjs': (
        'export function verifyG20DirectRelationsAnswer(',
        'const FIXED_G20_SUBJECT_ID = 227245;',
        'exactQueryArguments(',
        'exactQueryArguments(toolCalls[0]?.arguments, FIXED_G20_SUBJECT_ID)',
        'resultRowsReadbackAvailable',
        'unsupportedCanonicalOrderClaim',
    ),
    'scripts/acceptance/run-g20-codex-agent-mcp.mjs': (
        'export function buildCodexExecArgs(',
        'export function validateRunnerArgs(',
        'export function createOneShotClaim(',
        'export function createOneShotClaims(',
        'function buildExactCandidateBundle(',
        'assertG20CandidateReviewGate(status, pr',
        "'features.shell_tool=false'",
    ),
    'scripts/acceptance/write-g20-agent-mcp-report.mjs': (
        "const TOOL_NAME = 'bangumi.get_subject_relations'",
        'verifyG20DirectRelationsAnswer(',
        'input.sourceRevision !== sourceRevision',
        "openSync(reportPath, 'wx', 0o600)",
    ),
}
CODEX_A01_PROBE_IMPLEMENTATION_MARKERS = {
    'scripts/acceptance/a01-agent-answer-check.mjs': (
        "export const A01_TARGET_TOOL = 'bangumi.compare_subject_cohorts'",
        'export function verifyA01AgentAnswer(',
        'officialPublicOperations:',
        'rejectsUnsupportedSignificance:',
        'rejectsUnsupportedCompleteness:',
        'rejectsUnsupportedInterpretation:',
    ),
    'scripts/acceptance/run-a01-codex-agent-mcp.mjs': (
        "const EPOCH_ID = 'run95-a01-agent-mcp-acceptance'",
        'export function buildCodexExecArgs(',
        'createA01OneShotClaim(',
        'function publicResultProjection(result)',
        'export function projectA01CohortQuery(query)',
        'function writeReport(report)',
        "'features.shell_tool=false'",
    ),
    'scripts/generate-tool-acceptance-tasks.py': (
        'def codex_a01_report_is_valid(',
        'def codex_a01_report_matches_candidate_revision(',
        "CODEX_A01_REPORT_RELATIVE_PATH = (",
    ),
    'apps/mcp/codex-one-tool-mcp-server.mjs': (
        "'--candidate-sha'",
        'runtimeCandidateMatches(sourceRevision, bundleSha256)',
        'authorizeToolCall({',
    ),
    CODEX_G26_BUNDLE_ATTESTATION_RELATIVE_PATH: (
        '"kind": "g26-mcp-runtime-bundle-attestation-v1"',
        '"bundleSha256":',
    ),
}
CODEX_G26_PROBE_IMPLEMENTATION_MARKERS = {
    'scripts/acceptance/run-g26-codex-agent-mcp.mjs': (
        'export function buildCodexExecArgs(',
        'export function validateRunnerArgs(',
        'export function parseCodexJsonl(',
        'export function summarizeCodexEvents(',
        'export function sanitizeCodexEnvironment(',
        'export function createOneShotClaim(',
        'export function createOneShotClaims(',
        'function buildExactCandidateBundle(',
        'readG26McpBundleAttestation(ROOT)',
        'canonicalG26ClaimPath()',
        'function serverSummaryMatchesCandidate(',
        "'features.shell_tool=false'",
    ),
    'scripts/acceptance/g26-exact-tag-answer-check.mjs': (
        "export const G26_EXACT_TAG_ANSWER_CHECK_METHOD = 'g26-exact-public-tag-query-v1'",
        'export function verifyG26ExactTagAnswer(',
        "exactStringArray(args.tags, ['女性向'])",
        'function checkPlanScope(',
        'function validateScopeDisclosure(',
    ),
    'scripts/acceptance/write-g26-agent-mcp-report.mjs': (
        "const TOOL_NAME = 'bangumi.query_subjects'",
        'verifyG26ExactTagAnswer(',
        'input.sourceRevision !== sourceRevision',
        'computeMcpBundleSha256(process.cwd())',
        'readG26McpBundleAttestation(process.cwd())',
        "openSync(REPORT_PATH, 'wx', 0o600)",
    ),
    'scripts/lib/g26-mcp-bundle.mjs': (
        'export function computeMcpBundleSha256(',
        'export function readG26McpBundleAttestation(',
        "const DIST_RELATIVE_PATHS = ['apps/mcp/dist']",
    ),
    'apps/mcp/codex-one-tool-mcp-server.mjs': (
        "'--candidate-sha'",
        'computeMcpBundleSha256(PRODUCT_ROOT)',
        'readG26McpBundleAttestation(PRODUCT_ROOT)',
        'runtimeCandidateMatches(sourceRevision, bundleSha256)',
    ),
    CODEX_G26_BUNDLE_ATTESTATION_RELATIVE_PATH: (
        '"kind": "g26-mcp-runtime-bundle-attestation-v1"',
        '"bundleSha256":',
    ),
    'apps/mcp/src/result-presenter.ts': (
        'function compactDiscoveryResult(',
        'fullStructuredContentAvailable: true',
        'Only included rows are shown in this text view',
    ),
    'scripts/discovery-scenario-cases.ts': (
        '  G26: {',
        "exactTag: '女性向'",
        'export function selectDiscoveryScenario(',
    ),
    'scripts/generate-tool-acceptance-tasks.py': (
        'def codex_g26_report_is_valid(',
        'def codex_g26_candidate_bundle_sha256(',
        'def codex_g26_report_matches_candidate_revision(',
        'def validate_g26_frontier_evidence(',
    ),
}
CODEX_S02_PROBE_IMPLEMENTATION_MARKERS = {
    'scripts/generate-tool-acceptance-tasks.py': (
        'def codex_s02_report_is_valid(',
        'def codex_s02_report_matches_candidate_revision(',
    ),
    'packages/tools/src/definitions/read-tools.ts': (
        "name: 'bangumi.get_person_activity'",
        'top_rated_main_voice',
    ),
    'apps/mcp/s02-one-tool-mcp-server.mjs': (
        "const TOOL_NAME = 'bangumi.get_person_activity'",
        "serverProfile: 's02-one-tool-anonymous-public-v1'",
        'readS02McpBundleAttestation(PRODUCT_ROOT)',
    ),
    'scripts/acceptance/s02-agent-answer-check.mjs': (
        "export const S02_RANKING_ANSWER_CHECK_METHOD = 's02-top-rated-main-voice-answer-v1'",
        'export function verifyS02RankingAnswer(',
        'deterministicScoreOrder',
    ),
    'scripts/acceptance/run-s02-codex-agent-mcp.mjs': (
        'export function buildCodexExecArgs(',
        'export function assertS02CandidateReviewGate(',
        'export function createS02OneShotClaim(',
        'export function buildS02EvidenceReport(',
        'assertCandidateGate(sourceRevision)',
        "'features.shell_tool=false'",
        "'features.multi_agent=false'",
    ),
    'scripts/lib/s02-mcp-bundle.mjs': (
        "'docs/product/s02-mcp-bundle-attestation.json'",
        'export function readS02McpBundleAttestation(',
    ),
    'scripts/acceptance/write-s02-mcp-bundle-attestation.mjs': (
        'export function writeS02McpBundleAttestation(',
        'computeMcpBundleSha256(root)',
        "'pnpm', ['build']",
    ),
}
CODEX_D05_PROBE_IMPLEMENTATION_MARKERS = {
    'scripts/generate-tool-acceptance-tasks.py': (
        'def codex_d05_report_is_valid(',
        'def codex_d05_report_matches_candidate_revision(',
    ),
    'packages/discovery/src/query.ts': (
        "timeZone: 'Asia/Tokyo'",
        "input.season === 'current'",
    ),
    'packages/discovery/src/compiler.ts': (
        "query.season === undefined ? {} : { season: query.season }",
    ),
    'packages/tools/src/definitions/discovery-tools.ts': (
        '按运行时 Asia/Tokyo 日期解析为当前季度',
    ),
    'apps/mcp/d05-one-tool-mcp-server.mjs': (
        "const TARGET_TOOL = 'bangumi.query_subjects'",
        'readD05McpBundleAttestation(PRODUCT_ROOT)',
        'authorizeToolCall({',
    ),
    'scripts/acceptance/d05-current-season-answer-check.mjs': (
        "export const D05_ANSWER_CHECK_METHOD = 'd05-current-season-multitag-heat-v1'",
        'export function verifyD05CurrentSeasonAnswer(',
        'requestFilterMatches',
    ),
    'scripts/acceptance/run-d05-codex-agent-mcp.mjs': (
        'export function assertD05CandidateReviewGate(',
        'export function createD05OneShotClaim(',
        'function assertCurrentD05ReviewGate(',
        'const MODEL = \'gpt-6-luna\'',
    ),
    'scripts/acceptance/write-d05-agent-mcp-report.mjs': (
        "evidenceKind: 'codex_cli_d05_current_season_agent_mcp'",
        'verifyD05CurrentSeasonAnswer(',
        'export function assertD05ReportCandidate(',
        'function readCanonicalClaim(',
        "rawAnswerPersisted: false",
    ),
    'scripts/acceptance/write-d05-mcp-bundle-attestation.mjs': (
        'export function writeD05McpBundleAttestation(',
        'const previousAttestationBytes = existsSync(outputPath)',
        'readD05McpBundleAttestation(root)',
    ),
    'scripts/lib/d05-mcp-bundle.mjs': (
        'export function readD05McpBundleAttestation(',
    ),
    CODEX_D05_BUNDLE_ATTESTATION_RELATIVE_PATH: (
        '"kind": "d05-mcp-runtime-bundle-attestation-v1"',
        '"bundleSha256":',
    ),
}
CODEX_FORBIDDEN_CONTENT_KEYS = {
    'prompt', 'userprompt', 'rawprompt', 'answer', 'assistanttext', 'rawanswer',
    'resultbody', 'rawresult', 'rawtoolresult', 'structuredcontent', 'imagedata',
    'imagebytes', 'base64', 'credential', 'credentials', 'accesstoken', 'oauthtoken',
    'accountid', 'username', 'messagebody', 'replybody',
}


def _canonical_json_sha256(value: object) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(encoded.encode('utf-8')).hexdigest()


def _contains_forbidden_codex_content(value: object) -> bool:
    if isinstance(value, dict):
        for key, child in value.items():
            if str(key).replace('_', '').lower() in CODEX_FORBIDDEN_CONTENT_KEYS:
                return True
            if _contains_forbidden_codex_content(child):
                return True
    elif isinstance(value, list):
        return any(_contains_forbidden_codex_content(child) for child in value)
    return False


def codex_a01_result_is_valid(result: object) -> bool:
    """Validate the bounded, sanitized public projection for the A01 one-shot."""
    if not isinstance(result, dict) or set(result) != CODEX_A01_RESULT_FIELDS:
        return False
    states = {
        'complete', 'partial', 'conflict', 'unavailable', 'not_computable',
        'not_found', 'upstream_error', 'unsupported', 'stale', 'auth_required',
        'permission_denied',
    }
    metric_row_states = {'available', 'partial', 'missing', 'conflict', 'not_computable'}
    timestamp = re.compile(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z')

    def nonnegative_int(value: object) -> bool:
        return type(value) is int and value >= 0

    def nonnegative_safe_int(value: object) -> bool:
        return nonnegative_int(value) and value <= 9_007_199_254_740_991

    def finite_number(value: object) -> bool:
        return type(value) in (int, float) and math.isfinite(value)

    def optional_number(value: object) -> bool:
        return value is None or finite_number(value)

    def valid_time(value: object, optional: bool = False) -> bool:
        return optional and value is None or isinstance(value, str) and bool(timestamp.fullmatch(value))

    def expected_cohort_metric_state(
        coverage: dict, query_state: str, query_coverage_state: str,
    ) -> str:
        query_metric_state = (
            None if query_state == 'ok'
            else 'not_computable' if query_state == 'not_found'
            else query_state
        )
        if query_metric_state is not None and query_metric_state != 'partial':
            return query_metric_state
        if coverage['conflicts'] > 0:
            return 'conflict'
        if (coverage['valid'] == 0 and coverage['partial'] == 0
                and coverage['notComputable'] > 0 and coverage['missing'] == 0):
            return 'not_computable'
        if (query_metric_state == 'partial' or query_coverage_state != 'complete'
                or coverage['partial'] > 0 or coverage['missing'] > 0
                or coverage['notComputable'] > 0):
            return 'partial'
        if coverage['valid'] == 0:
            return 'not_computable'
        return 'complete'

    def expected_aggregate_metric_state(coverages: list[dict]) -> str:
        for state in (
            'upstream_error', 'auth_required', 'permission_denied',
            'unavailable', 'unsupported', 'stale',
        ):
            if any(coverage['state'] == state for coverage in coverages):
                return state
        if any(coverage['state'] == 'conflict' for coverage in coverages):
            return 'conflict'
        if all(coverage['state'] == 'not_computable' for coverage in coverages):
            return 'not_computable'
        if all(coverage['state'] == 'complete' for coverage in coverages):
            return 'complete'
        return 'partial'

    def expected_comparison_state(query_states: list[str], metric_states: list[str]) -> str:
        for state in (
            'upstream_error', 'auth_required', 'permission_denied',
            'unavailable', 'unsupported', 'stale',
        ):
            if state in query_states:
                return state
        if all(state == 'not_found' for state in query_states):
            return 'not_found'
        if 'conflict' in metric_states:
            return 'conflict'
        if all(state == 'not_computable' for state in metric_states):
            return 'not_computable'
        if (any(state != 'ok' for state in query_states)
                or any(state != 'complete' for state in metric_states)):
            return 'partial'
        return 'complete'

    def expected_query_coverage_state(query_coverage: dict) -> str:
        output_truncated = query_coverage['matched'] > query_coverage['returned']
        if (query_coverage['budgetExceeded']
                or output_truncated
                or query_coverage['hydrationsUnresolved'] > 0):
            return 'partial'
        if query_coverage['upstreamExhausted']:
            return 'complete'
        return 'unknown'

    if (result.get('state') not in states
            or result.get('formulaVersion') != 'subject-cohort-comparison-v1'
            or not isinstance(result.get('cohorts'), list)
            or len(result['cohorts']) != 2
            or not isinstance(result.get('ratingStandardDeviation'), dict)
            or not isinstance(result.get('coverage'), dict)
            or not isinstance(result.get('source'), dict)
            or not isinstance(result.get('evidence'), list)
            or not isinstance(result.get('warnings'), list)
            or not isinstance(result.get('comparisonMetrics'), list)
            or not isinstance(result.get('limitations'), list)
            or not valid_time(result.get('retrievedAt'), optional=True)):
        return False

    comparison_metric_keys = {
        'score', 'heat', 'episodesReported', 'ratingStandardDeviation',
    }
    comparison_metric_states: dict[str, str] = {}
    if len(result['comparisonMetrics']) != len(comparison_metric_keys):
        return False
    for comparison_metric in result['comparisonMetrics']:
        if (not isinstance(comparison_metric, dict)
                or set(comparison_metric) != {'key', 'state'}
                or not isinstance(comparison_metric.get('key'), str)
                or comparison_metric.get('key') not in comparison_metric_keys
                or comparison_metric.get('key') in comparison_metric_states
                or not isinstance(comparison_metric.get('state'), str)
                or comparison_metric.get('state') not in states):
            return False
        comparison_metric_states[comparison_metric['key']] = comparison_metric['state']

    returned_total = 0
    complete_count = 0
    partial_count = 0
    hydration_totals = {'attempted': 0, 'succeeded': 0, 'failed': 0}
    cohort_rating_coverage: list[dict] = []
    cohort_ids: list[set[int]] = []
    for index, cohort in enumerate(result['cohorts']):
        if (not isinstance(cohort, dict)
                or not CODEX_A01_COHORT_FIELDS.issuperset(cohort)
                or not {'label', 'query', 'querySummary', 'queryPlan', 'queryState',
                        'queryCoverage', 'detailHydrations',
                        'ratingStandardDeviationCoverage', 'subjects'}.issubset(cohort)
                or not isinstance(cohort.get('label'), str)
                or len(cohort['label']) > 80
                or cohort.get('label') != CODEX_A01_QUERY_ARGUMENTS['cohorts'][index]['label']
                or cohort.get('query') != {
                    **CODEX_A01_QUERY_ARGUMENTS['cohorts'][index]['query'],
                    'limit': CODEX_A01_QUERY_ARGUMENTS['maxSubjects'],
                    'budget': CODEX_A01_QUERY_BUDGET,
                }
                or not isinstance(cohort.get('querySummary'), str)
                or len(cohort['querySummary']) > 500
                or cohort.get('queryState') not in {'ok', 'partial', 'not_found'}
                or not isinstance(cohort.get('queryCoverage'), dict)
                or not isinstance(cohort.get('queryPlan'), dict)
                or not isinstance(cohort.get('detailHydrations'), dict)
                or not isinstance(cohort.get('ratingStandardDeviationCoverage'), dict)
                or not isinstance(cohort.get('subjects'), list)
                or len(cohort['subjects']) > CODEX_A01_QUERY_ARGUMENTS['maxSubjects']):
            return False

        plan = cohort['queryPlan']
        if plan != codex_a01_expected_query_plan(index):
            return False

        query_coverage = cohort['queryCoverage']
        query_coverage_required = {
            'state', 'requested', 'scanned', 'matched', 'returned', 'pagesRequested',
            'pagesScanned', 'upstreamExhausted', 'budgetExceeded', 'postFilterCount',
            'totalKind', 'hydrationsAttempted', 'hydrationsSucceeded', 'hydrationsFailed',
            'hydrationsUnresolved', 'hydrationBudgetExceeded',
        }
        if (not CODEX_A01_QUERY_COVERAGE_FIELDS.issuperset(query_coverage)
                or not query_coverage_required.issubset(query_coverage)
                or query_coverage.get('state') not in {'complete', 'partial', 'unknown'}
                or query_coverage.get('totalKind') != plan['totalKind']
                or any(not nonnegative_int(query_coverage.get(key)) for key in (
                    'requested', 'scanned', 'matched', 'returned', 'pagesRequested',
                    'pagesScanned', 'postFilterCount', 'hydrationsAttempted',
                    'hydrationsSucceeded', 'hydrationsFailed', 'hydrationsUnresolved',
                ))
                or query_coverage['returned'] != len(cohort['subjects'])
                or query_coverage['matched'] < query_coverage['returned']
                or query_coverage['scanned'] < query_coverage['matched']
                or query_coverage['requested'] > 300
                or query_coverage['scanned'] > 300
                or query_coverage['matched'] > 300
                or query_coverage['postFilterCount'] > 300
                or query_coverage['pagesRequested'] > 6
                or query_coverage['requested'] != (
                    query_coverage['scanned'] if query_coverage['upstreamExhausted'] else 0
                )
                or query_coverage['pagesScanned'] > query_coverage['pagesRequested']
                or query_coverage['pagesScanned'] > 6
                or query_coverage['hydrationsAttempted'] > 60
                or query_coverage['hydrationsSucceeded'] + query_coverage['hydrationsFailed']
                    > query_coverage['hydrationsAttempted']
                or type(query_coverage.get('upstreamExhausted')) is not bool
                or type(query_coverage.get('budgetExceeded')) is not bool
                or type(query_coverage.get('hydrationBudgetExceeded')) is not bool
                or (query_coverage['hydrationBudgetExceeded']
                    and not query_coverage['budgetExceeded'])
                or ('missing' in query_coverage and not nonnegative_int(query_coverage['missing']))
                or ('unresolvedCandidates' in query_coverage
                    and (
                        not nonnegative_int(query_coverage['unresolvedCandidates'])
                        or query_coverage['unresolvedCandidates']
                            != query_coverage['hydrationsUnresolved']
                    ))
                or ('outputCap' in query_coverage and query_coverage['outputCap'] is not None
                    and (not nonnegative_int(query_coverage['outputCap'])
                         or query_coverage['outputCap'] > 8))
                or ('reason' in query_coverage and (
                    not isinstance(query_coverage['reason'], str)
                    or len(query_coverage['reason']) > 240
                ))):
            return False
        expected_coverage_state = expected_query_coverage_state(query_coverage)
        if query_coverage['state'] != expected_coverage_state:
            return False
        expected_query_state = (
            'partial' if expected_coverage_state == 'partial'
            else 'not_found' if query_coverage['returned'] == 0
            else 'ok'
        )
        if cohort['queryState'] != expected_query_state:
            return False
        if query_coverage['state'] == 'complete':
            complete_count += 1
        else:
            partial_count += 1

        detail = cohort['detailHydrations']
        if (set(detail) != {'attempted', 'succeeded', 'failed'}
                or any(not nonnegative_int(detail.get(key)) for key in detail)
                or detail['attempted'] > CODEX_A01_QUERY_ARGUMENTS['maxSubjects']
                or detail['attempted'] != len(cohort['subjects'])
                or detail['succeeded'] + detail['failed'] != detail['attempted']):
            return False
        for key in hydration_totals:
            hydration_totals[key] += detail[key]

        metric_coverage = cohort['ratingStandardDeviationCoverage']
        if (set(metric_coverage) != {
                'valid', 'partial', 'missing', 'conflicts', 'notComputable', 'state',
            }
                or any(not nonnegative_int(metric_coverage.get(key)) for key in (
                    'valid', 'partial', 'missing', 'conflicts', 'notComputable',
                ))
                or metric_coverage.get('state') not in states
                or sum(metric_coverage[key] for key in (
                    'valid', 'partial', 'missing', 'conflicts', 'notComputable',
                )) != len(cohort['subjects'])):
            return False
        if detail['failed'] > metric_coverage['notComputable']:
            return False

        ids: set[int] = set()
        row_states: dict[str, int] = {state: 0 for state in metric_row_states}
        for subject in cohort['subjects']:
            required_subject_fields = {
                'id', 'name', 'displayName', 'ratingStandardDeviationState',
            }
            if (not isinstance(subject, dict)
                    or not CODEX_A01_SUBJECT_FIELDS.issuperset(subject)
                    or not required_subject_fields.issubset(subject)
                    or not nonnegative_int(subject.get('id'))
                    or subject['id'] in ids
                    or not isinstance(subject.get('name'), str)
                    or not subject['name']
                    or len(subject['name']) > 180
                    or not isinstance(subject.get('displayName'), str)
                    or not subject['displayName']
                    or len(subject['displayName']) > 180
                    or subject.get('ratingStandardDeviationState') not in metric_row_states
                    or ('date' in subject and (
                        not isinstance(subject['date'], str) or len(subject['date']) > 40
                    ))
                    or ('ratingCount' in subject and not nonnegative_int(subject['ratingCount']))
                    or ('ratingCountState' in subject and (
                        subject['ratingCountState'] != 'invalid' or 'ratingCount' in subject
                    ))
                    or ('ratingHistogramPopulation' in subject
                        and not nonnegative_int(subject['ratingHistogramPopulation']))
                    or ('ratingStandardDeviation' in subject and (
                        not finite_number(subject['ratingStandardDeviation'])
                        or subject['ratingStandardDeviation'] < 0
                    ))):
                return False
            row_state = subject['ratingStandardDeviationState']
            if (row_state in {'available', 'partial'}
                    and 'ratingStandardDeviation' not in subject):
                return False
            if (row_state in {'missing', 'not_computable'}
                    and 'ratingStandardDeviation' in subject):
                return False
            ids.add(subject['id'])
            row_states[row_state] += 1
            conflicts = subject.get('ratingStandardDeviationConflicts', [])
            if not isinstance(conflicts, list) or len(conflicts) > 8:
                return False
            for conflict in conflicts:
                if not isinstance(conflict, dict):
                    return False
                score_conflict = conflict.get('kind') == 'score_vs_histogram_mean'
                expected_conflict_fields = (
                    {'kind', 'officialScore', 'histogramMean', 'reason'}
                    if score_conflict else
                    {'kind', 'discoveryRatingCount', 'detailRatingTotal', 'reason'}
                )
                if (set(conflict) != expected_conflict_fields
                        or conflict.get('kind') not in {
                            'score_vs_histogram_mean', 'discovery_vs_detail_rating_total',
                        }
                        or not isinstance(conflict.get('reason'), str)
                        or len(conflict['reason']) > 240
                        or (score_conflict and (
                            not finite_number(conflict.get('officialScore'))
                            or not finite_number(conflict.get('histogramMean'))
                            or not 0 <= conflict['officialScore'] <= 10
                            or not 0 <= conflict['histogramMean'] <= 10
                        ))
                        or (not score_conflict and (
                            not nonnegative_int(conflict.get('discoveryRatingCount'))
                            or not nonnegative_int(conflict.get('detailRatingTotal'))
                        ))):
                    return False
            total_validation = subject.get('ratingHistogramTotalValidation')
            if total_validation is not None:
                if (not isinstance(total_validation, dict)
                        or not set(total_validation).issubset({
                            'state', 'detailRatingTotal', 'histogramPopulation',
                        })
                        or total_validation.get('state') not in {'match', 'mismatch', 'invalid'}
                        or not nonnegative_safe_int(total_validation.get('histogramPopulation'))):
                    return False
                validation_state = total_validation['state']
                has_detail_total = 'detailRatingTotal' in total_validation
                detail_total = total_validation.get('detailRatingTotal')
                if validation_state == 'invalid':
                    if has_detail_total and (
                        not finite_number(detail_total)
                        or nonnegative_safe_int(detail_total)
                    ):
                        return False
                elif (not has_detail_total or not nonnegative_safe_int(detail_total)
                      or (validation_state == 'match'
                          and detail_total != total_validation['histogramPopulation'])
                      or (validation_state == 'mismatch'
                          and detail_total == total_validation['histogramPopulation'])):
                    return False

        for state, count_key in (
            ('available', 'valid'), ('partial', 'partial'), ('missing', 'missing'),
            ('conflict', 'conflicts'), ('not_computable', 'notComputable'),
        ):
            if row_states[state] != metric_coverage[count_key]:
                return False
        if metric_coverage['state'] != expected_cohort_metric_state(
            metric_coverage, cohort['queryState'], query_coverage['state'],
        ):
            return False
        cohort_rating_coverage.append(metric_coverage)
        if index == 0:
            target_rows = cohort['subjects']
            if (len(target_rows) != 1
                    or target_rows[0]['id'] != 218707
                    or not {'少女终末旅行', '少女終末旅行'}.intersection({
                        target_rows[0]['name'], target_rows[0]['displayName'],
                    })):
                return False
        cohort_ids.append(ids)
        returned_total += len(cohort['subjects'])

    if result['state'] not in states:
        return False
    metric = result['ratingStandardDeviation']
    required_metric_fields = {
        'key', 'label', 'sourceField', 'averages', 'validCounts', 'partialCounts',
        'missingCounts', 'conflictCounts', 'notComputableCounts', 'formula', 'state',
    }
    if (not CODEX_A01_METRIC_FIELDS.issuperset(metric)
            or not required_metric_fields.issubset(metric)
            or metric.get('key') != 'ratingStandardDeviation'
            or metric.get('sourceField') != 'subject.rating.count[1..10]'
            or metric.get('state') not in states
            or not isinstance(metric.get('label'), str)
            or len(metric['label']) > 80
            or not isinstance(metric.get('formula'), dict)
            or set(metric['formula']) != {'id', 'version', 'description'}
            or metric['formula'].get('id') != 'bangumi.rating.population_sd.v1'
            or metric['formula'].get('version') != 1
            or not isinstance(metric['formula'].get('description'), str)
            or len(metric['formula']['description']) > 240):
        return False
    for key in ('averages', 'validCounts', 'partialCounts', 'missingCounts',
                'conflictCounts', 'notComputableCounts'):
        values = metric.get(key)
        if not isinstance(values, list) or len(values) != 2:
            return False
        if key == 'averages':
            if any(not optional_number(value) for value in values):
                return False
        elif any(not nonnegative_int(value) for value in values):
            return False
    if ('partialAverages' in metric
            and (not isinstance(metric['partialAverages'], list)
                 or len(metric['partialAverages']) != 2
                 or any(not optional_number(value) for value in metric['partialAverages']))):
        return False
    if 'delta' in metric and not optional_number(metric['delta']):
        return False
    if metric['state'] != expected_aggregate_metric_state(cohort_rating_coverage):
        return False
    if metric['state'] == 'complete':
        if ('partialAverages' in metric
                or any(not finite_number(value) or value < 0 for value in metric['averages'])
                or 'delta' not in metric
                or not finite_number(metric['delta'])
                or not math.isclose(
                    metric['delta'], metric['averages'][1] - metric['averages'][0],
                    rel_tol=1e-9, abs_tol=1e-9,
                )
                or any(coverage['state'] != 'complete' or coverage['valid'] == 0
                       or coverage['partial'] != 0 or coverage['missing'] != 0
                       or coverage['conflicts'] != 0 or coverage['notComputable'] != 0
                       for coverage in cohort_rating_coverage)):
            return False
    elif (metric['averages'] != [None, None]
          or 'partialAverages' not in metric
          or 'delta' in metric
          or any(
              (coverage['valid'] + coverage['partial'] > 0) != finite_number(value)
              for coverage, value in zip(cohort_rating_coverage, metric['partialAverages'])
          )
          or any(finite_number(value) and value < 0 for value in metric['partialAverages'])):
        return False
    for index, coverage in enumerate(cohort_rating_coverage):
        for metric_key, coverage_key in (
            ('validCounts', 'valid'), ('partialCounts', 'partial'),
            ('missingCounts', 'missing'), ('conflictCounts', 'conflicts'),
            ('notComputableCounts', 'notComputable'),
        ):
            if metric[metric_key][index] != coverage[coverage_key]:
                return False
    if comparison_metric_states['ratingStandardDeviation'] != metric['state']:
        return False
    query_states = [cohort['queryState'] for cohort in result['cohorts']]
    metric_states = [
        comparison_metric_states[key]
        for key in ('score', 'heat', 'episodesReported', 'ratingStandardDeviation')
    ]
    if result['state'] != expected_comparison_state(query_states, metric_states):
        return False

    coverage = result['coverage']
    required_coverage = CODEX_A01_RESULT_COVERAGE_FIELDS
    if (not isinstance(coverage, dict)
            or set(coverage) != required_coverage
            or coverage.get('maxSubjectsPerCohort') != CODEX_A01_QUERY_ARGUMENTS['maxSubjects']
            or coverage.get('totalSubjectsReturned') != returned_total
            or coverage.get('cohortsComplete') != complete_count
            or coverage.get('cohortsPartial') != partial_count
            or coverage.get('detailHydrationsAttempted') != hydration_totals['attempted']
            or coverage.get('detailHydrationsSucceeded') != hydration_totals['succeeded']
            or coverage.get('detailHydrationsFailed') != hydration_totals['failed']
            or type(coverage.get('truncated')) is not bool):
        return False
    overlap = coverage.get('overlap')
    expected_overlap = sorted(cohort_ids[0] & cohort_ids[1])
    if (not isinstance(overlap, dict)
            or set(overlap) != CODEX_A01_OVERLAP_FIELDS
            or overlap.get('subjectIds') != expected_overlap
            or overlap.get('count') != len(expected_overlap)):
        return False

    evidence_coverage = coverage.get('evidence')
    if (not isinstance(evidence_coverage, dict)
            or set(evidence_coverage) != CODEX_A01_EVIDENCE_COVERAGE_FIELDS
            or any(not nonnegative_int(evidence_coverage.get(key)) for key in (
                'retained', 'omitted', 'deduplicated', 'omittedByBound', 'bytes',
                'maxRefs', 'maxBytes',
            ))
            or evidence_coverage['retained'] != len(result['evidence'])
            or evidence_coverage['omitted'] != (
                evidence_coverage['deduplicated'] + evidence_coverage['omittedByBound']
            )
            or evidence_coverage['retained'] > evidence_coverage['maxRefs']
            or evidence_coverage['bytes'] > evidence_coverage['maxBytes']
            or evidence_coverage['omittedByBound'] > evidence_coverage['omitted']
            or evidence_coverage['maxRefs'] != 256
            or evidence_coverage['maxBytes'] != 96_000
            or type(evidence_coverage.get('truncated')) is not bool
            or evidence_coverage['truncated'] != (evidence_coverage['omittedByBound'] > 0)):
        return False
    evidence_classes: set[str] = set()
    official_evidence_operations: set[str] = set()
    for item in result['evidence']:
        source = item.get('source') if isinstance(item, dict) else None
        if (not isinstance(item, dict)
                or set(item) != {'source', 'retrievedAt'}
                or not isinstance(source, dict)
                or not isinstance(source.get('class'), str)
                or source.get('class') not in {'official_v0', 'derived'}
                or not valid_time(item.get('retrievedAt'))):
            return False
        if source.get('class') == 'official_v0':
            if (not set(source).issubset(CODEX_A01_EVIDENCE_SOURCE_FIELDS)
                    or not {'class', 'provider', 'version', 'operation'}.issubset(source)
                    or source.get('provider') != 'bangumi'
                    or source.get('version') != 'v0'
                    or not isinstance(source.get('operation'), str)
                    or source.get('operation') not in CODEX_A01_OFFICIAL_OPERATIONS
                    or ('experimental' in source and type(source['experimental']) is not bool)):
                return False
            official_evidence_operations.add(source['operation'])
        elif (not set(source).issubset(CODEX_A01_EVIDENCE_SOURCE_FIELDS)
              or source.get('provider') != 'bangumi-agent-kit'
              or not {'class', 'provider'}.issubset(source)
              or ('operation' in source and (
                  not isinstance(source['operation'], str)
                  or not re.fullmatch(r'[A-Za-z0-9_.-]{1,160}', source['operation'])
              ))
              or ('version' in source and (
                  not isinstance(source['version'], str)
                  or not re.fullmatch(r'[A-Za-z0-9_.-]{1,80}', source['version'])
              ))
              or ('experimental' in source and type(source['experimental']) is not bool)):
            return False
        evidence_classes.add(source['class'])

    warning_coverage = coverage.get('warnings')
    if (not isinstance(warning_coverage, dict)
            or set(warning_coverage) != CODEX_A01_WARNING_COVERAGE_FIELDS
            or any(not nonnegative_int(warning_coverage.get(key)) for key in (
                'retained', 'omitted', 'max',
            ))
            or warning_coverage['retained'] != len(result['warnings'])
            or warning_coverage['retained'] > warning_coverage['max']
            or warning_coverage['max'] != 12
            or type(warning_coverage.get('truncated')) is not bool
            or warning_coverage['truncated'] != (warning_coverage['omitted'] > 0)
            or len(result['warnings']) > 12
            or any(not isinstance(item, dict)
                   or not set(item).issubset({'code', 'state', 'message', 'cohort'})
                   or not {'code', 'state', 'message'}.issubset(item)
                   or not isinstance(item.get('code'), str)
                   or not re.fullmatch(r'[A-Z0-9_]{1,80}', item['code'])
                   or item.get('state') not in states | {'ok'}
                   or not isinstance(item.get('message'), str)
                   or len(item['message']) > 500
                   or ('cohort' in item and (
                       not isinstance(item['cohort'], str) or len(item['cohort']) > 80
                   )) for item in result['warnings'])):
        return False
    if any(not isinstance(item, str) or not item or len(item) > 500
           for item in result['limitations']) or not result['limitations']:
        return False
    expected_truncated = (
        partial_count > 0
        or any(cohort['queryCoverage']['budgetExceeded'] for cohort in result['cohorts'])
        or evidence_coverage['truncated']
        or warning_coverage['truncated']
    )
    if coverage['truncated'] != expected_truncated:
        return False

    source = result['source']
    if set(source) != {'official', 'derived'}:
        return False
    for key, expected_class in (('official', 'official-v0'), ('derived', 'derived-s7')):
        summary = source.get(key)
        if (not isinstance(summary, dict)
                or not CODEX_A01_SOURCE_SUMMARY_FIELDS.issuperset(summary)
                or not {'class', 'operations', 'attemptedAt'}.issubset(summary)
                or summary.get('class') != expected_class
                or not isinstance(summary.get('operations'), list)
                or len(summary['operations']) > 16
                or any(not isinstance(operation, str) or not operation or len(operation) > 240
                       for operation in summary['operations'])
                or not valid_time(summary.get('attemptedAt'))
                or ('retrievedAt' in summary
                    and not valid_time(summary['retrievedAt'], optional=True))):
            return False
    official_operations = source['official']['operations']
    if (not official_operations
            or any(not isinstance(operation, str)
                   or operation not in CODEX_A01_OFFICIAL_OPERATIONS
                   for operation in official_operations)
            or not source['official'].get('retrievedAt')
            or 'official_v0' not in evidence_classes
            or not official_evidence_operations.issubset(set(official_operations))
            or (not evidence_coverage['truncated']
                and set(official_operations) != official_evidence_operations)):
        return False

    return True


def codex_a01_report_is_valid(report: object, current_by_name: dict[str, dict]) -> bool:
    """Accept only exact-Candidate Luna Max A01 evidence with its checked bounded result."""
    if (not isinstance(report, dict)
            or set(report) != CODEX_A01_REPORT_FIELDS
            or type(report.get('schemaVersion')) is not int
            or report.get('schemaVersion') != 1
            or report.get('evidenceKind') != 'codex_cli_a01_agent_mcp'
            or report.get('profile') != 'codex-luna-max-one-tool-v1'
            or report.get('scenarioId') != 'A01'
            or report.get('frontierId') != 'A01'
            or report.get('epochId') != 'run95-a01-agent-mcp-acceptance'
            or report.get('runNumber') != 95
            or report.get('state') != 'ANSWER_CHECK_PASSED'
            or report.get('model') != 'gpt-6-luna'
            or report.get('reasoningEffort') != 'max'
            or not isinstance(report.get('codexCliVersion'), str)
            or not re.fullmatch(
                r'\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?',
                report['codexCliVersion'],
            )
            or report.get('toolName') != 'bangumi.compare_subject_cohorts'
            or report.get('argumentProfile') != CODEX_A01_ARGUMENT_PROFILE
            or report.get('expectedArgumentsSha256') != _canonical_json_sha256(
                CODEX_A01_QUERY_ARGUMENTS,
            )
            or report.get('queryArguments') != CODEX_A01_QUERY_ARGUMENTS
            or type(report.get('processExitCode')) is not int
            or report.get('processExitCode') != 0
            or report.get('resultCount') != 1
            or report.get('eventStreamParsed') is not True
            or report.get('codexMcpToolEventCount') != 1
            or report.get('nonMcpToolEventCount') != 0
            or report.get('shellToolCallCount') != 0
            or report.get('allowedCallCount') != 1
            or report.get('deniedCallCount') != 0
            or report.get('resultStatus') != 'SUCCESS'
            or report.get('qqPipelineTested') is not False
            or report.get('timClientTested') is not False
            or report.get('serverSummaryMatchesCandidate') is not True
            or report.get('sameCandidateAfterCall') is not True
            or report.get('serverToolNames') != ['bangumi.compare_subject_cohorts']
            or report.get('serverToolCount') != 1
            or report.get('mcpServerNames') != ['bgk_a01_one_tool']
            or not isinstance(report.get('sourceRevision'), str)
            or not re.fullmatch(r'[0-9a-f]{40}', report['sourceRevision'])
            or not isinstance(report.get('baseSha'), str)
            or not re.fullmatch(r'[0-9a-f]{40}', report['baseSha'])
            or _run_repository_git(
                ROOT, 'merge-base', '--is-ancestor', report['baseSha'], report['sourceRevision'],
            ).returncode != 0
            or not isinstance(report.get('mcpBundleSha256'), str)
            or not re.fullmatch(r'[0-9a-f]{64}', report['mcpBundleSha256'])
            or not codex_a01_probe_revision_has_implementation(report['sourceRevision'])
            or codex_g26_candidate_bundle_sha256(report['sourceRevision'])
                != report['mcpBundleSha256']):
        return False

    timestamp = re.compile(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z')
    if not isinstance(report.get('observedAt'), str) or not timestamp.fullmatch(report['observedAt']):
        return False

    candidate_gate = report.get('candidateGate')
    if (not isinstance(candidate_gate, dict)
            or set(candidate_gate) != CODEX_A01_CANDIDATE_GATE_FIELDS
            or candidate_gate.get('candidateSha') != report['sourceRevision']
            or candidate_gate.get('baseSha') != report['baseSha']
            or candidate_gate.get('reviewPassSha') != report['sourceRevision']
            or candidate_gate.get('reviewVerdict') != 'PASS'
            or not isinstance(candidate_gate.get('reviewerId'), str)
            or not re.search(r'gpt[-_]6[-_]luna[-_]max', candidate_gate['reviewerId'], re.I)
            or candidate_gate.get('ciSha') != report['sourceRevision']
            or candidate_gate.get('ciStatus') != 'SUCCESS'):
        return False

    tool = current_by_name.get(report['toolName'])
    try:
        catalog_bytes = CATALOG.read_bytes()
    except OSError:
        return False
    if (not isinstance(tool, dict)
            or tool.get('auth') != 'none'
            or tool.get('risk') != 'read'
            or report.get('catalogSha256') != hashlib.sha256(catalog_bytes).hexdigest()
            or report.get('toolDescriptionSha256') != hashlib.sha256(
                tool.get('description', '').encode('utf-8'),
            ).hexdigest()
            or report.get('inputSchemaSha256') != _canonical_json_sha256(tool.get('inputSchema'))
            or any(not re.fullmatch(r'[0-9a-f]{64}', str(report.get(key, '')))
                   for key in ('catalogSha256', 'toolDescriptionSha256', 'inputSchemaSha256'))):
        return False

    checks = report.get('answerChecks')
    if (not isinstance(checks, dict)
            or set(checks) != CODEX_A01_ANSWER_CHECK_FIELDS
            or any(value is not True for value in checks.values())
            or report.get('answerCheckMethod') != 'a01-bounded-cohort-answer-v1'
            or not isinstance(report.get('answerSha256'), str)
            or not re.fullmatch(r'[0-9a-f]{64}', report['answerSha256'])
            or type(report.get('answerUtf8Bytes')) is not int
            or report['answerUtf8Bytes'] <= 0
            or report['answerUtf8Bytes'] > 64_000):
        return False

    expected_call = [{
        'name': 'bangumi.compare_subject_cohorts',
        'state': 'DONE',
        'arguments': CODEX_A01_QUERY_ARGUMENTS,
    }]
    if report.get('toolCalls') != expected_call or not codex_a01_result_is_valid(report.get('result')):
        return False
    privacy = report.get('privacy')
    expected_privacy = {
        'authProfile': 'anonymous',
        'oauthAttempted': False,
        'accountDataRead': False,
        'writesAttempted': False,
        'qqPipelineTested': False,
        'timClientTested': False,
        'promptStored': False,
        'answerStored': False,
        'rawResultStored': False,
        'artifactImageBytesStored': False,
        'credentialsStored': False,
    }
    return (
        isinstance(privacy, dict)
        and set(privacy) == CODEX_A01_PRIVACY_FIELDS
        and privacy == expected_privacy
        and report.get('acceptanceLimit') == (
            'One anonymous current-snapshot sample only; this does not establish global season coverage or statistical significance. No retry is authorized.'
        )
        and not _contains_forbidden_codex_content(report)
    )


def codex_g20_result_is_valid(result: object, expected_subject_id: int) -> bool:
    if not isinstance(result, dict) or set(result) != CODEX_G20_RESULT_FIELDS:
        return False
    if (result.get('toolName') != 'bangumi.get_subject_relations'
            or result.get('resultState') not in {'observed', 'partial'}
            or type(result.get('sourceSubjectId')) is not int
            or result['sourceSubjectId'] != expected_subject_id
            or type(result.get('resultByteLength')) is not int
            or result['resultByteLength'] <= 0
            or not re.fullmatch(r'[0-9a-f]{64}', str(result.get('resultSha256', '')))
            or type(result.get('limitationsCount')) is not int
            or result['limitationsCount'] <= 0):
        return False

    source = result.get('source')
    if (not isinstance(source, dict)
            or set(source) != CODEX_G20_SOURCE_FIELDS
            or source.get('api') != 'Bangumi official v0'
            or source.get('operation') != 'GET /v0/subjects/{subject_id}/subjects'
            or source.get('direction') != 'source_subject_to_returned_target'
            or source.get('scope') != 'visible_direct_rows_returned_for_source_subject'
            or not isinstance(source.get('retrievedAt'), str)
            or not re.fullmatch(
                r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z',
                source['retrievedAt'],
            )):
        return False

    coverage = result.get('coverage')
    if (not isinstance(coverage, dict)
            or set(coverage) != CODEX_G20_COVERAGE_FIELDS
            or any(type(coverage.get(key)) is not int or coverage[key] < 0 for key in (
                'responseRowsObserved', 'rowsReturned', 'schemaDriftRows',
            ))
            or type(coverage.get('truncated')) is not bool
            or coverage.get('paginationAvailable') is not False
            or coverage.get('totalCountAvailable') is not False
            or coverage.get('completeness') != 'not_provided_by_source'
            or coverage['responseRowsObserved'] != (
                coverage['rowsReturned'] + coverage['schemaDriftRows']
            )
            or coverage['truncated'] != (coverage['schemaDriftRows'] > 0)):
        return False
    if result['resultState'] != ('partial' if coverage['truncated'] else 'observed'):
        return False

    rows = result.get('visibleRows')
    if not isinstance(rows, list) or not rows:
        return False
    for row in rows:
        if (not isinstance(row, dict)
                or set(row) not in ({'id', 'name', 'relation'}, CODEX_G20_VISIBLE_ROW_FIELDS)
                or type(row.get('id')) is not int or row['id'] <= 0
                or not isinstance(row.get('name'), str) or not row['name'].strip()
                or not isinstance(row.get('relation'), str) or not row['relation'].strip()
                or ('nameCn' in row and (
                    not isinstance(row['nameCn'], str) or not row['nameCn'].strip()
                ))):
            return False
    if len({row['id'] for row in rows}) != len(rows):
        return False
    if coverage['rowsReturned'] != len(rows):
        return False

    text_projection = result.get('textProjection')
    if (not isinstance(text_projection, dict)
            or set(text_projection) != CODEX_G20_TEXT_PROJECTION_FIELDS
            or type(text_projection.get('textUtf8Bytes')) is not int
            or not 0 < text_projection['textUtf8Bytes'] <= 3600
            or any(type(text_projection.get(key)) is not int or text_projection[key] < 0 for key in (
                'rowsIncluded', 'rowsOmitted', 'displayNamesClipped',
                'relationLabelsClipped', 'limitationsClipped', 'imageFieldsOmitted',
            ))
            or type(text_projection.get('fullStructuredContentAvailable')) is not bool
            or text_projection['fullStructuredContentAvailable'] is not True
            or text_projection['rowsIncluded'] + text_projection['rowsOmitted'] != len(rows)
            or (text_projection['rowsOmitted'] > 0
                and not text_projection['fullStructuredContentAvailable'])):
        return False

    answer_counters = result.get('answerCounters')
    if (not isinstance(answer_counters, dict)
            or set(answer_counters) != CODEX_G20_ANSWER_COUNTER_FIELDS
            or any(type(value) is not int or value < 0 for value in answer_counters.values())
            or answer_counters['visibleSourceRows'] != len(rows)
            or answer_counters['invalidSourceRowsCount'] != 0
            or answer_counters['duplicateSourceRowsCount'] != 0
            or answer_counters['answerRowsParsed'] != len(rows)
            or answer_counters['rowsMatched'] != len(rows)
            or any(answer_counters[key] != 0 for key in (
                'missingRowsCount', 'mismatchedRowsCount', 'unmatchedRowsCount',
                'duplicateAnswerRowsCount', 'unstructuredAnswerLinesCount',
            ))
            or answer_counters['toolTextUtf8Bytes'] != text_projection['textUtf8Bytes']):
        return False

    operations = result.get('sourceOperations')
    if not isinstance(operations, list) or operations:
        # The one-tool server does not expose HTTP-attempt telemetry for this result.
        return False
    artifact = result.get('artifact')
    return artifact == {'returned': False, 'persisted': False}


_GIT_REPOSITORY_OVERRIDE_KEYS = {
    'GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_CEILING_DIRECTORIES', 'GIT_DISCOVERY_ACROSS_FILESYSTEM',
    'GIT_NAMESPACE', 'GIT_PREFIX', 'GIT_CONFIG',
}


def _sanitized_repository_git_environment() -> dict[str, str]:
    environment = os.environ.copy()
    for key in tuple(environment):
        if key in _GIT_REPOSITORY_OVERRIDE_KEYS or key.startswith('GIT_CONFIG_'):
            environment.pop(key, None)
    environment.update({
        'GIT_CONFIG_GLOBAL': os.devnull,
        'GIT_CONFIG_SYSTEM': os.devnull,
        'GIT_CONFIG_NOSYSTEM': '1',
    })
    return environment


def _run_repository_git(
    repository_root: str | Path, *arguments: str,
) -> subprocess.CompletedProcess:
    """Run a Git read against this checkout, ignoring caller-selected Git metadata/config."""
    return subprocess.run(
        ['git', *arguments],
        cwd=repository_root,
        env=_sanitized_repository_git_environment(),
        capture_output=True,
        text=True,
        check=False,
    )


def _codex_revision_has_markers(
    repository_root: str, revision: str, markers_by_path: dict[str, tuple[str, ...]],
) -> bool:
    resolved = _run_repository_git(
        repository_root, 'rev-parse', '--verify', f'{revision}^{{commit}}',
    )
    if resolved.returncode != 0 or resolved.stdout.strip() != revision:
        return False
    for relative_path, markers in markers_by_path.items():
        source = _run_repository_git(repository_root, 'show', f'{revision}:{relative_path}')
        if source.returncode != 0 or any(marker not in source.stdout for marker in markers):
            return False
    return True


@functools.lru_cache(maxsize=128)
def _codex_probe_revision_has_implementation(repository_root: str, revision: str) -> bool:
    """Bind a report revision to the tracked one-tool server and its evidence checks."""
    return _codex_revision_has_markers(
        repository_root, revision, CODEX_PROBE_IMPLEMENTATION_MARKERS,
    )


def codex_probe_revision_has_implementation(revision: object) -> bool:
    if not isinstance(revision, str) or not re.fullmatch(r'[0-9a-f]{40}', revision):
        return False
    return _codex_probe_revision_has_implementation(str(ROOT), revision)


@functools.lru_cache(maxsize=128)
def _codex_d04_probe_revision_has_implementation(repository_root: str, revision: str) -> bool:
    """Bind D04 query evidence to the exact isolated runner, MCP server, and answer checker."""
    return _codex_revision_has_markers(
        repository_root, revision, CODEX_D04_PROBE_IMPLEMENTATION_MARKERS,
    )


def codex_d04_probe_revision_has_implementation(revision: object) -> bool:
    if not isinstance(revision, str) or not re.fullmatch(r'[0-9a-f]{40}', revision):
        return False
    return _codex_d04_probe_revision_has_implementation(str(ROOT), revision)


def codex_g20_probe_revision_has_implementation(revision: object) -> bool:
    if not isinstance(revision, str) or not re.fullmatch(r'[0-9a-f]{40}', revision):
        return False
    return (
        codex_probe_revision_has_implementation(revision)
        and _codex_revision_has_markers(
            str(ROOT), revision, CODEX_G20_PROBE_IMPLEMENTATION_MARKERS,
        )
    )


def codex_a01_probe_revision_has_implementation(revision: object) -> bool:
    if not isinstance(revision, str) or not re.fullmatch(r'[0-9a-f]{40}', revision):
        return False
    return (
        codex_probe_revision_has_implementation(revision)
        and _codex_revision_has_markers(
            str(ROOT), revision, CODEX_A01_PROBE_IMPLEMENTATION_MARKERS,
        )
    )


def codex_g02_probe_revision_has_implementation(revision: object) -> bool:
    if not isinstance(revision, str) or not re.fullmatch(r'[0-9a-f]{40}', revision):
        return False
    return (
        codex_probe_revision_has_implementation(revision)
        and _codex_revision_has_markers(
            str(ROOT), revision, CODEX_G02_PROBE_IMPLEMENTATION_MARKERS,
        )
    )


def codex_g26_probe_revision_has_implementation(revision: object) -> bool:
    if not isinstance(revision, str) or not re.fullmatch(r'[0-9a-f]{40}', revision):
        return False
    return (
        codex_probe_revision_has_implementation(revision)
        and _codex_revision_has_markers(
            str(ROOT), revision, CODEX_G26_PROBE_IMPLEMENTATION_MARKERS,
        )
    )


def codex_g20_report_matches_candidate_revision(report_path: Path, revision: object) -> bool:
    """Require G20 evidence to originate from the exact pre-query candidate."""
    if not isinstance(revision, str) or not re.fullmatch(r'[0-9a-f]{40}', revision):
        return False
    try:
        relative_path = report_path.resolve().relative_to(ROOT.resolve()).as_posix()
    except ValueError:
        return False

    head = _run_repository_git(ROOT, 'rev-parse', 'HEAD')
    if head.returncode != 0:
        return False
    head_sha = head.stdout.strip()
    committed_in_head = _run_repository_git(ROOT, 'cat-file', '-e', f'{head_sha}:{relative_path}')
    if committed_in_head.returncode != 0:
        # Before the sanitized report is committed, HEAD is still the candidate
        # that authorized the one-shot query. A staged report is also absent
        # from the HEAD tree and follows this path.
        return revision == head_sha

    added_commit = _run_repository_git(
        ROOT, 'log', '--follow', '--diff-filter=A', '--format=%H', '-1', '--', relative_path,
    )
    commit_sha = added_commit.stdout.strip()
    if added_commit.returncode != 0 or not re.fullmatch(r'[0-9a-f]{40}', commit_sha):
        return False
    parents = _run_repository_git(ROOT, 'rev-list', '--parents', '-n', '1', commit_sha)
    parent_shas = parents.stdout.strip().split()
    return parents.returncode == 0 and len(parent_shas) >= 2 and parent_shas[1] == revision


def codex_a01_report_matches_candidate_revision(report_path: Path, revision: object) -> bool:
    """Bind A01 live evidence to its exact reviewed runtime candidate and post-query report commit."""
    if not codex_a01_probe_revision_has_implementation(revision):
        return False
    try:
        relative_path = report_path.resolve().relative_to(ROOT.resolve()).as_posix()
        report = json.loads(report_path.read_text(encoding='utf-8'))
    except (OSError, ValueError, TypeError):
        return False
    if (
        relative_path != CODEX_A01_REPORT_RELATIVE_PATH
        or report.get('sourceRevision') != revision
        or report.get('mcpBundleSha256') != codex_g26_candidate_bundle_sha256(revision)
    ):
        return False
    base_sha = report.get('baseSha')
    if (
        not isinstance(base_sha, str)
        or not re.fullmatch(r'[0-9a-f]{40}', base_sha)
        or _run_repository_git(ROOT, 'merge-base', '--is-ancestor', base_sha, revision).returncode != 0
    ):
        return False

    head = _run_repository_git(ROOT, 'rev-parse', 'HEAD')
    if head.returncode != 0:
        return False
    head_sha = head.stdout.strip()
    committed_in_head = _run_repository_git(ROOT, 'cat-file', '-e', f'{head_sha}:{relative_path}')
    if committed_in_head.returncode != 0:
        return revision == head_sha
    added_commit = _run_repository_git(
        ROOT, 'log', '--follow', '--diff-filter=A', '--format=%H', '-1', '--', relative_path,
    )
    commit_sha = added_commit.stdout.strip()
    if added_commit.returncode != 0 or not re.fullmatch(r'[0-9a-f]{40}', commit_sha):
        return False
    parents = _run_repository_git(ROOT, 'rev-list', '--parents', '-n', '1', commit_sha)
    parent_shas = parents.stdout.strip().split()
    return parents.returncode == 0 and len(parent_shas) >= 2 and parent_shas[1] == revision


def codex_a01_aggregate_report_matches_candidate_revision(
    report_path: Path, revision: object,
) -> bool:
    """Bind aggregate evidence to its exact reviewed runtime Candidate and report commit."""
    if not codex_a01_aggregate_probe_revision_has_implementation(revision):
        return False
    try:
        relative_path = report_path.resolve().relative_to(ROOT.resolve()).as_posix()
        report = json.loads(report_path.read_text(encoding='utf-8'))
    except (OSError, ValueError, TypeError):
        return False
    if (
        relative_path != CODEX_A01_AGGREGATE_REPORT_RELATIVE_PATH
        or report.get('sourceRevision') != revision
        or report.get('mcpBundleSha256') != codex_g26_candidate_bundle_sha256(revision)
    ):
        return False
    base_sha = report.get('baseSha')
    if (
        not isinstance(base_sha, str)
        or not re.fullmatch(r'[0-9a-f]{40}', base_sha)
        or _run_repository_git(ROOT, 'merge-base', '--is-ancestor', base_sha, revision).returncode != 0
    ):
        return False

    head = _run_repository_git(ROOT, 'rev-parse', 'HEAD')
    if head.returncode != 0:
        return False
    head_sha = head.stdout.strip()
    committed_blob = _run_repository_git(ROOT, 'rev-parse', f'{head_sha}:{relative_path}')
    working_blob = _run_repository_git(ROOT, 'hash-object', str(report_path))
    if (
        committed_blob.returncode != 0
        or working_blob.returncode != 0
        or committed_blob.stdout.strip() != working_blob.stdout.strip()
    ):
        return False
    added_commit = _run_repository_git(
        ROOT, 'log', '--follow', '--diff-filter=A', '--format=%H', '-1', '--', relative_path,
    )
    commit_sha = added_commit.stdout.strip()
    if added_commit.returncode != 0 or not re.fullmatch(r'[0-9a-f]{40}', commit_sha):
        return False
    parents = _run_repository_git(ROOT, 'rev-list', '--parents', '-n', '1', commit_sha)
    parent_shas = parents.stdout.strip().split()
    added_blob = _run_repository_git(ROOT, 'rev-parse', f'{commit_sha}:{relative_path}')
    return (
        parents.returncode == 0
        and len(parent_shas) >= 2
        and parent_shas[1] == revision
        and added_blob.returncode == 0
        and added_blob.stdout.strip() == committed_blob.stdout.strip()
    )


def _codex_a01_aggregate_expected_metric_state(
    key: str, query_state: str, coverage: dict, metric: dict,
) -> str:
    if query_state not in {'ok', 'partial'}:
        return 'not_computable' if query_state == 'not_found' else query_state
    if metric['conflicts'] > 0:
        return 'conflict'
    if key != 'ratingStandardDeviation' and metric['valid'] == 0:
        return 'not_computable'
    if (
        metric['valid'] + metric['partial'] == 0
        and metric['notComputable'] > 0
        and metric['missing'] == 0
    ):
        return 'not_computable'
    if (
        query_state == 'partial'
        or coverage['cohortsPartial'] > 0
        or metric['partial'] > 0
        or metric['missing'] > 0
        or metric['notComputable'] > 0
    ):
        return 'partial'
    return 'not_computable' if metric['valid'] == 0 else 'complete'


def codex_g02_report_matches_candidate_revision(report_path: Path, revision: object) -> bool:
    """Require each G02 report to be added after the exact reviewed Candidate."""
    if not codex_g02_probe_revision_has_implementation(revision):
        return False
    return codex_g20_report_matches_candidate_revision(report_path, revision)


def codex_g26_report_matches_candidate_revision(report_path: Path, revision: object) -> bool:
    """Require G26 evidence to originate from the exact pre-query Product Candidate."""
    if not codex_g26_probe_revision_has_implementation(revision):
        return False
    return codex_g20_report_matches_candidate_revision(report_path, revision)


def codex_g26_candidate_bundle_sha256(revision: object) -> str | None:
    """Read the exact runtime-bundle digest attested by the source Candidate commit."""
    if not isinstance(revision, str) or not re.fullmatch(r'[0-9a-f]{40}', revision):
        return None
    result = _run_repository_git(
        ROOT, 'show', f'{revision}:{CODEX_G26_BUNDLE_ATTESTATION_RELATIVE_PATH}',
    )
    if result.returncode != 0:
        return None
    try:
        attestation = json.loads(result.stdout)
    except (TypeError, ValueError):
        return None
    if (
        not isinstance(attestation, dict)
        or set(attestation) != {'schemaVersion', 'kind', 'bundleSha256'}
        or type(attestation.get('schemaVersion')) is not int
        or attestation.get('schemaVersion') != 1
        or attestation.get('kind') != 'g26-mcp-runtime-bundle-attestation-v1'
        or not isinstance(attestation.get('bundleSha256'), str)
        or not re.fullmatch(r'[0-9a-f]{64}', attestation['bundleSha256'])
    ):
        return None
    return attestation['bundleSha256']


def codex_s02_candidate_bundle_sha256(revision: object) -> str | None:
    """Read the S02 runtime-bundle digest attested by its exact Candidate."""
    if not isinstance(revision, str) or not re.fullmatch(r'[0-9a-f]{40}', revision):
        return None
    result = _run_repository_git(
        ROOT, 'show', f'{revision}:{CODEX_S02_BUNDLE_ATTESTATION_RELATIVE_PATH}',
    )
    if result.returncode != 0:
        return None
    try:
        attestation = json.loads(result.stdout)
    except (TypeError, ValueError):
        return None
    if (
        not isinstance(attestation, dict)
        or set(attestation) != {'schemaVersion', 'kind', 'bundleSha256'}
        or type(attestation.get('schemaVersion')) is not int
        or attestation.get('schemaVersion') != 1
        or attestation.get('kind') != 's02-mcp-runtime-bundle-attestation-v1'
        or not isinstance(attestation.get('bundleSha256'), str)
        or not re.fullmatch(r'[0-9a-f]{64}', attestation['bundleSha256'])
    ):
        return None
    return attestation['bundleSha256']


def codex_s02_probe_revision_has_implementation(revision: object) -> bool:
    if not isinstance(revision, str) or not re.fullmatch(r'[0-9a-f]{40}', revision):
        return False
    return _codex_revision_has_markers(
        str(ROOT), revision, CODEX_S02_PROBE_IMPLEMENTATION_MARKERS,
    )


def codex_s02_report_matches_candidate_revision(report_path: Path, revision: object) -> bool:
    """Bind S02's one-shot evidence to the exact Candidate that authorized it."""
    if not codex_s02_probe_revision_has_implementation(revision):
        return False
    try:
        relative_path = report_path.resolve().relative_to(ROOT.resolve()).as_posix()
    except ValueError:
        return False
    if relative_path != CODEX_S02_REPORT_RELATIVE_PATH:
        return False
    return codex_g20_report_matches_candidate_revision(report_path, revision)


def codex_s02_report_is_valid(report: object) -> bool:
    """Validate sanitized S02 Agent/MCP evidence for the exact Luna Max one-tool run."""
    if not isinstance(report, dict) or set(report) != CODEX_S02_REPORT_FIELDS:
        return False
    source_revision = report.get('sourceRevision')
    if (
        type(report.get('schemaVersion')) is not int
        or report.get('schemaVersion') != 1
        or report.get('evidenceKind') != 'codex_cli_s02_person_activity_agent_mcp'
        or report.get('runNumber') != 95
        or report.get('frontierId') != 'S02'
        or report.get('scenarioId') != 'S02'
        or report.get('profile') != 'codex-luna-max-one-tool-v1'
        or report.get('model') != 'gpt-6-luna'
        or report.get('reasoningEffort') != 'max'
        or not isinstance(report.get('codexCliVersion'), str)
        or not re.fullmatch(r'\d+\.\d+\.\d+', report['codexCliVersion'])
        or report.get('toolName') != 'bangumi.get_person_activity'
        or report.get('argumentProfile') != 'fixed-s02-person-3474-top-rated-main-voice-v1'
        or report.get('expectedArgumentsSha256') != _canonical_json_sha256(
            CODEX_S02_EXPECTED_ARGUMENTS,
        )
        or type(report.get('processExitCode')) is not int
        or report.get('processExitCode') != 0
        or report.get('resultStatus') != 'SUCCESS'
        or report.get('eventStreamParsed') is not True
        or type(report.get('codexMcpToolEventCount')) is not int
        or report.get('codexMcpToolEventCount') != 1
        or type(report.get('nonMcpToolEventCount')) is not int
        or report.get('nonMcpToolEventCount') != 0
        or type(report.get('shellToolCallCount')) is not int
        or report.get('shellToolCallCount') != 0
        or type(report.get('allowedCallCount')) is not int
        or report.get('allowedCallCount') != 1
        or type(report.get('deniedCallCount')) is not int
        or report.get('deniedCallCount') != 0
        or report.get('answerCheckMethod') != 's02-top-rated-main-voice-answer-v1'
        or not isinstance(source_revision, str)
        or not re.fullmatch(r'[0-9a-f]{40}', source_revision)
        or not isinstance(report.get('mcpBundleSha256'), str)
        or codex_s02_candidate_bundle_sha256(source_revision) != report.get('mcpBundleSha256')
        or not codex_s02_probe_revision_has_implementation(source_revision)
    ):
        return False

    observed_at = report.get('observedAt')
    if (
        not isinstance(observed_at, str)
        or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z', observed_at)
    ):
        return False

    try:
        catalog_bytes = CATALOG.read_bytes()
        catalog = json.loads(catalog_bytes)
    except (OSError, ValueError):
        return False
    current_tool = next(
        (item for item in catalog if isinstance(item, dict)
         and item.get('name') == 'bangumi.get_person_activity'),
        None,
    )
    if (
        not isinstance(current_tool, dict)
        or current_tool.get('auth') != 'none'
        or current_tool.get('risk') != 'read'
        or report.get('catalogSha256') != hashlib.sha256(catalog_bytes).hexdigest()
        or report.get('toolDescriptionSha256') != hashlib.sha256(
            current_tool.get('description', '').encode('utf-8'),
        ).hexdigest()
        or report.get('inputSchemaSha256') != _canonical_json_sha256(
            current_tool.get('inputSchema'),
        )
    ):
        return False

    try:
        bundle = json.loads(
            _run_repository_git(
                ROOT,
                'show',
                f'{source_revision}:{CODEX_S02_BUNDLE_ATTESTATION_RELATIVE_PATH}',
            ).stdout,
        )
    except (TypeError, ValueError):
        return False
    if (
        not isinstance(bundle, dict)
        or set(bundle) != {'schemaVersion', 'kind', 'bundleSha256'}
        or bundle.get('schemaVersion') != 1
        or bundle.get('kind') != 's02-mcp-runtime-bundle-attestation-v1'
        or report.get('mcpBundleSha256') != bundle.get('bundleSha256')
    ):
        return False

    if report.get('toolCalls') != [
        {'name': 'bangumi.get_person_activity', 'state': 'DONE'},
    ]:
        return False
    answer_checks = report.get('answerChecks')
    if (
        not isinstance(answer_checks, dict)
        or set(answer_checks) != CODEX_S02_ANSWER_CHECK_FIELDS
        or any(value is not True for value in answer_checks.values())
    ):
        return False
    counters = report.get('answerCounters')
    if (
        not isinstance(counters, dict)
        or set(counters) != CODEX_S02_ANSWER_COUNTER_FIELDS
        or any(type(value) is not int or value < 0 for value in counters.values())
        or not 1 <= counters['sourceRows'] <= 5
        or counters['answerRows'] != counters['sourceRows']
        or counters['rowsMatched'] != counters['sourceRows']
        or any(counters[key] != 0 for key in (
            'missingRowsCount', 'extraRowsCount', 'duplicateAnswerRowsCount',
        ))
        or counters['coverageFieldsMatched'] != len(CODEX_S02_COVERAGE_FIELDS)
    ):
        return False

    summary = report.get('resultSummary')
    if (
        not isinstance(summary, dict)
        or set(summary) != CODEX_S02_RESULT_SUMMARY_FIELDS
        or summary.get('state') not in {'complete', 'partial'}
        or summary.get('scope') != 'current_official_person_character_response'
        or summary.get('media') != 'all'
        or type(summary.get('truncated')) is not bool
    ):
        return False
    rows = summary.get('rows')
    if not isinstance(rows, list) or not 1 <= len(rows) <= 5:
        return False
    normalized_rows = []
    for row in rows:
        if (
            not isinstance(row, dict)
            or set(row) != CODEX_S02_RESULT_ROW_FIELDS
            or type(row.get('subjectId')) is not int
            or row['subjectId'] <= 0
            or type(row.get('ratingScore')) not in {int, float}
            or not math.isfinite(row['ratingScore'])
            or not 0 <= row['ratingScore'] <= 10
            or (row.get('ratingTotal') is not None and (
                type(row.get('ratingTotal')) is not int or row['ratingTotal'] < 0
            ))
        ):
            return False
        normalized_rows.append(row)
    if len({row['subjectId'] for row in normalized_rows}) != len(normalized_rows):
        return False
    ranking_keys = [
        (-row['ratingScore'], -(row['ratingTotal'] if row['ratingTotal'] is not None else -1), row['subjectId'])
        for row in normalized_rows
    ]
    if ranking_keys != sorted(ranking_keys):
        return False

    coverage = summary.get('coverage')
    if (
        not isinstance(coverage, dict)
        or set(coverage) != CODEX_S02_COVERAGE_FIELDS
        or any(type(value) is not int or value < 0 for value in coverage.values())
        or coverage['relationRowsSelected'] > coverage['relationRowsObserved']
        or coverage['relationRowsDroppedAtLimit'] != (
            coverage['relationRowsObserved'] - coverage['relationRowsSelected']
        )
        or coverage['rowsReturned'] != len(normalized_rows)
    ):
        return False
    if summary['state'] == 'complete' and (
        summary['truncated'] is not False or any(coverage[key] != 0 for key in (
        'relationRowsDroppedAtLimit', 'subjectDetailsFailed',
        'subjectDetailIdsDroppedAtLimit', 'unknownRoleRows', 'missingRatingScoreSubjects',
        'missingRatingTotalSubjects', 'mediaUnknownSubjects', 'missingSubjectIdRows',
        'mainRoleSubjectsMissingDetail',
        ))
    ):
        return False

    privacy = report.get('privacy')
    return (
        isinstance(privacy, dict)
        and set(privacy) == CODEX_S02_PRIVACY_FIELDS
        and privacy.get('authProfile') == 'anonymous'
        and all(privacy.get(key) is False for key in CODEX_S02_PRIVACY_FIELDS - {'authProfile'})
        and not _contains_forbidden_codex_content(report)
    )


def codex_s03_candidate_bundle_sha256(revision: object) -> str | None:
    """Read the S03 runtime-bundle digest attested by its exact Candidate."""
    if not isinstance(revision, str) or not re.fullmatch(r'[0-9a-f]{40}', revision):
        return None
    result = _run_repository_git(
        ROOT, 'show', f'{revision}:{CODEX_S03_BUNDLE_ATTESTATION_RELATIVE_PATH}',
    )
    if result.returncode != 0:
        return None
    try:
        attestation = json.loads(result.stdout)
    except (TypeError, ValueError):
        return None
    if (
        not isinstance(attestation, dict)
        or set(attestation) != {'schemaVersion', 'kind', 'bundleSha256'}
        or type(attestation.get('schemaVersion')) is not int
        or attestation.get('schemaVersion') != 1
        or attestation.get('kind') != 's03-mcp-runtime-bundle-attestation-v1'
        or not isinstance(attestation.get('bundleSha256'), str)
        or not re.fullmatch(r'[0-9a-f]{64}', attestation['bundleSha256'])
    ):
        return None
    return attestation['bundleSha256']


def codex_s03_probe_revision_has_implementation(revision: object) -> bool:
    if not isinstance(revision, str) or not re.fullmatch(r'[0-9a-f]{40}', revision):
        return False
    return _codex_revision_has_markers(
        str(ROOT), revision, CODEX_S03_PROBE_IMPLEMENTATION_MARKERS,
    )


def codex_s03_report_matches_candidate_revision(report_path: Path, revision: object) -> bool:
    """Bind S03's sanitized evidence to the exact pre-query Candidate."""
    if not codex_s03_probe_revision_has_implementation(revision):
        return False
    try:
        relative_path = report_path.resolve().relative_to(ROOT.resolve()).as_posix()
    except ValueError:
        return False
    return (
        relative_path == CODEX_S03_REPORT_RELATIVE_PATH
        and codex_g20_report_matches_candidate_revision(report_path, revision)
    )


def codex_s03_harness_control_record_trusts_attestation(
    pr_number: object,
    source_revision: object,
    base_sha: object,
    reviewer_id: object,
    key_id_sha256: object,
) -> bool:
    """Trust an S03 key only when the exact PASS and key pin are in the GitHub Harness control plane."""
    if (
        type(pr_number) is not int
        or pr_number <= 0
        or not isinstance(source_revision, str)
        or not re.fullmatch(r'[0-9a-f]{40}', source_revision)
        or not isinstance(base_sha, str)
        or not re.fullmatch(r'[0-9a-f]{40}', base_sha)
        or not isinstance(reviewer_id, str)
        or reviewer_id != f'gpt-6-luna-max-run95-s03-pr{pr_number}-round1'
        or not isinstance(key_id_sha256, str)
        or not re.fullmatch(r'[0-9a-f]{64}', key_id_sha256)
    ):
        return False
    request = urllib.request.Request(
        f'https://api.github.com/repos/PariyaProject/BangumiAgentKit/pulls/{pr_number}',
        headers={
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'PariyaAgent-acceptance-evidence',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            payload = response.read(1_000_001)
        if len(payload) > 1_000_000:
            return False
        pr = json.loads(payload)
    except (
        OSError,
        TimeoutError,
        UnicodeDecodeError,
        urllib.error.URLError,
        json.JSONDecodeError,
    ):
        return False
    if not isinstance(pr, dict) or pr.get('number') != pr_number:
        return False
    body = pr.get('body')
    if not isinstance(body, str):
        return False
    start_marker = '<!-- bangumi-harness:v3:epoch:start -->'
    end_marker = '<!-- bangumi-harness:v3:epoch:end -->'
    start = body.find(start_marker)
    end = body.find(end_marker)
    if start < 0 or end <= start:
        return False
    content = body[start + len(start_marker):end].strip()
    content = re.sub(r'^\x60{3}json\s*|\s*\x60{3}$', '', content)
    try:
        epoch = json.loads(content)
    except json.JSONDecodeError:
        return False
    preflight = epoch.get('adversarial_preflight') if isinstance(epoch, dict) else None
    review_history = epoch.get('review_history') if isinstance(epoch, dict) else None
    if not isinstance(preflight, dict) or not isinstance(review_history, list):
        return False
    marker = (
        f'S03 runner attestation trust: candidate {source_revision}; '
        f'Ed25519 public key SHA-256 {key_id_sha256}.'
    )
    return (
        isinstance(epoch, dict)
        and epoch.get('schema') == 'bangumi-harness/v3'
        and epoch.get('kind') == 'epoch'
        and epoch.get('pr_number') == pr_number
        and epoch.get('base_sha') == base_sha
        and preflight.get('completed') is True
        and marker in str(preflight.get('summary', ''))
        and any(
            isinstance(review, dict)
            and review.get('candidate_sha') == source_revision
            and review.get('reviewed_base_sha') == base_sha
            and review.get('reviewer_id') == reviewer_id
            and review.get('verdict') == 'PASS'
            for review in review_history
        )
    )


def codex_s03_report_provenance_is_valid(report: object) -> bool:
    if not isinstance(report, dict):
        return False
    provenance = report.get('evidenceProvenance')
    pr_number = report.get('prNumber')
    if (
        not isinstance(provenance, dict)
        or set(provenance) != CODEX_S03_PROVENANCE_FIELDS
        or type(provenance.get('schemaVersion')) is not int
        or provenance.get('schemaVersion') != 1
        or provenance.get('kind') != 's03-runner-evidence-digest-v1'
        or provenance.get('algorithm') != 'Ed25519'
        or type(pr_number) is not int
        or pr_number <= 0
        or provenance.get('reviewerId') != f'gpt-6-luna-max-run95-s03-pr{pr_number}-round1'
        or any(
            not isinstance(provenance.get(field), str)
            or not re.fullmatch(r'[0-9a-f]{64}', provenance[field])
            for field in (
                'keyIdSha256', 'summaryPathSha256', 'serverSummarySha256',
                'eventsSha256', 'proofSha256',
            )
        )
        or not isinstance(provenance.get('signature'), str)
    ):
        return False
    try:
        signature = base64.b64decode(provenance['signature'], validate=True)
    except (ValueError, TypeError):
        return False
    if len(signature) != 64 or base64.b64encode(signature).decode('ascii') != provenance['signature']:
        return False
    source_revision = report.get('sourceRevision')
    if not isinstance(source_revision, str) or not re.fullmatch(r'[0-9a-f]{40}', source_revision):
        return False
    key_result = _run_repository_git(
        ROOT,
        'show',
        f'{source_revision}:{CODEX_S03_ATTESTATION_PUBLIC_KEY_RELATIVE_PATH}',
    )
    if key_result.returncode != 0:
        return False
    public_key_pem = key_result.stdout
    if (
        not public_key_pem.startswith('-----BEGIN PUBLIC KEY-----')
        or hashlib.sha256(public_key_pem.encode('utf-8')).hexdigest()
        != provenance['keyIdSha256']
    ):
        return False
    report_without_provenance = dict(report)
    report_without_provenance.pop('evidenceProvenance', None)
    proof_payload = {
        'sourceRevision': report.get('sourceRevision'),
        'baseSha': report.get('baseSha'),
        'bundleSha256': report.get('mcpBundleSha256'),
        'prNumber': report.get('prNumber'),
        'reviewerId': provenance['reviewerId'],
        'model': report.get('model'),
        'reasoningEffort': report.get('reasoningEffort'),
        'expectedArgumentsSha256': report.get('expectedArgumentsSha256'),
        'algorithm': provenance['algorithm'],
        'keyIdSha256': provenance['keyIdSha256'],
        'summaryPathSha256': provenance['summaryPathSha256'],
        'serverSummarySha256': provenance['serverSummarySha256'],
        'eventsSha256': provenance['eventsSha256'],
        'reportSha256': _canonical_json_sha256(report_without_provenance),
    }
    if provenance['proofSha256'] != _canonical_json_sha256(proof_payload):
        return False
    verifier_script = (
        'import { createPublicKey, verify } from "node:crypto";\n'
        'import { readFileSync } from "node:fs";\n'
        'try {\n'
        '  const input = JSON.parse(readFileSync(0, "utf8"));\n'
        '  const valid = verify(null, Buffer.from(input.proofSha256, "hex"), '
        'createPublicKey(input.publicKeyPem), Buffer.from(input.signature, "base64"));\n'
        '  process.exitCode = valid ? 0 : 1;\n'
        '} catch { process.exitCode = 1; }\n'
    )
    verification_env = os.environ.copy()
    verification_env.pop('PARIYA_S03_EVIDENCE_SIGNING_KEY_PATH', None)
    try:
        verification = subprocess.run(
            ['node', '--input-type=module', '-e', verifier_script],
            cwd=ROOT,
            env=verification_env,
            input=json.dumps({
                'proofSha256': provenance['proofSha256'],
                'publicKeyPem': public_key_pem,
                'signature': provenance['signature'],
            }),
            capture_output=True,
            text=True,
            check=False,
            timeout=10,
        )
    except (OSError, subprocess.TimeoutExpired):
        return False
    return verification.returncode == 0 and codex_s03_harness_control_record_trusts_attestation(
        pr_number,
        source_revision,
        report.get('baseSha'),
        provenance['reviewerId'],
        provenance['keyIdSha256'],
    )


def codex_s03_report_is_valid(report: object) -> bool:
    """Validate sanitized S03 Agent/MCP evidence for the fixed Luna Max call."""
    if not isinstance(report, dict) or set(report) != CODEX_S03_REPORT_FIELDS:
        return False
    if not codex_s03_report_provenance_is_valid(report):
        return False
    source_revision = report.get('sourceRevision')
    if (
        type(report.get('schemaVersion')) is not int
        or report.get('schemaVersion') != 1
        or report.get('evidenceKind') != 'codex_cli_s03_series_voice_overlap_agent_mcp'
        or type(report.get('runNumber')) is not int
        or report.get('runNumber') != 95
        or report.get('scenarioId') != 'S03'
        or report.get('profile') != 'run95-s03-series-voice-overlap-agent-mcp-v1'
        or report.get('frontierId') != 'S03'
        or not isinstance(source_revision, str)
        or not re.fullmatch(r'[0-9a-f]{40}', source_revision)
        or not codex_s03_probe_revision_has_implementation(source_revision)
        or report.get('mcpBundleSha256') != codex_s03_candidate_bundle_sha256(source_revision)
        or type(report.get('prNumber')) is not int
        or report.get('prNumber') <= 0
        or not isinstance(report.get('baseSha'), str)
        or not re.fullmatch(r'[0-9a-f]{40}', report['baseSha'])
        or not isinstance(report.get('observedAt'), str)
        or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z', report['observedAt'])
        or report.get('model') != 'gpt-6-luna'
        or report.get('reasoningEffort') != 'max'
        or not isinstance(report.get('codexCliVersion'), str)
        or not re.fullmatch(r'\d+\.\d+\.\d+', report['codexCliVersion'])
        or report.get('toolName') != 'bangumi.get_series_watch_order'
        or report.get('argumentProfile') != 'fixed-s03-spy-family-goto-hiroki-voice-overlap-v1'
        or report.get('expectedArgumentsSha256') != _canonical_json_sha256(
            CODEX_S03_EXPECTED_ARGUMENTS,
        )
        or type(report.get('processExitCode')) is not int
        or report.get('processExitCode') != 0
        or report.get('resultStatus') != 'SUCCESS'
        or report.get('eventStreamParsed') is not True
        or report.get('codexMcpToolEventCount') != 1
        or report.get('nonMcpToolEventCount') != 0
        or report.get('shellToolCallCount') != 0
        or report.get('allowedCallCount') != 1
        or report.get('deniedCallCount') != 0
        or report.get('answerCheckMethod') != 's03-series-voice-overlap-answer-v1'
        or type(report.get('toolTextUtf8Bytes')) is not int
        or not 1 <= report['toolTextUtf8Bytes'] <= 3600
        or type(report.get('rawAnswerPersisted')) is not bool
        or report.get('rawAnswerPersisted') is not False
        or type(report.get('rawToolResultPersisted')) is not bool
        or report.get('rawToolResultPersisted') is not False
    ):
        return False

    try:
        catalog_bytes = CATALOG.read_bytes()
        catalog = json.loads(catalog_bytes)
    except (OSError, ValueError):
        return False
    current_tool = next(
        (item for item in catalog if isinstance(item, dict)
         and item.get('name') == 'bangumi.get_series_watch_order'),
        None,
    )
    if (
        not isinstance(current_tool, dict)
        or current_tool.get('auth') != 'none'
        or current_tool.get('risk') != 'read'
        or report.get('catalogSha256') != hashlib.sha256(catalog_bytes).hexdigest()
        or report.get('toolDescriptionSha256') != hashlib.sha256(
            current_tool.get('description', '').encode('utf-8'),
        ).hexdigest()
        or report.get('inputSchemaSha256') != _canonical_json_sha256(
            current_tool.get('inputSchema'),
        )
    ):
        return False

    if (
        report.get('serverToolNames') != ['bangumi.get_series_watch_order']
        or report.get('mcpServerNames') != ['bgk_s03_one_tool']
        or report.get('serverToolCount') != 1
        or report.get('resultCount') != 1
        or report.get('toolCalls') != [
            {'name': 'bangumi.get_series_watch_order', 'state': 'DONE'},
        ]
    ):
        return False
    answer_checks = report.get('answerChecks')
    if (
        not isinstance(answer_checks, dict)
        or set(answer_checks) != CODEX_S03_ANSWER_CHECK_FIELDS
        or any(value is not True for value in answer_checks.values())
    ):
        return False
    counters = report.get('resultCounters')
    if (
        not isinstance(counters, dict)
        or set(counters) != CODEX_S03_RESULT_COUNTER_FIELDS
        or any(type(value) is not int or value < 0 for value in counters.values())
        or counters['distinctWorks'] < 2
        or counters['answerWorks'] != counters['distinctWorks']
        or counters['matchedCreditRows'] < 2
        or counters['personRowsReturned'] > 120
        or counters['personRowsReturned'] > counters['personRowsObserved']
        or counters['coverageFieldsMatched'] != len(CODEX_S03_COVERAGE_FIELDS)
    ):
        return False

    summary = report.get('resultSummary')
    if (
        not isinstance(summary, dict)
        or set(summary) != CODEX_S03_RESULT_SUMMARY_FIELDS
        or summary.get('rootSubjectId') != 329906
        or summary.get('matchStatus') != 'multi_work_found'
        or type(summary.get('distinctWorks')) is not int
        or summary['distinctWorks'] < 2
        or summary.get('state') not in {'observed', 'partial'}
        or summary.get('sourceOperationStatus') != 'succeeded'
    ):
        return False
    subject_ids = summary.get('subjectIds')
    character_ids = summary.get('characterIds')
    if (
        not isinstance(subject_ids, list)
        or any(type(item) is not int or item <= 0 for item in subject_ids)
        or len(set(subject_ids)) != len(subject_ids)
        or summary['distinctWorks'] != len(subject_ids)
        or not {329906, 373267}.issubset(set(subject_ids))
        or not isinstance(character_ids, list)
        or len(character_ids) < 2
        or any(type(item) is not int or item <= 0 for item in character_ids)
    ):
        return False
    coverage = summary.get('coverage')
    if (
        not isinstance(coverage, dict)
        or set(coverage) != CODEX_S03_COVERAGE_FIELDS
        or type(coverage.get('truncated')) is not bool
        or any(
            type(value) is not int or value < 0
            for key, value in coverage.items() if key != 'truncated'
        )
        or coverage['maxVoiceCredits'] != 120
        or coverage['maxResponseBytes'] != 1_048_576
        or coverage['personRowsReturned'] > 120
        or coverage['personRowsReturned'] > coverage['personRowsObserved']
        or coverage['personRowsOmitted'] != (
            coverage['personRowsObserved'] - coverage['personRowsReturned']
        )
        or coverage['eligibleDirectAnimeWorksSelected'] > 8
        or coverage['eligibleDirectAnimeWorksObserved'] != (
            coverage['eligibleDirectAnimeWorksSelected'] +
            coverage['eligibleDirectAnimeWorksOmitted']
        )
    ):
        return False
    privacy = report.get('privacy')
    return (
        isinstance(privacy, dict)
        and set(privacy) == CODEX_S03_PRIVACY_FIELDS
        and privacy.get('authProfile') == 'anonymous'
        and all(value is False for key, value in privacy.items() if key != 'authProfile')
        and not _contains_forbidden_codex_content(report)
    )


def codex_d05_candidate_bundle_sha256(revision: object) -> str | None:
    """Read the D05 runtime bundle attestation from the exact query Candidate."""
    if not isinstance(revision, str) or not re.fullmatch(r'[0-9a-f]{40}', revision):
        return None
    result = _run_repository_git(
        ROOT, 'show', f'{revision}:{CODEX_D05_BUNDLE_ATTESTATION_RELATIVE_PATH}',
    )
    if result.returncode != 0:
        return None
    try:
        attestation = json.loads(result.stdout)
    except (TypeError, ValueError):
        return None
    if (
        not isinstance(attestation, dict)
        or set(attestation) != {'schemaVersion', 'kind', 'bundleSha256'}
        or type(attestation.get('schemaVersion')) is not int
        or attestation.get('schemaVersion') != 1
        or attestation.get('kind') != 'd05-mcp-runtime-bundle-attestation-v1'
        or not isinstance(attestation.get('bundleSha256'), str)
        or not re.fullmatch(r'[0-9a-f]{64}', attestation['bundleSha256'])
    ):
        return None
    return attestation['bundleSha256']


def codex_d05_probe_revision_has_implementation(revision: object) -> bool:
    if not isinstance(revision, str) or not re.fullmatch(r'[0-9a-f]{40}', revision):
        return False
    return _codex_revision_has_markers(
        str(ROOT), revision, CODEX_D05_PROBE_IMPLEMENTATION_MARKERS,
    )


def codex_d05_report_matches_candidate_revision(report_path: Path, revision: object) -> bool:
    if (
        not isinstance(revision, str)
        or not re.fullmatch(r'[0-9a-f]{40}', revision)
        or not codex_d05_probe_revision_has_implementation(revision)
    ):
        return False
    try:
        relative_path = report_path.resolve().relative_to(ROOT.resolve()).as_posix()
    except ValueError:
        return False
    return relative_path == CODEX_D05_REPORT_RELATIVE_PATH and codex_g20_report_matches_candidate_revision(
        report_path, revision,
    )


def codex_d05_report_is_valid(report: object) -> bool:
    """Validate the sanitized D05 current-season anonymous Agent/MCP result."""
    if not isinstance(report, dict) or set(report) != CODEX_D05_REPORT_FIELDS:
        return False
    source_revision = report.get('sourceRevision')
    if (
        type(report.get('schemaVersion')) is not int
        or report.get('schemaVersion') != 1
        or report.get('evidenceKind') != 'codex_cli_d05_current_season_agent_mcp'
        or type(report.get('runNumber')) is not int
        or report.get('runNumber') != 95
        or report.get('scenarioId') != 'D05'
        or report.get('profile') != 'run95-d05-current-season-multitag-heat-agent-mcp-v1'
        or report.get('frontierId') != 'D05'
        or not isinstance(source_revision, str)
        or not re.fullmatch(r'[0-9a-f]{40}', source_revision)
        or not codex_d05_probe_revision_has_implementation(source_revision)
        or report.get('mcpBundleSha256') != codex_d05_candidate_bundle_sha256(source_revision)
        or type(report.get('prNumber')) is not int
        or report.get('prNumber') <= 0
        or not isinstance(report.get('baseSha'), str)
        or not re.fullmatch(r'[0-9a-f]{40}', report['baseSha'])
        or not isinstance(report.get('observedAt'), str)
        or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z', report['observedAt'])
        or report.get('model') != 'gpt-6-luna'
        or report.get('reasoningEffort') != 'max'
        or not isinstance(report.get('codexCliVersion'), str)
        or not re.fullmatch(r'\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?', report['codexCliVersion'])
        or report.get('toolName') != 'bangumi.query_subjects'
        or report.get('argumentProfile') != 'fixed-d05-current-season-campus-romance-heat-v1'
        or report.get('expectedArgumentsSha256') != _canonical_json_sha256(CODEX_D05_EXPECTED_ARGUMENTS)
        or report.get('processExitCode') != 0
        or report.get('resultStatus') != 'SUCCESS'
        or report.get('eventStreamParsed') is not True
        or report.get('resultCount') != 1
        or report.get('codexMcpToolEventCount') != 1
        or report.get('nonMcpToolEventCount') != 0
        or report.get('shellToolCallCount') != 0
        or report.get('serverToolNames') != ['bangumi.query_subjects']
        or report.get('mcpServerNames') != ['bgk_d05_one_tool']
        or report.get('serverToolCount') != 1
        or report.get('allowedCallCount') != 1
        or report.get('deniedCallCount') != 0
        or report.get('qqPipelineTested') is not False
        or report.get('timClientTested') is not False
        or report.get('toolCalls') != [{'name': 'bangumi.query_subjects', 'state': 'DONE'}]
        or report.get('answerCheckMethod') != 'd05-current-season-multitag-heat-v1'
        or report.get('rawAnswerPersisted') is not False
        or report.get('rawToolResultPersisted') is not False
    ):
        return False

    try:
        catalog_bytes = CATALOG.read_bytes()
        catalog = json.loads(catalog_bytes)
    except (OSError, ValueError):
        return False
    tool = next(
        (item for item in catalog if isinstance(item, dict) and item.get('name') == 'bangumi.query_subjects'),
        None,
    )
    if (
        not isinstance(tool, dict)
        or tool.get('auth') != 'none'
        or tool.get('risk') != 'read'
        or report.get('catalogSha256') != hashlib.sha256(catalog_bytes).hexdigest()
        or report.get('toolDescriptionSha256') != hashlib.sha256(
            tool.get('description', '').encode('utf-8'),
        ).hexdigest()
        or report.get('inputSchemaSha256') != _canonical_json_sha256(tool.get('inputSchema'))
    ):
        return False

    answer_checks = report.get('answerChecks')
    if (
        not isinstance(answer_checks, dict)
        or set(answer_checks) != CODEX_D05_ANSWER_CHECK_FIELDS
        or any(value is not True for value in answer_checks.values())
    ):
        return False
    counters = report.get('resultCounters')
    if not isinstance(counters, dict) or set(counters) != CODEX_D05_RESULT_COUNTER_FIELDS:
        return False
    integer_fields = CODEX_D05_RESULT_COUNTER_FIELDS - {'state', 'season', 'totalKind'}
    if any(type(counters.get(key)) is not int or counters[key] < 0 for key in integer_fields):
        return False
    if (
        counters.get('state') not in {'ok', 'partial'}
        or not isinstance(counters.get('season'), str)
        or not re.fullmatch(r'\d{4}-(?:winter|spring|summer|autumn)', counters['season'])
        or counters.get('totalKind') != 'estimated'
        or counters['scanned'] < counters['matched']
        or counters['matched'] < counters['returned']
        or counters['returned'] != counters['sourceRowsValid']
        or counters['sourceRowsInvalid'] != 0
        or counters['sourceRowsDuplicate'] != 0
        or counters['returned'] > CODEX_D05_EXPECTED_ARGUMENTS['limit']
        or counters['answerRows'] != counters['returned']
        or not 0 < counters['textUtf8Bytes'] <= 3600
        or type(report.get('toolTextUtf8Bytes')) is not int
        or report['toolTextUtf8Bytes'] != counters['textUtf8Bytes']
        or not isinstance(report.get('warningCodes'), list)
        or 'EXPERIMENTAL_SOURCE' not in report['warningCodes']
        or len(set(report['warningCodes'])) != len(report['warningCodes'])
    ):
        return False
    privacy = report.get('privacy')
    expected_privacy = {
        'authProfile': 'anonymous',
        'oauthAttempted': False,
        'accountDataRead': False,
        'writesAttempted': False,
        'qqPipelineTested': False,
        'timClientTested': False,
        'promptStored': False,
        'answerStored': False,
        'rawResultStored': False,
        'artifactImageBytesStored': False,
        'credentialsStored': False,
    }
    return (
        isinstance(privacy, dict)
        and set(privacy) == CODEX_D05_PRIVACY_FIELDS
        and privacy == expected_privacy
        and not _contains_forbidden_codex_content(report)
    )


def codex_g26_report_is_valid(report: object) -> bool:
    """Validate sanitized one-shot G26 Agent/MCP evidence without storing answer data."""
    if not isinstance(report, dict) or set(report) != CODEX_G26_REPORT_FIELDS:
        return False
    if (type(report.get('schemaVersion')) is not int
            or report.get('schemaVersion') != 1
            or report.get('evidenceKind') != 'codex_cli_g26_exact_tag_agent_mcp'
            or report.get('runNumber') != 95
            or report.get('frontierId') != 'G26'
            or report.get('scenarioId') != 'G26'
            or report.get('profile') != 'codex-luna-max-one-tool-v1'
            or report.get('model') != 'gpt-6-luna'
            or report.get('reasoningEffort') != 'max'
            or not isinstance(report.get('codexCliVersion'), str)
            or not re.fullmatch(r'\d+\.\d+\.\d+', report['codexCliVersion'])
            or report.get('toolName') != 'bangumi.query_subjects'
            or report.get('argumentProfile') != 'fixed-g26-exact-public-tag-2019-2024-v1'
            or report.get('expectedArgumentsSha256') != _canonical_json_sha256(
                CODEX_G26_EXPECTED_ARGUMENTS,
            )
            or report.get('processExitCode') != 0
            or report.get('resultStatus') != 'SUCCESS'
            or report.get('eventStreamParsed') is not True
            or report.get('codexMcpToolEventCount') != 1
            or report.get('nonMcpToolEventCount') != 0
            or report.get('shellToolCallCount') != 0
            or report.get('allowedCallCount') != 1
            or report.get('deniedCallCount') != 0
            or report.get('answerCheckMethod') != 'g26-exact-public-tag-query-v1'
            or not isinstance(report.get('sourceRevision'), str)
            or not re.fullmatch(r'[0-9a-f]{40}', report['sourceRevision'])
            or not isinstance(report.get('mcpBundleSha256'), str)
            or not re.fullmatch(r'[0-9a-f]{64}', report['mcpBundleSha256'])
            or codex_g26_candidate_bundle_sha256(report['sourceRevision']) != report['mcpBundleSha256']
            or not codex_g26_probe_revision_has_implementation(report['sourceRevision'])):
        return False

    observed_at = report.get('observedAt')
    if (not isinstance(observed_at, str)
            or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z', observed_at)):
        return False

    try:
        catalog_bytes = CATALOG.read_bytes()
        catalog = json.loads(catalog_bytes)
    except (OSError, ValueError):
        return False
    current_tool = next(
        (item for item in catalog if isinstance(item, dict)
         and item.get('name') == 'bangumi.query_subjects'),
        None,
    )
    if (not isinstance(current_tool, dict)
            or current_tool.get('auth') != 'none'
            or current_tool.get('risk') != 'read'
            or report.get('catalogSha256') != hashlib.sha256(catalog_bytes).hexdigest()
            or report.get('toolDescriptionSha256') != hashlib.sha256(
                current_tool.get('description', '').encode('utf-8'),
            ).hexdigest()
            or report.get('inputSchemaSha256') != _canonical_json_sha256(
                current_tool.get('inputSchema'),
            )):
        return False

    if report.get('toolCalls') != [{'name': 'bangumi.query_subjects', 'state': 'DONE'}]:
        return False
    answer_checks = report.get('answerChecks')
    if (not isinstance(answer_checks, dict)
            or set(answer_checks) != CODEX_G26_ANSWER_CHECK_FIELDS
            or any(value is not True for value in answer_checks.values())):
        return False

    counters = report.get('resultCounters')
    if not isinstance(counters, dict) or set(counters) != CODEX_G26_RESULT_COUNTER_FIELDS:
        return False
    nonnegative_ints = CODEX_G26_RESULT_COUNTER_FIELDS - {
        'resultState', 'coverageState', 'totalKind', 'upstreamExhausted',
        'budgetExceeded', 'hydrationBudgetExceeded', 'outputCap',
    }
    if any(type(counters.get(key)) is not int or counters[key] < 0 for key in nonnegative_ints):
        return False
    if (counters.get('resultState') not in {'ok', 'partial'}
            or counters.get('coverageState') not in {'complete', 'partial', 'unknown'}
            or counters.get('totalKind') != 'estimated'
            or type(counters.get('upstreamExhausted')) is not bool
            or type(counters.get('budgetExceeded')) is not bool
            or type(counters.get('hydrationBudgetExceeded')) is not bool
            or (counters.get('outputCap') is not None and (
                type(counters.get('outputCap')) is not int or counters['outputCap'] < 0
            ))
            or counters['scanned'] > 500
            or counters['matched'] < counters['returned']
            or counters['returned'] > 100
            or counters['pagesRequested'] > 10
            or counters['pagesScanned'] > 10
            or counters['hydrationsAttempted'] > 120
            or counters['visibleSourceRows'] != counters['returned']
            or counters['invalidSourceRowsCount'] != 0
            or counters['duplicateSourceRowsCount'] != 0
            or counters['textRowsIncluded'] + counters['textRowsOmitted'] != counters['returned']
            or not 0 < counters['textUtf8Bytes'] <= 3600
            or counters['answerRowsParsed'] != counters['rowsMatched']
            or counters['answerRowsParsed'] != counters['visibleSourceRows']
            or any(counters[key] != 0 for key in (
                'missingRowsCount', 'mismatchedRowsCount', 'unmatchedRowsCount',
                'duplicateAnswerRowsCount', 'unstructuredAnswerLinesCount',
            ))):
        return False

    warning_codes = report.get('warningCodes')
    if (not isinstance(warning_codes, list)
            or any(not isinstance(code, str) for code in warning_codes)
            or 'EXPERIMENTAL_SOURCE' not in warning_codes
            or len(set(warning_codes)) != len(warning_codes)):
        return False
    privacy = report.get('privacy')
    expected_privacy = {
        'authProfile': 'anonymous',
        'oauthAttempted': False,
        'accountDataRead': False,
        'writesAttempted': False,
        'qqPipelineTested': False,
        'timClientTested': False,
        'promptStored': False,
        'answerStored': False,
        'rawResultStored': False,
        'credentialsStored': False,
    }
    return (
        isinstance(privacy, dict)
        and set(privacy) == CODEX_G26_PRIVACY_FIELDS
        and privacy == expected_privacy
        and not _contains_forbidden_codex_content(report)
    )


def validate_g26_frontier_evidence() -> bool:
    """Keep the canonical G26 status tied to its one-shot sanitized report."""
    frontier_path = ROOT / 'docs/product/frontier-ledger.json'
    report_path = ROOT / CODEX_G26_REPORT_RELATIVE_PATH
    try:
        frontier = json.loads(frontier_path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return False
    records = frontier.get('records') if isinstance(frontier, dict) else None
    record = next(
        (item for item in records or [] if isinstance(item, dict) and item.get('id') == 'G26'),
        None,
    )
    if not isinstance(record, dict):
        return False
    if record.get('status') == 'UNASSESSED':
        return not report_path.exists()
    if (
        record.get('status') != 'PARTIAL'
        or not report_path.is_file()
        or CODEX_G26_REPORT_RELATIVE_PATH not in record.get('source_refs', [])
    ):
        return False
    try:
        report = json.loads(report_path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return False
    return (
        codex_g26_report_is_valid(report)
        and codex_g26_report_matches_candidate_revision(report_path, report.get('sourceRevision'))
    )


def codex_d04_coverage_is_valid(coverage: object) -> bool:
    if not isinstance(coverage, dict) or set(coverage) != CODEX_D04_COVERAGE_FIELDS:
        return False
    if (coverage.get('resultState') not in {'ok', 'partial'}
            or coverage.get('operation') != 'searchSubjects'
            or coverage.get('officialV0Plan') is not True
            or coverage.get('totalKind') != 'estimated'
            or coverage.get('coverageState') not in {'complete', 'partial'}
            or coverage.get('experimentalDisclosure') is not True
            or coverage.get('reportedEpsDisclosure') is not True):
        return False
    if ((coverage.get('resultState') == 'ok' and coverage.get('coverageState') != 'complete')
            or (coverage.get('resultState') == 'partial' and coverage.get('coverageState') != 'partial')):
        return False
    counters = coverage.get('counters')
    if (not isinstance(counters, dict)
            or set(counters) != CODEX_D04_COVERAGE_COUNTER_FIELDS
            or any(type(counters.get(key)) is not int or counters[key] < 0
                   for key in CODEX_D04_COVERAGE_COUNTER_FIELDS - {'outputCap'})):
        return False
    if (counters.get('outputCap') is not None
            and (type(counters['outputCap']) is not int or counters['outputCap'] < 0)):
        return False
    if (counters['requested'] > 500 or counters['scanned'] > 500
            or counters['matched'] < counters['returned'] or counters['returned'] > 100
            or counters['pagesRequested'] > 10 or counters['pagesScanned'] > 10
            or counters['hydrationsAttempted'] > 120
            or counters['hydrationsSucceeded'] > 120 or counters['hydrationsFailed'] > 120
            or counters['hydrationsUnresolved'] > 120
            or (counters['outputCap'] is not None and counters['outputCap'] > 100)):
        return False
    flags = coverage.get('flags')
    if (not isinstance(flags, dict) or set(flags) != CODEX_D04_COVERAGE_FLAGS
            or any(type(value) is not bool for value in flags.values())):
        return False
    query_checks = coverage.get('queryChecks')
    if (not isinstance(query_checks, dict) or set(query_checks) != CODEX_D04_QUERY_CHECKS
            or any(value is not True for value in query_checks.values())):
        return False
    rows = coverage.get('rows')
    if (not isinstance(rows, dict) or set(rows) != CODEX_D04_ROW_COUNTERS
            or any(type(value) is not int or value < 0 for value in rows.values())
            or rows['valid'] != rows['observed']
            or rows['withReportedEpisodeEvidence'] != rows['observed']
            or rows['observed'] != counters['returned']):
        return False
    warning_codes = coverage.get('warningCodes')
    return (
        isinstance(warning_codes, list)
        and len(set(warning_codes)) == len(warning_codes)
        and all(isinstance(code, str) and re.fullmatch(r'[A-Z0-9_]{1,64}', code) for code in warning_codes)
        and 'EXPERIMENTAL_SOURCE' in warning_codes
    )


def codex_a01_aggregate_probe_revision_has_implementation(revision: object) -> bool:
    if not isinstance(revision, str) or not re.fullmatch(r'[0-9a-f]{40}', revision):
        return False
    return _codex_revision_has_markers(
        str(ROOT), revision, CODEX_A01_AGGREGATE_PROBE_IMPLEMENTATION_MARKERS,
    )


def codex_a01_aggregate_result_is_valid(result: object) -> bool:
    if not isinstance(result, dict) or set(result) != CODEX_A01_AGGREGATE_RESULT_FIELDS:
        return False
    if (
        result.get('toolName') != 'bangumi.aggregate_subject_cohort'
        or result.get('resultState') not in {
            'complete', 'partial', 'conflict', 'unavailable', 'not_computable',
            'not_found', 'upstream_error', 'unsupported', 'stale', 'auth_required',
            'permission_denied',
        }
        or type(result.get('resultByteLength')) is not int
        or not 1 <= result['resultByteLength'] <= 1_000_000
        or not re.fullmatch(r'[0-9a-f]{64}', str(result.get('resultSha256', '')))
    ):
        return False
    summary = result.get('summary')
    if not isinstance(summary, dict) or set(summary) != CODEX_A01_AGGREGATE_SUMMARY_FIELDS:
        return False
    query = summary.get('query')
    coverage = summary.get('coverage')
    metrics = summary.get('metrics')
    if (
        summary.get('formulaVersion') != 'subject-cohort-comparison-v1'
        or summary.get('state') != result.get('resultState')
        or not isinstance(query, dict)
        or set(query) != CODEX_A01_AGGREGATE_QUERY_SUMMARY_FIELDS
        or query.get('state') not in {
            'ok', 'partial', 'stale', 'conflict', 'auth_required', 'permission_denied',
            'unavailable', 'not_computable', 'unsupported', 'not_found', 'upstream_error',
        }
        or any(type(query.get(key)) is not int or not 0 <= query[key] <= 500
               for key in ('scanned', 'matched', 'returned'))
        or query['matched'] > query['scanned']
        or query['returned'] > query['matched']
        or query.get('totalKind') not in {'estimated', 'exact', 'unknown'}
        or type(query.get('budgetExceeded')) is not bool
        or type(query.get('upstreamExhausted')) is not bool
        or not isinstance(coverage, dict)
        or set(coverage) != CODEX_A01_AGGREGATE_COVERAGE_FIELDS
        or type(coverage.get('maxSubjectsPerCohort')) is not int
        or coverage.get('maxSubjectsPerCohort') != 1
        or type(coverage.get('totalSubjectsReturned')) is not int
        or not 0 <= coverage['totalSubjectsReturned'] <= 1
        or type(coverage.get('cohortsComplete')) is not int
        or type(coverage.get('cohortsPartial')) is not int
        or min(coverage['cohortsComplete'], coverage['cohortsPartial']) < 0
        or coverage['cohortsComplete'] + coverage['cohortsPartial'] != 1
        or any(type(coverage.get(key)) is not int or coverage[key] < 0 or coverage[key] > 1
               for key in (
                   'detailHydrationsAttempted', 'detailHydrationsSucceeded',
                   'detailHydrationsFailed',
               ))
        or coverage['detailHydrationsSucceeded'] > coverage['detailHydrationsAttempted']
        or coverage['detailHydrationsFailed'] > coverage['detailHydrationsAttempted']
        or type(coverage.get('truncated')) is not bool
        or query['returned'] != coverage['totalSubjectsReturned']
        or coverage['detailHydrationsAttempted'] != coverage['totalSubjectsReturned']
        or coverage['detailHydrationsSucceeded'] + coverage['detailHydrationsFailed']
            != coverage['detailHydrationsAttempted']
        or (query['state'] == 'ok' and coverage['totalSubjectsReturned'] == 0)
        or (query['state'] == 'not_found' and coverage['totalSubjectsReturned'] != 0)
        or (query['budgetExceeded'] and not coverage['truncated'])
        or (coverage['cohortsComplete'] == 1 and (
            query['budgetExceeded']
            or not query['upstreamExhausted']
            or query['matched'] != query['returned']
        ))
        or (query['state'] == 'ok' and (
            query['budgetExceeded']
            or not query['upstreamExhausted']
            or query['matched'] != query['returned']
            or coverage['cohortsComplete'] != 1
            or coverage['cohortsPartial'] != 0
        ))
        or (query['state'] == 'partial' and (
            coverage['cohortsComplete'] != 0
            or coverage['cohortsPartial'] != 1
            or not coverage['truncated']
        ))
        or (query['state'] == 'not_found' and (
            query['budgetExceeded']
            or not query['upstreamExhausted']
            or query['matched'] != query['returned']
        ))
        or (coverage['cohortsPartial'] > 0 and not coverage['truncated'])
        or not isinstance(metrics, list)
        or len(metrics) != len(CODEX_A01_AGGREGATE_METRIC_KEYS)
        or not isinstance(summary.get('officialOperations'), list)
        or not 1 <= len(summary['officialOperations']) <= 2
        or any(operation not in {'searchSubjects', 'getSubjectById'}
               for operation in summary['officialOperations'])
        or len(set(summary['officialOperations'])) != len(summary['officialOperations'])
    ):
        return False
    count_fields = ('valid', 'partial', 'missing', 'conflicts', 'notComputable')
    for expected_key, metric in zip(CODEX_A01_AGGREGATE_METRIC_KEYS, metrics):
        if (
            not isinstance(metric, dict)
            or set(metric) != CODEX_A01_AGGREGATE_METRIC_FIELDS
            or metric.get('key') != expected_key
            or metric.get('state') not in {
                'complete', 'partial', 'conflict', 'unavailable', 'not_computable',
                'not_found', 'upstream_error', 'unsupported', 'stale', 'auth_required',
                'permission_denied',
            }
            or (metric.get('value') is not None and (
                type(metric.get('value')) not in (int, float) or
                not math.isfinite(metric['value'])
            ))
            or any(type(metric.get(key)) is not int or not 0 <= metric[key] <= 1
                   for key in count_fields)
            or sum(metric[key] for key in count_fields) != coverage['totalSubjectsReturned']
        ):
            return False
        if metric['state'] != _codex_a01_aggregate_expected_metric_state(
            expected_key, query['state'], coverage, metric,
        ):
            return False
    query_state = query['state']
    metric_states = [metric['state'] for metric in metrics]
    terminal_query_states = {
        'upstream_error', 'auth_required', 'permission_denied', 'unavailable', 'unsupported',
        'stale',
    }
    if query_state in terminal_query_states:
        expected_state = query_state
    elif query_state == 'not_found':
        expected_state = 'not_found'
    elif 'conflict' in metric_states:
        expected_state = 'conflict'
    elif all(state == 'not_computable' for state in metric_states):
        expected_state = 'not_computable'
    elif (
        query_state != 'ok'
        or any(state != 'complete' for state in metric_states)
        or coverage['truncated']
    ):
        expected_state = 'partial'
    else:
        expected_state = 'complete'
    if summary['state'] != expected_state:
        return False
    return True


def codex_a01_aggregate_report_is_valid(report: dict) -> bool:
    if (
        type(report.get('runNumber')) is not int or report['runNumber'] != 95
        or report.get('frontierId') != 'A01'
        or report.get('epochId') != 'run95-a01-aggregate-subject-cohort-codex-current-evidence'
        or report.get('state') != 'PASS'
        or not re.fullmatch(r'[0-9a-f]{64}', str(report.get('mcpBundleSha256', '')))
        or type(report.get('prNumber')) is not int
        or report['prNumber'] != CODEX_A01_AGGREGATE_PR_NUMBER
        or not re.fullmatch(r'[0-9a-f]{40}', str(report.get('baseSha', '')))
        or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z', str(report.get('observedAt', '')))
        or report.get('mcpServerNames') != ['bgk_a01_aggregate_one_tool']
        or report.get('queryArguments') != CODEX_A01_AGGREGATE_ARGUMENTS
        or not re.fullmatch(r'[0-9a-f]{64}', str(report.get('answerSha256', '')))
        or type(report.get('answerUtf8Bytes')) is not int or report['answerUtf8Bytes'] <= 0
    ):
        return False
    gate = report.get('candidateGate')
    if (
        not isinstance(gate, dict)
        or set(gate) != CODEX_A01_AGGREGATE_GATE_FIELDS
        or gate.get('candidateSha') != report.get('sourceRevision')
        or gate.get('baseSha') != report.get('baseSha')
        or gate.get('ciSha') != report.get('sourceRevision')
        or gate.get('ciStatus') != 'SUCCESS'
        or gate.get('reviewPassSha') != report.get('sourceRevision')
        or gate.get('reviewVerdict') != 'PASS'
        or not re.search(r'gpt[-_]6[-_]luna[-_]max', str(gate.get('reviewerId', '')), re.I)
    ):
        return False
    return True


def codex_mcp_evidence_is_valid(
    report: dict, evidence_by_name: dict[str, dict], current_by_name: dict[str, dict],
) -> bool:
    """Accept only sanitized, exact-catalog GPT-6 Luna Max one-tool reports."""
    if not isinstance(report, dict):
        return False
    tool_name = report.get('toolName')
    if not isinstance(tool_name, str):
        return False
    argument_profile = report.get('argumentProfile')
    is_a01_aggregate = tool_name == 'bangumi.aggregate_subject_cohort'
    is_d04 = (
        tool_name == 'bangumi.query_subjects'
        and argument_profile == 'd04-reported-episode-count-discovery-v1'
    )
    is_g02 = CODEX_G02_ARGUMENT_PROFILES.get(tool_name) == argument_profile
    expected_report_fields = (
        CODEX_A01_AGGREGATE_REPORT_FIELDS if is_a01_aggregate else
        CODEX_D04_REPORT_FIELDS if is_d04 else
        CODEX_G02_REPORT_FIELDS if is_g02 else
        CODEX_REPORT_FIELDS
    )
    if set(report) != expected_report_fields:
        return False
    if (type(report.get('schemaVersion')) is not int
            or report.get('schemaVersion') != 1
            or report.get('evidenceKind') != 'codex_cli_mcp_tool_use'
            or report.get('profile') != 'codex-luna-max-one-tool-v1'
            or report.get('model') != 'gpt-6-luna'
            or report.get('reasoningEffort') != 'max'
            or not isinstance(report.get('codexCliVersion'), str)
            or not re.fullmatch(r'\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?', report['codexCliVersion'])
            or not isinstance(report.get('sourceRevision'), str)
            or not re.fullmatch(r'[0-9a-f]{40}', report['sourceRevision'])
            or not (codex_a01_aggregate_probe_revision_has_implementation(report['sourceRevision'])
                    if is_a01_aggregate else codex_d04_probe_revision_has_implementation(report['sourceRevision'])
                    if is_d04 else codex_g02_probe_revision_has_implementation(report['sourceRevision'])
                    if is_g02 else codex_probe_revision_has_implementation(report['sourceRevision']))
            or type(report.get('processExitCode')) is not int
            or report.get('processExitCode') != 0
            or report.get('resultStatus') != 'SUCCESS'
            or type(report.get('resultCount')) is not int
            or report.get('resultCount') != 1
            or report.get('eventStreamParsed') is not True
            or type(report.get('codexMcpToolEventCount')) is not int
            or report.get('codexMcpToolEventCount') != 1
            or type(report.get('nonMcpToolEventCount')) is not int
            or report.get('nonMcpToolEventCount') != 0
            or type(report.get('shellToolCallCount')) is not int
            or report.get('shellToolCallCount') != 0
            or report.get('qqPipelineTested') is not False
            or report.get('timClientTested') is not False
            or type(report.get('serverToolCount')) is not int
            or type(report.get('allowedCallCount')) is not int
            or type(report.get('deniedCallCount')) is not int):
        return False

    if is_d04 and (
        type(report.get('runNumber')) is not int or report['runNumber'] != 95
        or report.get('frontierId') != 'D04'
        or not re.fullmatch(r'[0-9a-f]{64}', str(report.get('mcpBundleSha256', '')))
        or type(report.get('prNumber')) is not int or report['prNumber'] < 1
        or not re.fullmatch(r'[0-9a-f]{40}', str(report.get('baseSha', '')))
        or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z', str(report.get('observedAt', '')))
        or not codex_d04_coverage_is_valid(report.get('coverage'))
        or report.get('warningCodes') != report['coverage'].get('warningCodes')
        or 'EXPERIMENTAL_SOURCE' not in report.get('warningCodes', [])
        or type(report.get('resultByteLength')) is not int or report['resultByteLength'] <= 0
        or not re.fullmatch(r'[0-9a-f]{64}', str(report.get('resultHash', '')))
    ):
        return False

    if is_g02 and (
        type(report.get('runNumber')) is not int or report['runNumber'] != 95
        or report.get('frontierId') != 'G02'
        or not re.fullmatch(r'[0-9a-f]{64}', str(report.get('mcpBundleSha256', '')))
        or type(report.get('prNumber')) is not int or report['prNumber'] < 1
        or not re.fullmatch(r'[0-9a-f]{40}', str(report.get('baseSha', '')))
        or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z', str(report.get('observedAt', '')))
    ):
        return False

    arguments = (
        CODEX_D04_PROBE_ARGUMENTS.get(tool_name) if is_d04 else
        CODEX_G02_PROBE_ARGUMENTS.get(tool_name) if is_g02 else
        CODEX_PROBE_ARGUMENTS.get(tool_name)
    )
    is_g20 = tool_name in CODEX_G20_PROBE_ARGUMENTS
    expected_argument_profile = (
        'd04-reported-episode-count-discovery-v1' if is_d04
        else CODEX_G02_ARGUMENT_PROFILES.get(tool_name) if is_g02
        else CODEX_ARGUMENT_PROFILES.get(tool_name)
    )
    expected_answer_checks = (
        CODEX_A01_AGGREGATE_ANSWER_CHECK_FIELDS if is_a01_aggregate else
        CODEX_D04_ANSWER_CHECK_FIELDS if is_d04 else
        CODEX_G02_RENDERER_ANSWER_CHECK_FIELDS if is_g02 and tool_name.startswith('bangumi.render_') else
        CODEX_G02_QUERY_ANSWER_CHECK_FIELDS if is_g02 else
        CODEX_G20_ANSWER_CHECK_FIELDS if is_g20 else
        CODEX_RENDERER_ANSWER_CHECK_FIELDS if isinstance(tool_name, str) and tool_name.startswith('bangumi.render_') else
        CODEX_STATS_ANSWER_CHECK_FIELDS
    )
    current_tool = current_by_name.get(tool_name) if isinstance(tool_name, str) else None
    if (arguments is None or current_tool is None
            or evidence_by_name.get(tool_name) != current_tool
            or current_tool.get('auth') != 'none'
            or current_tool.get('risk') != 'read'
            or report.get('serverToolNames') != [tool_name]
            or report.get('serverToolCount') != 1
            or report.get('allowedCallCount') != 1
            or report.get('deniedCallCount') != 0
            or report.get('argumentProfile') != expected_argument_profile
            or report.get('expectedArgumentsSha256') != _canonical_json_sha256(arguments)
            or report.get('toolDescriptionSha256') != hashlib.sha256(
                current_tool.get('description', '').encode('utf-8')
            ).hexdigest()
            or report.get('inputSchemaSha256') != _canonical_json_sha256(
                current_tool.get('inputSchema')
            )):
        return False
    if is_g20 and not codex_g20_probe_revision_has_implementation(report.get('sourceRevision')):
        return False

    privacy = report.get('privacy')
    expected_privacy_fields = (
        CODEX_A01_AGGREGATE_PRIVACY_FIELDS if is_a01_aggregate else
        CODEX_D04_PRIVACY_FIELDS if is_d04 else
        CODEX_G02_PRIVACY_FIELDS if is_g02 else
        set(CODEX_PRIVACY_FLAGS) | {'authProfile'}
    )
    if (not isinstance(privacy, dict)
            or set(privacy) != expected_privacy_fields
            or privacy.get('authProfile') != 'anonymous'):
        return False
    privacy_false_fields = (
        CODEX_A01_AGGREGATE_PRIVACY_FIELDS - {'authProfile'} if is_a01_aggregate else
        CODEX_D04_PRIVACY_FIELDS - {'authProfile'} if is_d04 else
        CODEX_G02_PRIVACY_FIELDS - {'authProfile'} if is_g02 else
        CODEX_PRIVACY_FLAGS
    )
    if any(privacy.get(flag) is not False for flag in privacy_false_fields):
        return False

    scenarios = report.get('scenarios')
    if not isinstance(scenarios, list) or len(scenarios) != 1:
        return False
    scenario = scenarios[0]
    calls = scenario.get('toolCalls') if isinstance(scenario, dict) else None
    if (not isinstance(scenario, dict)
            or set(scenario) != CODEX_SCENARIO_FIELDS
            or scenario.get('passed') is not True
            or scenario.get('id') != tool_name
            or scenario.get('exactArgumentsMatched') is not True
            or scenario.get('oneToolAllowlistVerified') is not True
            or scenario.get('resultReadbackVerified') is not True
            or scenario.get('answerCheckPassed') is not True
            or not isinstance(scenario.get('answerChecks'), dict)
            or set(scenario.get('answerChecks', {})) != expected_answer_checks
            or any(value is not True for value in scenario.get('answerChecks', {}).values())
            or not isinstance(calls, list)
            or len(calls) != 1
            or calls[0] != {'name': tool_name, 'state': 'DONE'}
            or _contains_forbidden_codex_content(report)):
        return False

    result = scenario.get('result')
    if is_d04 and (
        not isinstance(result, dict)
        or result.get('resultState') != (
            'complete'
            if report['coverage'].get('coverageState') == 'complete'
            and report['coverage'].get('resultState') == 'ok'
            else 'partial'
        )
        or report.get('resultHash') != result.get('resultSha256')
        or report.get('resultByteLength') != result.get('resultByteLength')
    ):
        return False
    if is_g20:
        return codex_g20_result_is_valid(result, arguments['subjectId'])
    if is_a01_aggregate:
        return codex_a01_aggregate_report_is_valid(report) and codex_a01_aggregate_result_is_valid(result)
    if (not isinstance(result, dict)
            or set(result) != CODEX_RESULT_FIELDS
            or result.get('toolName') != tool_name
            or type(result.get('resultByteLength')) is not int
            or result.get('resultByteLength') <= 0
            or not re.fullmatch(r'[0-9a-f]{64}', str(result.get('resultSha256', '')))
            or not isinstance(result.get('sourceOperations'), list)
            or len(result.get('sourceOperations', [])) > 20
            or any(not isinstance(item, dict) or set(item) != CODEX_SOURCE_OPERATION_FIELDS
                   or not isinstance(item.get('operation'), str)
                   or not re.fullmatch(
                       r'(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) /[A-Za-z0-9_{}./-]{1,112}|unclassified',
                       item.get('operation', ''),
                   )
                   or any(type(item.get(key)) is not int or item[key] < 0
                          for key in ('attempted', 'succeeded', 'failed'))
                   for item in result.get('sourceOperations', []))):
        return False
    artifact = result.get('artifact')
    if not isinstance(artifact, dict):
        return False
    if is_g02:
        counters = report.get('resultCounters')
        if tool_name == 'bangumi.query_subjects':
            if (
                not isinstance(counters, dict)
                or set(counters) != CODEX_G02_QUERY_RESULT_COUNTER_FIELDS
                or counters.get('resultState') not in {'ok', 'partial'}
                or counters.get('coverageState') not in {'unknown', 'partial'}
                or counters.get('totalKind') != 'estimated'
                or type(counters.get('requested')) is not int or counters['requested'] != 10
                or any(type(counters.get(key)) is not int or counters[key] < 0
                       for key in ('scanned', 'matched', 'returned', 'sourceRowsValidated', 'answerRowsMatched'))
                or counters['scanned'] < 1
                or counters['scanned'] > CODEX_G02_MAX_CANDIDATES
                or counters['matched'] < 1
                or counters['matched'] > counters['scanned']
                or counters['returned'] < 1
                or counters['returned'] > counters['requested']
                or counters['matched'] < counters['returned']
                or counters['sourceRowsValidated'] != counters['returned']
                or counters['answerRowsMatched'] != counters['returned']
                or not isinstance(counters.get('warningCodes'), list)
                or len(counters['warningCodes']) > 20
                or any(not isinstance(code, str) or not re.fullmatch(r'[A-Z0-9_]{1,64}', code)
                       for code in counters['warningCodes'])
                or any(code not in CODEX_G02_WARNING_CODES for code in counters['warningCodes'])
                or len(set(counters['warningCodes'])) != len(counters['warningCodes'])
                or 'EXPERIMENTAL_SOURCE' not in counters['warningCodes']
                or result.get('resultState') != counters['resultState']
                or set(artifact) != {'returned', 'persisted'}
                or artifact.get('returned') is not False
                or artifact.get('persisted') is not False
            ):
                return False
            return True
        if (
            not isinstance(counters, dict)
            or set(counters) != CODEX_G02_RENDER_RESULT_COUNTER_FIELDS
            or counters != {'resultState': 'artifact_returned', 'artifactReturned': True}
            or result.get('resultState') != 'artifact_returned'
            or set(artifact) != CODEX_ARTIFACT_FIELDS
            or artifact.get('returned') is not True
            or artifact.get('persisted') is not False
            or artifact.get('mimeType') != 'image/png'
            or type(artifact.get('width')) is not int or artifact['width'] <= 0
            or type(artifact.get('height')) is not int or artifact['height'] <= 0
            or type(artifact.get('byteLength')) is not int or artifact['byteLength'] <= 0
            or artifact.get('pngSignatureValid') is not True
            or not re.fullmatch(r'[0-9a-f]{64}', str(artifact.get('sha256', '')))
        ):
            return False
        return True
    if tool_name.startswith('bangumi.render_'):
        if (set(artifact) != CODEX_ARTIFACT_FIELDS
                or result.get('resultState') != 'artifact_returned'
                or artifact.get('returned') is not True
                or artifact.get('persisted') is not False
                or artifact.get('mimeType') != 'image/png'
                or type(artifact.get('width')) is not int or artifact['width'] <= 0
                or type(artifact.get('height')) is not int or artifact['height'] <= 0
                or type(artifact.get('byteLength')) is not int or artifact['byteLength'] <= 0
                or artifact.get('pngSignatureValid') is not True
                or not re.fullmatch(r'[0-9a-f]{64}', str(artifact.get('sha256', '')))):
            return False
    else:
        if (set(artifact) != {'returned', 'persisted'}
                or result.get('resultState') not in {
                    'complete', 'partial', 'unavailable', 'not_found', 'not_computable',
                }
                or artifact.get('returned') is not False or artifact.get('persisted') is not False
                or 'width' in artifact or 'height' in artifact or 'sha256' in artifact):
            return False
    return True


def model_mcp_e2e_sources(catalog: list[dict]) -> dict[str, set[str]]:
    """Trust passed CLI MCP reports whose individual tool catalog entry is current."""
    sources: dict[str, set[str]] = {}
    current_catalog_sha256 = hashlib.sha256(CATALOG.read_bytes()).hexdigest()
    current_by_name = {item['name']: item for item in catalog}
    catalog_cache: dict[str, dict[str, dict] | None] = {
        current_catalog_sha256: current_by_name,
    }

    def catalog_for_hash(catalog_sha256: object) -> dict[str, dict] | None:
        if not isinstance(catalog_sha256, str) or not re.fullmatch(r'[0-9a-f]{64}', catalog_sha256):
            return None
        if catalog_sha256 in catalog_cache:
            return catalog_cache[catalog_sha256]
        snapshot_path = LIVE_PROBE_DIR / 'catalog-snapshots' / f'{catalog_sha256}.json'
        try:
            snapshot_bytes = snapshot_path.read_bytes()
            snapshot = json.loads(snapshot_bytes)
        except (OSError, ValueError):
            catalog_cache[catalog_sha256] = None
            return None
        if hashlib.sha256(snapshot_bytes).hexdigest() != catalog_sha256 or not isinstance(snapshot, list):
            catalog_cache[catalog_sha256] = None
            return None
        snapshot_by_name = {
            item['name']: item
            for item in snapshot
            if isinstance(item, dict) and isinstance(item.get('name'), str)
        }
        catalog_cache[catalog_sha256] = snapshot_by_name
        return snapshot_by_name

    valid_profiles = {
        'bangumi-compact-v1',
        'bangumi-full-public-qa-v1',
        'bangumi-full-renderer-qa-v1',
        'bangumi-full-operation-qa-v1',
        'bangumi-full-auth-start-qa-v1',
        'bangumi-full-auth-switch-qa-v1',
        'bangumi-full-auth-mutation-qa-v1',
        'bangumi-full-auth-feature-qa-v1',
        'bangumi-full-auth-write-qa-v1',
    }
    report_paths = list(LIVE_PROBE_DIR.glob('pariya-agent-*-e2e-*.json'))
    report_paths.append(LIVE_PROBE_DIR / CODEX_S02_REPORT_RELATIVE_PATH.split('/')[-1])
    report_paths.append(LIVE_PROBE_DIR / CODEX_S03_REPORT_RELATIVE_PATH.split('/')[-1])
    for path in report_paths:
        try:
            report = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            continue
        if not isinstance(report, dict):
            continue
        if report.get('evidenceKind') == 'codex_cli_a01_agent_mcp':
            if (
                path.name != Path(CODEX_A01_REPORT_RELATIVE_PATH).name
                or not codex_a01_report_is_valid(report, current_by_name)
                or not codex_a01_report_matches_candidate_revision(
                    path, report.get('sourceRevision'),
                )
            ):
                continue
            sources.setdefault('bangumi.compare_subject_cohorts', set()).add(
                report_source_ref(path),
            )
            continue
        if report.get('evidenceKind') == 'codex_cli_s03_series_voice_overlap_agent_mcp':
            if (
                path.name != Path(CODEX_S03_REPORT_RELATIVE_PATH).name
                or not codex_s03_report_is_valid(report)
                or not codex_s03_report_matches_candidate_revision(
                    path, report.get('sourceRevision'),
                )
            ):
                continue
            sources.setdefault('bangumi.get_series_watch_order', set()).add(report_source_ref(path))
            continue
        if report.get('evidenceKind') == 'codex_cli_s02_person_activity_agent_mcp':
            if (
                path.name != Path(CODEX_S02_REPORT_RELATIVE_PATH).name
                or not codex_s02_report_is_valid(report)
                or not codex_s02_report_matches_candidate_revision(
                    path, report.get('sourceRevision'),
                )
            ):
                continue
            sources.setdefault('bangumi.get_person_activity', set()).add(report_source_ref(path))
            continue
        evidence_by_name = catalog_for_hash(report.get('catalogSha256'))
        if evidence_by_name is None:
            continue
        if report.get('evidenceKind') == 'codex_cli_mcp_tool_use':
            if not codex_mcp_evidence_is_valid(report, evidence_by_name, current_by_name):
                continue
            if (report.get('toolName') == 'bangumi.get_subject_relations'
                    and not codex_g20_report_matches_candidate_revision(
                        path, report.get('sourceRevision'),
                    )):
                continue
            if report.get('toolName') == 'bangumi.aggregate_subject_cohort' and (
                report.get('frontierId') != 'A01'
                or path.relative_to(LIVE_PROBE_DIR.parent.parent).as_posix()
                    != CODEX_A01_AGGREGATE_REPORT_RELATIVE_PATH
                or not codex_a01_aggregate_report_matches_candidate_revision(
                    path, report.get('sourceRevision'),
                )
            ):
                continue
            if report.get('frontierId') == 'G02' and (
                report.get('toolName') not in CODEX_G02_REPORT_RELATIVE_PATHS
                or path.relative_to(LIVE_PROBE_DIR.parent.parent).as_posix()
                    != CODEX_G02_REPORT_RELATIVE_PATHS.get(report.get('toolName'))
                or not codex_g02_report_matches_candidate_revision(
                    path, report.get('sourceRevision'),
                )
            ):
                continue
        elif (report.get('schemaVersion') != 1
              or report.get('evidenceKind') != 'antigravity_cli_mcp_tool_use'
              or report.get('profile') not in valid_profiles
              or type(report.get('processExitCode')) is not int
              or report.get('processExitCode') != 0
              or report.get('resultStatus') != 'SUCCESS'
              or type(report.get('resultCount')) is not int
              or report.get('resultCount') < 1
              or report.get('qqPipelineTested') is not False
              or report.get('timClientTested') is not False):
            continue
        scenarios = report.get('scenarios')
        if not isinstance(scenarios, list) or len(scenarios) != report.get('resultCount'):
            continue
        for scenario in scenarios:
            if not isinstance(scenario, dict) or scenario.get('passed') is not True:
                continue
            calls = scenario.get('toolCalls')
            if not isinstance(calls, list) or not calls:
                continue
            if any(not isinstance(call, dict)
                   or call.get('state') != 'DONE'
                   or call.get('name') not in current_by_name
                   or evidence_by_name.get(call.get('name')) != current_by_name.get(call.get('name'))
                   for call in calls):
                continue
            for call in calls:
                sources.setdefault(call['name'], set()).add(report_source_ref(path))
    d05_path = LIVE_PROBE_DIR / CODEX_D05_REPORT_RELATIVE_PATH.split('/')[-1]
    try:
        d05_report = json.loads(d05_path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        d05_report = None
    if (
        codex_d05_report_is_valid(d05_report)
        and codex_d05_report_matches_candidate_revision(d05_path, d05_report.get('sourceRevision'))
    ):
        sources.setdefault('bangumi.query_subjects', set()).add(report_source_ref(d05_path))
    s03_path = LIVE_PROBE_DIR / CODEX_S03_REPORT_RELATIVE_PATH.split('/')[-1]
    try:
        s03_report = json.loads(s03_path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        s03_report = None
    if (
        codex_s03_report_is_valid(s03_report)
        and codex_s03_report_matches_candidate_revision(s03_path, s03_report.get('sourceRevision'))
    ):
        sources.setdefault('bangumi.get_series_watch_order', set()).add(report_source_ref(s03_path))
    return sources


def model_mcp_e2e_names(catalog: list[dict]) -> set[str]:
    return set(model_mcp_e2e_sources(catalog))


def auth_gate_denial_sources(catalog: list[dict]) -> dict[str, set[str]]:
    """Trust isolated no-account reports only when they prove an expected auth gate."""
    sources: dict[str, set[str]] = {}
    catalog_sha256 = hashlib.sha256(CATALOG.read_bytes()).hexdigest()
    current_by_name = {item['name']: item for item in catalog}
    catalog_cache: dict[str, dict[str, dict] | None] = {catalog_sha256: current_by_name}

    def catalog_for_hash(value: object) -> dict[str, dict] | None:
        if not isinstance(value, str) or not re.fullmatch(r'[0-9a-f]{64}', value):
            return None
        if value in catalog_cache:
            return catalog_cache[value]
        snapshot_path = LIVE_PROBE_DIR / 'catalog-snapshots' / f'{value}.json'
        try:
            snapshot_bytes = snapshot_path.read_bytes()
            snapshot = json.loads(snapshot_bytes)
        except (OSError, ValueError):
            catalog_cache[value] = None
            return None
        if hashlib.sha256(snapshot_bytes).hexdigest() != value or not isinstance(snapshot, list):
            catalog_cache[value] = None
            return None
        snapshot_by_name = {
            item['name']: item
            for item in snapshot
            if isinstance(item, dict) and isinstance(item.get('name'), str)
        }
        catalog_cache[value] = snapshot_by_name
        return snapshot_by_name

    for path in LIVE_PROBE_DIR.glob('pariya-agent-full-auth-denial-qa-e2e-*.json'):
        try:
            report = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            continue
        if not isinstance(report, dict):
            continue
        evidence_by_name = catalog_for_hash(report.get('catalogSha256'))
        if (report.get('schemaVersion') != 1
                or report.get('evidenceKind') != 'antigravity_cli_mcp_tool_use'
                or evidence_by_name is None
                or report.get('profile') != 'bangumi-full-auth-denial-qa-v1'
                or report.get('processExitCode') != 0
                or report.get('resultStatus') != 'SUCCESS'
                or report.get('qqPipelineTested') is not False
                or report.get('timClientTested') is not False):
            continue
        scenarios = report.get('scenarios')
        if not isinstance(scenarios, list) or len(scenarios) != 1:
            continue
        scenario = scenarios[0]
        if not isinstance(scenario, dict):
            continue
        name = scenario.get('id')
        tool = current_by_name.get(name)
        evidence_tool = evidence_by_name.get(name) if evidence_by_name is not None else None
        calls = scenario.get('toolCalls')
        assertions = scenario.get('assertions')
        if (not tool or evidence_tool != tool
                or tool.get('risk') not in {'read', 'write', 'destructive'}
                or tool.get('auth') != 'required'
                or scenario.get('passed') is not True
                or calls != [{'name': name, 'state': 'DONE'}]
                or not isinstance(assertions, dict)
                or assertions.get('authRequiredGateObserved') is not True
                or assertions.get('operationExecuted') is not False
                or assertions.get('accountDataReturned') is not False
                or assertions.get('networkAccessBlocked') is not True
                or assertions.get('networkRequestAttempts') != 0
                or assertions.get('externalApiCalled') is not False):
            continue
        sources.setdefault(name, set()).add(report_source_ref(path))
    return sources


def auth_gate_denial_names(catalog: list[dict]) -> set[str]:
    return set(auth_gate_denial_sources(catalog))


def live_client_e2e_sources(catalog: list[dict]) -> tuple[dict[str, set[str]], dict[str, set[str]]]:
    return tool_client_e2e_sources(
        catalog,
        catalog_path=CATALOG,
        report_dir=LIVE_PROBE_DIR,
        root=ROOT,
    )


def status(
    tool: dict,
    catalog_index: int,
    direct_source_refs: dict[str, set[str]],
    public_api_sources: dict[str, set[str]],
    auth_gate_denial_sources: dict[str, set[str]],
    model_mcp_e2e_sources: dict[str, set[str]],
    qq_pipeline_sources: dict[str, set[str]],
    tim_client_sources: dict[str, set[str]],
) -> tuple[str, ...]:
    def with_sources(mark: str, sources: set[str]) -> str:
        if not sources:
            return mark
        return mark + '<br>' + '<br>'.join(f'`{path}`' for path in sorted(sources))

    name = tool['name']
    schema = f'`docs/tool-catalog.json#/{catalog_index}`'
    source = '<br>'.join(f'`{path}`' for path in sorted(direct_source_refs.get(name, set()))) or '⬜'
    execute = '✅' if name in direct_source_refs else '⬜'
    # Required-account operations are not anonymous public-API candidates;
    # their remote behavior belongs to the separate account-auth acceptance column.
    if tool.get('auth') == 'required' or name in NON_PUBLIC_API_TOOLS:
        live = '—'
    elif name in public_api_sources:
        live = with_sources('◐', public_api_sources[name])
    else:
        live = '⬜'
    if tool.get('auth') != 'required':
        auth_gate = '—'
    elif name in auth_gate_denial_sources:
        auth_gate = with_sources('✅', auth_gate_denial_sources[name])
    else:
        auth_gate = '⬜'
    auth = '—' if tool.get('auth') == 'none' else '⬜'
    agent_mcp = (
        with_sources('✅', model_mcp_e2e_sources[name])
        if name in model_mcp_e2e_sources else '⬜'
    )
    qq_pipeline = with_sources('✅', qq_pipeline_sources[name]) if name in qq_pipeline_sources else '⬜'
    tim_client = with_sources('✅', tim_client_sources[name]) if name in tim_client_sources else '⬜'
    return schema, source, execute, live, auth_gate, auth, agent_mcp, qq_pipeline, tim_client


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        '--check', action='store_true',
        help='fail if the checked-in acceptance table differs from current evidence',
    )
    args = parser.parse_args()
    if not validate_g26_frontier_evidence():
        raise SystemExit(
            'G26 frontier status/evidence mismatch: keep it UNASSESSED without a report, '
            'or bind PARTIAL to the exact candidate-bound report.'
        )
    catalog = json.loads(CATALOG.read_text(encoding='utf-8'))
    source = test_source()
    direct_source_refs = direct_execute_sources()
    direct = set(direct_source_refs)
    public_api_sources = public_api_smoke_sources(catalog)
    public_candidates = {
        item['name'] for item in catalog
        if item.get('auth') != 'required' and item['name'] not in NON_PUBLIC_API_TOOLS
    }
    public_api_sources = {
        name: refs for name, refs in public_api_sources.items()
        if name in public_candidates
    }
    public_api_evidence = set(public_api_sources)
    auth_gate_denial_sources_by_name = auth_gate_denial_sources(catalog)
    auth_gate_denial_set = set(auth_gate_denial_sources_by_name)
    names = {item['name'] for item in catalog}
    model_mcp_sources_by_name = model_mcp_e2e_sources(catalog)
    model_mcp_e2e = set(model_mcp_sources_by_name)
    qq_pipeline_sources_by_name, tim_client_sources_by_name = live_client_e2e_sources(catalog)
    qq_pipeline_e2e = set(qq_pipeline_sources_by_name)
    tim_client_e2e = set(tim_client_sources_by_name)
    missing_source = sorted(name for name in names if name not in source)
    if missing_source:
        raise SystemExit('Missing test source references: ' + ', '.join(missing_source))

    direct_count = sum(item['name'] in direct for item in catalog)
    live_count = sum(item['name'] in public_api_evidence for item in catalog)
    auth_count = sum(item.get('auth') != 'none' for item in catalog)
    model_mcp_count = sum(item['name'] in model_mcp_e2e for item in catalog)
    public_not_applicable_count = sum(
        item.get('auth') == 'required' or item['name'] in NON_PUBLIC_API_TOOLS
        for item in catalog
    )
    public_candidate_count = len(catalog) - public_not_applicable_count
    public_pending_count = public_candidate_count - live_count
    auth_gate_total = sum(
        item.get('auth') == 'required'
        for item in catalog
    )
    auth_gate_count = sum(item['name'] in auth_gate_denial_set for item in catalog)
    lines = [
        '# BangumiAgentKit 逐项验收任务清单',
        '',
        '> 生成自 `docs/tool-catalog.json`、`tests/` 与带目录哈希的 `docs/live-probes/` 证据。每一列对应独立验收面；WebChat、MCP 调用、QQ 管线和 TIM 客户端不互相替代。',
        '',
        '## 总览',
        '',
        f'- [{"x" if direct_count == len(catalog) else " "}] 每个工具都有直接 `execute` 夹具：{direct_count}/{len(catalog)}。',
        f'- [{"x" if public_pending_count == 0 else " "}] 匿名可用的公开 API 工具有逐项实测：{live_count}/{public_candidate_count}；待补 {public_pending_count}。',
        f'- [{"x" if public_not_applicable_count + public_candidate_count == len(catalog) else " "}] 匿名公开 API 不适用项已单独分类：{public_not_applicable_count}/{len(catalog)}；这些工具由账号验收或本地状态验收覆盖。',
        f'- [ ] 需要账号的工具完成真实 OAuth/账号验收：{auth_count} 项目前不能用本地 mock 代替。',
        f'- [{"x" if auth_gate_count == auth_gate_total else " "}] 无账号认证门禁拒绝路径已验证：{auth_gate_count}/{auth_gate_total} 项；门禁通过不代表真实账号功能通过。',
        f'- [{"x" if model_mcp_count == len(catalog) else " "}] 每个工具都有实际 Agent→MCP 模型调用证据：{model_mcp_count}/{len(catalog)}。',
        f'- [{"x" if len(qq_pipeline_e2e) == len(catalog) else " "}] 每个工具都有 QQ 消息管线端到端证据：当前 {len(qq_pipeline_e2e)}/{len(catalog)}。',
        f'- [{"x" if len(tim_client_e2e) == len(catalog) else " "}] 每个工具都有 TIM 客户端端到端证据：当前 {len(tim_client_e2e)}/{len(catalog)}。',
        '',
        '状态说明：`注册/Schema目录引用` 列指向 `docs/tool-catalog.json` 中该工具由运行时 `ToolRegistry` 生成的精确条目；直接 execute 测试引用列列出调用 `.execute`/`ToolRegistry.executeTool` 或已知执行夹具的文件和行号。公开 API、未认证门禁、Agent/MCP 与真实客户端通过项均列出具体 JSON 报告文件。离线 OneBot fixture、WebChat 或 Agent/MCP 本身不满足真实 QQ/TIM 列。`◐` 表示有目录/探针源码哈希绑定的只读 ToolRegistry 实测、真实 HTTP 请求、无错误摘要和通过的形状断言；可比对的稳定 ID/计数也会校验。客户端报告仅保留目标工具名、脱敏投递阶段与客户端观察布尔值，不保存消息正文/QQ 号/截图；它不证明完整字段覆盖或长期稳定性；`⬜` 尚未完成；`—` 不适用匿名公开 API（账号必需的私有/写入功能由账号验收列单独跟踪；OAuth 生命周期、本地状态/历史和 operation metadata 没有公开 API 路径）。',
        '',
        '| 工具 | Auth | Risk | 注册/Schema目录引用 | 直接 execute 测试引用 | 直接 execute 夹具 | 真实公开 API | 无账号认证门禁 | 账号认证 | Agent/MCP E2E | QQ 管线 E2E | TIM 客户端 | 下一步 |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
        '无账号认证门禁列覆盖所有 auth=required 的读取、写入与破坏性工具，只记录缺少账号且零网络请求时的安全拒绝；真实 OAuth 与账号授权仍由“账号认证”列单独跟踪。',
    ]
    for catalog_index, item in enumerate(catalog):
        schema, source_ref, execute, live, auth_gate, auth, agent_mcp, qq_pipeline, tim_client = status(
            item, catalog_index, direct_source_refs, public_api_sources,
            auth_gate_denial_sources_by_name, model_mcp_sources_by_name,
            qq_pipeline_sources_by_name, tim_client_sources_by_name,
        )
        next_step = []
        if execute == '⬜':
            next_step.append('补直接夹具')
        if live == '⬜' and item.get('auth') == 'none':
            next_step.append('补公开 API')
        if auth == '⬜':
            next_step.append('准备账号验收')
        if auth_gate == '⬜':
            next_step.append('补未认证门禁拒绝测试')
        if agent_mcp == '⬜':
            next_step.append('补 Agent/MCP 实际调用证据')
        if qq_pipeline == '⬜':
            next_step.append('补 QQ 消息管线 E2E')
        if tim_client == '⬜':
            next_step.append('补 TIM 客户端 E2E')
        lines.append(
            f"| `{item['name']}` | `{item.get('auth')}` | `{item.get('risk')}` "
            f"| {schema} | {source_ref} | {execute} | {live} | {auth_gate} | {auth} "
            f"| {agent_mcp} | {qq_pipeline} | {tim_client} | {'；'.join(next_step)} |"
        )

    lines.extend([
        '',
        '## 真实生产 QQ/TIM 逐工具客户端证据',
        '',
        '下列勾选只来自当前锁定生产 profile 的真实工具调用、OneBot 收发阶段和真实 TIM 客户端画面三者关联的脱敏报告；离线 fixture 不会进入此列。账号必需、写入和破坏性工具仍需真实 OAuth/账号与专门授权，安全公开 profile 报告不能替代它们。',
        '',
    ])
    for name in sorted(qq_pipeline_e2e | tim_client_e2e):
        qq_refs = '<br>'.join(f'`{path}`' for path in sorted(qq_pipeline_sources_by_name.get(name, set())))
        tim_refs = '<br>'.join(f'`{path}`' for path in sorted(tim_client_sources_by_name.get(name, set()))) or '未观察到 TIM 客户端'
        lines.append(f'- [x] `{name}`：QQ 管线 {qq_refs}；TIM 客户端 {tim_refs}。')
    lines.extend([
        f'- [ ] 仍待逐工具实测：QQ 管线 {len(catalog) - len(qq_pipeline_e2e)}/{len(catalog)}；TIM 客户端 {len(catalog) - len(tim_client_e2e)}/{len(catalog)}。',
        '',
        '## 认证验收任务',
        '',
        '- [ ] 用真实 Bangumi OAuth 完成 `auth_start` → 回调 → `auth_status`。',
        '- [ ] 用真实账号完成 `auth_list_accounts`、`auth_switch_account`，验证多账号隔离。',
        '- [ ] 在明确确认下完成 `auth_remove_account` / `auth_disconnect`，记录回滚与审计结果。',
        '- [ ] 用真实账号验证所有 `auth: required` 的读工具、写工具和私有 render 工具。',
        '- [ ] 对写入/破坏性工具只使用测试账号和明确二次确认，不把 mock 成功当作线上成功。',
        '',
        '## QQ/TIM 真人语音输入验收（2026-09-23）',
        '',
        '- [x] 验收时机器人已登录，NapCat、AstrBot、Runner 和 OneBot 处于 READY。',
        '- [x] 用户在机器人私聊使用 TIM 麦克风发送真人语音；脱敏投递审计记录到 1 条入站 `record`，不保留语音或聊天正文。',
        '- [x] AstrBot 将 `record` 解析为 WAV，媒体桥把本轮受限文件路径交给 Antigravity 内置 `view_file`；固定合成探针已验证这条读取路径。',
        '- [x] 用户确认真实 TIM 回复与语音口令完全一致：`7294`。真人结果仅保存 `user_attested` 标记，不保存口令对应的原始聊天内容。',
        '- [ ] 后续只在语音桥、模型 CLI、AstrBot 或 OneBot 媒体处理改动后重跑；本次单次成功不代表各种口音、近音词、时长和编码都已覆盖。',
        '- [ ] QQ 登录掉线率仍需长期观察；语音验收不代表掉线稳定性问题已解决。',
        '',
        '说明：真人语音验收只证明一条真实 `record` 输入链路并获得准确回复；它与上方 96 个工具逐项的 QQ 管线/TIM 客户端列相互独立。本表中 `render_subject_overview` 的 1/96 客户端证据来自单作品信息卡文字+图片交互，不来自真人语音样本。',
        '',
        '这份清单完成前，不再把“完整工具覆盖”简称为“所有工具都真实测试过”。',
    ])
    generated = '\n'.join(lines) + '\n'
    summary = {'catalog': len(catalog), 'direct_execute': direct_count,
               'live_public': live_count, 'auth_required_or_optional': auth_count,
               'auth_gate_denial': len(auth_gate_denial_set),
               'auth_gate_pending': sum(item.get('auth') == 'required' and item['name'] not in auth_gate_denial_set for item in catalog),
               'agent_mcp_e2e': model_mcp_count, 'qq_pipeline_e2e': len(qq_pipeline_e2e),
               'tim_client_e2e': len(tim_client_e2e),
               'g26_frontier_evidence': (
                   'partial_verified'
                   if (ROOT / CODEX_G26_REPORT_RELATIVE_PATH).is_file()
                   else 'not_run'
               ),
               'output': str(OUTPUT)}
    if args.check:
        try:
            current = OUTPUT.read_text(encoding='utf-8')
        except OSError as error:
            raise SystemExit(f'acceptance table unavailable: {error}') from error
        if current != generated:
            raise SystemExit('acceptance table is stale; run python3 scripts/generate-tool-acceptance-tasks.py')
        print(json.dumps({**summary, 'check': 'current'}, ensure_ascii=False))
        return
    OUTPUT.write_text(generated, encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == '__main__':
    main()
