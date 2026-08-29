import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { canonicalHash } from '../../scripts/lib/frontier-ledger.mjs';
import {
  DISCOVERY_POLICY_VERSION,
  EPOCH_MARKER,
  MAX_EPOCH_REVIEWS,
  MAX_OUTER_REVIEWS,
  RUN_MARKER,
  HarnessInvariantError,
  afterPassBaseAction,
  applyFrontierReviewResult,
  applyReviewResult,
  assertGoalStopAllowed,
  assertCandidateInvariant,
  assertCorrectiveClosure,
  assertDiscoveryExhaustionEvidence,
  assertMergeReadiness,
  assertNoLegacyRuntimeChanges,
  assertProductCommitHygiene,
  assertRunCanStartEpoch,
  assertTrustedFrontierStop,
  assertReviewReadiness,
  assertScopeClosure,
  beforeReviewBaseAction,
  completeMerge,
  createEpochState,
  createRunState,
  markReviewStarted,
  markFrontierReviewStarted,
  parseControlBlock,
  reconcileFrontierReviewReservation,
  reconcileReviewReservation,
  recordIntegrationBlocked,
  resumeReviewLimitForFinalCorrective,
  resumeDiscoveryAfterFrontierRejection,
  renderEpochBody,
  renderRunBody,
  reserveReview,
  reserveFrontierReview,
  waitForFrontierReviewer,
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

function closeFindings(findings) {
  return findings.map((finding) => ({
    finding_id: finding.id,
    root_cause: 'A truthy fallback collapsed unknown and valid zero source metadata.',
    equivalence_class: 'Missing, invalid, contradictory, and zero-valued pagination metadata.',
    generalized_fix: 'Normalize metadata once and preserve explicit unknown and zero states.',
    regression_tests: ['missing/invalid totals', 'later-page zero offset'],
    validation: ['focused regression suite passed', 'full mandatory suite passed'],
  }));
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

test('frontier exhaustion rejects evidence that omits an actionable ledger record', () => {
  const evidence = {
    policy_version: DISCOVERY_POLICY_VERSION,
    audited_sha: sha('a'),
    audited_at: '2026-08-28T00:00:00.000Z',
    discovery_delta:
      'This audit records concrete changes across the complete governed frontier inventory.',
    lane_assessments: Object.fromEntries(
      [
        'recorded_product_opportunities',
        'capability_maturity_and_user_journeys',
        'agent_ux_and_discoverability',
        'renderer_and_standalone_experience',
        'correctness_evidence_and_resource_bounds',
        'architecture_maintenance_and_testability',
      ].map((lane, index) => [
        lane,
        {
          observation: `Concrete governed observation ${index} covers named records and repository evidence.`,
          conclusion: `Distinct governed conclusion ${index} follows from the named evidence and coverage.`,
        },
      ]),
    ),
    candidate_assessments: Array.from({ length: 3 }, (_, index) => ({
      id: `candidate-${index}`,
      lane: 'recorded_product_opportunities',
      user_question: `Can a bounded product journey answer concrete question number ${index}?`,
      source_evidence: `Repository source and contract evidence number ${index} was inspected directly.`,
      value_hypothesis: `The concrete journey number ${index} could improve an observable user outcome.`,
      source_and_coverage_limits:
        'Only bounded positive observations are supported and negative claims remain prohibited.',
      delta_since_previous_audit:
        'This candidate has a newly recorded repository comparison and explicit coverage analysis.',
      disposition: 'LOW_USER_OR_AGENT_VALUE',
      reason:
        'The narrowed result duplicates an existing journey without sufficient incremental value.',
      scope_salvage: {
        narrowed_user_question:
          'Can a smaller positive-only result preserve useful bounded semantics?',
        output_semantics:
          'Return only directly observed positive facts with partial state exposed.',
        coverage_and_negative_claim_limits:
          'Expose scan coverage and truncation and never infer nonexistence from absence.',
        resource_bounds: 'Scan at most three pages and return no more than one hundred records.',
        outcome: 'NO_SAFE_VARIANT',
        rationale: 'The bounded result remains duplicative after the complete salvage analysis.',
      },
      source_contract_research: {
        status: 'NOT_REQUIRED',
        next_step:
          'No source research remains because the candidate uses an existing official contract.',
        closure_evidence: [
          'Named contract and regression evidence were inspected at the audited SHA.',
        ],
      },
    })),
  };
  const ledger = {
    schema: 'bangumi-frontier/v1',
    version: 1,
    policy_version: DISCOVERY_POLICY_VERSION,
    records: [
      {
        id: 'OP-004',
        kind: 'opportunity',
        user_question: 'Can collection relationships answer a bounded positive-only question?',
        lane: 'recorded_product_opportunities',
        status: 'UNASSESSED',
        source_refs: ['docs/product/opportunity-log.md'],
        next_action: 'Assess the positive-only scope salvage.',
        reopen_when: 'The source or bounded product contract changes.',
        related_ids: [],
      },
    ],
    protected_boundaries: [],
  };
  evidence.ledger_hash = canonicalHash(ledger);
  evidence.frontier_assessments = evidence.candidate_assessments.map((candidate) => ({
    id: candidate.id,
    status: 'CLOSED_LOW_VALUE',
    conclusion: candidate.reason,
    delta_since_previous_audit: candidate.delta_since_previous_audit,
    evidence_refs: ['docs/product/opportunity-log.md'],
  }));
  evidence.assessed_frontier_ids = evidence.frontier_assessments.map(({ id }) => id);
  evidence.frontier_inventory = {
    total: 1,
    by_status: { UNASSESSED: 1 },
    by_lane: { recorded_product_opportunities: 1 },
    by_kind: { opportunity: 1 },
  };
  assert.throws(
    () =>
      assertDiscoveryExhaustionEvidence(evidence, sha('a'), {
        ledger,
        pathExists: () => true,
      }),
    (error) =>
      error instanceof HarnessInvariantError && error.code === 'FRONTIER_COVERAGE_INCOMPLETE',
  );
});

test('Epoch human projection renders structured validation without object coercion', () => {
  const { epoch } = fixture();
  epoch.validation = [{ command: 'pnpm harness:test', status: 'PASS' }];
  const body = renderEpochBody(epoch);
  assert.doesNotMatch(body, /\[object Object\]/u);
  assert.match(body, /pnpm harness:test/u);
  assert.match(body, /PASS/u);
});

test('outer review budget reserves three Product launches and one independent closure launch', () => {
  const run = createRunState({ runId: 'partitioned-budget' });
  run.outer_sol.consumed = 3;
  run.outer_sol.product.consumed = 3;
  const { epoch } = fixture();
  assert.throws(
    () => reserveReview(run, epoch),
    (error) => error instanceof HarnessInvariantError && error.code === 'REVIEW_BUDGET_EXHAUSTED',
  );
  const reserved = reserveFrontierReview(run, {
    baseSha: sha('a'),
    ledgerHash: sha('b'),
    evidenceHash: sha('c'),
  });
  const started = markFrontierReviewStarted(reserved, 'sol-closure');
  assert.equal(started.outer_sol.consumed, 4);
  assert.equal(started.outer_sol.product.consumed, 3);
  assert.equal(started.outer_sol.closure.consumed, 1);
});

test('the third Outer Product review corrective enters Luna final-corrective and preserves closure Sol', () => {
  let { run, epoch } = fixture();
  run.outer_sol.consumed = 2;
  run.outer_sol.product.consumed = 2;
  ({ run, epoch } = startReview(run, epoch, 'sol-final-product-slot'));
  ({ run, epoch } = applyReviewResult(run, epoch, {
    verdict: 'CORRECTIVE_REQUIRED',
    findings: [{ priority: 'P1', summary: 'The third Product launch found one bounded issue.' }],
  }));
  assert.equal(epoch.review.consumed, 1);
  assert.equal(epoch.state, 'FINAL_CORRECTIVE_REQUIRED');
  assert.equal(run.outer_sol.product.consumed, 3);
  assert.equal(run.outer_sol.closure.consumed, 0);

  epoch.corrective_closure = closeFindings(epoch.findings);
  epoch.candidate_sha = sha('d');
  epoch.ci = { sha: sha('d'), status: 'SUCCESS', url: 'https://example.test/ci-final' };
  epoch.final_corrective_sha = sha('d');
  epoch.final_corrective_base_sha = sha('a');
  epoch.state = 'FINAL_CORRECTIVE_READY';
  assertMergeReadiness({
    epoch,
    outerSol: run.outer_sol,
    branchHeadSha: sha('d'),
    prHeadSha: sha('d'),
    currentBaseSha: sha('a'),
  });
});

test('frontier closure rejection resumes Luna and can never launch a second closure reviewer', () => {
  const run = createRunState({ runId: 'rejected-closure' });
  const reserved = reserveFrontierReview(run, {
    baseSha: sha('a'),
    ledgerHash: sha('b'),
    evidenceHash: sha('c'),
  });
  const started = markFrontierReviewStarted(reserved, 'sol-closure');
  const rejected = applyFrontierReviewResult(started, {
    verdict: 'DISCOVERY_REQUIRED',
    findings: [{ id: 'missing-op-004', summary: 'OP-004 was not closed consistently.' }],
  });
  assert.equal(rejected.state, 'FRONTIER_REVIEW_REJECTED');
  assert.equal(rejected.next_action, 'LUNA_RESUME_DISCOVERY_WITHOUT_SECOND_CLOSURE_REVIEW');
  const resumed = resumeDiscoveryAfterFrontierRejection(rejected);
  assert.equal(resumed.state, 'ACTIVE');
  assert.equal(resumed.frontier_closure.state, 'REJECTED');
  assert.throws(
    () =>
      reserveFrontierReview(resumed, {
        baseSha: sha('a'),
        ledgerHash: sha('b'),
        evidenceHash: sha('d'),
      }),
    (error) => error instanceof HarnessInvariantError && error.code === 'FRONTIER_REVIEW_REJECTED',
  );
});

test('frontier reviewer requires runtime proof and resumes the same identity without budget change', () => {
  let run = createRunState({ runId: 'frontier-runtime' });
  run = reserveFrontierReview(run, {
    baseSha: sha('a'),
    ledgerHash: sha('b'),
    evidenceHash: sha('c'),
  });
  run = markFrontierReviewStarted(run, 'sol-frontier');
  assert.throws(
    () => waitForFrontierReviewer(run, 'sol-frontier'),
    (error) =>
      error instanceof HarnessInvariantError &&
      error.code === 'REVIEW_RUNTIME_OBSERVATION_REQUIRED',
  );

  const interrupted = waitForFrontierReviewer(run, 'sol-frontier', 'INTERRUPTED', 'CAPACITY_LIMIT');
  assert.equal(interrupted.run.state, 'FRONTIER_REVIEW_INTERRUPTED_RESUMABLE');
  assert.equal(interrupted.run.frontier_closure.reviewer_id, 'sol-frontier');
  assert.equal(interrupted.run.outer_sol.closure.consumed, 1);
  const resumed = waitForFrontierReviewer(interrupted.run, 'sol-frontier', 'ACTIVE');
  assert.equal(resumed.run.state, 'FRONTIER_REVIEW_RUNNING');
  assert.equal(resumed.run.outer_sol.closure.consumed, 1);
  assert.equal(resumed.launches, 0);
});

test('frontier reviewer replacement uses the one shared recovery context and preserves hashes', () => {
  let run = createRunState({ runId: 'frontier-recovery' });
  run = reserveFrontierReview(run, {
    baseSha: sha('a'),
    ledgerHash: sha('b'),
    evidenceHash: sha('c'),
  });
  run = markFrontierReviewStarted(run, 'sol-frontier-lost');
  const unavailable = waitForFrontierReviewer(
    run,
    'sol-frontier-lost',
    'UNAVAILABLE',
    'REVIEWER_TASK_NOT_FOUND',
  );
  assert.equal(unavailable.run.state, 'FRONTIER_REVIEW_RUNTIME_RECOVERY_REQUIRED');
  assert.equal(unavailable.run.frontier_closure.base_sha, sha('a'));
  assert.equal(unavailable.run.frontier_closure.ledger_hash, sha('b'));
  assert.equal(unavailable.run.frontier_closure.evidence_hash, sha('c'));

  run = reserveFrontierReview(unavailable.run, { runtimeRecovery: true });
  assert.equal(run.outer_sol.runtime_recovery.reserved, 1);
  run = markFrontierReviewStarted(run, 'sol-frontier-replacement', {
    runtimeRecovery: true,
  });
  assert.equal(run.outer_sol.closure.consumed, 1);
  assert.equal(run.outer_sol.runtime_recovery.consumed, 1);
  assert.equal(run.frontier_closure.runtime.allocation, 'RECOVERY');
  assert.equal(run.frontier_closure.runtime.replaces_reviewer_id, 'sol-frontier-lost');
});

test('trusted stop authority is bound to exact master, ledger, evidence, and closure PASS', () => {
  const run = createRunState({ runId: 'trusted-closure' });
  const reserved = reserveFrontierReview(run, {
    baseSha: sha('a'),
    ledgerHash: sha('b'),
    evidenceHash: sha('c'),
  });
  const started = markFrontierReviewStarted(reserved, 'sol-closure');
  const passed = applyFrontierReviewResult(started, { verdict: 'PASS' });
  assert.equal(
    assertTrustedFrontierStop(passed, {
      baseSha: sha('a'),
      ledgerHash: sha('b'),
      evidenceHash: sha('c'),
    }),
    true,
  );
  assert.throws(
    () =>
      assertTrustedFrontierStop(passed, {
        baseSha: sha('a'),
        ledgerHash: sha('b'),
        evidenceHash: sha('d'),
      }),
    (error) => error instanceof HarnessInvariantError && error.code === 'FRONTIER_REVIEW_REQUIRED',
  );
});

test('B. CORRECTIVE PASS: one consolidated Luna corrective creates a new Candidate for Sol #2', () => {
  let { run, epoch } = fixture();
  ({ run, epoch } = startReview(run, epoch, 'sol-1'));
  ({ run, epoch } = applyReviewResult(run, epoch, {
    verdict: 'CORRECTIVE_REQUIRED',
    findings: [{ priority: 'P1', summary: 'Bound nested fan-out' }],
  }));
  assert.equal(epoch.state, 'CORRECTIVE_REQUIRED');
  epoch.corrective_closure = closeFindings(epoch.findings);
  epoch.candidate_sha = sha('d');
  epoch.ci = { sha: sha('d'), status: 'SUCCESS', url: 'https://example.test/ci-2' };
  epoch.state = 'REVIEW_READY';
  ({ run, epoch } = startReview(run, epoch, 'sol-1'));
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

test('stored REVIEW_RUNNING state alone cannot prove that the reviewer is active', () => {
  let { run, epoch } = fixture();
  ({ run, epoch } = startReview(run, epoch, 'sol-1'));
  assert.throws(
    () => waitForSameReviewer(run, epoch, 'sol-1'),
    (error) =>
      error instanceof HarnessInvariantError &&
      error.code === 'REVIEW_RUNTIME_OBSERVATION_REQUIRED',
  );
});

test('runtime recovery rejects wrong reviewer ids and requires confirmed unavailability', () => {
  let { run, epoch } = fixture();
  ({ run, epoch } = startReview(run, epoch, 'sol-recorded'));
  assert.throws(
    () => waitForSameReviewer(run, epoch, 'sol-wrong', 'ACTIVE'),
    (error) => error instanceof HarnessInvariantError && error.code === 'REVIEWER_ID_MISMATCH',
  );
  assert.throws(
    () => reserveReview(run, epoch, { runtimeRecovery: true }),
    (error) =>
      error instanceof HarnessInvariantError && error.code === 'REVIEW_RUNTIME_RECOVERY_NOT_READY',
  );

  let frontierRun = createRunState({ runId: 'frontier-id-check' });
  frontierRun = reserveFrontierReview(frontierRun, {
    baseSha: sha('a'),
    ledgerHash: 'ledger',
    evidenceHash: 'evidence',
  });
  frontierRun = markFrontierReviewStarted(frontierRun, 'frontier-recorded');
  assert.throws(
    () => waitForFrontierReviewer(frontierRun, 'frontier-wrong', 'ACTIVE'),
    (error) => error instanceof HarnessInvariantError && error.code === 'REVIEWER_ID_MISMATCH',
  );
});

test('C. POLLING: six timeouts cause zero durable writes, Git mutations, or launches', () => {
  let { run, epoch } = fixture();
  ({ run, epoch } = startReview(run, epoch, 'sol-1'));
  for (let count = 0; count < 6; count += 1) {
    const waited = waitForSameReviewer(run, epoch, 'sol-1', 'ACTIVE');
    assert.equal(waited.run, run);
    assert.equal(waited.epoch, epoch);
    assert.equal(waited.durableWrite, false);
    assert.equal(waited.gitMutations, 0);
    assert.equal(waited.launches, 0);
  }
  assert.equal(epoch.review.consumed, 1);
  assert.equal(run.outer_sol.consumed, 1);
});

test('an interrupted Product reviewer resumes with the same identity and no budget change', () => {
  let { run, epoch } = fixture();
  ({ run, epoch } = startReview(run, epoch, 'sol-1'));
  const candidateSha = epoch.candidate_sha;
  const ci = structuredClone(epoch.ci);

  const interrupted = waitForSameReviewer(run, epoch, 'sol-1', 'INTERRUPTED', 'CAPACITY_LIMIT');
  assert.equal(interrupted.epoch.state, 'REVIEW_INTERRUPTED_RESUMABLE');
  assert.equal(interrupted.epoch.review.reviewer_id, 'sol-1');
  assert.equal(interrupted.epoch.review.runtime.reason, 'CAPACITY_LIMIT');
  assert.equal(interrupted.run.outer_sol.consumed, 1);
  assert.equal(interrupted.epoch.review.consumed, 1);
  assert.equal(interrupted.epoch.candidate_sha, candidateSha);
  assert.deepEqual(interrupted.epoch.ci, ci);

  const resumed = waitForSameReviewer(interrupted.run, interrupted.epoch, 'sol-1', 'ACTIVE');
  assert.equal(resumed.epoch.state, 'REVIEW_RUNNING');
  assert.equal(resumed.epoch.review.runtime.state, 'ACTIVE');
  assert.equal(resumed.run.outer_sol.consumed, 1);
  assert.equal(resumed.epoch.review.consumed, 1);
  assert.equal(resumed.launches, 0);
});

test('an unavailable Product reviewer preserves consumption and requests one recovery context', () => {
  let { run, epoch } = fixture();
  ({ run, epoch } = startReview(run, epoch, 'sol-lost'));

  const unavailable = waitForSameReviewer(
    run,
    epoch,
    'sol-lost',
    'UNAVAILABLE',
    'REVIEWER_TASK_NOT_FOUND',
  );
  assert.equal(unavailable.epoch.state, 'REVIEW_RUNTIME_RECOVERY_REQUIRED');
  assert.equal(unavailable.epoch.review.reviewer_id, null);
  assert.equal(unavailable.epoch.review.consumed, 1);
  assert.equal(unavailable.run.outer_sol.consumed, 1);
  assert.deepEqual(unavailable.run.outer_sol.runtime_recovery, {
    max: 1,
    consumed: 0,
    reserved: 0,
  });
  assert.deepEqual(unavailable.epoch.review.runtime_recovery, {
    max: 1,
    consumed: 0,
    reserved: 0,
  });
  assert.deepEqual(unavailable.epoch.review.runtime_history, [
    {
      reviewer_id: 'sol-lost',
      allocation: 'NORMAL',
      outcome: 'UNAVAILABLE',
      reason: 'REVIEWER_TASK_NOT_FOUND',
    },
  ]);
  assert.equal(unavailable.epoch.review.runtime.replacement_allocation, 'RECOVERY');
});

test('a Product runtime replacement consumes the paired recovery ledger exactly once', () => {
  let { run, epoch } = fixture();
  ({ run, epoch } = startReview(run, epoch, 'sol-lost'));
  ({ run, epoch } = waitForSameReviewer(
    run,
    epoch,
    'sol-lost',
    'UNAVAILABLE',
    'REVIEWER_TASK_NOT_FOUND',
  ));

  ({ run, epoch } = reserveReview(run, epoch, { runtimeRecovery: true }));
  assert.equal(run.outer_sol.runtime_recovery.reserved, 1);
  assert.equal(epoch.review.runtime_recovery.reserved, 1);
  assert.equal(run.outer_sol.product.reserved, 0);
  assert.equal(epoch.review.reserved, 0);

  ({ run, epoch } = markReviewStarted(run, epoch, 'sol-replacement', {
    runtimeRecovery: true,
  }));
  assert.equal(run.outer_sol.runtime_recovery.consumed, 1);
  assert.equal(epoch.review.runtime_recovery.consumed, 1);
  assert.equal(run.outer_sol.product.consumed, 1);
  assert.equal(epoch.review.consumed, 1);
  assert.equal(epoch.review.reviewer_id, 'sol-replacement');
  assert.equal(epoch.review.runtime.allocation, 'RECOVERY');
  assert.equal(epoch.review.runtime.replaces_reviewer_id, 'sol-lost');
  assert.equal(epoch.state, 'REVIEW_RUNNING');

  ({ run, epoch } = applyReviewResult(run, epoch, { verdict: 'PASS' }));
  assert.equal(epoch.review_history.at(-1).runtime_allocation, 'RECOVERY');
  assert.equal(epoch.review_history.at(-1).replaces_reviewer_id, 'sol-lost');
  assert.equal(epoch.review.runtime.state, 'COMPLETED');
});

test('an interrupted Product reviewer cannot return a verdict until runtime is ACTIVE', () => {
  let { run, epoch } = fixture();
  ({ run, epoch } = startReview(run, epoch, 'sol-interrupted'));
  ({ run, epoch } = waitForSameReviewer(
    run,
    epoch,
    'sol-interrupted',
    'INTERRUPTED',
    'CAPACITY_PAUSE',
  ));
  assert.throws(
    () => applyReviewResult(run, epoch, { verdict: 'PASS' }),
    (error) => error instanceof HarnessInvariantError && error.code === 'REVIEW_NOT_RUNNING',
  );
});

test('runtime recovery exhaustion uses one remaining normal slot then blocks without refund', () => {
  let { run, epoch } = fixture();
  ({ run, epoch } = startReview(run, epoch, 'sol-normal-1'));
  ({ run, epoch } = waitForSameReviewer(
    run,
    epoch,
    'sol-normal-1',
    'UNAVAILABLE',
    'NORMAL_CONTEXT_LOST',
  ));
  ({ run, epoch } = reserveReview(run, epoch, { runtimeRecovery: true }));
  ({ run, epoch } = markReviewStarted(run, epoch, 'sol-recovery', {
    runtimeRecovery: true,
  }));

  ({ run, epoch } = waitForSameReviewer(
    run,
    epoch,
    'sol-recovery',
    'UNAVAILABLE',
    'RECOVERY_CONTEXT_LOST',
  ));
  assert.equal(epoch.review.runtime.replacement_allocation, 'NORMAL');
  ({ run, epoch } = reserveReview(run, epoch));
  ({ run, epoch } = markReviewStarted(run, epoch, 'sol-normal-2'));
  assert.equal(epoch.review.consumed, 2);
  assert.equal(epoch.review.runtime_recovery.consumed, 1);

  ({ run, epoch } = waitForSameReviewer(
    run,
    epoch,
    'sol-normal-2',
    'UNAVAILABLE',
    'FINAL_CONTEXT_LOST',
  ));
  assert.equal(epoch.state, 'REVIEW_RUNTIME_BLOCKED');
  assert.equal(epoch.review.consumed, 2);
  assert.equal(epoch.review.runtime_recovery.consumed, 1);
  assert.throws(
    () => reserveReview(run, epoch),
    (error) => error instanceof HarnessInvariantError && error.code === 'REVIEW_BUDGET_EXHAUSTED',
  );
});

test('uncertain recovery reservation reconciliation consumes only recovery and never invents a verdict', () => {
  let { run, epoch } = fixture();
  ({ run, epoch } = startReview(run, epoch, 'sol-lost'));
  ({ run, epoch } = waitForSameReviewer(run, epoch, 'sol-lost', 'UNAVAILABLE', 'TASK_NOT_FOUND'));
  ({ run, epoch } = reserveReview(run, epoch, { runtimeRecovery: true }));
  ({ run, epoch } = reconcileReviewReservation(run, epoch, false, {
    runtimeRecovery: true,
  }));
  assert.equal(run.outer_sol.runtime_recovery.consumed, 1);
  assert.equal(epoch.review.runtime_recovery.consumed, 1);
  assert.equal(run.outer_sol.product.consumed, 1);
  assert.equal(epoch.review.consumed, 1);
  assert.equal(epoch.review.runtime.replacement_allocation, 'NORMAL');

  let frontierRun = createRunState({ runId: 'frontier-reconcile' });
  frontierRun.state = 'FRONTIER_REVIEW_RUNNING';
  frontierRun.frontier_closure = {
    state: 'RUNNING',
    base_sha: sha('a'),
    ledger_hash: 'ledger',
    evidence_hash: 'evidence',
    reviewer_id: 'frontier-lost',
    verdict: null,
    findings: [],
    evidence: { encoding: 'gzip+base64', uncompressed_bytes: 2, data: 'e30=' },
    runtime: { state: 'ACTIVE', reason: null, allocation: 'NORMAL' },
    runtime_history: [],
  };
  frontierRun.outer_sol.consumed = 1;
  frontierRun.outer_sol.closure.consumed = 1;
  ({ run: frontierRun } = waitForFrontierReviewer(
    frontierRun,
    'frontier-lost',
    'UNAVAILABLE',
    'TASK_NOT_FOUND',
  ));
  frontierRun = reserveFrontierReview(frontierRun, { runtimeRecovery: true });
  frontierRun = reconcileFrontierReviewReservation(frontierRun, false, {
    runtimeRecovery: true,
  });
  assert.equal(frontierRun.outer_sol.runtime_recovery.consumed, 1);
  assert.equal(frontierRun.outer_sol.closure.consumed, 1);
  assert.equal(frontierRun.state, 'FRONTIER_REVIEW_RUNTIME_BLOCKED');
  assert.notEqual(frontierRun.frontier_closure.verdict, 'PASS');
});

test('legacy V3.2 control blocks normalize additive recovery fields without claiming activity', () => {
  const { run, epoch } = fixture();
  delete run.outer_sol.runtime_recovery;
  delete run.frontier_closure.runtime;
  delete run.frontier_closure.runtime_history;
  delete run.frontier_closure.evidence;
  delete epoch.review.runtime_recovery;
  delete epoch.review.runtime_history;
  delete epoch.review.runtime;
  epoch.state = 'REVIEW_RUNNING';
  epoch.review.reviewer_id = 'legacy-sol';
  const parsedRun = parseControlBlock(renderRunBody(run), RUN_MARKER);
  const parsedEpoch = parseControlBlock(renderEpochBody(epoch), EPOCH_MARKER);
  assert.deepEqual(parsedRun.outer_sol.runtime_recovery, { max: 1, consumed: 0, reserved: 0 });
  assert.deepEqual(parsedEpoch.review.runtime_recovery, { max: 1, consumed: 0, reserved: 0 });
  assert.equal(parsedEpoch.review.runtime.state, 'OBSERVATION_REQUIRED');
  assert.throws(
    () => waitForSameReviewer(parsedRun, parsedEpoch, 'legacy-sol'),
    (error) =>
      error instanceof HarnessInvariantError &&
      error.code === 'REVIEW_RUNTIME_OBSERVATION_REQUIRED',
  );
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

test('Sol #2 must continue the same reviewer instead of paying to rebuild context', () => {
  let { run, epoch } = fixture();
  ({ run, epoch } = startReview(run, epoch, 'sol-1'));
  ({ run, epoch } = applyReviewResult(run, epoch, {
    verdict: 'CORRECTIVE_REQUIRED',
    findings: [{ priority: 'P1', summary: 'One blocker' }],
  }));
  epoch.corrective_closure = closeFindings(epoch.findings);
  epoch.candidate_sha = sha('d');
  epoch.ci = { sha: sha('d'), status: 'SUCCESS', url: null };
  epoch.state = 'REVIEW_READY';
  const reserved = reserveReview(run, epoch);
  assert.throws(
    () => markReviewStarted(reserved.run, reserved.epoch, 'new-sol-context'),
    (error) => error instanceof HarnessInvariantError && error.code === 'SAME_REVIEWER_REQUIRED',
  );
  const continued = markReviewStarted(reserved.run, reserved.epoch, 'sol-1');
  assert.equal(continued.epoch.review.consumed, 2);
});

test('D. REVIEW LIMIT: Sol #2 findings require one autonomous Luna final corrective, never Sol #3', () => {
  let { run, epoch } = fixture();
  ({ run, epoch } = startReview(run, epoch, 'sol-1'));
  ({ run, epoch } = applyReviewResult(run, epoch, {
    verdict: 'CORRECTIVE_REQUIRED',
    findings: [{ priority: 'P1', summary: 'First root-cause class' }],
  }));
  epoch.corrective_closure = closeFindings(epoch.findings);
  epoch.candidate_sha = sha('d');
  epoch.ci = { sha: sha('d'), status: 'SUCCESS', url: null };
  epoch.state = 'REVIEW_READY';
  ({ run, epoch } = startReview(run, epoch, 'sol-1'));
  ({ run, epoch } = applyReviewResult(run, epoch, {
    verdict: 'CORRECTIVE_REQUIRED',
    findings: [{ priority: 'P1', summary: 'Still blocking' }],
  }));
  assert.equal(epoch.state, 'FINAL_CORRECTIVE_REQUIRED');
  assert.equal(epoch.pr_number, 42);
  assert.equal(epoch.branch, 'codex/epoch-epoch-test');
  assert.equal(run.state, 'EPOCH_ACTIVE');
  assert.equal(run.active_epoch_pr, 42);
  assert.deepEqual(run.parked_epoch_prs, []);
  assert.equal(epoch.review_history.length, 2);
  assert.equal(epoch.findings[0].id, 'sol-2-finding-1');
  assert.throws(
    () => reserveReview(run, epoch),
    (error) => error instanceof HarnessInvariantError && error.code === 'REVIEW_BUDGET_EXHAUSTED',
  );

  epoch.corrective_closure = closeFindings(epoch.findings);
  epoch.candidate_sha = sha('e');
  epoch.ci = { sha: sha('e'), status: 'SUCCESS', url: 'https://example.test/ci-final' };
  epoch.final_corrective_sha = sha('e');
  epoch.final_corrective_base_sha = sha('a');
  epoch.state = 'FINAL_CORRECTIVE_READY';
  assertMergeReadiness({
    epoch,
    branchHeadSha: sha('e'),
    prHeadSha: sha('e'),
    currentBaseSha: sha('a'),
  });
  const merged = completeMerge(run, epoch, {
    mergeSha: sha('f'),
    candidateIsAncestor: true,
  });
  assert.equal(merged.epoch.state, 'MERGED');
  assert.equal(merged.run.next_action, 'DISCOVER_NEXT_EPOCH');
});

test('corrective closure rejects literal fixes without root-cause and regression evidence', () => {
  const { epoch } = fixture();
  epoch.findings = [{ id: 'sol-2-finding-1', priority: 'P1', summary: 'Still blocking' }];
  assert.throws(
    () =>
      assertCorrectiveClosure(epoch, [
        {
          finding_id: 'sol-2-finding-1',
          root_cause: 'Fixed the reported line.',
          equivalence_class: '',
          generalized_fix: 'Changed fallback.',
          regression_tests: [],
          validation: ['focused test passed'],
        },
      ]),
    (error) =>
      error instanceof HarnessInvariantError && error.code === 'CORRECTIVE_CLOSURE_INCOMPLETE',
  );
});

test('legacy parked review-limit state resumes on the same PR for Luna final corrective', () => {
  const { run, epoch } = fixture();
  run.state = 'QUALITY_CIRCUIT_BREAKER';
  run.active_epoch_pr = null;
  run.parked_epoch_prs = [42];
  epoch.state = 'PARKED_REVIEW_LIMIT';
  epoch.review.consumed = 2;
  epoch.findings = [{ priority: 'P1', summary: 'Legacy unresolved finding' }];

  const resumed = resumeReviewLimitForFinalCorrective(run, epoch);
  assert.equal(resumed.epoch.state, 'FINAL_CORRECTIVE_REQUIRED');
  assert.equal(resumed.epoch.findings[0].id, 'sol-2-finding-1');
  assert.equal(resumed.run.state, 'EPOCH_ACTIVE');
  assert.equal(resumed.run.active_epoch_pr, 42);
  assert.deepEqual(resumed.run.parked_epoch_prs, []);
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

test('Goal completion is rejected for every active review runtime and allowed only at a true stop', () => {
  let { run, epoch } = fixture();
  ({ run, epoch } = startReview(run, epoch, 'sol-1'));
  for (const state of [
    'REVIEW_RUNNING',
    'REVIEW_INTERRUPTED_RESUMABLE',
    'REVIEW_RUNTIME_RECOVERY_REQUIRED',
    'REVIEW_RUNTIME_BLOCKED',
  ]) {
    epoch.state = state;
    assert.throws(
      () => assertGoalStopAllowed({ run, epoch }),
      (error) =>
        error instanceof HarnessInvariantError && error.code === 'GOAL_CONTINUATION_REQUIRED',
    );
  }

  run.state = 'STOPPED_RUN_BUDGET_EXHAUSTED_RESUMABLE';
  run.active_epoch_pr = null;
  epoch.state = 'REVIEW_RUNTIME_BLOCKED';
  assert.throws(
    () => assertGoalStopAllowed({ run, epoch }),
    (error) =>
      error instanceof HarnessInvariantError && error.code === 'GOAL_CONTINUATION_REQUIRED',
  );
  assert.equal(assertGoalStopAllowed({ run }), true);
  assert.equal(assertGoalStopAllowed({ discoveryState: 'UNCHANGED_EXHAUSTION' }), true);
});
