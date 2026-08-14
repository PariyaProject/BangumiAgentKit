import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  EPOCH_MARKER,
  MAX_EPOCH_REVIEWS,
  MAX_OUTER_REVIEWS,
  RUN_MARKER,
  HarnessInvariantError,
  afterPassBaseAction,
  applyReviewResult,
  assertCandidateInvariant,
  assertMergeReadiness,
  assertNoLegacyRuntimeChanges,
  assertProductCommitHygiene,
  assertRunCanStartEpoch,
  assertReviewReadiness,
  assertScopeClosure,
  beforeReviewBaseAction,
  completeMerge,
  createEpochState,
  createRunState,
  markReviewStarted,
  parseControlBlock,
  reconcileReviewReservation,
  recordIntegrationBlocked,
  renderEpochBody,
  renderRunBody,
  reserveReview,
  waitForSameReviewer,
} from '../../scripts/lib/agent-harness-core.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const sha = (digit) => digit.repeat(40);

function fixture() {
  const run = createRunState({ runId: 'run-test' });
  const epoch = createEpochState({
    epochId: 'epoch-test',
    baseSha: sha('a'),
    objective: 'Complete one coherent subject-intelligence journey',
    questions: ['Tell me everything important about this subject.'],
    workPackages: ['semantic composition', 'Agent response', 'Renderer report'],
    nonScope: ['personalization'],
    acceptanceCriteria: ['The full journey is correct and bounded.'],
  });
  epoch.branch = 'codex/epoch-epoch-test';
  epoch.pr_number = 42;
  epoch.candidate_sha = sha('b');
  epoch.ci = { sha: sha('b'), status: 'SUCCESS', url: 'https://example.test/ci' };
  epoch.scope_closure = {
    why_not_review_earlier:
      'The semantic, Agent, and Renderer Work Packages share one context and are now complete.',
    why_not_extend_further: 'Personalization is a separate user objective and product domain.',
    related_work_remaining: false,
  };
  epoch.adversarial_preflight = {
    completed: true,
    summary: 'Bounds, degraded states, evidence, contracts, and Renderer fixtures were falsified.',
  };
  epoch.state = 'REVIEW_READY';
  run.active_epoch_pr = 42;
  return { run, epoch };
}

function startReview(run, epoch, id) {
  const reserved = reserveReview(run, epoch);
  return markReviewStarted(reserved.run, reserved.epoch, id);
}

test('A. NORMAL PASS: engineering Candidate passes once, auto-merges, and adds no runtime commits', () => {
  const { run, epoch } = fixture();
  const engineeringCommits = [
    'feat(subject): compose intelligence',
    'test(subject): cover journey',
  ];
  assertReviewReadiness({
    epoch,
    changedPaths: ['packages/bangumi-core/src/subject.ts', 'tests/semantic/subject.test.ts'],
    branchHeadSha: sha('b'),
    prHeadSha: sha('b'),
    currentBaseSha: sha('a'),
  });
  const running = startReview(run, epoch, 'sol-1');
  const passed = applyReviewResult(running.run, running.epoch, { verdict: 'PASS' });
  assertMergeReadiness({
    epoch: passed.epoch,
    branchHeadSha: sha('b'),
    prHeadSha: sha('b'),
    currentBaseSha: sha('a'),
  });
  const merged = completeMerge(passed.run, passed.epoch, {
    mergeSha: sha('c'),
    candidateIsAncestor: true,
  });
  assert.equal(merged.epoch.state, 'MERGED');
  assert.equal(merged.run.active_epoch_pr, null);
  assert.deepEqual(engineeringCommits, [
    'feat(subject): compose intelligence',
    'test(subject): cover journey',
  ]);
});

test('B. CORRECTIVE PASS: one consolidated Luna corrective creates a new Candidate for Sol #2', () => {
  let { run, epoch } = fixture();
  ({ run, epoch } = startReview(run, epoch, 'sol-1'));
  ({ run, epoch } = applyReviewResult(run, epoch, {
    verdict: 'CORRECTIVE_REQUIRED',
    findings: [{ priority: 'P1', summary: 'Bound nested fan-out' }],
  }));
  assert.equal(epoch.state, 'CORRECTIVE_REQUIRED');
  epoch.candidate_sha = sha('d');
  epoch.ci = { sha: sha('d'), status: 'SUCCESS', url: 'https://example.test/ci-2' };
  epoch.state = 'REVIEW_READY';
  ({ run, epoch } = startReview(run, epoch, 'sol-2'));
  ({ run, epoch } = applyReviewResult(run, epoch, { verdict: 'PASS' }));
  assert.equal(epoch.review.consumed, 2);
  assert.equal(epoch.review_pass_sha, sha('d'));
  assertMergeReadiness({
    epoch,
    branchHeadSha: sha('d'),
    prHeadSha: sha('d'),
    currentBaseSha: sha('a'),
  });
});

test('C. POLLING: six timeouts cause zero durable writes, Git mutations, or launches', () => {
  let { run, epoch } = fixture();
  ({ run, epoch } = startReview(run, epoch, 'sol-1'));
  for (let count = 0; count < 6; count += 1) {
    const waited = waitForSameReviewer(run, epoch, 'sol-1');
    assert.equal(waited.run, run);
    assert.equal(waited.epoch, epoch);
    assert.equal(waited.durableWrite, false);
    assert.equal(waited.gitMutations, 0);
    assert.equal(waited.launches, 0);
  }
  assert.equal(epoch.review.consumed, 1);
  assert.equal(run.outer_sol.consumed, 1);
});

test('review reservation reconciliation closes a partial write conservatively', () => {
  const { run, epoch } = fixture();
  epoch.review.reserved = 1;
  const reconciled = reconcileReviewReservation(run, epoch, false);
  assert.equal(reconciled.run.outer_sol.reserved, 0);
  assert.equal(reconciled.epoch.review.reserved, 0);
  assert.equal(reconciled.run.outer_sol.consumed, 1);
  assert.equal(reconciled.epoch.review.consumed, 1);
});

test('D. REVIEW LIMIT: second blocking verdict parks the same PR/branch and trips circuit breaker', () => {
  let { run, epoch } = fixture();
  ({ run, epoch } = startReview(run, epoch, 'sol-1'));
  ({ run, epoch } = applyReviewResult(run, epoch, { verdict: 'CORRECTIVE_REQUIRED' }));
  epoch.candidate_sha = sha('d');
  epoch.ci = { sha: sha('d'), status: 'SUCCESS', url: null };
  epoch.state = 'REVIEW_READY';
  ({ run, epoch } = startReview(run, epoch, 'sol-2'));
  ({ run, epoch } = applyReviewResult(run, epoch, {
    verdict: 'CORRECTIVE_REQUIRED',
    findings: [{ priority: 'P1', summary: 'Still blocking' }],
  }));
  assert.equal(epoch.state, 'PARKED_REVIEW_LIMIT');
  assert.equal(epoch.pr_number, 42);
  assert.equal(epoch.branch, 'codex/epoch-epoch-test');
  assert.equal(run.state, 'QUALITY_CIRCUIT_BREAKER');
  assert.deepEqual(run.parked_epoch_prs, [42]);
});

test('E. BASE DRIFT BEFORE REVIEW: review is rejected until sync, validation, and new Candidate', () => {
  const action = beforeReviewBaseAction({
    recordedBaseSha: sha('a'),
    currentBaseSha: sha('c'),
  });
  assert.deepEqual(action, {
    ready: false,
    action: 'SYNCHRONIZE_VALIDATE_NEW_CANDIDATE',
    code: 'BASE_DRIFT_BEFORE_REVIEW',
  });
});

test('F. BASE DRIFT AFTER PASS: the old PASS cannot authorize the new integration combination', () => {
  const { run, epoch } = fixture();
  const action = afterPassBaseAction({
    reviewedBaseSha: sha('a'),
    currentBaseSha: sha('c'),
    epochReview: epoch.review,
    outerReview: run.outer_sol,
  });
  assert.equal(action.ready, false);
  assert.equal(action.code, 'PASS_INVALIDATED_BASE_DRIFT');
  assert.match(action.action, /NEW_CANDIDATE_AND_REVIEW/u);

  let running = startReview(run, epoch, 'sol-1');
  running = applyReviewResult(running.run, running.epoch, { verdict: 'PASS' });
  assert.throws(
    () =>
      assertMergeReadiness({
        epoch: running.epoch,
        branchHeadSha: sha('b'),
        prHeadSha: sha('b'),
        currentBaseSha: sha('c'),
      }),
    (error) =>
      error instanceof HarnessInvariantError && error.code === 'PASS_INVALIDATED_BASE_DRIFT',
  );
});

test('G. GITHUB UNAVAILABLE: CLI stops without a tracked-runtime fallback', () => {
  const cli = path.join(root, 'scripts/agent-harness.mjs');
  const result = spawnSync(process.execPath, [cli, 'status', '--run', '1'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PATH: '' },
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /^CONTROL_PLANE_UNAVAILABLE:/u);
  assert.doesNotMatch(result.stderr, /loop-status|cycles\/|reviews\//u);
});

test('H. MERGE PERMISSION FAILURE: integration is blocked and the same PR remains authoritative', () => {
  const { run, epoch } = fixture();
  const blocked = recordIntegrationBlocked(run, epoch, 'merge permission denied');
  assert.equal(blocked.epoch.state, 'INTEGRATION_BLOCKED');
  assert.equal(blocked.epoch.pr_number, 42);
  assert.equal(blocked.run.active_epoch_pr, 42);
  assert.equal(blocked.run.next_action, 'RESUME_PR_42');
});

test('I. FRESH-THREAD RESUME: GitHub bodies reconstruct exact run and Epoch truth', () => {
  const { run, epoch } = fixture();
  const reconstructedRun = parseControlBlock(renderRunBody(run), RUN_MARKER);
  const reconstructedEpoch = parseControlBlock(renderEpochBody(epoch), EPOCH_MARKER);
  assert.deepEqual(reconstructedRun, run);
  assert.deepEqual(reconstructedEpoch, epoch);
  assert.equal(reconstructedRun.active_epoch_pr, reconstructedEpoch.pr_number);
});

test('J. CANDIDATE INVARIANT: Candidate must equal branch HEAD and PR head', () => {
  assert.equal(
    assertCandidateInvariant({
      candidateSha: sha('b'),
      branchHeadSha: sha('b'),
      prHeadSha: sha('b'),
    }),
    true,
  );
  assert.throws(
    () =>
      assertCandidateInvariant({
        candidateSha: sha('b'),
        branchHeadSha: sha('c'),
        prHeadSha: sha('b'),
      }),
    (error) =>
      error instanceof HarnessInvariantError && error.code === 'CANDIDATE_INVARIANT_FAILED',
  );
});

test('K. MICRO-EPOCH PREVENTION: related high-value Work Packages keep Scope Closure open', () => {
  assert.throws(
    () =>
      assertScopeClosure({
        why_not_review_earlier: 'The first vertical slice runs.',
        why_not_extend_further: 'No evidence yet.',
        related_work_remaining: true,
      }),
    (error) => error instanceof HarnessInvariantError && error.code === 'MICRO_EPOCH_SCOPE_OPEN',
  );
});

test('L. COMMIT HYGIENE: runtime paths and runtime-only commit subjects are rejected', () => {
  assertNoLegacyRuntimeChanges([
    'packages/bangumi-core/src/subject.ts',
    'tests/semantic/subject.test.ts',
  ]);
  assertProductCommitHygiene([
    'feat(subject): compose intelligence',
    'fix(renderer): bound character rows',
  ]);
  assert.throws(
    () => assertNoLegacyRuntimeChanges(['docs/product/loop-status.md']),
    (error) =>
      error instanceof HarnessInvariantError && error.code === 'LEGACY_RUNTIME_PATH_CHANGED',
  );
  assert.throws(
    () => assertProductCommitHygiene(['docs: record candidate review readiness']),
    (error) =>
      error instanceof HarnessInvariantError && error.code === 'RUNTIME_ONLY_COMMIT_REJECTED',
  );
  for (const subject of ['docs: freeze Candidate', 'chore: park state', 'docs(agent): CI green']) {
    assert.throws(
      () => assertProductCommitHygiene([subject]),
      (error) =>
        error instanceof HarnessInvariantError && error.code === 'RUNTIME_ONLY_COMMIT_REJECTED',
    );
  }
});

test('hard review ceilings reject caller and control-block overrides', () => {
  assert.equal(MAX_EPOCH_REVIEWS, 2);
  assert.equal(MAX_OUTER_REVIEWS, 4);
  assert.throws(
    () => createRunState({ runId: 'over-budget', outerSolMax: 5 }),
    (error) => error instanceof HarnessInvariantError && error.code === 'INVALID_REVIEW_LEDGER',
  );
  assert.throws(
    () =>
      createEpochState({
        epochId: 'over-budget',
        baseSha: sha('a'),
        objective: 'Invalid budget',
        maxReviews: 3,
      }),
    (error) => error instanceof HarnessInvariantError && error.code === 'INVALID_REVIEW_LEDGER',
  );
  const { run, epoch } = fixture();
  run.outer_sol.max = 99;
  epoch.review.max = 99;
  assert.throws(
    () => reserveReview(run, epoch),
    (error) => error instanceof HarnessInvariantError && error.code === 'INVALID_REVIEW_LEDGER',
  );
  run.outer_sol.reserved = 1;
  epoch.review.reserved = 1;
  assert.throws(
    () => markReviewStarted(run, epoch, 'forbidden-reviewer'),
    (error) => error instanceof HarnessInvariantError && error.code === 'INVALID_REVIEW_LEDGER',
  );
  assert.throws(
    () => reconcileReviewReservation(run, epoch, false),
    (error) => error instanceof HarnessInvariantError && error.code === 'INVALID_REVIEW_LEDGER',
  );
});

test('terminal and circuit-breaker runs cannot start another Epoch', () => {
  for (const state of ['QUALITY_CIRCUIT_BREAKER', 'STOPPED', 'INTEGRATION_BLOCKED']) {
    const run = createRunState({ runId: `run-${state}` });
    run.state = state;
    assert.throws(
      () => assertRunCanStartEpoch(run),
      (error) => error instanceof HarnessInvariantError && error.code === 'RUN_NOT_ACTIVE',
    );
  }
  assert.equal(assertRunCanStartEpoch(createRunState({ runId: 'active' })), true);
});
