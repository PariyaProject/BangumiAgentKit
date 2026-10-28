import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import catalog from '../../docs/tool-catalog.json';

const ROOT = process.cwd();
const REAL_A1_REPORT_PATH = 'docs/live-probes/run95-a1-bound-reads-2026-10-26/a1-result.json';
const REAL_A1_TOOLS = new Set(['bangumi.get_my_profile', 'bangumi.list_collections']);
const REAL_A3_REPORT_PATH =
  'docs/live-probes/run95-a3-bound-overview-and-private-png-2026-10-27/a3-result.json';
const REAL_A4_BUNDLE = 'docs/live-probes/run95-a4-backlog-schedule-and-private-pngs-2026-10-27';
const REAL_A4_REPORT_PATH = REAL_A4_BUNDLE + '/a4-result.json';
const REAL_A4_TOOLS = [
  'bangumi.get_collection_backlog',
  'bangumi.render_collection_backlog',
  'bangumi.get_collection_schedule',
  'bangumi.render_collection_schedule',
];
const REAL_A5_BUNDLE = 'docs/live-probes/run95-a5-dashboard-and-private-png-2026-10-28';
const REAL_A5_REPORT_PATH = REAL_A5_BUNDLE + '/a5-result.json';
const REAL_A5_TOOLS = ['bangumi.get_collection_dashboard', 'bangumi.render_collection_dashboard'];
const REAL_A6_BUNDLE = 'docs/live-probes/run95-a6-series-and-private-png-2026-10-28';
const REAL_A6_REPORT_PATH = REAL_A6_BUNDLE + '/a6-result.json';
const REAL_A6_TOOLS = [
  'bangumi.get_collection_series_groups',
  'bangumi.render_collection_series_groups',
];
const REAL_CURRENT_ACCOUNT_TOOLS = [
  'bangumi.get_collection_backlog',
  'bangumi.get_collection_dashboard',
  'bangumi.get_collection_intelligence',
  'bangumi.get_collection_schedule',
  'bangumi.get_collection_series_groups',
  'bangumi.list_collections',
  'bangumi.render_collection_backlog',
  'bangumi.render_collection_dashboard',
  'bangumi.render_collection_intelligence',
  'bangumi.render_collection_schedule',
  'bangumi.render_collection_series_groups',
];
const REAL_A2_REPORT_PATH =
  'docs/live-probes/run95-a2-partial-account-read-2026-10-27/a2-result.json';
const CATALOG_TEXT = readFileSync(join(ROOT, 'docs/tool-catalog.json'), 'utf8');
const TABLE = readFileSync(join(ROOT, 'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md'), 'utf8');
const FRONTIER = JSON.parse(readFileSync(join(ROOT, 'docs/product/frontier-ledger.json'), 'utf8'));
const P06_AGENT_MCP_REPORT_PATH =
  'docs/live-probes/p06-render-person-profile-agent-mcp-v3-run95.json';
const RENDER_SUBJECT_CARD_V5_REPORT_PATH =
  'docs/live-probes/render-subject-card-compact-typography-v5-agent-mcp-run95.json';
const RENDER_SUBJECT_CARD_V5_REPORT_FILE = join(ROOT, RENDER_SUBJECT_CARD_V5_REPORT_PATH);
const RENDER_SUBJECT_CARD_V5_REPORT = existsSync(RENDER_SUBJECT_CARD_V5_REPORT_FILE)
  ? JSON.parse(readFileSync(RENDER_SUBJECT_CARD_V5_REPORT_FILE, 'utf8'))
  : null;
const COMPACT_EVIDENCE = JSON.parse(
  readFileSync(join(ROOT, 'docs/live-probes/pariya-agent-compact-e2e-2026-09-23.json'), 'utf8'),
);
const RUN86_PERSON_ACTIVITY_COMPARISON_EVIDENCE = JSON.parse(
  readFileSync(
    join(ROOT, 'docs/live-probes/person-activity-comparison-run86-c4acc24.json'),
    'utf8',
  ),
);
const RUN89_SUBJECT_STAFF_EVIDENCE = JSON.parse(
  readFileSync(
    join(
      ROOT,
      'docs/live-probes/pariya-agent-full-public-qa-e2e-get-subject-staff-2026-10-04.json',
    ),
    'utf8',
  ),
);
const FULL_PUBLIC_QA_EVIDENCE = readdirSync(join(ROOT, 'docs/live-probes'))
  .filter((name) => name.startsWith('pariya-agent-full-public-qa-e2e-') && name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(readFileSync(join(ROOT, 'docs/live-probes', name), 'utf8')));
const FULL_RENDERER_QA_EVIDENCE = readdirSync(join(ROOT, 'docs/live-probes'))
  .filter((name) => name.startsWith('pariya-agent-full-renderer-qa-e2e-') && name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(readFileSync(join(ROOT, 'docs/live-probes', name), 'utf8')));
const CODEX_LUNA_EVIDENCE = readdirSync(join(ROOT, 'docs/live-probes'))
  .filter((name) => name.startsWith('pariya-agent-codex-luna-e2e-') && name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(readFileSync(join(ROOT, 'docs/live-probes', name), 'utf8')));
const D05_REPORT_PATH = join(
  ROOT,
  'docs/live-probes/d05-current-season-multitag-heat-agent-mcp-run95.json',
);
const D05_REPORT = existsSync(D05_REPORT_PATH)
  ? JSON.parse(readFileSync(D05_REPORT_PATH, 'utf8'))
  : null;
const S04_REPORT_PATH = join(
  ROOT,
  'docs/live-probes/s04-subject-cast-multirole-agent-mcp-run95.json',
);
const S04_REPORT = existsSync(S04_REPORT_PATH)
  ? JSON.parse(readFileSync(S04_REPORT_PATH, 'utf8'))
  : null;
const G06_CAST_OFFLINE_V2_REPORT_PATH =
  'docs/live-probes/g06-subject-cast-offline-agent-mcp-run95-v2.json';
const G06_CAST_OFFLINE_V2_REPORT_FILE = join(ROOT, G06_CAST_OFFLINE_V2_REPORT_PATH);
const G06_CAST_OFFLINE_V2_REPORT = existsSync(G06_CAST_OFFLINE_V2_REPORT_FILE)
  ? JSON.parse(readFileSync(G06_CAST_OFFLINE_V2_REPORT_FILE, 'utf8'))
  : null;
const R04_RENDER_V2_REPORT_PATH =
  'docs/live-probes/r04-render-series-watch-order-offline-agent-mcp-v2-run95.json';
const R04_RENDER_V2_REPORT_FILE = join(ROOT, R04_RENDER_V2_REPORT_PATH);
const R04_RENDER_V2_REPORT = existsSync(R04_RENDER_V2_REPORT_FILE)
  ? JSON.parse(readFileSync(R04_RENDER_V2_REPORT_FILE, 'utf8'))
  : null;
const P01_DIRECTOR_AGENT_MCP_REPORT_PATH =
  'docs/live-probes/p01-person-activity-director-offline-run95-v1.json';
const P01_DIRECTOR_AGENT_MCP_REPORT_FILE = join(ROOT, P01_DIRECTOR_AGENT_MCP_REPORT_PATH);
const P01_DIRECTOR_AGENT_MCP_REPORT = existsSync(P01_DIRECTOR_AGENT_MCP_REPORT_FILE)
  ? JSON.parse(readFileSync(P01_DIRECTOR_AGENT_MCP_REPORT_FILE, 'utf8'))
  : null;
const P03_V4_AGENT_MCP_REPORT_PATH =
  'docs/live-probes/p03-person-name-cn-public-v4-agent-mcp-run95.json';
const P03_V4_AGENT_MCP_REPORT_FILE = join(ROOT, P03_V4_AGENT_MCP_REPORT_PATH);
const P03_V4_AGENT_MCP_REPORT = existsSync(P03_V4_AGENT_MCP_REPORT_FILE)
  ? JSON.parse(readFileSync(P03_V4_AGENT_MCP_REPORT_FILE, 'utf8'))
  : null;

function reportReferencesInMatrixCell(cell: unknown): string[] {
  if (typeof cell !== 'string') return [];
  const references = cell.matchAll(
    /(?:^|[\s`<>"'|,;()])([^\s`<>"'|,;()]*docs\/live-probes\/[^\s`<>"'|,;()]+)(?=$|[\s`<>"'|,;()])/gu,
  );
  const paths: string[] = [];
  for (const match of references) {
    if (match[1] !== undefined) paths.push(match[1]);
  }
  return paths;
}

function hasExactMatrixReportReference(cell: unknown, expectedPath: string): boolean {
  const paths = reportReferencesInMatrixCell(cell);
  return paths.length === 1 && paths[0] === expectedPath;
}

function expectAccountAuthCell(toolName: string, cell: unknown): void {
  const liveReference =
    toolName === 'bangumi.list_collections'
      ? REAL_A2_REPORT_PATH
      : ['bangumi.get_collection_intelligence', 'bangumi.render_collection_intelligence'].includes(
            toolName,
          )
        ? REAL_A3_REPORT_PATH
        : REAL_A4_TOOLS.includes(toolName)
          ? REAL_A4_REPORT_PATH
          : REAL_A5_TOOLS.includes(toolName)
            ? REAL_A5_REPORT_PATH
            : REAL_A6_TOOLS.includes(toolName)
              ? REAL_A6_REPORT_PATH
              : undefined;
  if (liveReference !== undefined) expect(cell).toBe(`✅<br>\`${liveReference}\``);
  else expectAccountAuthPending(cell);
}

function expectAccountAuthPending(cell: unknown): void {
  // Historical e081 live success remains preserved, but the upgraded dependency
  // graph was never exercised by that batch. No synthetic/denial report earns it.
  expect(cell).toBe('⬜');
}

const FULL_OPERATION_QA_EVIDENCE = readdirSync(join(ROOT, 'docs/live-probes'))
  .filter(
    (name) => name.startsWith('pariya-agent-full-operation-qa-e2e-') && name.endsWith('.json'),
  )
  .sort()
  .map((name) => JSON.parse(readFileSync(join(ROOT, 'docs/live-probes', name), 'utf8')));
const FULL_AUTH_START_QA_EVIDENCE = readdirSync(join(ROOT, 'docs/live-probes'))
  .filter(
    (name) => name.startsWith('pariya-agent-full-auth-start-qa-e2e-') && name.endsWith('.json'),
  )
  .sort()
  .map((name) => JSON.parse(readFileSync(join(ROOT, 'docs/live-probes', name), 'utf8')));
const FULL_AUTH_DENIAL_QA_EVIDENCE = readdirSync(join(ROOT, 'docs/live-probes'))
  .filter(
    (name) => name.startsWith('pariya-agent-full-auth-denial-qa-e2e-') && name.endsWith('.json'),
  )
  .sort()
  .map((name) => JSON.parse(readFileSync(join(ROOT, 'docs/live-probes', name), 'utf8')))
  .filter((report: any) => report.scenarios?.[0]?.assertions?.networkAccessBlocked === true);
const FULL_AUTH_SWITCH_QA_EVIDENCE = readdirSync(join(ROOT, 'docs/live-probes'))
  .filter(
    (name) => name.startsWith('pariya-agent-full-auth-switch-qa-e2e-') && name.endsWith('.json'),
  )
  .sort()
  .map((name) => JSON.parse(readFileSync(join(ROOT, 'docs/live-probes', name), 'utf8')));
const FULL_AUTH_MUTATION_QA_EVIDENCE = readdirSync(join(ROOT, 'docs/live-probes'))
  .filter(
    (name) => name.startsWith('pariya-agent-full-auth-mutation-qa-e2e-') && name.endsWith('.json'),
  )
  .sort()
  .map((name) => JSON.parse(readFileSync(join(ROOT, 'docs/live-probes', name), 'utf8')));
const FULL_AUTH_FEATURE_QA_EVIDENCE = readdirSync(join(ROOT, 'docs/live-probes'))
  .filter(
    (name) => name.startsWith('pariya-agent-full-auth-feature-qa-e2e-') && name.endsWith('.json'),
  )
  .sort()
  .map((name) => JSON.parse(readFileSync(join(ROOT, 'docs/live-probes', name), 'utf8')));
const FULL_AUTH_WRITE_QA_EVIDENCE = readdirSync(join(ROOT, 'docs/live-probes'))
  .filter(
    (name) => name.startsWith('pariya-agent-full-auth-write-qa-e2e-') && name.endsWith('.json'),
  )
  .sort()
  .map((name) => JSON.parse(readFileSync(join(ROOT, 'docs/live-probes', name), 'utf8')));
const RUN66_DISCOVERY_DIRECT_EVIDENCE = JSON.parse(
  readFileSync(
    join(ROOT, 'docs/live-probes/discovery-scenarios-run66-d1a5a03-2026-10-03.json'),
    'utf8',
  ),
);
const RUN66_DISCOVERY_SCENARIO_DIR = join(ROOT, 'docs/live-probes/scenario-runs/run66-d1a5a03');
const RUN66_DISCOVERY_AGENT_EVIDENCE = readdirSync(RUN66_DISCOVERY_SCENARIO_DIR)
  .filter((name) => name.startsWith('agent-query-subjects-') && name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(readFileSync(join(RUN66_DISCOVERY_SCENARIO_DIR, name), 'utf8')));
const RUN66_DISCOVERY_RENDER_EVIDENCE = readdirSync(RUN66_DISCOVERY_SCENARIO_DIR)
  .filter((name) => name.startsWith('render-query-subjects-') && name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(readFileSync(join(RUN66_DISCOVERY_SCENARIO_DIR, name), 'utf8')));

const CURRENT_CATALOG_SHA256 = createHash('sha256').update(CATALOG_TEXT).digest('hex');
const catalogCache = new Map<string, unknown[]>([[CURRENT_CATALOG_SHA256, catalog]]);

function catalogForHash(sha256: string): unknown[] | undefined {
  const cached = catalogCache.get(sha256);
  if (cached) return cached;
  if (!/^[a-f0-9]{64}$/u.test(sha256)) return undefined;
  try {
    const content = readFileSync(
      join(ROOT, 'docs/live-probes/catalog-snapshots', `${sha256}.json`),
    );
    if (createHash('sha256').update(content).digest('hex') !== sha256) return undefined;
    const snapshot = JSON.parse(content.toString('utf8')) as unknown[];
    catalogCache.set(sha256, snapshot);
    return snapshot;
  } catch {
    return undefined;
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function toolContractMatchesCurrent(report: any, name: string): boolean {
  const evidenceCatalog = catalogForHash(report.catalogSha256);
  const evidenceTool = evidenceCatalog?.find((item) =>
    Boolean(item && typeof item === 'object' && (item as { name?: unknown }).name === name),
  );
  const currentTool = catalog.find((item) => item.name === name);
  if (
    name === 'bangumi.render_subject_card' &&
    report.results?.find((result: any) => result.tool === name)?.input?.includeCollection ===
      false &&
    currentTool?.policyMode === 'dynamic'
  ) {
    // Historical public evidence remains valid only for an explicit public invocation.
    const historical = JSON.parse(JSON.stringify(currentTool));
    historical.policyMode = 'static';
    delete historical.policyDescription;
    return stableJson(evidenceTool) === stableJson(historical);
  }
  return Boolean(
    evidenceTool && currentTool && stableJson(evidenceTool) === stableJson(currentTool),
  );
}

function isCurrentC07RendererReport(report: any): boolean {
  const scenario = report?.scenarios?.[0];
  const result = scenario?.result;
  const artifact = result?.artifact;
  const checks = scenario?.answerChecks;
  const candidateGate = report?.candidateGate;
  const fixture = report?.offlineFixture;
  return Boolean(
    report?.evidenceKind === 'codex_cli_mcp_tool_use' &&
    report?.profile === 'codex-luna-max-one-tool-v1' &&
    report?.runNumber === 95 &&
    report?.frontierId === 'C07' &&
    report?.epochId === 'run95-c07-cohort-comparison-renderer-luna-mcp' &&
    report?.model === 'gpt-6-luna' &&
    report?.reasoningEffort === 'max' &&
    report?.toolName === 'bangumi.render_subject_cohort_comparison' &&
    report?.argumentProfile === 'run95-c07-cohort-comparison-renderer-offline-v1' &&
    /^[0-9a-f]{40}$/u.test(report?.sourceRevision ?? '') &&
    /^[0-9a-f]{40}$/u.test(report?.baseSha ?? '') &&
    /^[0-9a-f]{64}$/u.test(report?.mcpBundleSha256 ?? '') &&
    report?.prNumber === 140 &&
    typeof report?.eventStreamComplete === 'boolean' &&
    (report.eventStreamComplete === true || checks?.cliFinalMessageVerified === true) &&
    report?.processExitCode === 0 &&
    report?.resultStatus === 'SUCCESS' &&
    report?.eventStreamParsed === true &&
    report?.codexMcpToolEventCount === 1 &&
    report?.nonMcpToolEventCount === 0 &&
    report?.shellToolCallCount === 0 &&
    report?.allowedCallCount === 1 &&
    report?.deniedCallCount === 0 &&
    report?.serverToolCount === 1 &&
    report?.serverToolNames?.length === 1 &&
    report.serverToolNames[0] === 'bangumi.render_subject_cohort_comparison' &&
    report?.mcpServerNames?.length === 1 &&
    report.mcpServerNames[0] === 'bgk_c07_cohort_renderer_one_tool' &&
    report?.serverSummaryMatchesCandidate === true &&
    report?.sameCandidateAfterCall === true &&
    candidateGate?.candidateSha === report.sourceRevision &&
    candidateGate?.baseSha === report.baseSha &&
    candidateGate?.ciSha === report.sourceRevision &&
    candidateGate?.ciStatus === 'SUCCESS' &&
    candidateGate?.ciCheckCount === 7 &&
    candidateGate?.reviewPassSha === report.sourceRevision &&
    candidateGate?.reviewVerdict === 'PASS' &&
    /^gpt[-_]6[-_]luna[-_]max/u.test(candidateGate?.reviewerId ?? '') &&
    scenario?.id === 'bangumi.render_subject_cohort_comparison' &&
    scenario?.passed === true &&
    scenario?.exactArgumentsMatched === true &&
    scenario?.oneToolAllowlistVerified === true &&
    scenario?.resultReadbackVerified === true &&
    scenario?.answerCheckPassed === true &&
    scenario?.toolCalls?.length === 1 &&
    scenario.toolCalls[0]?.name === 'bangumi.render_subject_cohort_comparison' &&
    scenario.toolCalls[0]?.state === 'DONE' &&
    Object.values(checks ?? {}).length > 0 &&
    Object.keys(checks ?? {})
      .sort()
      .join(',') ===
      [
        'artifactReadback',
        'currentCandidateBundle',
        'decodedDimensionsMatch',
        'decodedPng',
        'fixedArguments',
        'noAdditionalTools',
        'offlineFixtureOnly',
        'oneToolOnly',
        'privacyPreserved',
        'cliFinalMessageVerified',
        'successfulServerCall',
        'nonblankPixelSignal',
      ]
        .sort()
        .join(',') &&
    Object.values(checks ?? {}).every((value) => value === true) &&
    result?.sourceOperations?.length === 0 &&
    result?.resultState === 'artifact_returned' &&
    fixture?.profile === 'run95-c07-cohort-render-v1' &&
    fixture?.localStubRequests === 4 &&
    fixture?.searchResponses === 2 &&
    fixture?.subjectDetailResponses === 2 &&
    fixture?.unexpectedRequests === 0 &&
    fixture?.authorizationHeaders === 0 &&
    fixture?.liveBangumiRequests === 0 &&
    fixture?.rawFixturePayloadStored === false &&
    report?.artifactValidation?.decoded === true &&
    report?.artifactValidation?.dimensionsMatch === true &&
    report?.artifactValidation?.nonblankPixelSignalVerified === true &&
    artifact?.mimeType === 'image/png' &&
    Number.isInteger(artifact?.width) &&
    artifact.width > 0 &&
    artifact.width <= 3000 &&
    Number.isInteger(artifact?.height) &&
    artifact.height > 0 &&
    artifact.height <= 5000 &&
    artifact.width * artifact.height <= 10_000_000 &&
    Number.isInteger(artifact?.byteLength) &&
    artifact.byteLength > 0 &&
    artifact.byteLength <= 5_000_000 &&
    /^[0-9a-f]{64}$/u.test(artifact?.sha256 ?? '') &&
    artifact?.pngSignatureValid === true &&
    artifact?.persisted === false &&
    report?.privacy?.authProfile === 'anonymous' &&
    report?.privacy?.oauthAttempted === false &&
    report?.privacy?.accountDataRead === false &&
    report?.privacy?.writesAttempted === false &&
    report?.privacy?.qqPipelineTested === false &&
    report?.privacy?.timClientTested === false &&
    report?.privacy?.promptStored === false &&
    report?.privacy?.answerStored === false &&
    report?.privacy?.rawResultStored === false &&
    report?.privacy?.artifactImageBytesStored === false &&
    report?.privacy?.credentialsStored === false &&
    toolContractMatchesCurrent(report, 'bangumi.render_subject_cohort_comparison'),
  );
}

function isCurrentD05Report(report: any): boolean {
  const checks = report?.answerChecks;
  return Boolean(
    report?.evidenceKind === 'codex_cli_d05_current_season_agent_mcp' &&
    report?.runNumber === 95 &&
    report?.scenarioId === 'D05' &&
    report?.frontierId === 'D05' &&
    report?.model === 'gpt-6-luna' &&
    report?.reasoningEffort === 'max' &&
    report?.toolName === 'bangumi.query_subjects' &&
    report?.processExitCode === 0 &&
    report?.resultStatus === 'SUCCESS' &&
    report?.codexMcpToolEventCount === 1 &&
    report?.nonMcpToolEventCount === 0 &&
    report?.shellToolCallCount === 0 &&
    report?.allowedCallCount === 1 &&
    report?.deniedCallCount === 0 &&
    report?.rawAnswerPersisted === false &&
    report?.rawToolResultPersisted === false &&
    toolContractMatchesCurrent(report, 'bangumi.query_subjects') &&
    Array.isArray(checks) === false &&
    checks &&
    Object.values(checks).length > 0 &&
    Object.values(checks).every((value) => value === true) &&
    report?.resultCounters?.totalKind === 'estimated' &&
    report?.warningCodes?.includes('EXPERIMENTAL_SOURCE') &&
    report?.privacy?.authProfile === 'anonymous' &&
    report?.privacy?.oauthAttempted === false &&
    report?.privacy?.accountDataRead === false &&
    report?.privacy?.writesAttempted === false &&
    report?.privacy?.qqPipelineTested === false &&
    report?.privacy?.timClientTested === false,
  );
}

function isCurrentS04Report(report: any): boolean {
  const checks = report?.answerChecks;
  return Boolean(
    report?.evidenceKind === 'codex_cli_s04_subject_cast_multirole_agent_mcp' &&
    report?.runNumber === 95 &&
    report?.scenarioId === 'S04' &&
    report?.frontierId === 'S04' &&
    report?.model === 'gpt-6-luna' &&
    report?.reasoningEffort === 'max' &&
    report?.toolName === 'bangumi.get_subject_cast' &&
    report?.processExitCode === 0 &&
    report?.resultStatus === 'SUCCESS' &&
    report?.codexMcpToolEventCount === 1 &&
    report?.nonMcpToolEventCount === 0 &&
    report?.shellToolCallCount === 0 &&
    report?.allowedCallCount === 1 &&
    report?.deniedCallCount === 0 &&
    Array.isArray(checks) === false &&
    checks &&
    Object.values(checks).length > 0 &&
    Object.values(checks).every((value) => value === true) &&
    report?.sourceCoverage?.responseByteLimit === 1_048_576 &&
    report?.privacy?.authProfile === 'anonymous' &&
    report?.privacy?.oauthAttempted === false &&
    report?.privacy?.accountDataRead === false &&
    report?.privacy?.writesAttempted === false &&
    report?.privacy?.qqPipelineTested === false &&
    report?.privacy?.timClientTested === false &&
    report?.privacy?.communityRead === false &&
    report?.privacy?.rawAnswerPersisted === false &&
    report?.privacy?.rawToolResultPersisted === false &&
    toolContractMatchesCurrent(report, 'bangumi.get_subject_cast'),
  );
}

const CURRENT_D05_REPORT = isCurrentD05Report(D05_REPORT) ? D05_REPORT : null;
const CURRENT_S04_REPORT = isCurrentS04Report(S04_REPORT) ? S04_REPORT : null;
const CURRENT_C07_RENDERER_REPORT = CODEX_LUNA_EVIDENCE.find(isCurrentC07RendererReport) ?? null;
const CURRENT_P06_AGENT_MCP_MATRIX = (() => {
  const row = rowsByTool().get('bangumi.render_person_profile');
  const frontierRecord = FRONTIER.records?.find((record: any) => record.id === 'P06');
  return Boolean(
    existsSync(join(ROOT, P06_AGENT_MCP_REPORT_PATH)) &&
    row?.length === 13 &&
    statusMark(row[9]) === '✅' &&
    hasExactMatrixReportReference(row[9], P06_AGENT_MCP_REPORT_PATH) &&
    !reportReferencesInMatrixCell(row[6]).includes(P06_AGENT_MCP_REPORT_PATH) &&
    frontierRecord?.status === 'UNASSESSED' &&
    frontierRecord.source_refs?.includes(P06_AGENT_MCP_REPORT_PATH),
  );
})();

// Preserve prior reports as history, but count only the newest current-contract
// report for each tool in the current-source acceptance matrix.
const CURRENT_FULL_PUBLIC_QA_EVIDENCE = (() => {
  const current = FULL_PUBLIC_QA_EVIDENCE.filter((report: any) => {
    const name = report.scenarios?.[0]?.id;
    return typeof name === 'string' && toolContractMatchesCurrent(report, name);
  }).sort(
    (left: any, right: any) =>
      Number(Boolean(right.candidateSha)) - Number(Boolean(left.candidateSha)) ||
      String(right.createdOn ?? '').localeCompare(String(left.createdOn ?? '')) ||
      String(right.upstreamRevision ?? '').localeCompare(String(left.upstreamRevision ?? '')),
  );
  const seenTools = new Set<string>();
  return current.filter((report: any) => {
    const name = report.scenarios?.[0]?.id;
    if (typeof name !== 'string' || seenTools.has(name)) return false;
    seenTools.add(name);
    return true;
  });
})();
const CURRENT_FULL_RENDERER_QA_EVIDENCE = FULL_RENDERER_QA_EVIDENCE.filter((report: any) => {
  const name = report.scenarios?.[0]?.id;
  return typeof name === 'string' && toolContractMatchesCurrent(report, name);
});

const EVIDENCE = [
  COMPACT_EVIDENCE,
  ...CURRENT_FULL_PUBLIC_QA_EVIDENCE,
  ...FULL_RENDERER_QA_EVIDENCE,
  ...CODEX_LUNA_EVIDENCE,
  ...FULL_OPERATION_QA_EVIDENCE,
  ...FULL_AUTH_START_QA_EVIDENCE,
  ...FULL_AUTH_SWITCH_QA_EVIDENCE,
  ...FULL_AUTH_MUTATION_QA_EVIDENCE,
  ...FULL_AUTH_FEATURE_QA_EVIDENCE,
  ...FULL_AUTH_WRITE_QA_EVIDENCE,
];

function rowsByTool(): Map<string, string[]> {
  const rows = new Map<string, string[]>();
  for (const line of TABLE.split(/\r?\n/u)) {
    if (!line.startsWith('| `bangumi.')) continue;
    const fields = line
      .slice(1, -1)
      .split('|')
      .map((field) => field.trim());
    const toolName = fields[0];
    if (toolName) rows.set(toolName.replaceAll('`', ''), fields);
  }
  return rows;
}

function statusMark(cell: string | undefined): string | undefined {
  return cell?.split('<br>', 1)[0];
}

function isCurrentG06CastOfflineV2Report(report: any): boolean {
  const row = rowsByTool().get('bangumi.get_subject_cast');
  const checks = report?.ciChecks;
  const answerChecks = report?.answerChecks;
  return Boolean(
    report?.schemaVersion === 1 &&
    report?.evidenceKind === 'codex_cli_g06_subject_cast_offline_agent_mcp_v2' &&
    report?.runNumber === 95 &&
    report?.frontierId === 'G06' &&
    report?.scenarioId === null &&
    report?.acceptanceScope === 'agent-mcp-matrix-only' &&
    report?.profileId === 'g06-cast-offline-agent-mcp-matrix-v2' &&
    report?.epochId === 'run95-g06-cast-offline-matrix-v2-20261018' &&
    report?.model === 'gpt-6-luna' &&
    report?.reasoningEffort === 'max' &&
    report?.toolName === 'bangumi.get_subject_cast' &&
    report?.processExitCode === 0 &&
    report?.resultStatus === 'SUCCESS' &&
    report?.codexMcpToolEventCount === 1 &&
    report?.nonMcpToolEventCount === 0 &&
    report?.shellToolCallCount === 0 &&
    report?.allowedCallCount === 1 &&
    report?.deniedCallCount === 0 &&
    /^[0-9a-f]{40}$/u.test(report?.sourceRevision ?? '') &&
    report?.ciSha === report?.sourceRevision &&
    report?.ciStatus === 'SUCCESS' &&
    Array.isArray(checks) &&
    checks.length === 7 &&
    checks.every((check: any) => check.status === 'COMPLETED' && check.conclusion === 'SUCCESS') &&
    answerChecks &&
    Object.values(answerChecks).length === 10 &&
    Object.values(answerChecks).every((value) => value === true) &&
    report?.offlineFixture?.requestCount === 1 &&
    report?.offlineFixture?.unexpectedRequestCount === 0 &&
    report?.networkBoundary?.liveBangumiApiRequestCount === 0 &&
    report?.networkBoundary?.externalProductRequestCount === 0 &&
    report?.privacy?.authProfile === 'anonymous' &&
    report?.privacy?.oauthAttempted === false &&
    report?.privacy?.accountDataRead === false &&
    report?.privacy?.writesAttempted === false &&
    report?.privacy?.qqPipelineTested === false &&
    report?.privacy?.timClientTested === false &&
    typeof report?.runnerReceipt?.signature === 'string' &&
    toolContractMatchesCurrent(report, 'bangumi.get_subject_cast') &&
    statusMark(row?.[9]) === '✅' &&
    hasExactMatrixReportReference(row?.[9], G06_CAST_OFFLINE_V2_REPORT_PATH),
  );
}

const CURRENT_G06_CAST_OFFLINE_V2_REPORT = isCurrentG06CastOfflineV2Report(
  G06_CAST_OFFLINE_V2_REPORT,
)
  ? G06_CAST_OFFLINE_V2_REPORT
  : null;
const CURRENT_CAST_AGENT_MCP_REPORT = CURRENT_G06_CAST_OFFLINE_V2_REPORT ?? CURRENT_S04_REPORT;

function isCurrentRenderSubjectCardV5Report(report: any): boolean {
  const row = rowsByTool().get('bangumi.render_subject_card');
  const checks = report?.ciChecks;
  const answerChecks = report?.answerChecks;
  return Boolean(
    report?.schemaVersion === 1 &&
    report?.evidenceKind === 'codex_cli_render_subject_card_compact_typography_v5_agent_mcp' &&
    report?.runNumber === 95 &&
    report?.frontierId === 'OP-008' &&
    report?.scenarioId === null &&
    report?.profileId === 'render-subject-card-compact-typography-agent-mcp-v5' &&
    report?.epochId === 'run95-op008-render-card-compact-typography-v5-20261023' &&
    report?.profile === 'codex-luna-max-offline-agent-mcp-matrix-v5' &&
    report?.model === 'gpt-6-luna' &&
    report?.reasoningEffort === 'max' &&
    report?.prNumber === 269 &&
    /^[0-9a-f]{40}$/u.test(report?.sourceRevision ?? '') &&
    report?.ciSha === report?.sourceRevision &&
    report?.ciStatus === 'SUCCESS' &&
    /^\d+$/u.test(report?.ciRunId ?? '') &&
    Array.isArray(checks) &&
    checks.length === 7 &&
    checks.every((check: any) => check.status === 'COMPLETED' && check.conclusion === 'SUCCESS') &&
    report?.toolName === 'bangumi.render_subject_card' &&
    report?.processExitCode === 0 &&
    report?.resultStatus === 'SUCCESS' &&
    report?.eventStreamParsed === true &&
    report?.turnCompleted === true &&
    report?.codexMcpToolEventCount === 1 &&
    report?.codexErrorItemCount === 0 &&
    report?.nonMcpToolEventCount === 0 &&
    report?.shellToolCallCount === 0 &&
    report?.allowedCallCount === 1 &&
    report?.deniedCallCount === 0 &&
    answerChecks &&
    Object.values(answerChecks).length === 10 &&
    Object.values(answerChecks).every((value) => value === true) &&
    report?.offlineFixture?.profile === 'run95-render-subject-card-compact-typography-v5' &&
    report?.offlineFixture?.expectedOperation === 'GET /v0/subjects/991905' &&
    report?.offlineFixture?.requestCount === 1 &&
    report?.offlineFixture?.unexpectedRequestCount === 0 &&
    report?.offlineFixture?.authorizationHeaderCount === 0 &&
    report?.offlineFixture?.collectionRequestCount === 0 &&
    report?.offlineAssetBoundary?.assetResolutionCallCount === 0 &&
    report?.offlineAssetBoundary?.nonEmptyAssetUrlCount === 0 &&
    report?.networkBoundary?.liveBangumiApiRequestCount === 0 &&
    report?.networkBoundary?.rendererAssetRequestCount === 0 &&
    report?.networkBoundary?.fullCodexHarnessNetworkSandboxed === false &&
    report?.privacy?.authProfile === 'anonymous' &&
    report?.privacy?.oauthAttempted === false &&
    report?.privacy?.accountDataRead === false &&
    report?.privacy?.writesAttempted === false &&
    report?.privacy?.communityRead === false &&
    report?.privacy?.qqPipelineTested === false &&
    report?.privacy?.timClientTested === false &&
    report?.privacy?.artifactImageBytesStored === false &&
    typeof report?.runnerReceipt?.signature === 'string' &&
    report.runnerReceipt.signature.length > 0 &&
    toolContractMatchesCurrent(report, 'bangumi.render_subject_card') &&
    statusMark(row?.[9]) === '✅' &&
    hasExactMatrixReportReference(row?.[9], RENDER_SUBJECT_CARD_V5_REPORT_PATH),
  );
}

const CURRENT_RENDER_SUBJECT_CARD_V5_REPORT = isCurrentRenderSubjectCardV5Report(
  RENDER_SUBJECT_CARD_V5_REPORT,
)
  ? RENDER_SUBJECT_CARD_V5_REPORT
  : null;

function isCurrentR04RenderV2Report(report: any): boolean {
  const row = rowsByTool().get('bangumi.render_series_watch_order');
  const artifact = report?.resultSummary?.artifact;
  const checks = report?.answerChecks;
  return Boolean(
    report?.schemaVersion === 1 &&
    report?.evidenceKind === 'codex_cli_r04_render_series_watch_order_offline_agent_mcp_v2' &&
    report?.runNumber === 95 &&
    report?.frontierId === 'R04' &&
    report?.scenarioId === null &&
    report?.profileId === 'r04-render-series-watch-order-offline-agent-mcp-matrix-v2' &&
    report?.epochId === 'run95-r04-render-series-watch-order-offline-matrix-v2-20261018' &&
    report?.model === 'gpt-6-luna' &&
    report?.reasoningEffort === 'max' &&
    report?.toolName === 'bangumi.render_series_watch_order' &&
    report?.resultStatus === 'SUCCESS' &&
    report?.processExitCode === 0 &&
    report?.codexMcpToolEventCount === 1 &&
    report?.mcpToolErrorResultCount === 0 &&
    report?.nonMcpToolEventCount === 0 &&
    report?.shellToolCallCount === 0 &&
    report?.allowedCallCount === 1 &&
    report?.deniedCallCount === 0 &&
    /^[0-9a-f]{40}$/u.test(report?.sourceRevision ?? '') &&
    report?.ciSha === report?.sourceRevision &&
    report?.ciStatus === 'SUCCESS' &&
    Array.isArray(report?.ciChecks) &&
    report.ciChecks.length === 7 &&
    report.ciChecks.every(
      (check: any) => check.status === 'COMPLETED' && check.conclusion === 'SUCCESS',
    ) &&
    report?.offlineFixture?.requestCount === 2 &&
    report?.offlineFixture?.duplicateRequestCount === 0 &&
    report?.offlineFixture?.unexpectedRequestCount === 0 &&
    report?.offlineFixture?.authorizationHeaderCount === 0 &&
    report?.rendererAssetBoundary?.requestCount === 0 &&
    report?.networkBoundary?.liveBangumiApiRequestCount === 0 &&
    report?.networkBoundary?.rendererAssetRequestCount === 0 &&
    report?.privacy?.authProfile === 'anonymous' &&
    report?.privacy?.oauthAttempted === false &&
    report?.privacy?.accountDataRead === false &&
    report?.privacy?.writesAttempted === false &&
    report?.privacy?.qqPipelineTested === false &&
    report?.privacy?.timClientTested === false &&
    report?.privacy?.artifactImageBytesStored === false &&
    artifact?.returned === true &&
    artifact?.persisted === false &&
    artifact?.mimeType === 'image/png' &&
    Number.isInteger(artifact?.width) &&
    artifact.width > 0 &&
    Number.isInteger(artifact?.height) &&
    artifact.height > 0 &&
    artifact?.pngSignatureValid === true &&
    artifact?.decoded === true &&
    artifact?.dimensionsMatch === true &&
    checks &&
    Object.keys(checks).length === 11 &&
    Object.values(checks).every((value) => value === true) &&
    typeof report?.runnerReceipt?.signature === 'string' &&
    toolContractMatchesCurrent(report, 'bangumi.render_series_watch_order') &&
    statusMark(row?.[9]) === '✅' &&
    hasExactMatrixReportReference(row?.[9], R04_RENDER_V2_REPORT_PATH),
  );
}

const CURRENT_R04_RENDER_V2_REPORT = isCurrentR04RenderV2Report(R04_RENDER_V2_REPORT)
  ? R04_RENDER_V2_REPORT
  : null;

function isCurrentP01DirectorAgentMcpReport(report: any): boolean {
  const row = rowsByTool().get('bangumi.get_person_activity');
  const record = FRONTIER.records?.find((item: any) => item.id === 'P01');
  const checks = report?.answerChecks;
  return Boolean(
    report?.schemaVersion === 1 &&
    report?.evidenceKind === 'codex_cli_p01_person_activity_director_offline_agent_mcp_matrix_v1' &&
    report?.runNumber === 95 &&
    report?.frontierId === 'P01' &&
    report?.scenarioId === null &&
    report?.epochId === 'run95-p01-person-activity-director-offline-agent-mcp-matrix-v1-20261023' &&
    report?.profileId === 'p01-person-director-offline-matrix-v1-20261023' &&
    report?.profile === 'codex-luna-max-offline-agent-mcp-matrix-v1' &&
    report?.model === 'gpt-6-luna' &&
    report?.reasoningEffort === 'max' &&
    report?.toolName === 'bangumi.get_person_activity' &&
    report?.resultStatus === 'SUCCESS' &&
    report?.processExitCode === 0 &&
    report?.codexMcpToolEventCount === 1 &&
    report?.nonMcpToolEventCount === 0 &&
    report?.shellToolCallCount === 0 &&
    report?.allowedCallCount === 1 &&
    report?.deniedCallCount === 0 &&
    report?.networkBoundary?.liveBangumiApiRequestCount === 0 &&
    report?.networkBoundary?.unexpectedNetworkRequestCount === 0 &&
    report?.privacy?.authProfile === 'anonymous' &&
    report?.privacy?.oauthAttempted === false &&
    report?.privacy?.accountDataRead === false &&
    report?.privacy?.writesAttempted === false &&
    report?.privacy?.communityRead === false &&
    report?.privacy?.qqPipelineTested === false &&
    report?.privacy?.timClientTested === false &&
    report?.privacy?.rawToolResultStored === false &&
    report?.privacy?.credentialsStored === false &&
    checks?.exactRegisteredProfile === true &&
    checks?.oneAllowedMcpTool === true &&
    checks?.fixedArguments === true &&
    checks?.exactCandidateBundle === true &&
    checks?.offlineFixtureOnly === true &&
    checks?.resultReadbackMatched === true &&
    checks?.answerEchoedToolResult === true &&
    checks?.outputSchemaApplied === true &&
    checks?.noScenarioCredit === true &&
    checks?.privacyPreserved === true &&
    typeof report?.runnerReceipt?.signature === 'string' &&
    record?.status === 'UNASSESSED' &&
    toolContractMatchesCurrent(report, 'bangumi.get_person_activity') &&
    row?.length === 13 &&
    statusMark(row[9]) === '✅' &&
    hasExactMatrixReportReference(row[9], P01_DIRECTOR_AGENT_MCP_REPORT_PATH),
  );
}

const CURRENT_P01_DIRECTOR_AGENT_MCP_REPORT = isCurrentP01DirectorAgentMcpReport(
  P01_DIRECTOR_AGENT_MCP_REPORT,
)
  ? P01_DIRECTOR_AGENT_MCP_REPORT
  : null;

function isCurrentP03V4AgentMcpReport(report: any): boolean {
  const row = rowsByTool().get('bangumi.get_person_profile');
  const answerChecks = report?.answerChecks;
  const receipt = report?.runnerReceipt;
  const receiptPayload = receipt?.payload;
  const p03 = FRONTIER.records?.find((record: any) => record.id === 'P03');
  return Boolean(
    report?.schemaVersion === 1 &&
    report?.evidenceKind === 'codex_cli_p03_person_name_cn_public_v4_agent_mcp' &&
    report?.profile === 'codex-luna-max-agent-mcp-matrix-v4' &&
    report?.model === 'gpt-6-luna' &&
    report?.reasoningEffort === 'max' &&
    report?.runNumber === 95 &&
    report?.frontierId === 'P03' &&
    report?.scenarioId === null &&
    report?.acceptanceScope === 'agent-mcp-matrix-only' &&
    report?.profileId === 'p03-person-name-cn-agent-mcp-v4' &&
    report?.toolName === 'bangumi.get_person_profile' &&
    report?.resultStatus === 'SUCCESS' &&
    report?.ciStatus === 'SUCCESS' &&
    report?.sourceCompletenessDocumented === false &&
    report?.structuredContentCompatible === true &&
    report?.codexMcpToolEventCount === 1 &&
    report?.nonMcpToolEventCount === 0 &&
    report?.shellToolCallCount === 0 &&
    report?.allowedCallCount === 1 &&
    report?.deniedCallCount === 0 &&
    answerChecks &&
    Object.keys(answerChecks).length > 0 &&
    Object.values(answerChecks).every((value) => value === true) &&
    report?.privacy?.authProfile === 'anonymous' &&
    report?.privacy?.oauthAttempted === false &&
    report?.privacy?.accountDataRead === false &&
    report?.privacy?.writesAttempted === false &&
    report?.privacy?.communityRead === false &&
    report?.privacy?.qqPipelineTested === false &&
    report?.privacy?.timClientTested === false &&
    report?.privacy?.rawToolResultStored === false &&
    receiptPayload?.kind === 'p03-person-name-cn-agent-mcp-runner-receipt-v4' &&
    receiptPayload?.profileId === report?.profileId &&
    receiptPayload?.sourceRevision === report?.sourceRevision &&
    receiptPayload?.ciSha === report?.ciSha &&
    receiptPayload?.ciStatus === 'SUCCESS' &&
    typeof receipt?.signature === 'string' &&
    p03?.status === 'PARTIAL' &&
    p03?.source_refs?.includes(P03_V4_AGENT_MCP_REPORT_PATH) &&
    toolContractMatchesCurrent(report, 'bangumi.get_person_profile') &&
    row?.length === 13 &&
    statusMark(row[9]) === '✅' &&
    hasExactMatrixReportReference(row[9], P03_V4_AGENT_MCP_REPORT_PATH),
  );
}

const CURRENT_P03_V4_AGENT_MCP_REPORT = isCurrentP03V4AgentMcpReport(P03_V4_AGENT_MCP_REPORT)
  ? P03_V4_AGENT_MCP_REPORT
  : null;

function expectClientEvidenceCell(cell: string | undefined, label: string): void {
  const mark = statusMark(cell);
  expect(['✅', '⬜'], label).toContain(mark);
  if (mark === '✅') {
    expect(cell, label).toContain('pariya-agent-production-client-e2e-');
  } else {
    expect(cell, label).toBe('⬜');
  }
  expect(cell, label).not.toContain('pariya-agent-full-public-qa-e2e-');
}

describe('per-tool model/MCP and QQ/TIM acceptance evidence', () => {
  it('does not count Agent/MCP reports from failed or incomplete CLI runs', () => {
    const liveDir = mkdtempSync(join(tmpdir(), 'bangumi-e2e-evidence-'));
    try {
      const python = String.raw`
import hashlib, importlib.util, json, pathlib, sys
module_path = pathlib.Path(sys.argv[1])
live_dir = pathlib.Path(sys.argv[2])
spec = importlib.util.spec_from_file_location('acceptance_generator', module_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.LIVE_PROBE_DIR = live_dir
catalog = json.loads(module.CATALOG.read_text(encoding='utf-8'))
catalog_hash = hashlib.sha256(module.CATALOG.read_bytes()).hexdigest()
cases = [
    ('valid', 0, 'SUCCESS', 1, True),
    ('nonzero-exit', 1, 'SUCCESS', 1, True),
    ('bool-exit', False, 'SUCCESS', 1, True),
    ('failed-result', 0, 'FAILURE', 1, True),
    ('missing-exit', None, 'SUCCESS', 1, False),
    ('missing-result-count', 0, 'SUCCESS', None, True),
    ('mismatched-result-count', 0, 'SUCCESS', 2, True),
]
for index, (label, exit_code, result_status, result_count, include_exit) in enumerate(cases):
    tool_name = catalog[index]['name']
    report = {
        'schemaVersion': 1,
        'evidenceKind': 'antigravity_cli_mcp_tool_use',
        'catalogSha256': catalog_hash,
        'profile': 'bangumi-compact-v1',
        'resultStatus': result_status,
        'resultCount': result_count,
        'qqPipelineTested': False,
        'timClientTested': False,
        'scenarios': [{'passed': True, 'toolCalls': [{'name': tool_name, 'state': 'DONE'}]}],
    }
    if include_exit:
        report['processExitCode'] = exit_code
    if result_count is None:
        report.pop('resultCount')
    (live_dir / f'pariya-agent-{label}-e2e-{index}.json').write_text(json.dumps(report), encoding='utf-8')
print(json.dumps(sorted(module.model_mcp_e2e_names(catalog))))
`;
      const result = spawnSync(
        'python3',
        ['-c', python, join(ROOT, 'scripts/generate-tool-acceptance-tasks.py'), liveDir],
        { encoding: 'utf8' },
      );
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual([catalog[0]?.name]);
    } finally {
      rmSync(liveDir, { recursive: true, force: true });
    }
  });

  it('validates the exact-candidate bounded person-activity comparison evidence', () => {
    const report = RUN86_PERSON_ACTIVITY_COMPARISON_EVIDENCE;
    expect(report).toMatchObject({
      evidenceKind: 'antigravity_cli_mcp_tool_use',
      upstreamRevision: 'c4acc246551d31ddfc91b54d1031d4454365a7fc',
      candidateSha: 'c4acc246551d31ddfc91b54d1031d4454365a7fc',
      catalogSha256: '26672c59d62f41910457fcee14f7925c615b17ff6ff658cac0e3ca053a02e08e',
      sourceProfile: 'standard-full',
      cliVersion: '1.2.14',
      processExitCode: 0,
      resultCount: 1,
      resultStatus: 'SUCCESS',
      personActivityArgumentsVerified: true,
      probeArgumentsVerified: true,
      personActivityResultVerified: true,
      qqPipelineTested: false,
      timClientTested: false,
    });
    expect(report.probeArguments).toEqual({
      personId: 13684,
      kind: 'voice',
      media: 'tv',
      windowMonths: 6,
      maxRelations: 48,
      maxSubjectDetails: 12,
      maxRows: 20,
      comparePreviousWindow: true,
    });

    expect(report.toolResultSummaries).toHaveLength(1);
    const tool = report.toolResultSummaries[0];
    expect(tool.name).toBe('bangumi.get_person_activity');
    expect(tool.arguments).toMatchObject({
      available: true,
      matchedFieldNames: [
        'comparePreviousWindow',
        'kind',
        'maxRelations',
        'maxRows',
        'maxSubjectDetails',
        'media',
        'personId',
        'windowMonths',
      ],
      unexpectedFieldNames: [],
      passed: true,
    });
    expect(tool.outputShape.bytes).toBeLessThanOrEqual(3600);
    expect(
      report.bangumiToolEvents.filter((event: { state: string }) => event.state === 'DONE'),
    ).toEqual([{ name: 'bangumi.get_person_activity', state: 'DONE' }]);
    expect(report.scenarios).toHaveLength(1);
    expect(report.scenarios[0]).toMatchObject({
      id: 'bangumi.get_person_activity',
      passed: true,
      targetToolOutcome: 'TARGET_TOOL_COMPLETED',
      toolCalls: [{ name: 'bangumi.get_person_activity', state: 'DONE' }],
      assertions: {
        cliSucceeded: true,
        exactTargetToolCompleted: true,
        boundedToolBudget: true,
        personActivityArgumentsVerified: true,
        personActivityResultVerified: true,
      },
    });

    const comparison = tool.result.comparison;
    expect(comparison).toMatchObject({ state: 'partial', windowMonths: 6 });
    expect(comparison.recent).toMatchObject({
      state: 'partial',
      windowMonths: 6,
      windowStart: '2026-05-01',
      windowEnd: '2026-10-04',
      countsOmittedDueToCoverage: true,
      summary: {},
      coverage: { rowsEligible: 0, maxRelations: 48, maxSubjectDetails: 12, maxRows: 20 },
    });
    expect(comparison.recent.summary).not.toHaveProperty('uniqueSubjects');
    expect(comparison.previous).toMatchObject({
      state: 'partial',
      windowMonths: 6,
      windowStart: '2025-11-01',
      windowEnd: '2026-04-30',
      summary: { uniqueSubjects: 1 },
      coverage: { rowsEligible: 1, rowsReturned: 1 },
    });
    expect(comparison.delta).toMatchObject({
      state: 'partial',
      valuesOmittedDueToCoverage: true,
    });
    expect(comparison.delta).not.toHaveProperty('uniqueSubjects');
    expect(comparison.peak).toMatchObject({ state: 'partial', metric: 'uniqueSubjects' });
    expect(comparison.peak.months).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ period: 'previous', month: '2026-04', uniqueSubjects: 1 }),
      ]),
    );
    expect(comparison.answerSummaryChecks).toMatchObject({
      present: true,
      bothWindows: true,
      recentOmissionExplicit: true,
      previousObservedCountPresent: true,
      deltaOmissionExplicit: true,
      peakMonthsPresent: true,
      scopeLimitsPresent: true,
      passed: true,
    });
    expect(report.personActivityAnswerCheck).toMatchObject({
      resultReadbackAvailable: true,
      personMentioned: true,
      bothWindowBoundariesMentioned: true,
      recentCountMentioned: true,
      previousCountMentioned: true,
      deltaStateAndValueMentioned: true,
      peakStateAndMonthMentioned: true,
      coverageDisclosurePresent: true,
      unsupportedCompleteCareerClaim: false,
      unsupportedWorkloadOrTrendClaim: false,
      markdownFormattingDetected: false,
      passed: true,
    });
  });

  it('keeps old relation reports historical after the direct-evidence contract changes', () => {
    const report = FULL_PUBLIC_QA_EVIDENCE.find(
      (candidate: any) => candidate.scenarios?.[0]?.id === 'bangumi.get_subject_relations',
    );
    expect(report).toBeDefined();
    expect(catalogForHash(report.catalogSha256)).toBeDefined();
    expect(toolContractMatchesCurrent(report, 'bangumi.get_subject_relations')).toBe(false);
    expect(CURRENT_FULL_PUBLIC_QA_EVIDENCE).not.toContain(report);
  });

  it('counts a G20 Luna report only when its sanitized direct-row readback matches the current contract', () => {
    const reports = CODEX_LUNA_EVIDENCE.filter(
      (report: any) => report.toolName === 'bangumi.get_subject_relations',
    );
    expect(reports.length).toBeLessThanOrEqual(1);
    for (const report of reports) {
      expect(toolContractMatchesCurrent(report, 'bangumi.get_subject_relations')).toBe(true);
      expect(report).toMatchObject({
        evidenceKind: 'codex_cli_mcp_tool_use',
        profile: 'codex-luna-max-one-tool-v1',
        model: 'gpt-6-luna',
        reasoningEffort: 'max',
        processExitCode: 0,
        resultStatus: 'SUCCESS',
        resultCount: 1,
        codexMcpToolEventCount: 1,
        nonMcpToolEventCount: 0,
        shellToolCallCount: 0,
        allowedCallCount: 1,
        deniedCallCount: 0,
        privacy: {
          authProfile: 'anonymous',
          oauthAttempted: false,
          accountDataRead: false,
          writesAttempted: false,
          qqPipelineTested: false,
          timClientTested: false,
          promptStored: false,
          answerStored: false,
          rawResultStored: false,
          artifactImageBytesStored: false,
          credentialsStored: false,
        },
      });
      expect(report.scenarios).toHaveLength(1);
      expect(report.scenarios[0]).toMatchObject({
        id: 'bangumi.get_subject_relations',
        passed: true,
        exactArgumentsMatched: true,
        oneToolAllowlistVerified: true,
        resultReadbackVerified: true,
        answerCheckPassed: true,
        toolCalls: [{ name: 'bangumi.get_subject_relations', state: 'DONE' }],
      });
      expect(report.scenarios[0].result.visibleRows.length).toBeGreaterThan(0);
      expect(report.scenarios[0].result).not.toHaveProperty('items');
      expect(report.scenarios[0].result).not.toHaveProperty('structuredContent');
      expect(report.scenarios[0]).not.toHaveProperty('answer');
      expect(report.scenarios[0]).not.toHaveProperty('prompt');
    }
  });

  it('records observed model-to-MCP calls without implying QQ or TIM acceptance', () => {
    const rows = rowsByTool();
    const catalogNames = catalog.map((item) => item.name).sort();
    const evidenceNames = [
      ...EVIDENCE.filter(
        (report) => report.processExitCode === 0 && report.resultStatus === 'SUCCESS',
      ).flatMap((report) =>
        report.scenarios.flatMap(
          (scenario: { toolCalls: Array<{ name: string }>; passed: boolean }) =>
            scenario.passed
              ? scenario.toolCalls
                  .filter((call: { name: string }) => toolContractMatchesCurrent(report, call.name))
                  .map((call: { name: string }) => call.name)
              : [],
        ),
      ),
      ...(CURRENT_P01_DIRECTOR_AGENT_MCP_REPORT ? ['bangumi.get_person_activity'] : []),
      ...(CURRENT_D05_REPORT ? ['bangumi.query_subjects'] : []),
      ...(CURRENT_CAST_AGENT_MCP_REPORT ? ['bangumi.get_subject_cast'] : []),
      ...(CURRENT_P06_AGENT_MCP_MATRIX ? ['bangumi.render_person_profile'] : []),
      ...(CURRENT_R04_RENDER_V2_REPORT ? ['bangumi.render_series_watch_order'] : []),
      ...(CURRENT_P03_V4_AGENT_MCP_REPORT ? ['bangumi.get_person_profile'] : []),
      ...(CURRENT_RENDER_SUBJECT_CARD_V5_REPORT ? ['bangumi.render_subject_card'] : []),
    ];

    expect(rows.size).toBe(96);
    expect([...rows.keys()].sort()).toEqual(catalogNames);
    expect(new Set(evidenceNames).size).toBe(evidenceNames.length);
    const observedEvidenceNames = new Set(evidenceNames);
    const uncoveredNames = catalogNames.filter((name) => !observedEvidenceNames.has(name));
    const currentG20Report = CODEX_LUNA_EVIDENCE.find(
      (report: any) => report.toolName === 'bangumi.get_subject_relations',
    );
    const currentG20Evidence = Boolean(
      currentG20Report &&
      currentG20Report.scenarios?.[0]?.passed === true &&
      toolContractMatchesCurrent(currentG20Report, 'bangumi.get_subject_relations'),
    );
    // Historical subject-card evidence stays catalog-bound; the signed v5 offline profile is checked separately.
    expect(uncoveredNames).toEqual(
      [
        ...(CURRENT_D05_REPORT ? [] : ['bangumi.query_subjects']),
        ...(CURRENT_CAST_AGENT_MCP_REPORT ? [] : ['bangumi.get_subject_cast']),
        'bangumi.aggregate_subject_cohort',
        'bangumi.compare_subject_cohorts',
        ...(CURRENT_P01_DIRECTOR_AGENT_MCP_REPORT ? [] : ['bangumi.get_person_activity']),
        ...(CURRENT_P03_V4_AGENT_MCP_REPORT ? [] : ['bangumi.get_person_profile']),
        'bangumi.get_series_watch_order',
        'bangumi.render_subject_cohort_aggregation',
        ...(CURRENT_C07_RENDERER_REPORT ? [] : ['bangumi.render_subject_cohort_comparison']),
        'bangumi.render_query_subjects',
        ...(CURRENT_P06_AGENT_MCP_MATRIX ? [] : ['bangumi.render_person_profile']),
        ...(CURRENT_R04_RENDER_V2_REPORT ? [] : ['bangumi.render_series_watch_order']),
        'bangumi.auth_start',
        'bangumi.manage_index',
        ...(CURRENT_RENDER_SUBJECT_CARD_V5_REPORT ? [] : ['bangumi.render_subject_card']),
        ...(currentG20Evidence ? [] : ['bangumi.get_subject_relations']),
      ].sort(),
    );
    expect(evidenceNames.sort()).toEqual(
      [
        'bangumi.auth_disconnect',
        'bangumi.auth_list_accounts',
        'bangumi.auth_remove_account',
        'bangumi.auth_status',
        'bangumi.describe_operation',
        'bangumi.get_calendar',
        'bangumi.get_calendar_intelligence',
        'bangumi.get_character',
        'bangumi.get_character_collection',
        'bangumi.get_character_credit_integrity',
        'bangumi.get_collection',
        'bangumi.get_collection_backlog',
        'bangumi.get_collection_dashboard',
        'bangumi.get_collection_entity_consistency',
        'bangumi.get_collection_intelligence',
        'bangumi.get_collection_schedule',
        'bangumi.get_collection_series_groups',
        'bangumi.get_episode',
        'bangumi.get_episode_collections',
        'bangumi.get_episode_guide',
        'bangumi.get_episode_integrity',
        'bangumi.get_episodes',
        'bangumi.get_index',
        'bangumi.get_latest_subject_revision',
        'bangumi.get_person',
        ...(CURRENT_P01_DIRECTOR_AGENT_MCP_REPORT ? ['bangumi.get_person_activity'] : []),
        ...(CURRENT_P03_V4_AGENT_MCP_REPORT ? ['bangumi.get_person_profile'] : []),
        'bangumi.get_person_collaboration',
        'bangumi.get_person_collection',
        'bangumi.get_my_profile',
        'bangumi.get_revision',
        'bangumi.get_revision_intelligence',
        'bangumi.get_subject',
        ...(CURRENT_CAST_AGENT_MCP_REPORT ? ['bangumi.get_subject_cast'] : []),
        ...(CURRENT_P06_AGENT_MCP_MATRIX ? ['bangumi.render_person_profile'] : []),
        ...(CURRENT_R04_RENDER_V2_REPORT ? ['bangumi.render_series_watch_order'] : []),
        'bangumi.get_subject_comparison',
        'bangumi.get_subject_identity',
        'bangumi.get_subject_index_membership',
        'bangumi.get_subject_overlap',
        'bangumi.get_subject_overview',
        'bangumi.get_subject_staff',
        'bangumi.get_subject_stats',
        'bangumi.get_subject_stats_history',
        'bangumi.get_subject_stats_intelligence',
        'bangumi.get_user',
        'bangumi.list_character_collections',
        'bangumi.list_collections',
        'bangumi.list_operations',
        'bangumi.list_person_collections',
        'bangumi.list_revisions',
        'bangumi.manage_character_collection',
        'bangumi.manage_person_collection',
        'bangumi.resolve_subject_concept',
        'bangumi.search_characters',
        'bangumi.search_persons',
        'bangumi.search_subjects',
        'bangumi.auth_switch_account',
        ...(currentG20Evidence ? ['bangumi.get_subject_relations'] : []),
        'bangumi.call_operation',
        'bangumi.render_calendar',
        'bangumi.render_collection_backlog',
        'bangumi.render_collection_dashboard',
        'bangumi.render_collection_entity_consistency',
        'bangumi.render_collection_intelligence',
        'bangumi.render_collection_progress',
        'bangumi.render_collection_schedule',
        'bangumi.render_collection_series_groups',
        'bangumi.render_cast_card',
        'bangumi.render_character_credit_integrity',
        'bangumi.render_episode_guide',
        'bangumi.render_episode_integrity',
        'bangumi.render_latest_subject_revision',
        'bangumi.render_person_activity',
        'bangumi.render_person_collaboration',
        'bangumi.render_revision_timeline',
        'bangumi.render_search',
        ...(CURRENT_RENDER_SUBJECT_CARD_V5_REPORT ? ['bangumi.render_subject_card'] : []),
        'bangumi.render_subject_comparison',
        ...(CURRENT_C07_RENDERER_REPORT ? ['bangumi.render_subject_cohort_comparison'] : []),
        'bangumi.render_subject_identity',
        'bangumi.render_subject_index_membership',
        'bangumi.render_subject_overlap',
        'bangumi.render_subject_overview',
        'bangumi.render_subject_stats_intelligence',
        'bangumi.render_subject_stats_history',
        'bangumi.update_collection',
        'bangumi.update_episode_progress',
        ...(CURRENT_D05_REPORT ? ['bangumi.query_subjects'] : []),
      ].sort(),
    );

    const newlyVerifiedPublicTools = [
      'bangumi.get_subject_overview',
      'bangumi.render_subject_overview',
    ];
    expect(newlyVerifiedPublicTools.filter((name) => evidenceNames.includes(name))).toEqual(
      newlyVerifiedPublicTools,
    );
    for (const name of newlyVerifiedPublicTools) {
      expect(statusMark(rows.get(name)?.[9]), `${name} current model/MCP evidence`).toBe('✅');
    }

    for (const [name, fields] of rows) {
      expect(fields, name).toHaveLength(13);
      expect(statusMark(fields[9]), `${name} model/MCP`).toBe(
        evidenceNames.includes(name) ? '✅' : '⬜',
      );
      expectClientEvidenceCell(fields[10], `${name} QQ pipeline`);
      expectClientEvidenceCell(fields[11], `${name} TIM client`);
    }
  });

  it('keeps the committed probe evidence scoped to actual CLI tool events', () => {
    expect(COMPACT_EVIDENCE).toMatchObject({
      schemaVersion: 1,
      evidenceKind: 'antigravity_cli_mcp_tool_use',
      upstreamRevision: '724b286a1bc72a4dc7d84c988ffee792359fdf02',
      catalogSha256: COMPACT_EVIDENCE.catalogSha256,
      profile: 'bangumi-compact-v1',
      qqPipelineTested: false,
      timClientTested: false,
    });
    expect(COMPACT_EVIDENCE.scenarios).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'subject-and-cast',
          passed: true,
          toolCalls: [
            { name: 'bangumi.search_subjects', state: 'DONE' },
            { name: 'bangumi.get_subject', state: 'DONE' },
            { name: 'bangumi.get_subject_cast', state: 'DONE' },
          ],
        }),
        expect.objectContaining({
          id: 'july-discovery',
          passed: true,
          toolCalls: [{ name: 'bangumi.query_subjects', state: 'DONE' }],
        }),
      ]),
    );
    expect(catalogForHash(COMPACT_EVIDENCE.catalogSha256)).toBeDefined();
    for (const scenario of COMPACT_EVIDENCE.scenarios) {
      for (const call of scenario.toolCalls) {
        if (toolContractMatchesCurrent(COMPACT_EVIDENCE, call.name)) continue;

        if (call.name === 'bangumi.query_subjects') {
          // The historical Compact query report predates this schema change.
          // Only the post-gate D05 report can restore the current query tool row.
          if (CURRENT_D05_REPORT) {
            expect(CURRENT_D05_REPORT.toolName).toBe(call.name);
            expect(toolContractMatchesCurrent(CURRENT_D05_REPORT, call.name)).toBe(true);
          } else {
            const currentReport = CURRENT_FULL_PUBLIC_QA_EVIDENCE.find(
              (report: any) => report.scenarios?.[0]?.id === call.name,
            );
            expect(currentReport).toBeUndefined();
          }
          continue;
        }
        if (call.name === 'bangumi.get_subject_cast') {
          // Current, exact-contract reports can refresh old calls for this tool.
          if (CURRENT_CAST_AGENT_MCP_REPORT) {
            expect(CURRENT_CAST_AGENT_MCP_REPORT.toolName).toBe(call.name);
            expect(toolContractMatchesCurrent(CURRENT_CAST_AGENT_MCP_REPORT, call.name)).toBe(true);
          }
          continue;
        }
        expect(call.name).toBe('bangumi.get_subject_cast');
      }
    }

    expect(
      CURRENT_FULL_PUBLIC_QA_EVIDENCE.map((report: any) => report.scenarios[0].id).sort(),
    ).toEqual(
      [
        'bangumi.auth_list_accounts',
        'bangumi.auth_status',
        'bangumi.describe_operation',
        'bangumi.get_calendar',
        'bangumi.get_calendar_intelligence',
        'bangumi.get_character',
        'bangumi.get_character_collection',
        'bangumi.get_character_credit_integrity',
        'bangumi.get_collection',
        'bangumi.get_episode',
        'bangumi.get_episode_guide',
        'bangumi.get_episode_integrity',
        'bangumi.get_episodes',
        'bangumi.get_index',
        'bangumi.get_latest_subject_revision',
        'bangumi.get_person',
        'bangumi.get_person_collaboration',
        'bangumi.get_person_collection',
        'bangumi.get_revision',
        'bangumi.get_revision_intelligence',
        'bangumi.get_subject',
        'bangumi.get_subject_comparison',
        'bangumi.get_subject_identity',
        'bangumi.get_subject_index_membership',
        'bangumi.get_subject_overlap',
        'bangumi.get_subject_overview',
        'bangumi.get_subject_staff',
        'bangumi.get_subject_stats',
        'bangumi.get_subject_stats_history',
        'bangumi.get_user',
        'bangumi.list_character_collections',
        'bangumi.list_collections',
        'bangumi.list_operations',
        'bangumi.list_person_collections',
        'bangumi.list_revisions',
        'bangumi.resolve_subject_concept',
        'bangumi.search_characters',
        'bangumi.search_persons',
        'bangumi.search_subjects',
      ].sort(),
    );
    for (const report of CURRENT_FULL_PUBLIC_QA_EVIDENCE) {
      expect(report).toMatchObject({
        schemaVersion: 1,
        evidenceKind: 'antigravity_cli_mcp_tool_use',
        catalogSha256: report.catalogSha256,
        profile: 'bangumi-full-public-qa-v1',
        processExitCode: 0,
        resultCount: 1,
        resultStatus: 'SUCCESS',
        qqPipelineTested: false,
        timClientTested: false,
      });
      expect(report.scenarios).toHaveLength(1);
      expect(report.scenarios[0]).toMatchObject({
        passed: true,
        toolCalls: [{ name: report.scenarios[0].id, state: 'DONE' }],
      });
      expect(report.scenarios[0]).not.toHaveProperty('prompt');
      expect(report.scenarios[0]).not.toHaveProperty('arguments');
      expect(catalogForHash(report.catalogSha256)).toBeDefined();
      expect(toolContractMatchesCurrent(report, report.scenarios[0].id)).toBe(true);
    }
  });

  it('accepts the exact-candidate bounded subject-staff Agent/MCP answer', () => {
    const report = RUN89_SUBJECT_STAFF_EVIDENCE;
    expect(report).toMatchObject({
      evidenceKind: 'antigravity_cli_mcp_tool_use',
      upstreamRevision: 'c13fcff7a4c0073299581afb1814555439812aae',
      candidateSha: 'c13fcff7a4c0073299581afb1814555439812aae',
      catalogSha256: '26672c59d62f41910457fcee14f7925c615b17ff6ff658cac0e3ca053a02e08e',
      sourceProfile: 'standard-full',
      profile: 'bangumi-full-public-qa-v1',
      cliVersion: '1.2.14',
      subjectId: 218707,
      processExitCode: 0,
      resultCount: 1,
      resultStatus: 'SUCCESS',
      subjectStaffArgumentsVerified: true,
      subjectStaffResultVerified: true,
      promptPersisted: false,
      answerProsePersisted: false,
      personNamesPersisted: false,
      qqPipelineTested: false,
      timClientTested: false,
    });
    expect(report.toolResultSummaries).toHaveLength(1);
    expect(report.toolResultSummaries[0]).toMatchObject({
      name: 'bangumi.get_subject_staff',
      arguments: {
        expectedFieldNames: ['limit', 'subjectId'],
        matchedFieldNames: ['limit', 'subjectId'],
        unexpectedFieldNames: [],
        passed: true,
      },
      result: {
        found: true,
        subjectId: 218707,
        state: 'complete',
        textUtf8Bytes: 3529,
        structuredContentHasFullResult: true,
        scopeDisclosurePresent: true,
        coverage: {
          state: 'complete',
          productionStaff: { observed: 157, returned: 157, truncated: false },
          cast: { observed: 7, returned: 7, truncated: false },
          limit: 200,
        },
        omitted: {
          staffGroupsOmittedFromText: 15,
          staffGroupMembershipsOmittedFromText: 127,
          castItemsOmittedFromText: 7,
        },
      },
    });
    expect(report.toolResultSummaries[0].result.textUtf8Bytes).toBeLessThanOrEqual(3600);
    expect(report.toolResultSummaries[0].result.roleLabels).toContain('导演');
    expect(report.toolResultSummaries[0].result.roleLabels).toContain('原作');
    expect(report.subjectStaffAnswerCheck).toMatchObject({
      resultReadbackAvailable: true,
      roleLabelsMentioned: true,
      memberNamesMentioned: true,
      associationCheckMethod: 'bounded-positive-statement-v2',
      associationCheckerSha256: createHash('sha256')
        .update(readFileSync(join(ROOT, 'scripts/acceptance/subject-staff-answer-check.mjs')))
        .digest('hex'),
      boundedCoverageDisclosurePresent: true,
      omissionNotAbsencePresent: true,
      unsupportedCompletenessClaim: false,
      markdownFormattingDetected: false,
      passed: true,
    });
    expect(report.subjectStaffAnswerCheck.roleNamePairsMatchedCount).toBeGreaterThanOrEqual(2);
    expect(report.scenarios).toHaveLength(1);
    expect(report.scenarios[0]).toMatchObject({
      id: 'bangumi.get_subject_staff',
      passed: true,
      toolCalls: [{ name: 'bangumi.get_subject_staff', state: 'DONE' }],
    });
    expect(report).not.toHaveProperty('prompt');
    expect(report).not.toHaveProperty('answer');
    expect(report).not.toHaveProperty('finalAnswer');
    expect(report.scenarios[0]).not.toHaveProperty('prompt');
    expect(report.scenarios[0]).not.toHaveProperty('arguments');
    expect(report.toolResultSummaries[0].result).not.toHaveProperty('members');
    expect(report.toolResultSummaries[0].result).not.toHaveProperty('personNames');
    expect(catalogForHash(report.catalogSha256)).toBeDefined();
    expect(toolContractMatchesCurrent(report, 'bangumi.get_subject_staff')).toBe(true);
  });

  it('accepts only renderer evidence containing a verified temporary PNG artifact', () => {
    expect(
      CURRENT_FULL_RENDERER_QA_EVIDENCE.map((report: any) => report.scenarios[0].id).sort(),
    ).toEqual(
      [
        'bangumi.render_calendar',
        'bangumi.render_cast_card',
        'bangumi.render_character_credit_integrity',
        'bangumi.render_episode_guide',
        'bangumi.render_episode_integrity',
        'bangumi.render_latest_subject_revision',
        'bangumi.render_person_activity',
        'bangumi.render_person_collaboration',
        'bangumi.render_revision_timeline',
        'bangumi.render_search',
        'bangumi.render_subject_comparison',
        'bangumi.render_subject_identity',
        'bangumi.render_subject_index_membership',
        'bangumi.render_subject_overlap',
        'bangumi.render_subject_overview',
        'bangumi.render_subject_stats_history',
      ].sort(),
    );
    for (const report of CURRENT_FULL_RENDERER_QA_EVIDENCE) {
      expect(report).toMatchObject({
        schemaVersion: 1,
        evidenceKind: 'antigravity_cli_mcp_tool_use',
        profile: 'bangumi-full-renderer-qa-v1',
        processExitCode: 0,
        resultStatus: 'SUCCESS',
        qqPipelineTested: false,
        timClientTested: false,
      });
      const scenario = report.scenarios[0];
      expect(scenario).toMatchObject({
        passed: true,
        id: scenario.toolCalls[0].name,
        toolCalls: [{ name: scenario.id, state: 'DONE' }],
        assertions: {
          exactTargetToolCompleted: true,
          rendererArtifactVerified: true,
          artifactRefReturned: true,
          toolReportedError: false,
          artifactMimeType: 'image/png',
        },
      });
      expect(scenario.assertions.artifactWidth).toBeGreaterThan(0);
      expect(scenario.assertions.artifactHeight).toBeGreaterThan(0);
      if (scenario.id === 'bangumi.render_subject_overview') {
        expect(catalogForHash(report.catalogSha256)).toBeDefined();
        expect(toolContractMatchesCurrent(report, scenario.id)).toBe(true);
        expect(scenario.assertions.subjectOverviewRenderAnswerCheck).toMatchObject({
          coverageDisclosurePresent: true,
          staffCoverageMentioned: true,
          partialCoveragePhrasePresent: true,
          unsupportedCompletenessClaim: false,
          markdownFormattingDetected: false,
          passed: true,
        });
      }
      expect(catalogForHash(report.catalogSha256)).toBeDefined();
      expect(toolContractMatchesCurrent(report, scenario.id)).toBe(true);
      expect(scenario).not.toHaveProperty('prompt');
      expect(scenario).not.toHaveProperty('arguments');
    }
  });

  it('accepts dynamic-operation evidence only for the pinned public getCalendar operation', () => {
    expect(FULL_OPERATION_QA_EVIDENCE.map((report: any) => report.scenarios[0].id)).toEqual([
      'bangumi.call_operation',
    ]);
    for (const report of FULL_OPERATION_QA_EVIDENCE) {
      expect(report).toMatchObject({
        schemaVersion: 1,
        evidenceKind: 'antigravity_cli_mcp_tool_use',
        profile: 'bangumi-full-operation-qa-v1',
        processExitCode: 0,
        resultCount: 1,
        resultStatus: 'SUCCESS',
        qqPipelineTested: false,
        timClientTested: false,
      });
      expect(report.scopeNote).toContain('GET /calendar');
      expect(report.scenarios).toHaveLength(1);
      expect(report.scenarios[0]).toMatchObject({
        id: 'bangumi.call_operation',
        passed: true,
        toolCalls: [{ name: 'bangumi.call_operation', state: 'DONE' }],
      });
      expect(catalogForHash(report.catalogSha256)).toBeDefined();
      expect(toolContractMatchesCurrent(report, 'bangumi.call_operation')).toBe(true);
      expect(report.scenarios[0]).not.toHaveProperty('prompt');
      expect(report.scenarios[0]).not.toHaveProperty('arguments');
    }
  });

  it('keeps prior synthetic OAuth-start evidence uncredited after its tool description changes', () => {
    expect(FULL_AUTH_START_QA_EVIDENCE.map((report: any) => report.scenarios[0].id)).toEqual([
      'bangumi.auth_start',
    ]);
    for (const report of FULL_AUTH_START_QA_EVIDENCE) {
      expect(report).toMatchObject({
        schemaVersion: 1,
        evidenceKind: 'antigravity_cli_mcp_tool_use',
        profile: 'bangumi-full-auth-start-qa-v1',
        processExitCode: 0,
        resultCount: 1,
        resultStatus: 'SUCCESS',
        qqPipelineTested: false,
        timClientTested: false,
      });
      expect(report.scopeNote).toContain('test_client_id');
      expect(report.scopeNote).toContain('redacted');
      expect(report.scopeNote).toContain('No real account authorization');
      expect(report.scenarios).toHaveLength(1);
      expect(report.scenarios[0]).toMatchObject({
        id: 'bangumi.auth_start',
        passed: true,
        toolCalls: [{ name: 'bangumi.auth_start', state: 'DONE' }],
      });
      expect(catalogForHash(report.catalogSha256)).toBeDefined();
      expect(toolContractMatchesCurrent(report, 'bangumi.auth_start')).toBe(false);
      expect(statusMark(rowsByTool().get('bangumi.auth_start')?.[9])).toBe('⬜');
      expect(report.scenarios[0]).not.toHaveProperty('prompt');
      expect(report.scenarios[0]).not.toHaveProperty('arguments');
    }
  });

  it('records auth-required denial separately from authenticated feature execution', () => {
    const expectedTools = catalog
      .filter((tool) => tool.auth === 'required')
      .map((tool) => tool.name)
      .sort();
    expect(expectedTools).toHaveLength(22);
    expect(
      FULL_AUTH_DENIAL_QA_EVIDENCE.map((report: any) => report.scenarios[0].id).sort(),
    ).toEqual(expectedTools);
    const rows = rowsByTool();
    for (const report of FULL_AUTH_DENIAL_QA_EVIDENCE) {
      expect(report).toMatchObject({
        schemaVersion: 1,
        evidenceKind: 'antigravity_cli_mcp_tool_use',
        profile: 'bangumi-full-auth-denial-qa-v1',
        processExitCode: 0,
        resultCount: 1,
        resultStatus: 'SUCCESS',
        qqPipelineTested: false,
        timClientTested: false,
      });
      expect(report.scopeNote).toContain('AUTH_REQUIRED');
      const scenario = report.scenarios[0];
      expect(scenario).toMatchObject({
        id: scenario.toolCalls[0].name,
        passed: true,
        toolCalls: [{ name: scenario.id, state: 'DONE' }],
        assertions: {
          authRequiredGateObserved: true,
          operationExecuted: false,
          accountDataReturned: false,
          networkAccessBlocked: true,
          networkRequestAttempts: 0,
          externalApiCalled: false,
        },
      });
      const catalogTool = catalog.find((tool) => tool.name === scenario.id);
      expect(catalogTool?.auth).toBe('required');
      expect(['read', 'write', 'destructive']).toContain(catalogTool?.risk);
      expect(catalogForHash(report.catalogSha256)).toBeDefined();
      if (scenario.id === 'bangumi.manage_index') {
        expect(toolContractMatchesCurrent(report, scenario.id)).toBe(false);
        expect(rows.get(scenario.id)?.[7]).toBe(
          '✅<br>`docs/live-probes/tool-registry-no-account-auth-denial-manage-index.json`',
        );
        expect(rows.get(scenario.id)?.[8]).toBe('⬜');
        expect(rows.get(scenario.id)?.[9]).toBe('⬜');
        continue;
      }
      expect(toolContractMatchesCurrent(report, scenario.id)).toBe(true);
      expect(scenario).not.toHaveProperty('prompt');
      expect(scenario).not.toHaveProperty('arguments');
      expect(statusMark(rows.get(scenario.id)?.[7])).toBe('✅');
      expectAccountAuthCell(scenario.id, rows.get(scenario.id)?.[8]);
      expect(statusMark(rows.get(scenario.id)?.[9])).toBe('✅');
    }
  });

  it('accepts local auth-switch evidence only for the fixed synthetic account binding', () => {
    expect(FULL_AUTH_SWITCH_QA_EVIDENCE.map((report: any) => report.scenarios[0].id)).toEqual([
      'bangumi.auth_switch_account',
    ]);
    for (const report of FULL_AUTH_SWITCH_QA_EVIDENCE) {
      expect(report).toMatchObject({
        schemaVersion: 1,
        evidenceKind: 'antigravity_cli_mcp_tool_use',
        profile: 'bangumi-full-auth-switch-qa-v1',
        processExitCode: 0,
        resultCount: 1,
        resultStatus: 'SUCCESS',
        qqPipelineTested: false,
        timClientTested: false,
      });
      expect(report.scopeNote).toContain('synthetic MemoryStorage');
      expect(report.scopeNote).toContain('no Bangumi API');
      expect(report.scenarios[0]).toMatchObject({
        id: 'bangumi.auth_switch_account',
        passed: true,
        toolCalls: [{ name: 'bangumi.auth_switch_account', state: 'DONE' }],
        assertions: {
          syntheticLocalStateMutation: true,
          activeBindingVerified: true,
          externalApiCalled: false,
          realAccountUsed: false,
        },
      });
      expect(catalogForHash(report.catalogSha256)).toBeDefined();
      expect(toolContractMatchesCurrent(report, 'bangumi.auth_switch_account')).toBe(true);
      expect(report.scenarios[0]).not.toHaveProperty('prompt');
      expect(report.scenarios[0]).not.toHaveProperty('arguments');
      expect(statusMark(rowsByTool().get('bangumi.auth_switch_account')?.[9])).toBe('✅');
    }
  });

  it('accepts auth-mutation evidence only for the two fixed synthetic destructive tools', () => {
    expect(
      FULL_AUTH_MUTATION_QA_EVIDENCE.map((report: any) => report.scenarios[0].id).sort(),
    ).toEqual(['bangumi.auth_disconnect', 'bangumi.auth_remove_account']);
    for (const report of FULL_AUTH_MUTATION_QA_EVIDENCE) {
      const scenario = report.scenarios[0];
      expect(report).toMatchObject({
        schemaVersion: 1,
        evidenceKind: 'antigravity_cli_mcp_tool_use',
        profile: 'bangumi-full-auth-mutation-qa-v1',
        processExitCode: 0,
        resultCount: 1,
        resultStatus: 'SUCCESS',
        qqPipelineTested: false,
        timClientTested: false,
      });
      expect(report.scopeNote).toContain('synthetic in-memory accounts');
      expect(report.scopeNote).toContain('No real account, token, or Bangumi API');
      expect(scenario).toMatchObject({
        id: scenario.toolCalls[0].name,
        passed: true,
        toolCalls: [{ name: scenario.id, state: 'DONE' }],
        assertions: {
          confirmationRequiredObserved: true,
          syntheticConfirmationApplied: true,
          syntheticStateVerified: true,
          externalApiCalled: false,
          realAccountUsed: false,
        },
      });
      expect(catalogForHash(report.catalogSha256)).toBeDefined();
      expect(toolContractMatchesCurrent(report, scenario.id)).toBe(true);
      expect(scenario).not.toHaveProperty('prompt');
      expect(scenario).not.toHaveProperty('arguments');
      expect(rowsByTool().get(scenario.id)?.[8]).toBe('⬜');
      expect(statusMark(rowsByTool().get(scenario.id)?.[9])).toBe('✅');
    }
  });

  it('preserves the historical two live A1 reads without crediting the updated dependency graph', () => {
    const report = JSON.parse(readFileSync(join(ROOT, REAL_A1_REPORT_PATH), 'utf8'));
    expect(report).toMatchObject({
      executionKind: 'live',
      passed: true,
      code: 'OK',
      startAttempted: true,
      containerRemoved: true,
      toolCallsAttempted: 2,
      toolCallsSucceeded: 2,
      httpRequests: 2,
      collectionRows: 2,
      modelCalls: 0,
      clientActions: 0,
      privatePayloadSaved: false,
    });
    expect(report.sourceRevision).toBe('e0810dad9e57f35cbeca63de35cf7a97d745d712');
    const inventory = JSON.parse(
      readFileSync(
        join(ROOT, 'docs/live-probes/run95-a1-bound-reads-2026-10-26/source-files.json'),
        'utf8',
      ),
    );
    expect(
      createHash('sha256')
        .update(readFileSync(join(ROOT, 'pnpm-lock.yaml')))
        .digest('hex'),
    ).not.toBe(inventory['pnpm-lock.yaml'].sha256);
    const imported = JSON.parse(
      readFileSync(
        join(ROOT, 'docs/live-probes/run95-a1-bound-reads-2026-10-26/import.json'),
        'utf8',
      ),
    );
    expect(imported.tools.map((tool: { name: string }) => tool.name).sort()).toEqual(
      [...REAL_A1_TOOLS].sort(),
    );
    const credited = [...rowsByTool()].filter(([, cells]) => statusMark(cells[8]) === '✅');
    expect(credited.map(([name]) => name).sort()).toEqual(REAL_CURRENT_ACCOUNT_TOOLS);
    for (const [name, cells] of rowsByTool()) {
      if (REAL_A1_TOOLS.has(name)) {
        expect(reportReferencesInMatrixCell(cells[8])).not.toContain(REAL_A1_REPORT_PATH);
        if (name !== 'bangumi.list_collections') expectAccountAuthPending(cells[8]);
      }
      for (const index of [6, 7, 9, 10, 11]) {
        expect(reportReferencesInMatrixCell(cells[index])).not.toContain(REAL_A1_REPORT_PATH);
      }
      expect(cells[10]).toBe('⬜');
      expect(cells[11]).toBe('⬜');
    }
    expect(TABLE).toContain('11/33；待补 22');
  });

  it('credits only the successful collection selection from the failed and spent A2 batch', () => {
    const report = JSON.parse(readFileSync(join(ROOT, REAL_A2_REPORT_PATH), 'utf8'));
    expect(report).toMatchObject({
      passed: false,
      phase: 'FAILED_SERVICES_RESTORED',
      servicesRestored: true,
      batch: {
        executionKind: 'live',
        passed: false,
        code: 'A2_BATCH_FAILED',
        toolCallsAttempted: 2,
        toolCallsSucceeded: 1,
        apiRequests: 2,
        coverRequests: 0,
        pngValidated: false,
        cleanupConfirmed: true,
        claimFinalized: true,
        modelCalls: 0,
        clientActions: 0,
        privatePayloadExported: false,
      },
    });
    const imported = JSON.parse(
      readFileSync(
        join(ROOT, 'docs/live-probes/run95-a2-partial-account-read-2026-10-27/import.json'),
        'utf8',
      ),
    );
    expect(imported.admittedTools).toEqual([
      {
        name: 'bangumi.list_collections',
        input: { subjectType: 'anime', status: 'doing', limit: 1, offset: 0 },
      },
    ]);
    const credited = [...rowsByTool()].filter(([, cells]) => statusMark(cells[8]) === '✅');
    expect(credited.map(([name]) => name).sort()).toEqual(REAL_CURRENT_ACCOUNT_TOOLS);
    expect(reportReferencesInMatrixCell(rowsByTool().get('bangumi.list_collections')?.[8])).toEqual(
      [REAL_A2_REPORT_PATH],
    );
    expectAccountAuthPending(rowsByTool().get('bangumi.render_collection_progress')?.[8]);
    expectAccountAuthPending(rowsByTool().get('bangumi.get_my_profile')?.[8]);
    for (const [, cells] of rowsByTool()) {
      for (const index of [6, 7, 9, 10, 11]) {
        expect(reportReferencesInMatrixCell(cells[index])).not.toContain(REAL_A2_REPORT_PATH);
      }
    }
    expect(TABLE).toContain('11/33；待补 22');
  });

  it('credits only the completed bounded A3 overview and private PNG with partial sample limits', () => {
    const report = JSON.parse(readFileSync(join(ROOT, REAL_A3_REPORT_PATH), 'utf8'));
    expect(report).toMatchObject({
      passed: true,
      phase: 'COMPLETE',
      servicesRestored: true,
      protectedClaimsPreserved: true,
      operatorModelPrompts: 0,
      operatorClientActions: 0,
      privatePayloadExported: false,
      batch: {
        executionKind: 'live',
        passed: true,
        code: 'OK',
        toolCallsAttempted: 2,
        toolCallsSucceeded: 2,
        apiRequests: 2,
        coverRequests: 0,
        pngValidated: true,
        cleanupConfirmed: true,
        claimFinalized: true,
        modelCalls: 0,
        clientActions: 0,
        privatePayloadExported: false,
        diagnostic: {
          phase: 'complete',
          reason: null,
          readState: 'partial',
          renderState: 'partial',
          readRows: 2,
          renderRows: 2,
          failureStage: null,
        },
      },
    });
    const manifest = JSON.parse(
      readFileSync(
        join(
          ROOT,
          'docs/live-probes/run95-a3-bound-overview-and-private-png-2026-10-27/import.json',
        ),
        'utf8',
      ),
    );
    expect(manifest.admittedTools).toEqual([
      { name: 'bangumi.get_collection_intelligence', input: { maxItems: 2 } },
      { name: 'bangumi.render_collection_intelligence', input: { maxItems: 2 } },
    ]);
    const claim = JSON.parse(
      readFileSync(
        join(
          ROOT,
          'docs/live-probes/run95-a3-bound-overview-and-private-png-2026-10-27/durable-a3-claim.json',
        ),
        'utf8',
      ),
    );
    expect(claim).toMatchObject({
      state: 'COMPLETE',
      scope: 'a3-bound-collection-intelligence-v1',
      observation: {
        toolCallsAttempted: 2,
        toolCallsSucceeded: 2,
        apiRequests: 2,
        coverRequests: 0,
        pngValidated: true,
        cleanupConfirmed: true,
      },
    });
    for (const [name, cells] of rowsByTool()) {
      expect(reportReferencesInMatrixCell(cells[8]).includes(REAL_A3_REPORT_PATH)).toBe(
        manifest.admittedTools.some((tool: { name: string }) => tool.name === name),
      );
      for (const index of [6, 7, 9, 10, 11]) {
        expect(reportReferencesInMatrixCell(cells[index])).not.toContain(REAL_A3_REPORT_PATH);
      }
    }
    expect(TABLE).toContain('11/33；待补 22');
  });

  it('admits only four actual A4 backlog/schedule tools with conflict and partial limits', () => {
    const report = JSON.parse(readFileSync(join(ROOT, REAL_A4_REPORT_PATH), 'utf8'));
    expect(report).toMatchObject({
      passed: true,
      phase: 'COMPLETE',
      servicesRestored: true,
      protectedClaimsPreserved: true,
      operatorModelPrompts: 0,
      operatorClientActions: 0,
      privatePayloadExported: false,
      batch: {
        executionKind: 'live',
        passed: true,
        code: 'OK',
        toolCallsAttempted: 4,
        toolCallsSucceeded: 4,
        apiRequests: 10,
        coverRequests: 0,
        pngValidated: true,
        cleanupConfirmed: true,
        claimFinalized: true,
        modelCalls: 0,
        clientActions: 0,
        privatePayloadExported: false,
        diagnostic: {
          guardPhase: 'complete',
          guardReason: null,
          semanticFailure: null,
          failureStage: null,
          pngsValidated: 2,
          collectionRequests: 4,
          episodeRequests: 2,
          calendarRequests: 4,
          backlogReadState: 'conflict',
          backlogReadRows: 1,
          backlogRenderState: 'conflict',
          backlogRenderRows: 1,
          scheduleReadState: 'partial',
          scheduleReadRows: 1,
          scheduleRenderState: 'partial',
          scheduleRenderRows: 1,
        },
      },
    });
    const manifest = JSON.parse(readFileSync(join(ROOT, REAL_A4_BUNDLE, 'import.json'), 'utf8'));
    const statuses = ['wish', 'doing', 'done', 'on_hold', 'dropped'];
    expect(manifest.admittedTools).toEqual(
      REAL_A4_TOOLS.map((name, index) => ({
        name,
        input:
          index < 2
            ? { maxItems: 1, maxSubjects: 1, maxEpisodesPerSubject: 1, statuses, sortBy: 'source' }
            : { maxCollectionItems: 1, maxRows: 1, statuses },
      })),
    );
    const rawClaim = readFileSync(join(ROOT, REAL_A4_BUNDLE, 'durable-a4-claim.json'));
    expect(createHash('sha256').update(rawClaim).digest('hex')).toBe(
      'b2693e31c6a44cf43b0d1457a1980ba2e966158707b618afaeb9282fd3bb7e51',
    );
    expect(JSON.parse(rawClaim.toString())).toMatchObject({
      state: 'COMPLETE',
      scope: 'a4-bound-backlog-and-schedule-v1',
      observation: {
        toolCallsAttempted: 4,
        toolCallsSucceeded: 4,
        apiRequests: 10,
        coverRequests: 0,
        pngValidated: true,
        cleanupConfirmed: true,
      },
    });
    for (const [name, cells] of rowsByTool()) {
      expect(reportReferencesInMatrixCell(cells[8]).includes(REAL_A4_REPORT_PATH)).toBe(
        REAL_A4_TOOLS.includes(name),
      );
      for (const index of [6, 7, 9, 10, 11]) {
        expect(reportReferencesInMatrixCell(cells[index])).not.toContain(REAL_A4_REPORT_PATH);
      }
    }
    expect(TABLE).toContain('11/33；待补 22');
  });

  it('admits only the completed A5 pair while preserving composite partial and conflict exclusion', () => {
    const report = JSON.parse(readFileSync(join(ROOT, REAL_A5_REPORT_PATH), 'utf8'));
    expect(report).toMatchObject({
      passed: true,
      phase: 'COMPLETE',
      servicesRestored: true,
      protectedClaimsPreserved: true,
      modelRunsBefore: 945,
      modelRunsAfter: 945,
      operatorModelPrompts: 0,
      operatorClientActions: 0,
      privatePayloadExported: false,
      batch: {
        executionKind: 'live',
        passed: true,
        code: 'OK',
        toolCallsAttempted: 2,
        toolCallsSucceeded: 2,
        apiRequests: 10,
        coverRequests: 0,
        pngValidated: true,
        cleanupConfirmed: true,
        claimFinalized: true,
        modelCalls: 0,
        clientActions: 0,
        privatePayloadExported: false,
      },
    });
    const diagnostic = report.batch.diagnostic;
    expect(diagnostic).toMatchObject({
      guardPhase: 'complete',
      guardReason: null,
      failureStage: null,
      semanticFailure: null,
      pixelDecodeValidated: true,
      collectionRequests: 6,
      episodeRequests: 2,
      calendarRequests: 2,
    });
    for (const role of ['read', 'render']) {
      expect(diagnostic[role + 'State']).toBe('partial');
      expect(diagnostic[role + 'SucceededSections']).toBe(2);
      expect(diagnostic[role + 'ObservedRows']).toBe(2);
      expect(diagnostic[role + 'TimedOutSections']).toBe(0);
      expect(diagnostic[role + 'SkippedSections']).toBe(0);
      for (const [section, state] of [
        ['Intelligence', 'partial'],
        ['Backlog', 'conflict'],
        ['Schedule', 'partial'],
      ]) {
        expect(diagnostic[role + section + 'State']).toBe(state);
        expect(diagnostic[role + section + 'Rows']).toBe(1);
      }
    }
    const manifest = JSON.parse(readFileSync(join(ROOT, REAL_A5_BUNDLE, 'import.json'), 'utf8'));
    expect(manifest.admittedTools).toEqual(
      REAL_A5_TOOLS.map((name) => ({
        name,
        input: {
          maxCollectionItems: 1,
          maxSubjects: 1,
          maxEpisodesPerSubject: 1,
          maxRows: 1,
          maxDurationMs: 30000,
          statuses: ['wish', 'doing', 'done', 'on_hold', 'dropped'],
        },
      })),
    );
    const rawClaim = readFileSync(join(ROOT, REAL_A5_BUNDLE, 'durable-a5-claim.json'));
    expect(createHash('sha256').update(rawClaim).digest('hex')).toBe(
      '007538a80c41291163a735e15a4623f807f919d57230cadd1eb153f695e9d863',
    );
    expect(JSON.parse(rawClaim.toString())).toMatchObject({
      state: 'COMPLETE',
      scope: 'a5-bound-collection-dashboard-v1',
      observation: {
        toolCallsAttempted: 2,
        toolCallsSucceeded: 2,
        apiRequests: 10,
        coverRequests: 0,
        pngValidated: true,
        cleanupConfirmed: true,
      },
    });
    for (const [name, cells] of rowsByTool()) {
      expect(reportReferencesInMatrixCell(cells[8]).includes(REAL_A5_REPORT_PATH)).toBe(
        REAL_A5_TOOLS.includes(name),
      );
      for (const index of [6, 7, 9, 10, 11]) {
        expect(reportReferencesInMatrixCell(cells[index])).not.toContain(REAL_A5_REPORT_PATH);
      }
    }
    expect(TABLE).toContain('11/33；待补 22');
  });

  it('admits only the completed A6 non-anime partial sample without real relation or grouping credit', () => {
    const report = JSON.parse(readFileSync(join(ROOT, REAL_A6_REPORT_PATH), 'utf8'));
    expect(report).toMatchObject({
      passed: true,
      phase: 'COMPLETE',
      servicesRestored: true,
      protectedClaimsPreserved: true,
      modelRunsBefore: 945,
      modelRunsAfter: 945,
      operatorModelPrompts: 0,
      operatorClientActions: 0,
      privatePayloadExported: false,
      batch: {
        executionKind: 'live',
        passed: true,
        code: 'OK',
        toolCallsAttempted: 2,
        toolCallsSucceeded: 2,
        apiRequests: 2,
        coverRequests: 0,
        pngValidated: true,
        cleanupConfirmed: true,
        claimFinalized: true,
        modelCalls: 0,
        clientActions: 0,
        privatePayloadExported: false,
      },
    });
    const diagnostic = report.batch.diagnostic;
    expect(diagnostic).toMatchObject({
      guardPhase: 'complete',
      guardReason: null,
      failureStage: null,
      semanticFailure: null,
      pixelDecodeValidated: true,
      collectionRequests: 2,
      relationRequests: 0,
    });
    for (const role of ['read', 'render']) {
      expect(diagnostic[role + 'Rows']).toBe(1);
      expect(diagnostic[role + 'State']).toBe('partial');
      expect(diagnostic[role + 'CollectionTruncated']).toBe(true);
      expect(diagnostic[role + 'SourceExhausted']).toBe(false);
      for (const key of [
        'EligibleAnimeRows',
        'RelationRows',
        'RelationRowsReturned',
        'RelationTruncatedSubjects',
        'GroupCount',
        'GroupedItems',
        'UngroupedItems',
        'UnresolvedItems',
        'EdgeCount',
        'ConflictEdges',
      ]) {
        expect(diagnostic[role + key]).toBe(0);
      }
    }
    const manifest = JSON.parse(readFileSync(join(ROOT, REAL_A6_BUNDLE, 'import.json'), 'utf8'));
    expect(manifest.admittedTools).toEqual(
      REAL_A6_TOOLS.map((name) => ({
        name,
        input: {
          maxItems: 1,
          maxRelationSubjects: 1,
          maxRelationsPerSubject: 1,
          maxGroups: 1,
          maxEdges: 1,
          statuses: ['wish', 'doing', 'done', 'on_hold', 'dropped'],
        },
      })),
    );
    const rawClaim = readFileSync(join(ROOT, REAL_A6_BUNDLE, 'durable-a6-claim.json'));
    expect(createHash('sha256').update(rawClaim).digest('hex')).toBe(
      '842360a8dd1ec8aa6946051ecaacbd610082fd3c3558c1ee05add60538b445d4',
    );
    expect(JSON.parse(rawClaim.toString())).toMatchObject({
      state: 'COMPLETE',
      scope: 'a6-bound-collection-series-v1',
      observation: {
        toolCallsAttempted: 2,
        toolCallsSucceeded: 2,
        apiRequests: 2,
        coverRequests: 0,
        pngValidated: true,
        cleanupConfirmed: true,
      },
    });
    const post = JSON.parse(
      readFileSync(join(ROOT, REAL_A6_BUNDLE, 'postconditions.json'), 'utf8'),
    );
    expect(post).toMatchObject({
      passed: true,
      protectedA1A2A3A4A5ClaimBytesPreserved: true,
      runnerProcessCwdMatchesRelease: true,
      napcatSameProcess: true,
      astrbotSameContainer: true,
      containersHealthyAndUnpaused: true,
      gatewayReady: true,
      noOrphanOrFence: true,
      a6ClaimState: 'COMPLETE',
      modelRunsBefore: 945,
      modelRunsAfter: 945,
      runningModels: 0,
      pendingMessages: 0,
      privatePngsRetained: false,
      bangumiApiRequestsDuringReadback: 0,
    });
    for (const [name, cells] of rowsByTool()) {
      expect(reportReferencesInMatrixCell(cells[8]).includes(REAL_A6_REPORT_PATH)).toBe(
        REAL_A6_TOOLS.includes(name),
      );
      for (const index of [6, 7, 9, 10, 11])
        expect(reportReferencesInMatrixCell(cells[index])).not.toContain(REAL_A6_REPORT_PATH);
    }
    expect(TABLE).toContain('11/33；待补 22');
  });

  it('accepts synthetic authenticated-read and render evidence without implying real account auth', () => {
    const expectedTools = [
      'bangumi.get_collection_backlog',
      'bangumi.get_collection_dashboard',
      'bangumi.get_collection_entity_consistency',
      'bangumi.get_collection_intelligence',
      'bangumi.get_collection_schedule',
      'bangumi.get_collection_series_groups',
      'bangumi.get_episode_collections',
      'bangumi.get_my_profile',
      'bangumi.render_collection_backlog',
      'bangumi.render_collection_dashboard',
      'bangumi.render_collection_entity_consistency',
      'bangumi.render_collection_intelligence',
      'bangumi.render_collection_progress',
      'bangumi.render_collection_schedule',
      'bangumi.render_collection_series_groups',
    ].sort();
    expect(
      FULL_AUTH_FEATURE_QA_EVIDENCE.map((report: any) => report.scenarios[0].id).sort(),
    ).toEqual(expectedTools);
    for (const report of FULL_AUTH_FEATURE_QA_EVIDENCE) {
      const scenario = report.scenarios[0];
      expect(report).toMatchObject({
        schemaVersion: 1,
        evidenceKind: 'antigravity_cli_mcp_tool_use',
        profile: 'bangumi-full-auth-feature-qa-v1',
        processExitCode: 0,
        resultCount: 1,
        resultStatus: 'SUCCESS',
        qqPipelineTested: false,
        timClientTested: false,
      });
      expect(report.scopeNote).toContain('synthetic MemoryStorage account');
      expect(report.scopeNote).toContain('local HTTP fixture');
      expect(report.scopeNote).toContain('No real account or OAuth');
      expect(scenario).toMatchObject({
        id: scenario.toolCalls[0].name,
        passed: true,
        toolCalls: [{ name: scenario.id, state: 'DONE' }],
        assertions: {
          syntheticAccountUsed: true,
          syntheticTokenValidated: true,
          syntheticFixtureOnly: true,
          externalApiCalled: false,
          realAccountUsed: false,
        },
      });
      if (scenario.id.startsWith('bangumi.render_')) {
        expect(scenario.assertions).toMatchObject({
          rendererArtifactVerified: true,
          artifactRefReturned: true,
          artifactMimeType: 'image/png',
          artifactVerified: true,
        });
        expect(scenario.assertions.artifactWidth).toBeGreaterThan(0);
        expect(scenario.assertions.artifactHeight).toBeGreaterThan(0);
      }
      expect(catalogForHash(report.catalogSha256)).toBeDefined();
      expect(toolContractMatchesCurrent(report, scenario.id)).toBe(true);
      expect(scenario).not.toHaveProperty('prompt');
      expect(scenario).not.toHaveProperty('arguments');
      expectAccountAuthCell(scenario.id, rowsByTool().get(scenario.id)?.[8]);
      expect(statusMark(rowsByTool().get(scenario.id)?.[9])).toBe('✅');
    }
  });

  it('accepts the five fixed synthetic write paths without counting real authorization', () => {
    const expectedTools = [
      'bangumi.manage_character_collection',
      'bangumi.manage_index',
      'bangumi.manage_person_collection',
      'bangumi.update_collection',
      'bangumi.update_episode_progress',
    ].sort();
    expect(FULL_AUTH_WRITE_QA_EVIDENCE.map((report: any) => report.scenarios[0].id).sort()).toEqual(
      expectedTools,
    );
    for (const report of FULL_AUTH_WRITE_QA_EVIDENCE) {
      const scenario = report.scenarios[0];
      expect(report).toMatchObject({
        schemaVersion: 1,
        evidenceKind: 'antigravity_cli_mcp_tool_use',
        profile: 'bangumi-full-auth-write-qa-v1',
        processExitCode: 0,
        resultCount: 1,
        resultStatus: 'SUCCESS',
        qqPipelineTested: false,
        timClientTested: false,
      });
      expect(report.scopeNote).toContain('local HTTP fixture');
      expect(report.scopeNote).toContain('no external API');
      expect(report.scopeNote).toContain('not real account or write approval');
      expect(scenario).toMatchObject({
        id: scenario.toolCalls[0].name,
        passed: true,
        toolCalls: [{ name: scenario.id, state: 'DONE' }],
        assertions: {
          syntheticAccountUsed: true,
          syntheticTokenValidated: true,
          syntheticWriteVerified: true,
          syntheticFixtureOnly: true,
          externalApiCalled: false,
          realAccountUsed: false,
        },
      });
      expect(catalogForHash(report.catalogSha256)).toBeDefined();
      if (scenario.id === 'bangumi.manage_index') {
        expect(toolContractMatchesCurrent(report, scenario.id)).toBe(false);
        expect(rowsByTool().get(scenario.id)?.[9]).toBe('⬜');
        continue;
      }
      expect(toolContractMatchesCurrent(report, scenario.id)).toBe(true);
      expect(scenario).not.toHaveProperty('prompt');
      expect(scenario).not.toHaveProperty('arguments');
      expect(rowsByTool().get(scenario.id)?.[8]).toBe('⬜');
      expect(statusMark(rowsByTool().get(scenario.id)?.[9])).toBe('✅');
    }
  });

  it('continues to mark the public QA probe as Agent/MCP only', () => {
    const rows = rowsByTool();
    for (const report of CURRENT_FULL_PUBLIC_QA_EVIDENCE) {
      const name = report.scenarios[0].id;
      expect(statusMark(rows.get(name)?.[9])).toBe('✅');
      expect(report.qqPipelineTested).toBe(false);
      expect(report.timClientTested).toBe(false);
      expectClientEvidenceCell(rows.get(name)?.[10], `${name} QQ pipeline`);
      expectClientEvidenceCell(rows.get(name)?.[11], `${name} TIM client`);
    }
  });

  it('retains exact-source direct, Agent/MCP, and chat-card evidence for G02/G03/G14', () => {
    const expectedScenarios = ['G02', 'G03', 'G14'];
    const expectedRevision = 'd1a5a03095818c090ca7f2f9ff255753e5381f7e';
    const expectedCatalog = '3b140a83270c06e71eb7a470035a5259fc1e65d421020d03c5344f86178b3831';

    expect(RUN66_DISCOVERY_DIRECT_EVIDENCE).toMatchObject({
      evidenceKind: 'bangumi_public_discovery_scenarios_tool_registry',
      mode: 'read_only_public_api_scenario_smoke',
      sourceRevision: expectedRevision,
      catalogSha256: expectedCatalog,
      qqPipelineTested: false,
      timClientTested: false,
      scenarioCount: 3,
    });
    const directByScenario = new Map<string, any>(
      RUN66_DISCOVERY_DIRECT_EVIDENCE.results.map((result: any) => [result.scenario, result]),
    );
    expect([...directByScenario.keys()].sort()).toEqual(expectedScenarios);
    for (const scenario of expectedScenarios) {
      expect(directByScenario.get(scenario).assertions.passed).toBe(true);
      expect(
        directByScenario.get(scenario).result.items.every((item: any) => !('name' in item)),
      ).toBe(true);
    }
    expect(
      directByScenario
        .get('G02')
        .result.items.map((item: any) => item.collectionTotal)
        .every(
          (value: number, index: number, values: number[]) =>
            index === 0 || values[index - 1]! >= value,
        ),
    ).toBe(true);
    expect(directByScenario.get('G02').result.coverage.state).toBe('unknown');
    expect(directByScenario.get('G14').result.warningCodes).toEqual(['EXPERIMENTAL_SOURCE']);

    for (const reports of [RUN66_DISCOVERY_AGENT_EVIDENCE, RUN66_DISCOVERY_RENDER_EVIDENCE]) {
      expect(reports.map((report: any) => report.discoveryScenario).sort()).toEqual(
        expectedScenarios,
      );
      for (const report of reports) {
        expect(report.upstreamRevision).toBe(expectedRevision);
        expect(report.catalogSha256).toBe(expectedCatalog);
        expect(report.processExitCode).toBe(0);
        expect(report.resultStatus).toBe('SUCCESS');
        expect(report.qqPipelineTested).toBe(false);
        expect(report.timClientTested).toBe(false);
        expect(report.scenarios).toHaveLength(1);
        expect(report.scenarios[0].passed).toBe(true);
        expect(report.scenarios[0].assertions.queryArgumentsMatchScenario).toBe(true);
        expect(report.scenarios[0].toolCalls).toEqual([
          { name: report.scenarios[0].id, state: 'DONE' },
        ]);
      }
    }
    for (const report of RUN66_DISCOVERY_RENDER_EVIDENCE) {
      expect(report.scenarios[0].assertions).toMatchObject({
        rendererArtifactVerified: true,
        artifactReadbackVerified: true,
        artifactMimeType: 'image/png',
        artifactWidth: 720,
        chatViewportVerified: true,
        renderTarget: 'chat',
      });
    }
  });
});
