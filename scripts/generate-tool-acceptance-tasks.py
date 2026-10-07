#!/usr/bin/env python3
"""Generate the per-tool Bangumi acceptance checklist from the catalog and tests."""
import argparse
import functools
import hashlib
import json
import re
from pathlib import Path
import subprocess
import sys

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
CODEX_PROBE_ARGUMENTS = CODEX_G23_PROBE_ARGUMENTS | CODEX_G20_PROBE_ARGUMENTS
CODEX_ARGUMENT_PROFILES = {
    **{name: 'fixed-public-subject-218707-v1' for name in CODEX_G23_PROBE_ARGUMENTS},
    **{name: 'fixed-g20-subject-227245-include-evidence-v1' for name in CODEX_G20_PROBE_ARGUMENTS},
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
CODEX_G20_ANSWER_CHECK_FIELDS = {
    'queryArgumentsMatch', 'exactSingleToolCall', 'resultReadbackAvailable',
    'sourceScopeVerified', 'coverageConsistent', 'textProjectionConsistent',
    'textBudgetVerified', 'boundedSourceDisclosurePresent',
    'responseCountsDisclosurePresent', 'omissionNotAbsenceDisclosurePresent',
    'nonCanonicalOrderDisclosurePresent', 'schemaDriftDisclosurePresent',
    'noUnsupportedCompletenessClaim', 'noUnsupportedCanonicalOrderClaim',
    'noUnsupportedAbsenceClaim', 'noUnsupportedReverseClaim', 'noMarkdownFormatting',
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


@functools.lru_cache(maxsize=128)
def _codex_probe_revision_has_implementation(repository_root: str, revision: str) -> bool:
    """Bind a report revision to the tracked one-tool server and its evidence checks."""
    return _codex_revision_has_markers(
        repository_root, revision, CODEX_PROBE_IMPLEMENTATION_MARKERS,
    )


def _codex_revision_has_markers(
    repository_root: str, revision: str, markers_by_path: dict[str, tuple[str, ...]],
) -> bool:
    resolved = subprocess.run(
        ['git', 'rev-parse', '--verify', f'{revision}^{{commit}}'],
        cwd=repository_root, capture_output=True, text=True, check=False,
    )
    if resolved.returncode != 0 or resolved.stdout.strip() != revision:
        return False
    for relative_path, markers in markers_by_path.items():
        source = subprocess.run(
            ['git', 'show', f'{revision}:{relative_path}'],
            cwd=repository_root, capture_output=True, text=True, check=False,
        )
        if source.returncode != 0 or any(marker not in source.stdout for marker in markers):
            return False
    return True


def codex_probe_revision_has_implementation(revision: object) -> bool:
    if not isinstance(revision, str) or not re.fullmatch(r'[0-9a-f]{40}', revision):
        return False
    return _codex_probe_revision_has_implementation(str(ROOT), revision)


def codex_g20_probe_revision_has_implementation(revision: object) -> bool:
    if not isinstance(revision, str) or not re.fullmatch(r'[0-9a-f]{40}', revision):
        return False
    return (
        codex_probe_revision_has_implementation(revision)
        and _codex_revision_has_markers(
            str(ROOT), revision, CODEX_G20_PROBE_IMPLEMENTATION_MARKERS,
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

    head = subprocess.run(
        ['git', 'rev-parse', 'HEAD'], cwd=ROOT, capture_output=True, text=True, check=False,
    )
    if head.returncode != 0:
        return False
    head_sha = head.stdout.strip()
    committed_in_head = subprocess.run(
        ['git', 'cat-file', '-e', f'{head_sha}:{relative_path}'],
        cwd=ROOT, capture_output=True, text=True, check=False,
    )
    if committed_in_head.returncode != 0:
        # Before the sanitized report is committed, HEAD is still the candidate
        # that authorized the one-shot query. A staged report is also absent
        # from the HEAD tree and follows this path.
        return revision == head_sha

    added_commit = subprocess.run(
        ['git', 'log', '--follow', '--diff-filter=A', '--format=%H', '-1', '--', relative_path],
        cwd=ROOT, capture_output=True, text=True, check=False,
    )
    commit_sha = added_commit.stdout.strip()
    if added_commit.returncode != 0 or not re.fullmatch(r'[0-9a-f]{40}', commit_sha):
        return False
    parents = subprocess.run(
        ['git', 'rev-list', '--parents', '-n', '1', commit_sha],
        cwd=ROOT, capture_output=True, text=True, check=False,
    )
    parent_shas = parents.stdout.strip().split()
    return parents.returncode == 0 and len(parent_shas) >= 2 and parent_shas[1] == revision


def codex_mcp_evidence_is_valid(
    report: dict, evidence_by_name: dict[str, dict], current_by_name: dict[str, dict],
) -> bool:
    """Accept only sanitized, exact-catalog GPT-6 Luna Max one-tool reports."""
    if set(report) != CODEX_REPORT_FIELDS:
        return False
    if (type(report.get('schemaVersion')) is not int
            or report.get('schemaVersion') != 1
            or report.get('evidenceKind') != 'codex_cli_mcp_tool_use'
            or report.get('profile') != 'codex-luna-max-one-tool-v1'
            or report.get('model') != 'gpt-6-luna'
            or report.get('reasoningEffort') != 'max'
            or not isinstance(report.get('codexCliVersion'), str)
            or not re.fullmatch(r'\d+\.\d+\.\d+', report['codexCliVersion'])
            or not isinstance(report.get('sourceRevision'), str)
            or not re.fullmatch(r'[0-9a-f]{40}', report['sourceRevision'])
            or not codex_probe_revision_has_implementation(report['sourceRevision'])
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

    tool_name = report.get('toolName')
    arguments = CODEX_PROBE_ARGUMENTS.get(tool_name)
    is_g20 = tool_name in CODEX_G20_PROBE_ARGUMENTS
    current_tool = current_by_name.get(tool_name) if isinstance(tool_name, str) else None
    if (arguments is None or current_tool is None
            or evidence_by_name.get(tool_name) != current_tool
            or current_tool.get('auth') != 'none'
            or current_tool.get('risk') != 'read'
            or report.get('serverToolNames') != [tool_name]
            or report.get('serverToolCount') != 1
            or report.get('allowedCallCount') != 1
            or report.get('deniedCallCount') != 0
            or report.get('argumentProfile') != CODEX_ARGUMENT_PROFILES.get(tool_name)
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
    if (not isinstance(privacy, dict)
            or set(privacy) != set(CODEX_PRIVACY_FLAGS) | {'authProfile'}
            or privacy.get('authProfile') != 'anonymous'):
        return False
    if any(privacy.get(flag) is not False for flag in CODEX_PRIVACY_FLAGS):
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
            or set(scenario.get('answerChecks', {})) != (
                CODEX_G20_ANSWER_CHECK_FIELDS if is_g20 else (
                    CODEX_RENDERER_ANSWER_CHECK_FIELDS if tool_name.startswith('bangumi.render_')
                    else CODEX_STATS_ANSWER_CHECK_FIELDS
                )
            )
            or any(value is not True for value in scenario.get('answerChecks', {}).values())
            or not isinstance(calls, list)
            or len(calls) != 1
            or calls[0] != {'name': tool_name, 'state': 'DONE'}
            or _contains_forbidden_codex_content(report)):
        return False

    result = scenario.get('result')
    if is_g20:
        return codex_g20_result_is_valid(result, arguments['subjectId'])
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
    for path in LIVE_PROBE_DIR.glob('pariya-agent-*-e2e-*.json'):
        try:
            report = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            continue
        if not isinstance(report, dict):
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
