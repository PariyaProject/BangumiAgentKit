import assert from 'node:assert/strict';
import test from 'node:test';
import { planLegacyTerminalRecovery } from '../../scripts/lib/harness-terminal-recovery.mjs';
import { assertRunCanStartEpoch } from '../../scripts/lib/agent-harness-core.mjs';
import { terminalRecoveryFixture } from './fixtures/terminal-recovery.mjs';

const ineligible = (call) => assert.throws(call, { code: 'TERMINAL_RECOVERY_INELIGIBLE' });
test('legacy technical recovery clears stale authority while preserving claim/history/budgets exactly', () => {
  const { run, epoch, proof, claim } = terminalRecoveryFixture();
  const before = JSON.stringify({ run, epoch });
  const plan = planLegacyTerminalRecovery(run, epoch, proof);
  assert.equal(plan.state, 'TERMINAL_RECOVERY_PLAN_VALID');
  assert.equal(plan.pendingRun.state, 'TERMINAL_RECOVERY_PENDING');
  assert.throws(() => assertRunCanStartEpoch(plan.pendingRun), { code: 'RUN_NOT_ACTIVE' });
  assert.equal(plan.preparedEpoch.state, 'CORRECTIVE_REQUIRED');
  assert.equal(plan.preparedEpoch.candidate_sha, null);
  assert.equal(plan.preparedEpoch.review_pass_sha, null);
  assert.equal(plan.preparedEpoch.ci.status, 'NOT_RUN');
  assert.equal(plan.preparedEpoch.adversarial_preflight.completed, false);
  assert.equal(plan.preparedEpoch.scope_closure.related_work_remaining, true);
  assert.equal(
    JSON.stringify(
      plan.preparedEpoch.adversarial_preflight.agent_mcp_profile_dispositions[claim.profileId],
    ),
    JSON.stringify(claim),
  );
  assert.deepEqual(plan.preparedEpoch.review, epoch.review);
  assert.deepEqual(plan.preparedEpoch.review_history, epoch.review_history);
  assert.deepEqual(plan.completedRun.outer_sol, run.outer_sol);
  assert.equal(plan.completedRun.active_epoch_pr, 267);
  assert.deepEqual(plan.completedRun.parked_epoch_prs, []);
  assert.match(plan.preparedEpoch.acceptance_criteria.at(-1), /no matrix\/scenario credit/);
  assert.equal(JSON.stringify({ run, epoch }), before);
});

test('three-plane recovery resumes after either interrupted write and is idempotent after completion', () => {
  const { run, epoch, proof } = terminalRecoveryFixture();
  const first = planLegacyTerminalRecovery(run, epoch, proof);
  const afterRunIntent = planLegacyTerminalRecovery(first.pendingRun, epoch, proof);
  assert.equal(afterRunIntent.intent_id, first.intent_id);
  assert.deepEqual(afterRunIntent.preparedEpoch, first.preparedEpoch);
  const afterEpochWrite = planLegacyTerminalRecovery(first.pendingRun, first.preparedEpoch, proof);
  assert.deepEqual(afterEpochWrite.completedRun, first.completedRun);
  assert.deepEqual(planLegacyTerminalRecovery(first.completedRun, first.preparedEpoch, proof), {
    state: 'TERMINAL_RECOVERY_ALREADY_RESUMED',
    intent_id: first.intent_id,
  });
});

test('actual Human cases, another active/pending Epoch, reservations and malformed state remain closed', () => {
  const cases = [
    (f) => {
      f.run.active_epoch_pr = 274;
    },
    (f) => {
      f.run.pending_epoch = {};
    },
    (f) => {
      f.run.outer_sol.product.reserved = 1;
      f.run.outer_sol.reserved = 1;
    },
    (f) => {
      f.epoch.review.reviewer_id = 'running';
    },
    (f) => {
      f.epoch.review.runtime.state = 'ACTIVE';
    },
    (f) => {
      f.epoch.next_action = 'A human must decide protected authentication changes.';
    },
    (f) => {
      f.epoch.review_history[0].verdict = 'HUMAN_REVIEW_REQUIRED';
    },
    (f) => {
      f.epoch.findings = [{ id: 'protected', priority: 'P1' }];
    },
    (f) => {
      f.epoch.epoch_id = 'some-other-human-park';
    },
    (f) => {
      f.epoch.review_history = {};
    },
    (f) => {
      f.epoch.next_action = {};
    },
    (f) => {
      f.epoch.review.consumed = -1;
    },
    (f) => {
      f.run.outer_sol.consumed = 0;
    },
  ];
  for (const change of cases) {
    const f = terminalRecoveryFixture();
    change(f);
    ineligible(() => planLegacyTerminalRecovery(f.run, f.epoch, f.proof));
  }
});

test('live source CI, ancestry, latches, report absence and registry bindings are mandatory', () => {
  const cases = [
    (f) => {
      f.proof.reportExists = true;
    },
    (f) => {
      f.proof.labels = [];
    },
    (f) => {
      f.proof.sourceCi.sha = '0'.repeat(40);
    },
    (f) => {
      f.proof.sourceCi.checks = [];
    },
    (f) => {
      f.proof.sourceCi.runId = '9999';
    },
    (f) => {
      f.proof.headIncludesSource = false;
    },
    (f) => {
      f.proof.headIncludesParkedHead = false;
    },
    (f) => {
      f.proof.sourceIncludesBase = false;
    },
    (f) => {
      f.proof.pr.headRefName = 'replacement';
    },
    (f) => {
      f.proof.pr.state = 'CLOSED';
    },
    (f) => {
      f.claim.reportWritten = true;
    },
    (f) => {
      f.claim.retryAllowed = true;
    },
    (f) => {
      f.claim.reportPath = 'orphan.json';
    },
    (f) => {
      f.claim.registrySha256 = '0'.repeat(64);
    },
    (f) => {
      f.claim.runnerReceiptPublicKeySha256 = '0'.repeat(64);
    },
    (f) => {
      f.claim.reviewerId = 'different opaque identity';
    },
  ];
  for (const change of cases) {
    const f = terminalRecoveryFixture();
    change(f);
    ineligible(() => planLegacyTerminalRecovery(f.run, f.epoch, f.proof));
  }
});

test('pending or prepared recovery refuses changed immutable inputs rather than resetting them', () => {
  const f = terminalRecoveryFixture();
  const plan = planLegacyTerminalRecovery(f.run, f.epoch, f.proof);
  f.claim.finishedAt = '2026-10-24T00:00:00Z';
  ineligible(() => planLegacyTerminalRecovery(plan.pendingRun, f.epoch, f.proof));
  const prepared = structuredClone(plan.preparedEpoch);
  prepared.adversarial_preflight.agent_mcp_profile_dispositions[f.claim.profileId].finishedAt =
    f.claim.finishedAt;
  ineligible(() => planLegacyTerminalRecovery(plan.pendingRun, prepared, f.proof));
});

test('a partial recovery refuses altered prepared scope or intent rather than inheriting new authority', () => {
  const f = terminalRecoveryFixture();
  const plan = planLegacyTerminalRecovery(f.run, f.epoch, f.proof);
  const changed = structuredClone(plan.preparedEpoch);
  changed.acceptance_criteria.push('Grant credit without a report.');
  ineligible(() => planLegacyTerminalRecovery(plan.pendingRun, changed, f.proof));
  const wrongIntent = structuredClone(plan.pendingRun);
  wrongIntent.pending_terminal_recovery.kind = 'OTHER';
  ineligible(() => planLegacyTerminalRecovery(wrongIntent, f.epoch, f.proof));
});
