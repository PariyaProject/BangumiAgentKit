import assert from 'node:assert/strict';
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

test('P05 remains unassessed until its gated one-read report exists', () => {
  const record = ledger.records.find(({ id }) => id === 'P05');
  assert.ok(record, 'P05 must remain in the canonical frontier');
  assert.equal(record.status, 'UNASSESSED');
  assert.ok(
    record.source_refs.includes(
      'docs/research/run95-p05-person-work-media-distribution-source-contract-2026-10-15.md',
    ),
  );
  assert.ok(
    record.source_refs.includes('scripts/acceptance/run-p05-person-media-public-probe.ts'),
  );
  assert.ok(record.source_refs.includes('scripts/lib/p05-one-shot-claim.mjs'));
  assert.ok(record.source_refs.includes('tests/harness/agent-harness-cli.test.mjs'));

  const evidence = record.evidence?.p05_person_media_distribution_2026_10_15;
  assert.ok(evidence, 'P05 source and runner evidence must be recorded');
  assert.equal(evidence.planned_public_profile.tool, 'bangumi.get_person_profile');
  assert.deepEqual(evidence.planned_public_profile.arguments, {
    personId: 3474,
    includeCredits: false,
    maxSubjects: 500,
    maxCharacters: 1,
  });
  assert.equal(evidence.planned_public_profile.live_query_run, false);
  assert.match(evidence.runner_contract.repository_global_claim, /repository-scoped create-only GitHub label/u);
  assert.match(evidence.runner_contract.repository_global_claim, /active-PR claim.*read back/u);
  assert.equal(
    evidence.official_source_contract.pagination_total_order_or_completeness_documented,
    false,
  );
  assert.match(evidence.official_source_contract.claim_limit, /returned relation rows only/u);
  assert.match(record.next_action, /assigned same-identity GPT-6 Luna Max PASS/u);
  assert.match(record.next_action, /does not support platform or exhaustive career-wide distribution/u);
  assert.equal(
    existsSync(path.join(root, 'docs/live-probes/p05-person-media-public-probe-run95.json')),
    false,
    'an unassessed P05 frontier must not have a live report',
  );
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
