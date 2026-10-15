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

function assertOneShotRuntimeIsHarnessOwned(record) {
  const guidance = [record.next_action, record.evidence?.source_contract]
    .filter(Boolean)
    .join(' ');
  assert.match(guidance, /active Harness Run\/Epoch/u);
  assert.match(guidance, /never retry a consumed claim/u);
  assert.doesNotMatch(
    guidance,
    /\bRun #95\b|\bPR #\d+\b|retryAllowed\s*=|INCONCLUSIVE|Candidate [0-9a-f]{7,}/iu,
  );
}

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

test('G04 frontier keeps stable query policy without Run 95 attempt state', () => {
  const record = ledger.records.find(({ id }) => id === 'G04');
  assert.ok(record, 'G04 must remain in the canonical frontier');
  const serialized = JSON.stringify(record);
  assert.doesNotMatch(serialized, /NOT_ATTEMPTED|claim_state|acceptance_count_advanced/u);
  assert.match(record.next_action, /assigned same-identity Luna Max PASS/u);
});

test('G16 frontier keeps stable source guidance separate from Harness runtime state', () => {
  const record = ledger.records.find(({ id }) => id === 'G16');
  assert.ok(record, 'G16 must remain in the canonical frontier');
  assert.match(record.next_action, /PARTIAL/u);
  assert.match(record.next_action, /complete director filmography/u);
  assert.match(record.evidence.source_contract, /exact normalized director-label allow-list/u);
  assertOneShotRuntimeIsHarnessOwned(record);
});

test('R01 frontier keeps source limits separate from Harness runtime state', () => {
  const record = ledger.records.find(({ id }) => id === 'R01');
  assert.ok(record, 'R01 must remain in the canonical frontier');
  assert.equal(record.status, 'PARTIAL');
  assert.match(record.next_action, /reverse\/transitive edges/u);
  assert.match(record.next_action, /official viewing order/u);
  assertOneShotRuntimeIsHarnessOwned(record);
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
  assert.ok(
    record.source_refs.includes('scripts/acceptance/run-p05-person-media-public-probe.ts'),
  );
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
  assert.match(evidence.runner_contract.repository_global_claim, /repository-scoped create-only GitHub label/u);
  assert.match(evidence.runner_contract.repository_global_claim, /active-PR claim.*read back/u);
  assert.equal(
    evidence.official_source_contract.pagination_total_order_or_completeness_documented,
    false,
  );
  assert.match(evidence.official_source_contract.claim_limit, /returned relation rows only/u);
  assert.match(record.next_action, /same-identity GPT-6 Luna Max review/u);
  assert.match(record.next_action, /does not support platform or exhaustive career-wide distribution/u);
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
  assert.equal(record.evidence, undefined, 'R05 has no accepted report evidence or capability credit');

  const reportPath = 'docs/live-probes/r05-k-on-season-shared-person-agent-mcp-run95.json';
  assert.equal(existsSync(path.join(root, reportPath)), false, 'the terminal claim wrote no report');
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

  const dispositionPath = 'docs/research/run95-g15-terminal-disposition-reconciliation-2026-10-15.md';
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
  assert.match(table, /公开 API 工具有逐项实测：58\/65；待补 7/u);
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
  assert.match(table, /公开 API 工具有逐项实测：58\/65；待补 7/u);
  for (const tool of ['bangumi.get_series_watch_order', 'bangumi.render_series_watch_order']) {
    const row = table.split('\n').find((line) => line.includes(`\`${tool}\``));
    assert.ok(row?.includes(reportPath), `${tool} row must cite the current report`);
  }
});
