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

test('R05 failed pair preflight stays unassessed without a negative-connectivity claim', () => {
  const record = ledger.records.find(({ id }) => id === 'R05');
  assert.ok(record, 'R05 must remain in the canonical frontier');
  assert.equal(record.status, 'UNASSESSED');
  assert.ok(
    record.source_refs.includes(
      'docs/research/run95-r05-preflight-no-shared-voice-actor-2026-10-15.md',
    ),
  );
  assert.match(record.next_action, /No Agent\/MCP call or claim was made/u);
  assert.match(record.next_action, /not a negative connectivity finding/u);
  assert.match(
    record.next_action,
    /different pair with a preverified positive shared stable person ID/u,
  );

  const report = readFileSync(
    path.join(root, 'docs/research/run95-r05-preflight-no-shared-voice-actor-2026-10-15.md'),
    'utf8',
  );
  assert.match(report, /intersection of the two returned actor-ID sets was empty/u);
  assert.match(
    report,
    /No Agent\/MCP call was made, no claim or permanent latch was created/u,
  );
  assert.match(report, /not evidence that the two works have no connection/u);
});
