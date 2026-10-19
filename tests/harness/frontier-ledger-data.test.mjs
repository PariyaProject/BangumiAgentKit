import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ledger = JSON.parse(
  readFileSync(path.join(root, 'docs/product/frontier-ledger.json'), 'utf8'),
);
const agentMcpProfiles = JSON.parse(
  readFileSync(path.join(root, 'scripts/acceptance/agent-mcp-profile-registry.json'), 'utf8'),
).profiles;

function assertOneShotRuntimeIsHarnessOwned(record) {
  const guidance = [record.next_action, record.evidence?.source_contract].filter(Boolean).join(' ');
  assert.match(guidance, /active Harness Run\/Epoch/u);
  assert.match(guidance, /never retry a consumed claim/u);
  assert.doesNotMatch(
    guidance,
    /\bRun #95\b|\bPR #\d+\b|retryAllowed\s*=|INCONCLUSIVE|Candidate [0-9a-f]{7,}/iu,
  );
}

test('C07 v3 renderer matrix selection keeps the scenario unassessed and binds its visual QA receipt', () => {
  const record = ledger.records.find(({ id }) => id === 'C07');
  assert.ok(record, 'C07 must remain in the canonical frontier');
  assert.equal(record.status, 'UNASSESSED');
  assert.ok(
    record.source_refs.includes(
      'docs/research/run95-c07-render-comparison-offline-agent-mcp-matrix-v3-contract-2026-10-18.md',
    ),
  );
  assert.ok(
    record.source_refs.includes(
      'docs/research/run95-c07-render-comparison-offline-agent-mcp-matrix-v3-visual-qa-2026-10-18.json',
    ),
  );
  assert.ok(record.source_refs.includes('docs/product/g26-mcp-bundle-attestation.json'));
  assert.ok(record.source_refs.includes('scripts/lib/c07-render-comparison-visual-qa.mjs'));
  assert.ok(record.source_refs.includes('scripts/lib/c07-render-comparison-visual-qa.d.mts'));
  assert.match(record.next_action, /Luna Max round 1 is Harness-persisted as CORRECTIVE_REQUIRED/u);
  assert.match(record.next_action, /binds the receipt to the exact built MCP bundle/u);
  assert.match(record.next_action, /No v3 call or report exists yet/u);
});

test('consumed Run 95 S03 one-shot stays partial and cannot be retried', () => {
  const record = ledger.records.find(({ id }) => id === 'S03');
  assert.ok(record, 'S03 must remain in the canonical frontier');
  assert.equal(record.status, 'PARTIAL');
  assert.ok(
    record.source_refs.includes('docs/research/run95-s03-one-shot-disposition-2026-10-09.md'),
  );
  assert.match(record.next_action, /one-shot (?:is|remains) consumed/u);
  assert.match(record.next_action, /INCONCLUSIVE/u);
  assert.match(record.next_action, /Never retry/u);
  assert.match(record.next_action, /different safe unspent frontier/u);
  assert.doesNotMatch(record.next_action, /then make the single .* call/u);
});

test('G04 terminal Run 95 one-shot remains partial and cannot be retried', () => {
  const record = ledger.records.find(({ id }) => id === 'G04');
  assert.ok(record, 'G04 must remain in the canonical frontier');
  assert.equal(record.status, 'PARTIAL');
  const dispositionPath =
    'docs/research/run95-g04-terminal-disposition-reconciliation-2026-10-15.md';
  assert.ok(record.source_refs.includes(dispositionPath));

  const serialized = JSON.stringify(record);
  assert.doesNotMatch(serialized, /NOT_ATTEMPTED|claim_state|acceptance_count_advanced/u);
  assert.match(record.next_action, /PR #136 claim is INCONCLUSIVE/u);
  assert.match(record.next_action, /queryInvoked=false/u);
  assert.match(record.next_action, /retry is prohibited/u);
  assert.match(record.next_action, /permanent PR #139 latch is present/u);
  assert.match(record.next_action, /Do not invoke or claim this profile again/u);
  assert.match(record.next_action, /another safe unspent frontier/u);
  assert.doesNotMatch(record.next_action, /one-shot query may run|Run the fixed query/iu);

  const reportPath = 'docs/live-probes/g04-person-activity-run95.json';
  assert.equal(
    existsSync(path.join(root, reportPath)),
    false,
    'the terminal Run #95 claim wrote no report',
  );
  const disposition = readFileSync(path.join(root, dispositionPath), 'utf8');
  assert.match(disposition, /06c1915e64e466dc3543b46d58801eb767e9a161/u);
  assert.match(disposition, /51126320202c653d48e7d62461575a10988b1dbb/u);
  assert.match(disposition, /INCONCLUSIVE/u);
  assert.match(disposition, /queryInvoked=false/u);
  assert.match(disposition, /reportWritten=false/u);
  assert.match(disposition, /retryAllowed=false/u);
  assert.match(disposition, /harness-r95-g04-person-activity-claimed/u);
  assert.match(disposition, /one of 115 observed person\s+relation rows/u);
  assert.doesNotMatch(disposition, /claimId|personId|13684|expectedArguments|bundleSha256/iu);
});

test('G16 frontier keeps stable source guidance separate from Harness runtime state', () => {
  const record = ledger.records.find(({ id }) => id === 'G16');
  assert.ok(record, 'G16 must remain in the canonical frontier');
  assert.match(record.next_action, /PARTIAL/u);
  assert.match(record.next_action, /complete director filmography/u);
  assert.match(record.evidence.source_contract, /exact normalized director-label allow-list/u);
  assertOneShotRuntimeIsHarnessOwned(record);
});

test('M07 matrix-only account-denial evidence does not assess the index scenario', () => {
  const record = ledger.records.find(({ id }) => id === 'M07');
  assert.ok(record, 'M07 must remain in the canonical frontier');
  assert.equal(record.status, 'UNASSESSED');
  assert.ok(
    record.source_refs.includes(
      'docs/research/run95-m07-manage-index-agent-mcp-no-account-source-contract-2026-10-16.md',
    ),
  );
  assert.match(record.next_action, /matrix-only Agent\/MCP manage_index profile/u);
  assert.match(record.next_action, /AUTH_REQUIRED/u);
  assert.match(record.next_action, /does not answer the M07 scenario/u);
  assertOneShotRuntimeIsHarnessOwned(record);

  const matrixReport = 'docs/live-probes/m07-manage-index-agent-mcp-run95.json';
  if (existsSync(path.join(root, matrixReport))) {
    assert.ok(record.source_refs.includes(matrixReport));
    const report = JSON.parse(readFileSync(path.join(root, matrixReport), 'utf8'));
    assert.equal(report.acceptanceScope, 'agent-mcp-matrix-only');
    assert.equal(report.scenarioId, null);
    assert.equal(report.resultStatus, 'AUTH_REQUIRED');
  }
});

test('R01 frontier keeps source limits separate from Harness runtime state', () => {
  const record = ledger.records.find(({ id }) => id === 'R01');
  assert.ok(record, 'R01 must remain in the canonical frontier');
  assert.equal(record.status, 'PARTIAL');
  assert.match(record.next_action, /reverse\/transitive edges/u);
  assert.match(record.next_action, /official viewing order/u);
  assert.match(record.next_action, /only one Agent\/MCP matrix cell/u);
  for (const source of [
    'docs/research/run95-r01-subject-relations-offline-agent-mcp-matrix-2026-10-16.md',
    'apps/mcp/codex-one-tool-mcp-server.mjs',
    'scripts/acceptance/agent-mcp-profile-registry.json',
    'scripts/agent-harness.mjs',
    'scripts/lib/codex-one-tool-mcp-arguments.mjs',
    'scripts/lib/codex-profile-tool-summary.mjs',
    'scripts/lib/r01-relations-offline-profile.mjs',
    'scripts/lib/r01-relations-offline-fixture.mjs',
    'scripts/acceptance/run-r01-relations-offline-agent-mcp.mjs',
    'scripts/acceptance/write-r01-relations-offline-agent-mcp-report.mjs',
    'scripts/acceptance/validate-r01-relations-offline-agent-mcp-report.mjs',
    'tests/harness/agent-mcp-profile-claims.test.mjs',
    'tests/harness/codex-mcp-approval-config.test.mjs',
    'tests/harness/r01-relations-offline-fixture.test.mjs',
    'tests/harness/run-r01-relations-offline-agent-mcp.test.mjs',
    'tests/harness/write-r01-relations-offline-agent-mcp-report.test.mjs',
  ]) {
    assert.ok(record.source_refs.includes(source), `R01 source reference missing: ${source}`);
    assert.equal(
      existsSync(path.join(root, source)),
      true,
      `R01 source reference is missing: ${source}`,
    );
  }
  const matrixReport = 'docs/live-probes/r01-relations-offline-agent-mcp-run95.json';
  if (record.source_refs.includes(matrixReport)) {
    assert.equal(existsSync(path.join(root, matrixReport)), true);
    assert.match(record.next_action, /synthetic offline profile/u);
  }
  assertOneShotRuntimeIsHarnessOwned(record);
});

test('R03 bounded rating evidence is partial and does not credit Agent/MCP', () => {
  const record = ledger.records.find(({ id }) => id === 'R03');
  assert.ok(record, 'R03 must remain in the canonical frontier');
  assert.equal(record.status, 'PARTIAL');
  assert.match(record.next_action, /analysisMode=observed_two_hop_rating/u);
  assert.match(record.next_action, /bounded outgoing two-hop sample/u);
  assert.match(record.next_action, /does not establish the complete two-hop graph/u);
  assert.match(record.next_action, /local tests earn no Agent\/MCP matrix credit/u);
  assert.match(record.next_action, /PR #208 v1 and PR #212 v2 R03 claims are terminal/u);
  assert.match(record.next_action, /retryAllowed=false and must never be repeated/u);
  assert.match(record.next_action, /must not change the 65\/65 public API target/u);
  for (const source of [
    'docs/research/run95-r03-relations-agent-mcp-offline-matrix-2026-10-17.md',
    'docs/research/run95-r03-direct-relations-offline-agent-mcp-matrix-v2-2026-10-17.md',
    'scripts/lib/codex-mcp-approval-config.mjs',
    'tests/harness/codex-mcp-approval-config.test.mjs',
    'scripts/acceptance/agent-mcp-profile-registry.json',
    'scripts/acceptance/run-r03-relations-offline-agent-mcp.mjs',
    'scripts/acceptance/write-r03-relations-offline-agent-mcp-report.mjs',
    'scripts/acceptance/validate-r03-relations-offline-agent-mcp-report.mjs',
    'scripts/lib/r03-relations-offline-profile.mjs',
    'scripts/lib/r03-relations-offline-fixture.mjs',
    'apps/mcp/codex-one-tool-mcp-server.mjs',
    'scripts/generate-tool-acceptance-tasks.py',
    'scripts/test_acceptance_evidence.py',
    'tests/harness/r03-relations-offline-fixture.test.mjs',
    'tests/harness/run-r03-relations-offline-agent-mcp.test.mjs',
    'tests/harness/write-r03-relations-offline-agent-mcp-report.test.mjs',
    'docs/research/run95-r03-bounded-observed-two-hop-rating-contract-2026-10-17.md',
    'packages/bangumi-core/src/services/subject-relations-analysis-service.ts',
    'packages/bangumi-core/src/services/subject-service.ts',
    'apps/mcp/src/result-presenter.ts',
    'tests/semantic/subject-relations-analysis.test.ts',
    'tests/integration/subject-relations-analysis-presenter.test.ts',
  ]) {
    assert.ok(record.source_refs.includes(source), `R03 source reference missing: ${source}`);
    assert.equal(
      existsSync(path.join(root, source)),
      true,
      `R03 source reference is missing: ${source}`,
    );
  }
  const matrixReport = 'docs/live-probes/r03-direct-relations-agent-mcp-matrix-v2-run95.json';
  if (record.source_refs.includes(matrixReport)) {
    assert.equal(existsSync(path.join(root, matrixReport)), true);
    assert.match(record.next_action, /synthetic offline matrix-only profile/u);
  }
});

test('D07, P01, and A01 keep stable scenario guidance and defer claim state to Harness', () => {
  const expected = [
    {
      id: 'D07',
      status: 'UNASSESSED',
      scenario: /historical-rank scenario/u,
    },
    {
      id: 'P01',
      status: 'UNASSESSED',
      scenario: /bounded role distribution/u,
    },
    {
      id: 'A01',
      status: 'UNASSESSED',
      scenario: /cohort-analysis scenario/u,
      publicRows: /aggregate_subject_cohort.*public-matrix rows/u,
    },
  ];

  for (const item of expected) {
    const record = ledger.records.find(({ id }) => id === item.id);
    assert.ok(record, `${item.id} must remain in the canonical frontier`);
    assert.equal(record.status, item.status);
    assert.match(record.next_action, item.scenario);
    if (item.publicRows) assert.match(record.next_action, item.publicRows);
    assertOneShotRuntimeIsHarnessOwned(record);
  }
});

test('A01 public matrix evidence remains direct-only and does not promote the scenario', () => {
  const record = ledger.records.find(({ id }) => id === 'A01');
  assert.ok(record, 'A01 must remain in the canonical frontier');
  assert.equal(record.status, 'UNASSESSED');
  assert.ok(
    record.source_refs.includes(
      'docs/research/run95-c04-cohort-comparison-agent-mcp-matrix-contract-2026-10-16.md',
    ),
  );
  assert.match(
    record.next_action,
    /C04 cohort-comparison matrix contract documents separate single-tool Agent\/MCP checks/u,
  );
  const evidence = record.evidence?.direct_public_api_matrix_probe_2026_10_15;
  assert.ok(evidence, 'A01 must retain the bounded direct-public matrix observation');
  assert.ok(record.source_refs.includes(evidence.report));

  const reportText = readFileSync(path.join(root, evidence.report), 'utf8');
  const report = JSON.parse(reportText);
  assert.equal(evidence.report_sha256, createHash('sha256').update(reportText).digest('hex'));
  assert.equal(report.scopeId, evidence.scope_id);
  assert.equal(evidence.request_count, 19);
  assert.deepEqual(
    report.selectedTools.filter((tool) => evidence.tools.includes(tool)),
    evidence.tools,
  );
  assert.equal(
    report.results
      .filter(({ tool }) => evidence.tools.includes(tool))
      .every(({ assertions }) => assertions.passed === true),
    true,
  );
  assert.match(evidence.acceptance_boundary, /does not answer the A01 cohort-analysis question/u);
  assert.match(evidence.acceptance_boundary, /change A01 from UNASSESSED/u);
  assert.match(evidence.acceptance_boundary, /add Agent\/MCP or one-shot credit/u);
});

test('A01 aggregate cohort offline profile is distinct and remains matrix-only', () => {
  const record = ledger.records.find(({ id }) => id === 'A01');
  const profile = agentMcpProfiles.find(
    ({ id }) => id === 'a01-aggregate-cohort-offline-agent-mcp-matrix-v1',
  );
  const profileV2 = agentMcpProfiles.find(
    ({ id }) => id === 'a01-aggregate-cohort-offline-agent-mcp-matrix-v2',
  );
  assert.ok(record);
  assert.ok(profile);
  assert.ok(profileV2);
  assert.equal(record.status, 'UNASSESSED');
  assert.equal(profile.epochId, 'run95-a01-aggregate-cohort-matrix-followup-20261018');
  assert.equal(profile.acceptanceScope, 'agent-mcp-matrix-only');
  assert.equal(profile.toolName, 'bangumi.aggregate_subject_cohort');
  assert.equal(profileV2.toolName, profile.toolName);
  assert.equal(profileV2.acceptanceScope, 'agent-mcp-matrix-only');
  assert.notEqual(profileV2.epochId, profile.epochId);
  assert.notDeepEqual(profileV2.calls, profile.calls);
  assert.equal(
    record.evidence.aggregate_cohort_offline_matrix_followup_2026_10_18.epoch_id,
    profile.epochId,
  );
  assert.match(
    record.evidence.aggregate_cohort_offline_matrix_followup_2026_10_18.reconciliation_behavior,
    /preserve unrelated concurrent PR control updates/u,
  );
  assert.match(record.next_action, /A01 UNASSESSED/u);
  assert.ok(
    record.source_refs.includes(
      'docs/research/run95-a01-aggregate-subject-cohort-offline-agent-mcp-contract-2026-10-18.md',
    ),
  );
  assert.match(
    record.next_action,
    /distinct v1 and v2 synthetic offline matrix-profile contracts/iu,
  );
  assert.match(record.next_action, /v2 contract uses fresh synthetic input/u);
  assert.match(
    record.next_action,
    /can earn at most the aggregate_subject_cohort Agent\/MCP matrix row/u,
  );
  assert.ok(
    record.source_refs.includes(
      'docs/research/run95-a01-aggregate-cohort-offline-matrix-v2-contract-2026-10-19.md',
    ),
  );
  assertOneShotRuntimeIsHarnessOwned(record);
});

test('Run 95 public matrix rows remain hash-bound and separate from scenario evidence', () => {
  const readBoundReport = (record, evidence) => {
    assert.ok(record.source_refs.includes(evidence.report));
    const reportText = readFileSync(path.join(root, evidence.report), 'utf8');
    assert.equal(evidence.report_sha256, createHash('sha256').update(reportText).digest('hex'));
    const report = JSON.parse(reportText);
    assert.equal(report.scopeId, evidence.scope_id);
    return report;
  };

  const a01 = ledger.records.find(({ id }) => id === 'A01');
  assert.ok(a01, 'A01 must remain in the canonical frontier');
  assert.equal(a01.status, 'UNASSESSED');
  const a01Evidence = a01.evidence?.direct_public_api_matrix_rows_2026_10_16;
  assert.ok(a01Evidence, 'A01 must retain the contract-valid cohort report');
  const a01Report = readBoundReport(a01, a01Evidence);
  assert.equal(a01Evidence.request_count, 13);
  assert.equal(a01Report.httpRequests, 13);
  assert.equal(a01Report.budgetBlocked, false);
  assert.deepEqual(Object.keys(a01Evidence.tools).sort(), [
    'bangumi.aggregate_subject_cohort',
    'bangumi.compare_subject_cohorts',
    'bangumi.render_subject_cohort_aggregation',
    'bangumi.render_subject_cohort_comparison',
  ]);
  for (const [tool, expected] of Object.entries(a01Evidence.tools)) {
    const result = a01Report.results.find((item) => item.tool === tool);
    assert.ok(result, `${tool} must be present in the hash-bound report`);
    assert.equal(result.httpRequests, expected.requests);
    assert.equal(result.result.state, expected.result_state);
    assert.equal(result.assertions.passed, expected.assertions_passed);
  }
  assert.match(a01Evidence.acceptance_boundary, /do not answer the A01 cohort-analysis question/u);
  assert.match(a01Evidence.acceptance_boundary, /add Agent\/MCP or one-shot credit/u);

  const g01 = ledger.records.find(({ id }) => id === 'G01');
  assert.ok(g01, 'G01 must remain in the canonical frontier');
  assert.equal(g01.status, 'PARTIAL');
  const g01Evidence = g01.evidence?.direct_public_matrix_rows_2026_10_16;
  assert.ok(g01Evidence, 'G01 must retain the two passing direct public observations');
  const g01Report = readBoundReport(g01, g01Evidence);
  assert.equal(g01Evidence.request_count, 4);
  assert.equal(g01Report.httpRequests, 4);
  for (const [tool, expected] of Object.entries(g01Evidence.tools)) {
    const result = g01Report.results.find((item) => item.tool === tool);
    assert.ok(result, `${tool} must be present in the hash-bound report`);
    assert.equal(result.httpRequests, expected.requests);
    assert.equal(result.result.state, expected.result_state);
    assert.equal(result.assertions.passed, expected.assertions_passed);
  }
  const rejectedCohortRows = g01Report.results.filter(({ tool }) => tool.includes('cohort'));
  assert.equal(rejectedCohortRows.length, 4);
  assert.equal(
    rejectedCohortRows.every(
      ({ httpRequests, assertions }) => httpRequests === 0 && assertions.passed === false,
    ),
    true,
    'the rejected top-mode cohort calls must remain uncredited',
  );
  assert.match(g01Evidence.acceptance_boundary, /No G01 July 2026 harem scenario/u);
  assert.match(g01Evidence.acceptance_boundary, /Agent\/MCP evidence is inferred/u);

  assert.equal(
    g01.evidence?.run95_agent_mcp_terminal_profile_2026_10_17,
    undefined,
    'Harness runtime dispositions must not be copied into the product frontier',
  );
  assert.doesNotMatch(
    JSON.stringify(g01),
    /INCONCLUSIVE|call_count|report_written|retry_allowed|reason_code|codex_error_items|claim_latch_present|terminal_latch_present/u,
    'the G01 frontier must not copy terminal profile runtime fields from Harness',
  );
  assert.match(
    g01.next_action,
    /frontier ledger is scenario guidance, not a profile-claim status source/u,
  );
  assert.match(
    g01.next_action,
    /consult the active Run #95 Harness for exact claim and terminal eligibility/u,
  );
  assert.doesNotMatch(
    g01.next_action,
    /PR #211|INCONCLUSIVE|call_count|reportWritten|retryAllowed|claim latch|terminal latch/iu,
  );
  assert.match(g01.next_action, /never retry the consumed one-shot/u);
  assert.match(g01.next_action, /do not replay the consumed G01 Agent\/MCP canary/u);
  assert.doesNotMatch(g01.next_action, /unclaimed|remains unclaimed/iu);

  const p02 = ledger.records.find(({ id }) => id === 'P02');
  assert.ok(p02, 'P02 must remain in the canonical frontier');
  assert.equal(p02.status, 'PARTIAL');
  const p02Evidence = p02.evidence?.direct_public_api_matrix_rows_2026_10_16;
  assert.ok(p02Evidence, 'P02 must retain the two direct public profile reports');
  assert.equal(p02Evidence.profiles.length, 2);
  for (const profile of p02Evidence.profiles) {
    const report = readBoundReport(p02, profile);
    const [result] = report.results;
    assert.equal(report.results.length, 1);
    assert.equal(result.tool, profile.tool);
    assert.equal(result.input.personId, 13684);
    assert.equal(result.httpRequests, profile.requests);
    assert.equal(result.result.state, profile.result_state);
    assert.equal(result.assertions.passed, profile.assertions_passed);
    assert.ok(Array.isArray(result.result.keys), 'reports retain summary keys only');
  }
  assert.match(p02Evidence.privacy_clarification, /fixed public query input personId=13684/u);
  assert.match(p02Evidence.privacy_clarification, /response-derived identifiers/u);
  assert.match(
    p02Evidence.acceptance_boundary,
    /do not establish career-wide first\/latest participation/u,
  );
  assert.match(p02Evidence.acceptance_boundary, /change P02 from PARTIAL/u);

  const r04 = ledger.records.find(({ id }) => id === 'R04');
  assert.ok(r04, 'R04 must remain in the canonical frontier');
  assert.equal(r04.status, 'UNASSESSED');
  assert.match(
    r04.next_action,
    /existing get_series_watch_order offline profile is terminal INCONCLUSIVE/u,
  );
  assert.ok(
    r04.next_action.includes(
      'earlier renderer v1 profile is also terminal INCONCLUSIVE/no-report/no-retry',
    ),
    'the spent R04 renderer v1 profile must stay terminal and non-retriable',
  );
  assert.match(r04.next_action, /distinct matrix-only render_series_watch_order profile/u);
  assert.match(r04.next_action, /separately keyed R04 renderer v2 profile/u);
  assert.match(r04.next_action, /synthetic subjectId=990803/u);
  assert.match(r04.next_action, /keep the R04 theatrical-film scenario UNASSESSED/u);
  assert.match(r04.next_action, /do not claim canonical order or visual quality/u);
  assert.match(
    r04.next_action,
    /separately keyed R04 get_series_watch_order v2 Epoch is selected.*synthetic root 990817 and prequel 990818/u,
  );
  assert.match(r04.next_action, /preserves the terminal v1 profile and adds no credit yet/u);
  for (const source of [
    'scripts/lib/r04-render-series-watch-order-offline-fixture.mjs',
    'scripts/acceptance/run-r04-render-series-watch-order-offline-agent-mcp.mjs',
    'scripts/acceptance/write-r04-render-series-watch-order-offline-agent-mcp-report.mjs',
    'scripts/acceptance/validate-r04-render-series-watch-order-offline-agent-mcp-report.mjs',
    'docs/research/run95-r04-render-series-watch-order-offline-matrix-contract-2026-10-17.md',
    'scripts/lib/r04-render-series-watch-order-offline-v2-fixture.mjs',
    'scripts/acceptance/run-r04-render-series-watch-order-offline-agent-mcp-v2.mjs',
    'scripts/acceptance/write-r04-render-series-watch-order-offline-agent-mcp-v2-report.mjs',
    'scripts/acceptance/validate-r04-render-series-watch-order-offline-agent-mcp-v2-report.mjs',
    'docs/research/run95-r04-render-series-watch-order-offline-matrix-v2-contract-2026-10-18.md',
    'tests/harness/r04-render-series-watch-order-offline-v2-fixture.test.mjs',
    'tests/harness/run-r04-render-series-watch-order-offline-agent-mcp-v2.test.mjs',
    'tests/harness/write-r04-render-series-watch-order-offline-agent-mcp-v2-report.test.mjs',
    'scripts/lib/r04-series-watch-order-offline-v2-fixture.mjs',
    'scripts/acceptance/run-r04-series-watch-order-offline-agent-mcp-v2.mjs',
    'scripts/acceptance/write-r04-series-watch-order-offline-agent-mcp-v2-report.mjs',
    'scripts/acceptance/validate-r04-series-watch-order-offline-agent-mcp-v2-report.mjs',
    'docs/research/run95-r04-series-watch-order-offline-matrix-v2-contract-2026-10-18.md',
    'tests/harness/r04-series-watch-order-offline-v2-fixture.test.mjs',
    'tests/harness/run-r04-series-watch-order-offline-agent-mcp-v2.test.mjs',
    'tests/harness/write-r04-series-watch-order-offline-agent-mcp-v2-report.test.mjs',
  ]) {
    assert.ok(r04.source_refs.includes(source), `R04 source reference missing: ${source}`);
  }

  const r02 = ledger.records.find(({ id }) => id === 'R02');
  assert.ok(r02, 'R02 must remain in the canonical frontier');
  assert.equal(r02.status, 'UNASSESSED');
  for (const source of [
    'docs/research/run95-r02-positive-direct-relations-agent-mcp-source-contract-2026-10-16.md',
    'scripts/lib/r02-positive-direct-relations-profile.mjs',
    'scripts/acceptance/run-r02-positive-direct-relations-agent-mcp.mjs',
    'scripts/acceptance/write-r02-positive-direct-relations-agent-mcp-report.mjs',
    'scripts/acceptance/validate-r02-positive-direct-relations-agent-mcp-report.mjs',
  ]) {
    assert.ok(r02.source_refs.includes(source), `R02 source reference missing: ${source}`);
    assert.equal(
      existsSync(path.join(root, source)),
      true,
      `R02 source reference is missing: ${source}`,
    );
  }
  assert.match(
    r02.next_action,
    /Keep R02 UNASSESSED until an exact-Candidate signed report is accepted/u,
  );
  assert.match(
    r02.next_action,
    /does not establish reverse\/transitive edges or graph completeness/u,
  );

  const s05 = ledger.records.find(({ id }) => id === 'S05');
  assert.ok(s05, 'S05 must remain in the canonical frontier');
  assert.deepEqual(s05.source_refs, [
    'docs/research/user-scenario-catalog.md',
    'docs/research/run95-s05-six-month-non-tv-source-contract-2026-10-17.md',
  ]);
  assert.match(
    s05.next_action,
    /sole Run #95 claim is terminal INCONCLUSIVE with no report, no retry, and no Agent\/MCP credit/u,
  );
  assert.match(s05.next_action, /Keep S05 UNASSESSED and uncredited/u);
  assert.match(s05.next_action, /cannot establish that all recent voice work was non-TV/u);
  assert.doesNotMatch(s05.next_action, /R02/u);
  assert.equal(
    s05.source_refs.some((source) => source.includes('r02-positive-direct-relations')),
    false,
  );
});

test('C03 terminal no-report profile stays unassessed and cannot be retried', () => {
  const record = ledger.records.find(({ id }) => id === 'C03');
  assert.ok(record, 'C03 must remain in the canonical frontier');
  assert.equal(record.status, 'UNASSESSED');
  assert.equal(record.evidence, undefined, 'C03 has no report evidence or capability credit');
  assert.equal(
    existsSync(path.join(root, 'docs/live-probes/c03-voice-actor-comparison-agent-mcp-run95.json')),
    false,
    'the inconclusive C03 claim produced no report that could earn Agent/MCP credit',
  );

  const dispositionPath = 'docs/research/run95-c03-profile-terminal-disposition-2026-10-15.md';
  assert.ok(record.source_refs.includes(dispositionPath));
  assert.match(record.next_action, /INCONCLUSIVE without a report/u);
  assert.match(record.next_action, /retryAllowed=false/u);
  assert.match(record.next_action, /missing report does not restore eligibility/u);
  assert.match(record.next_action, /Never rerun this consumed Run #95 profile/u);
  assert.match(record.next_action, /another safe unspent frontier/u);
  assert.doesNotMatch(record.next_action, /run the registered one-shot profile once/iu);

  const disposition = readFileSync(path.join(root, dispositionPath), 'utf8');
  assert.match(disposition, /PR #162/u);
  assert.match(disposition, /run95-c03-profile-aware-agent-mcp-20261014/u);
  assert.match(disposition, /harness-r95-c03-activity-claimed/u);
  assert.match(disposition, /harness-r95-c03-activity-terminal/u);
  assert.match(disposition, /INCONCLUSIVE/u);
  assert.match(disposition, /reportWritten=false/u);
  assert.match(disposition, /retryAllowed=false/u);
  assert.doesNotMatch(disposition, /expectedArguments|runnerReceiptPublicKey|4765|17075/iu);
});

test('P03 terminal Agent/MCP disposition stays partial, uncredited, and non-retriable', () => {
  const record = ledger.records.find(({ id }) => id === 'P03');
  assert.ok(record, 'P03 must remain in the canonical frontier');
  assert.equal(record.status, 'PARTIAL');
  assert.match(record.next_action, /PARTIAL and uncredited/u);
  assert.match(record.next_action, /INCONCLUSIVE/u);
  assert.match(record.next_action, /retryAllowed=false/u);
  assert.match(record.next_action, /Do not repeat this call/u);
  assert.deepEqual(Object.keys(record.evidence).sort(), [
    'p03_agent_mcp_profile_preflight',
    'p03_agent_mcp_profile_result',
  ]);

  const preflight = record.evidence?.p03_agent_mcp_profile_preflight;
  assert.ok(preflight, 'the historical preflight snapshot must remain available');
  assert.deepEqual(Object.keys(preflight).sort(), [
    'arguments',
    'auth',
    'calls',
    'checks',
    'claim_state',
    'epoch_id',
    'live_query_run',
    'profile_id',
    'source_completeness',
    'status_boundary',
    'tool',
  ]);
  assert.deepEqual(Object.keys(preflight.arguments).sort(), [
    'includeCredits',
    'maxCharacters',
    'maxSubjects',
    'personId',
  ]);
  assert.equal(preflight.claim_state, 'UNCLAIMED');
  assert.equal(preflight.live_query_run, false);
  assert.equal(
    preflight.status_boundary,
    'This is the preflight snapshot before the one-shot claim; the later terminal INCONCLUSIVE disposition is recorded separately. P03 remains PARTIAL and uncredited.',
  );
  assert.deepEqual(preflight.checks, [
    'Round-1 exact-Candidate GPT-6 Luna Max review of head 022ea48405de829af0732c29e518f15aaf9fad7d against Base 2884aff638512652cfe99e4b496dd915332ad052 returned CORRECTIVE_REQUIRED with three findings (P1/P1/P2), recorded through Harness.',
    'Corrective regressions: exact canonical coverageNote rejects appended absence/completeness claims; person-profile MCP text always uses the positive-only compact projection; subjectsTruncated must equal subjectsObserved > subjectsReturned.',
    'Focused P03/C03/profile/claim/report Harness tests passed 28/28. MCP result-presenter integration passed 35/35, including a full result below 3600 UTF-8 bytes checked against the P03 projection validator.',
    'Full Harness suite passed 277/277. Typecheck, lint, build, legacy-path guard, acceptance:check, frontier:check, Prettier, and diff checks passed.',
    'Two independent builds reproduced MCP bundle SHA-256 ba30619c0426aa54ab30e5063a71cdd5c63e38795a23c7c8e4c74eafec5707a8; the current attestation matches.',
    'At this preflight snapshot no P03 claim/query had run; the later terminal disposition is recorded separately below. P03 remains PARTIAL; C03 remains terminal INCONCLUSIVE with retryAllowed=false.',
  ]);

  const result = record.evidence?.p03_agent_mcp_profile_result;
  assert.ok(result, 'the terminal disposition must be recorded separately');
  assert.deepEqual(Object.keys(result).sort(), [
    'base_sha',
    'bundle_sha256',
    'calls',
    'ci_run',
    'ci_status',
    'claim_state',
    'epoch_id',
    'finished_at',
    'merge_commit_sha',
    'profile_id',
    'reason_code',
    'report_present',
    'report_written',
    'retry_allowed',
    'reviewer_id',
    'sanitized_assertions',
    'source_candidate_sha',
    'source_completeness',
  ]);
  assert.equal(result.epoch_id, 'run95-p03-person-chinese-title-agent-mcp-20261015');
  assert.equal(result.profile_id, 'p03-person-name-cn-agent-mcp-v1');
  assert.equal(result.claim_state, 'INCONCLUSIVE');
  assert.equal(result.calls, 1);
  assert.equal(result.source_completeness, 'undocumented');
  assert.equal(result.report_written, false);
  assert.equal(result.report_present, false);
  assert.equal(result.retry_allowed, false);
  assert.equal(result.reason_code, 'P03_AGENT_MCP_ASSERTION_FAILED');
  assert.equal(result.source_candidate_sha, '623b555db249fe8be9e4f52ec5fab371236deb18');
  assert.equal(result.base_sha, '2884aff638512652cfe99e4b496dd915332ad052');
  assert.equal(result.ci_run, '38690431294');
  assert.equal(result.ci_status, 'SUCCESS');
  assert.equal(result.reviewer_id, 'gpt-6-luna-max-run95-pr167-round1');
  assert.equal(
    result.bundle_sha256,
    'ba30619c0426aa54ab30e5063a71cdd5c63e38795a23c7c8e4c74eafec5707a8',
  );
  assert.equal(result.merge_commit_sha, '019b41b05abfd512d1d64d31d649cc6c684771fe');
  assert.equal(result.finished_at, '2026-10-15T06:17:56.449Z');
  assert.deepEqual(result.sanitized_assertions, {
    event_stream_parsed: true,
    turn_completed: true,
    exact_registered_call: true,
    exact_tool_event: false,
    structured_readback: false,
    mcp_text_projection_valid: true,
    server_summary_valid: true,
    answer_person_identity_exact: false,
    codex_error_item_count: 3,
    non_mcp_tool_event_count: 0,
    shell_tool_call_count: 0,
  });
});

test('P06 offline renderer matrix evidence cannot close the latest-20 scenario', () => {
  const record = ledger.records.find(({ id }) => id === 'P06');
  assert.ok(record, 'P06 must remain in the canonical frontier');
  assert.equal(record.status, 'UNASSESSED');
  assert.match(record.next_action, /Keep UNASSESSED/u);
  assert.match(record.next_action, /synthetic offline render_person_profile Agent\/MCP/u);
  assert.match(record.next_action, /both are terminal INCONCLUSIVE\/no-report\/no-retry/u);
  assert.match(record.next_action, /P06_AGENT_MCP_ASSERTION_FAILED/u);
  assert.match(record.next_action, /do not add Agent\/MCP matrix credit for v2/u);
  assert.match(record.next_action, /does not establish real-person data/u);
  assert.ok(
    record.source_refs.includes(
      'docs/research/run95-p06-render-person-profile-agent-mcp-offline-fixture-source-contract-2026-10-16.md',
    ),
  );
  const reportPath = 'docs/live-probes/p06-render-person-profile-agent-mcp-run95.json';
  if (record.source_refs.includes(reportPath)) {
    assert.match(record.next_action, /matrix-only/u);
    assert.match(record.next_action, /no scenario acceptance/u);
  }
});

test('P02 offline person-profile matrix evidence cannot close first/latest participation', () => {
  const record = ledger.records.find(({ id }) => id === 'P02');
  assert.ok(record, 'P02 must remain in the canonical frontier');
  assert.equal(record.status, 'PARTIAL');
  assert.match(record.next_action, /Keep P02 PARTIAL/u);
  assert.match(record.next_action, /no P02 scenario credit/u);
  assert.match(
    record.next_action,
    /public matrix refresh in this Run #95 Epoch records 65\/65, compared with the 57\/65 master baseline at Epoch start/u,
  );
  assert.ok(
    record.source_refs.includes(
      'docs/research/run95-p02-person-profile-agent-mcp-offline-matrix-contract-2026-10-16.md',
    ),
  );
});

test('P05 records its bounded live report as partial returned-row evidence', () => {
  const record = ledger.records.find(({ id }) => id === 'P05');
  assert.ok(record, 'P05 must remain in the canonical frontier');
  assert.equal(record.status, 'PARTIAL');
  assert.ok(
    record.source_refs.includes(
      'docs/research/run95-p05-person-work-media-distribution-source-contract-2026-10-15.md',
    ),
  );
  assert.ok(
    record.source_refs.includes('docs/live-probes/p05-person-media-public-probe-run95.json'),
  );
  assert.ok(record.source_refs.includes('scripts/acceptance/run-p05-person-media-public-probe.ts'));
  assert.ok(record.source_refs.includes('scripts/lib/p05-one-shot-claim.mjs'));
  assert.ok(record.source_refs.includes('tests/harness/agent-harness-cli.test.mjs'));

  const evidence = record.evidence?.p05_person_media_distribution_2026_10_15;
  assert.ok(evidence, 'P05 source and runner evidence must be recorded');
  assert.equal(evidence.public_profile.tool, 'bangumi.get_person_profile');
  assert.deepEqual(evidence.public_profile.arguments, {
    personId: 3474,
    includeCredits: false,
    maxSubjects: 500,
    maxCharacters: 1,
  });
  assert.equal(evidence.public_profile.live_query_run, true);
  assert.equal(evidence.public_profile.tool_invocation_count, 1);
  assert.deepEqual(evidence.observed_result, {
    report: 'docs/live-probes/p05-person-media-public-probe-run95.json',
    report_sha256: '659bba19b4e8a54970420b6306791a813a2eeee15b53ba18598cbdecc3306872',
    result_state: 'SUCCESS',
    http_requests: 3,
    subject_rows_observed: 402,
    subject_rows_returned: 402,
    subject_rows_truncated: false,
    source_completeness: 'undocumented',
    unique_subjects: 370,
    subject_media: {
      anime: { relation_rows: 401, unique_subjects: 369, raw_codes: [2] },
      game: { relation_rows: 1, unique_subjects: 1, raw_codes: [4] },
    },
    claim_limit: 'Returned relation rows only; upstream completeness is undocumented.',
  });
  assert.match(
    evidence.runner_contract.repository_global_claim,
    /repository-scoped create-only GitHub label/u,
  );
  assert.match(evidence.runner_contract.repository_global_claim, /active-PR claim.*read back/u);
  assert.equal(
    evidence.official_source_contract.pagination_total_order_or_completeness_documented,
    false,
  );
  assert.match(evidence.official_source_contract.claim_limit, /returned relation rows only/u);
  assert.match(record.next_action, /same-identity GPT-6 Luna Max review/u);
  assert.match(
    record.next_action,
    /does not support platform or exhaustive career-wide distribution/u,
  );
  assert.match(record.next_action, /Never retry the consumed P05 claim/u);
  const reportPath = path.join(root, evidence.observed_result.report);
  assert.equal(existsSync(reportPath), true, 'the accepted one-shot report must be committed');
  const reportBytes = readFileSync(reportPath);
  assert.equal(
    createHash('sha256').update(reportBytes).digest('hex'),
    evidence.observed_result.report_sha256,
    'the sanitized one-shot report must match its recorded digest',
  );
  const report = JSON.parse(reportBytes.toString('utf8'));
  assert.equal(report.resultState, 'SUCCESS');
  assert.equal(report.toolInvocationCount, 1);
  assert.equal(report.resultSummary.subjectRowsObserved, 402);
  assert.equal(report.resultSummary.subjectRowsReturned, 402);
  assert.equal(report.resultSummary.sourceCompleteness, 'undocumented');
  assert.deepEqual(report.assertions, {
    exactHarnessCandidateGate: true,
    exactPublicReadArguments: true,
    exactlyOneToolInvocation: true,
    anonymousPublicRequestObserved: true,
    personMediaSummaryValid: true,
  });
  assert.equal(Object.hasOwn(report, 'rawResponse'), false);
});

test('community source and OP-003 closures are evidence-bound and keep discussion scenarios unresolved', () => {
  const source = ledger.records.find(({ id }) => id === 'SOURCE-COMMUNITY-STRUCTURED-WEB');
  assert.ok(source, 'the community source frontier must remain in the canonical ledger');
  assert.equal(source.status, 'CLOSED_NO_SAFE_SOURCE');
  assert.ok(
    source.source_refs.includes(
      'docs/research/run95-community-public-source-contract-2026-10-13.md',
    ),
  );
  assert.ok(
    source.research_closure.evidence_refs.includes(
      'docs/research/run95-community-public-source-contract-2026-10-13.md',
    ),
  );
  assert.match(source.closure_reason, /current explicit allowlist/u);
  assert.match(source.reopen_when, /official public API/u);

  for (const id of ['G10', 'G11', 'G21']) {
    assert.equal(ledger.records.find(({ id: current }) => current === id)?.status, 'PARTIAL');
  }
  const opportunity = ledger.records.find(({ id }) => id === 'OP-003');
  assert.ok(opportunity, 'OP-003 must remain in the canonical ledger');
  assert.equal(opportunity.status, 'CLOSED_NO_SAFE_SOURCE');
  assert.ok(
    Date.parse(ledger.updated_at) >= Date.parse(opportunity.research_closure.completed_at),
    'the frontier ledger timestamp must include the latest OP-003 closure',
  );
  assert.ok(
    opportunity.source_refs.includes(
      'docs/research/run95-op003-community-source-contract-2026-10-15.md',
    ),
  );
  assert.ok(
    opportunity.research_closure.evidence_refs.includes(
      'docs/research/run95-op003-community-source-contract-2026-10-15.md',
    ),
  );
  assert.match(opportunity.closure_reason, /no verifiable public community source/u);
  assert.match(opportunity.reopen_when, /versioned public discussion API/u);
});

test('R05 terminal no-report profile remains unassessed and cannot be retried', () => {
  const record = ledger.records.find(({ id }) => id === 'R05');
  assert.ok(record, 'R05 must remain in the canonical frontier');
  assert.equal(record.status, 'UNASSESSED');
  assert.equal(
    record.evidence,
    undefined,
    'R05 has no accepted report evidence or capability credit',
  );

  const reportPath = 'docs/live-probes/r05-k-on-season-shared-person-agent-mcp-run95.json';
  assert.equal(
    existsSync(path.join(root, reportPath)),
    false,
    'the terminal claim wrote no report',
  );
  const dispositionPath = 'docs/research/run95-r05-profile-terminal-disposition-2026-10-15.md';
  assert.ok(record.source_refs.includes(dispositionPath));
  assert.ok(
    record.source_refs.includes(
      'docs/research/run95-r05-preflight-no-shared-voice-actor-2026-10-15.md',
    ),
  );
  assert.ok(
    record.source_refs.includes(
      'docs/research/run95-r05-k-on-season-shared-person-preflight-2026-10-15.json',
    ),
  );
  assert.match(record.next_action, /PR #170.*INCONCLUSIVE without a report/u);
  assert.match(record.next_action, /retryAllowed=false/u);
  assert.match(record.next_action, /PR #169's earlier no-claim preflight predates/u);
  assert.match(record.next_action, /missing report does not restore eligibility/u);
  assert.match(record.next_action, /Never rerun the consumed fixed R05 profile/u);
  assert.match(record.next_action, /another safe unspent frontier/u);
  assert.doesNotMatch(record.next_action, /No Agent\/MCP call or claim was made/u);

  const earlierPreflight = readFileSync(
    path.join(root, 'docs/research/run95-r05-preflight-no-shared-voice-actor-2026-10-15.md'),
    'utf8',
  );
  assert.match(earlierPreflight, /intersection of the two returned actor-ID sets was empty/u);
  assert.match(
    earlierPreflight,
    /No Agent\/MCP call was made, no claim or permanent latch was created/u,
  );
  assert.match(earlierPreflight, /not evidence that the two works have no connection/u);

  const disposition = readFileSync(path.join(root, dispositionPath), 'utf8');
  assert.match(disposition, /PR #170/u);
  assert.match(disposition, /run95-r05-k-on-season-shared-person-20261015/u);
  assert.match(disposition, /INCONCLUSIVE/u);
  assert.match(disposition, /reportWritten=false/u);
  assert.match(disposition, /retryAllowed=false/u);
  assert.match(disposition, /harness-r95-r05-subject-overlap-claimed/u);
  assert.match(disposition, /harness-r95-r05-subject-overlap-terminal/u);
  assert.doesNotMatch(disposition, /claimId|expectedArguments|runnerReceiptPublicKey|1424|3774/iu);
});

test('G15 merged corrective implementation does not credit or retry the failed answer read', () => {
  const record = ledger.records.find(({ id }) => id === 'G15');
  assert.ok(record, 'G15 must remain in the canonical frontier');
  assert.equal(record.status, 'PARTIAL');
  assert.equal(record.evidence, undefined, 'the failed answer read earns no new frontier credit');

  const reportPath = 'docs/research/run92-g15-subject-comparison-agent-candidate-c-2026-10-05.json';
  assert.ok(record.source_refs.includes(reportPath));
  const report = JSON.parse(readFileSync(path.join(root, reportPath), 'utf8'));
  assert.equal(report.frontierStatus, 'PARTIAL');
  assert.equal(report.passed, false);
  assert.equal(report.reviewDisposition.status, 'AGENT_ANSWER_VALIDATION_FAILED');
  assert.equal(report.reviewDisposition.expectedMetricRows, 4);
  assert.equal(report.reviewDisposition.metricRowsMatched, 3);
  assert.equal(report.reviewDisposition.mismatchedMetricRows, 1);
  assert.equal(report.reviewDisposition.rawAnswerOrMcpResultAvailableForReassessment, false);
  assert.equal(report.reviewDisposition.retryPerformed, false);
  assert.equal(report.reviewDisposition.additionalPublicCallPerformed, false);

  const dispositionPath =
    'docs/research/run95-g15-terminal-disposition-reconciliation-2026-10-15.md';
  assert.ok(record.source_refs.includes(dispositionPath));
  const disposition = readFileSync(path.join(root, dispositionPath), 'utf8');
  assert.match(disposition, /PR #94/u);
  assert.match(disposition, /4c0e08bd488484f4443aefbea36a4219ef1ad2f4/u);
  assert.match(disposition, /eccbe37e1878118f709a60863dbcebd6d0e0598f/u);
  assert.match(disposition, /37270020917.*seven required/u);
  assert.match(disposition, /three of four metric rows/u);
  assert.match(disposition, /Do not repeat either G15\s+Agent\/MCP read/u);

  assert.match(record.next_action, /PR #94.*MERGED/u);
  assert.match(record.next_action, /four implementation corrections are already integrated/u);
  assert.match(record.next_action, /Candidate C's single current-source read matched 3\/4/u);
  assert.match(record.next_action, /must never be retried/u);
  assert.match(record.next_action, /another safe unspent frontier/u);
  assert.doesNotMatch(record.next_action, /Candidate D.*must pass.*before integrating/iu);
});

test('G06 current-catalog cast probe is public-only, hash-bound, and does not imply complete coverage', () => {
  const record = ledger.records.find(({ id }) => id === 'G06');
  assert.ok(record, 'G06 must remain in the canonical frontier');
  assert.equal(record.status, 'PARTIAL');

  const reportPath = 'docs/live-probes/public-tools-2026-10-15-092632892-50913.json';
  assert.ok(record.source_refs.includes(reportPath));
  assert.match(record.next_action, /Never rerun the G06 profile/u);
  assert.match(record.next_action, /does not count as Agent\/MCP answer acceptance/u);
  assert.match(record.next_action, /do not claim a complete cast\/CV list/u);

  const evidence = record.evidence?.direct_public_get_subject_cast_current_catalog;
  assert.ok(evidence, 'G06 must point at the refreshed current-catalog report');
  const reportText = readFileSync(path.join(root, reportPath), 'utf8');
  const report = JSON.parse(reportText);
  assert.equal(evidence.report, reportPath);
  assert.equal(evidence.report_sha256, createHash('sha256').update(reportText).digest('hex'));
  assert.equal(evidence.catalog_sha256, report.catalogSha256);
  assert.equal(
    evidence.probe_script_sha256,
    createHash('sha256')
      .update(readFileSync(path.join(root, report.sourceProgram)))
      .digest('hex'),
  );
  assert.equal(report.probeCount, 1);
  assert.equal(report.httpRequests, 1);
  assert.deepEqual(report.selectedTools, ['bangumi.get_subject_cast']);
  assert.deepEqual(report.results[0].input, { subjectId: 41529, limit: 2 });
  assert.equal(report.results[0].assertions.passed, true);
  assert.deepEqual(Object.keys(report.results[0].result).sort(), [
    'castCount',
    'observed',
    'returned',
    'subjectId',
  ]);
  assert.match(evidence.acceptance_boundary, /does not add Agent\/MCP evidence/u);

  const table = readFileSync(path.join(root, 'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md'), 'utf8');
  assert.match(table, /公开 API 工具有逐项实测：65\/65；待补 0/u);
  assert.ok(
    table.includes(`\`bangumi.get_subject_cast\` | \`none\` | \`read\` | `) &&
      table.includes(reportPath),
    'the generated tool matrix must cite the current report for get_subject_cast',
  );
});

test('G09 current-catalog watch-order reports remain direct-public and hash-bound', () => {
  const record = ledger.records.find(({ id }) => id === 'G09');
  assert.ok(record, 'G09 must remain in the canonical frontier');
  assert.equal(record.status, 'PARTIAL');

  const reportPath = 'docs/live-probes/public-tools-2026-10-15-094954394-75684.json';
  assert.ok(record.source_refs.includes(reportPath));
  assert.match(record.next_action, /earlier Run #95 direct-public G09 reports.*stale catalog SHA/u);
  assert.match(record.next_action, /Keep G09 PARTIAL and never retry/u);

  const evidence = record.evidence?.direct_public_watch_order_current_catalog_2026_10_15;
  assert.ok(evidence, 'G09 must point at the refreshed current-catalog report');
  const reportText = readFileSync(path.join(root, reportPath), 'utf8');
  const report = JSON.parse(reportText);
  assert.equal(evidence.report, reportPath);
  assert.equal(evidence.report_sha256, createHash('sha256').update(reportText).digest('hex'));
  assert.equal(evidence.catalog_sha256, report.catalogSha256);
  assert.equal(
    evidence.probe_script_sha256,
    createHash('sha256')
      .update(readFileSync(path.join(root, report.sourceProgram)))
      .digest('hex'),
  );
  assert.equal(report.probeCount, 2);
  assert.equal(report.httpRequests, 4);
  assert.deepEqual(report.selectedTools, [
    'bangumi.get_series_watch_order',
    'bangumi.render_series_watch_order',
  ]);
  assert.deepEqual(
    report.results.map(({ tool, input, httpRequests, assertions }) => ({
      tool,
      input,
      httpRequests,
      passed: assertions.passed,
    })),
    [
      {
        tool: 'bangumi.get_series_watch_order',
        input: { subjectId: 41529, depth: 0, maxNodes: 1 },
        httpRequests: 2,
        passed: true,
      },
      {
        tool: 'bangumi.render_series_watch_order',
        input: { subjectId: 41529, depth: 0, maxNodes: 1 },
        httpRequests: 2,
        passed: true,
      },
    ],
  );
  assert.deepEqual(Object.keys(report.results[1].result), ['state', 'keys']);
  assert.match(evidence.acceptance_boundary, /does not add Agent\/MCP evidence/u);
  assert.match(evidence.acceptance_boundary, /establish complete graph coverage/u);

  const table = readFileSync(path.join(root, 'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md'), 'utf8');
  assert.match(table, /公开 API 工具有逐项实测：65\/65；待补 0/u);
  for (const tool of ['bangumi.get_series_watch_order', 'bangumi.render_series_watch_order']) {
    const row = table.split('\n').find((line) => line.includes(`\`${tool}\``));
    assert.ok(row?.includes(reportPath), `${tool} row must cite the current report`);
  }
});

test('A05 and D02 terminal one-shot dispositions remain unassessed and cannot be retried', () => {
  const dispositionPath =
    'docs/research/run95-a05-d02-terminal-disposition-reconciliation-2026-10-15.md';
  const cases = [
    {
      id: 'A05',
      noRetry: /one-shot claim is consumed and must never be retried/u,
      staleInvitation: /Use its existing one-tool Agent\/MCP runner|If the report is accepted/iu,
    },
    {
      id: 'D02',
      noRetry: /retryAllowed=false/u,
      staleInvitation:
        /Assess current capability coverage, bounded scope salvage, and direct evidence/u,
    },
  ];

  for (const item of cases) {
    const record = ledger.records.find(({ id }) => id === item.id);
    assert.ok(record, `${item.id} must remain in the canonical frontier`);
    assert.equal(record.status, 'UNASSESSED');
    assert.equal(record.evidence, undefined, `${item.id} must remain uncredited`);
    assert.ok(record.source_refs.includes(dispositionPath));
    assert.match(record.next_action, item.noRetry);
    assert.match(record.next_action, /another safe unspent frontier/u);
    assert.doesNotMatch(record.next_action, item.staleInvitation);
  }

  const note = readFileSync(path.join(root, dispositionPath), 'utf8');
  assert.match(note, /PR #146 merged at `9bf2db2b15d8508a7abff605dd10730edc2e12e8`/u);
  assert.match(note, /2026-10-13T00:59:31Z.*INCONCLUSIVE/u);
  assert.match(note, /b3bdea257b4a17d47198b9ee01f956211dcd34be4a09280d4674331d7cf8a566/u);
  assert.match(
    note,
    /Run #95 Issue #95's later budget-extension history at `2026-10-13T09:39:55Z`/u,
  );
  assert.match(note, /Closed PR #152's Harness control record/u);
  assert.match(note, /`INCONCLUSIVE`, `reportWritten=false`, and `retryAllowed=false`/u);
  assert.match(note, /frontier statuses and acceptance matrix are unchanged/u);
  assert.doesNotMatch(
    note,
    /claimId|claim-id|personId|A05_EXPECTED_QUERY_ARGUMENTS|expectedArguments/iu,
  );
});
