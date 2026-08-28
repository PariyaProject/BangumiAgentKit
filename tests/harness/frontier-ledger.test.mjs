import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalHash,
  inspectFrontierClosure,
  inspectFrontierLedger,
} from '../../scripts/lib/frontier-ledger.mjs';

const sha = (digit) => digit.repeat(40);
const policyVersion = 'harness-v3.2-frontier-closure-v1';

function record(overrides = {}) {
  return {
    id: 'OP-004',
    kind: 'opportunity',
    user_question: 'Can a bounded collaboration result answer a concrete user question?',
    lane: 'recorded_product_opportunities',
    status: 'CLOSED_LOW_VALUE',
    source_refs: ['docs/product/opportunity-log.md'],
    next_action: 'Monitor the explicit reopen condition.',
    reopen_when: 'Source coverage or user value changes materially.',
    related_ids: [],
    closure_reason: 'Scope salvage found no independent incremental value at this policy version.',
    ...overrides,
  };
}

function ledger(records = [record()], protectedBoundaries = []) {
  return {
    schema: 'bangumi-frontier/v1',
    version: 1,
    policy_version: policyVersion,
    protected_boundaries: protectedBoundaries,
    records,
  };
}

function evidenceFor(value) {
  const inspected = inspectFrontierLedger(value);
  return {
    policy_version: policyVersion,
    audited_sha: sha('a'),
    audited_at: '2026-08-28T00:00:00.000Z',
    ledger_hash: inspected.hash,
    assessed_frontier_ids: value.records.map(({ id }) => id),
    frontier_inventory: inspected.counts,
    frontier_assessments: value.records.map((item) => ({
      id: item.id,
      status: item.status,
      conclusion:
        item.closure_reason ?? 'The directly named capability and test references prove delivery.',
      delta_since_previous_audit:
        'This assessment binds the current repository evidence and canonical ledger version.',
      evidence_refs: item.source_refs,
    })),
  };
}

test('an actionable or unassessed record mechanically prevents trusted exhaustion', () => {
  const value = ledger([record({ status: 'UNASSESSED', closure_reason: undefined })]);
  const result = inspectFrontierClosure({
    ledger: value,
    evidence: evidenceFor(value),
    currentBaseSha: sha('a'),
    policyVersion,
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some(({ code }) => code === 'FRONTIER_ACTIONABLE_REMAINS'));
});

test('DELIVERED requires real capability and test references', () => {
  const value = ledger([
    record({
      status: 'DELIVERED',
      closure_reason: 'Claimed delivery without test evidence.',
      evidence: { capabilities: ['imaginary_tool'], tests: [] },
    }),
  ]);
  const result = inspectFrontierLedger(value, { knownCapabilities: ['bangumi.real_tool'] });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some(({ code }) => code === 'FRONTIER_REFERENCE_REQUIRED'));
  assert.ok(result.issues.some(({ code }) => code === 'FRONTIER_DELIVERED_CAPABILITY_UNKNOWN'));
});

test('a nonexistent Charter boundary, including the Harness automation rule, cannot close product work', () => {
  const value = ledger([
    record({
      status: 'PROTECTED_BOUNDARY',
      boundary_id: 'PB-HARNESS-NO-AUTOMATION',
      closure_reason: 'Incorrectly treated Harness scheduling as a product boundary.',
    }),
  ]);
  const result = inspectFrontierLedger(value);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some(({ code }) => code === 'FRONTIER_BOUNDARY_UNKNOWN'));
});

test('research or Issue assessment status contradicting the ledger fails closure', () => {
  const value = ledger();
  const evidence = evidenceFor(value);
  evidence.frontier_assessments[0].status = 'RESEARCH_READY';
  const result = inspectFrontierClosure({
    ledger: value,
    evidence,
    currentBaseSha: sha('a'),
    policyVersion,
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some(({ code }) => code === 'FRONTIER_STATUS_CONTRADICTION'));
});

test('frontier templates that differ only by record id cannot prove closure', () => {
  const value = ledger([
    record(),
    record({
      id: 'OP-003',
      user_question: 'Can a narrow public community source support one bounded claim?',
    }),
  ]);
  const evidence = evidenceFor(value);
  for (const assessment of evidence.frontier_assessments) {
    assessment.conclusion = `${assessment.id}: generic closure conclusion with no record-specific evidence.`;
    assessment.delta_since_previous_audit = `${assessment.id}: generic cross-audit delta with no substantive change.`;
  }
  const result = inspectFrontierClosure({
    ledger: value,
    evidence,
    currentBaseSha: sha('a'),
    policyVersion,
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some(({ code }) => code === 'FRONTIER_ASSESSMENT_GENERIC'));
});

test('scenario questions cannot drift from the canonical source catalog', () => {
  const value = ledger();
  const result = inspectFrontierLedger(value, {
    expectedQuestions: { 'OP-004': 'A different canonical user question.' },
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some(({ code }) => code === 'FRONTIER_QUESTION_MISMATCH'));
});

test('a ledger policy-version change invalidates the previous frontier contract', () => {
  const result = inspectFrontierLedger(ledger(), {
    expectedPolicyVersion: `${policyVersion}-new`,
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some(({ code }) => code === 'FRONTIER_POLICY_STALE'));
});

test('master, policy, ledger, and evidence hashes are exact closure inputs', () => {
  const value = ledger();
  const evidence = evidenceFor(value);
  const pass = inspectFrontierClosure({
    ledger: value,
    evidence,
    currentBaseSha: sha('a'),
    policyVersion,
  });
  assert.equal(pass.ok, true, JSON.stringify(pass.issues));
  assert.equal(pass.evidence_hash, canonicalHash(evidence));

  const changed = structuredClone(value);
  changed.records[0].next_action =
    'A materially different next action invalidates the old closure hash.';
  const stale = inspectFrontierClosure({
    ledger: changed,
    evidence,
    currentBaseSha: sha('b'),
    policyVersion: `${policyVersion}-changed`,
  });
  assert.equal(stale.ok, false);
  for (const code of [
    'DISCOVERY_POLICY_STALE',
    'DISCOVERY_EVIDENCE_STALE',
    'FRONTIER_LEDGER_HASH_MISMATCH',
  ]) {
    assert.ok(
      stale.issues.some((item) => item.code === code),
      code,
    );
  }
});
