import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendContinuationEvent,
  assertContinuationMayAdvance,
  buildContinuationBrief,
  continuationEvents,
  continuationRisk,
  currentDirective,
} from '../../scripts/lib/harness-continuation.mjs';

const epoch = () => ({
  pr_number: 271,
  state: 'CORRECTIVE_REQUIRED',
  candidate_sha: 'a'.repeat(40),
  review_history: [],
  review: { max: 9, consumed: 8, reserved: 0 },
});
const run = () => ({
  state: 'EPOCH_ACTIVE',
  active_epoch_pr: 271,
  outer_sol: { product: { max: 454, consumed: 453, reserved: 0 } },
});
const pr = () => ({ number: 271, headRefOid: 'b'.repeat(40), baseRefOid: 'c'.repeat(40) });
const directive = (action, source = action) => ({
  type: 'directive',
  action,
  source_ref: 'user-message:' + source,
  reason: 'The current user explicitly requested this action.',
});
const checkpoint = (kind = 'no_progress') => ({
  type: 'checkpoint',
  kind,
  epoch_pr: 271,
  problem: 'mcp-contract-mismatch',
  input_sha256: 'f'.repeat(64),
  outcome: 'No new accepted evidence was produced.',
  next_action: 'Inspect the recorded root cause before another attempt.',
  evidence_refs: ['docs/agent/RUN95_RECOVERY_PLAN.md'],
});
const append = (state, input, ep = epoch()) =>
  appendContinuationEvent(state, ep, input, continuationEvents(state).length);
const errorCode = (expected) => (error) => error.code === expected;

test('a later continue supersedes pause after serialization and model handoff', () => {
  const initial = run();
  const paused = append(initial, directive('pause'));
  assert.throws(
    () => assertContinuationMayAdvance(paused, epoch()),
    errorCode('HUMAN_PAUSE_ACTIVE'),
  );
  const resumed = append(JSON.parse(JSON.stringify(paused)), {
    ...directive('continue'),
    reason: 'Cancel the old pause; quoted pause is historical.',
  });
  assert.equal(currentDirective(resumed).data.action, 'continue');
  assertContinuationMayAdvance(resumed, epoch());
  assert.equal(continuationEvents(resumed)[0].data.action, 'pause');
  assert.equal(initial.continuation, undefined);
});

test('source refs and expected sequence prevent replaying old instructions or overwriting history', () => {
  const state = append(run(), directive('continue'));
  assert.throws(
    () => appendContinuationEvent(state, epoch(), directive('pause'), 0),
    errorCode('STALE_CONTINUATION_SEQUENCE'),
  );
  assert.throws(
    () => append(state, directive('pause', 'continue')),
    errorCode('DIRECTIVE_ALREADY_RECORDED'),
  );
  const tampered = structuredClone(state);
  tampered.continuation.events[0].data.action = 'pause';
  assert.throws(() => currentDirective(tampered), errorCode('INVALID_CONTINUATION_HISTORY'));
});

test('three corrective verdicts demand strategy review; increasing budget does not clear the signal', () => {
  const ep = epoch();
  ep.review_history = Array.from({ length: 3 }, (_, i) => ({
    review_number: i + 1,
    verdict: 'CORRECTIVE_REQUIRED',
    candidate_sha: String(i).repeat(40),
  }));
  const state = append(run(), directive('continue'), ep);
  state.outer_sol.product.max += 10;
  assert.throws(
    () => assertContinuationMayAdvance(state, ep),
    errorCode('STRATEGY_REVIEW_REQUIRED'),
  );
  const reviewed = append(
    state,
    {
      ...checkpoint('strategy_review'),
      reviewer_id: 'current-strategy-session',
      model: 'gpt-6.1-sol',
      outcome: 'Pinned the reference and replaced the failing contract approach.',
    },
    ep,
  );
  assertContinuationMayAdvance(reviewed, ep);
  assert.equal(continuationRisk(reviewed, ep).corrective_verdicts_since_strategy_review, 0);
  const altered = structuredClone(ep);
  altered.review_history[0].candidate_sha = '9'.repeat(40);
  assert.throws(() => continuationRisk(reviewed, altered), errorCode('INVALID_STRATEGY_BINDING'));
});

test('two identical no-progress attempts trigger reassessment across Candidate changes', () => {
  let state = append(run(), directive('continue'));
  state = append(state, checkpoint());
  assertContinuationMayAdvance(state, epoch());
  state = append(state, checkpoint(), { ...epoch(), candidate_sha: 'd'.repeat(40) });
  assert.throws(
    () => assertContinuationMayAdvance(state, epoch()),
    errorCode('STRATEGY_REVIEW_REQUIRED'),
  );
  assert.equal(continuationRisk(state, epoch()).repeated_no_progress, true);
});

test('replanning remains separate from pause and does not assert that the app Goal resumed', () => {
  const state = append(run(), directive('replan'));
  assert.throws(() => assertContinuationMayAdvance(state, epoch()), errorCode('REPLAN_REQUIRED'));
  const brief = buildContinuationBrief({
    run: state,
    epoch: epoch(),
    pr: pr(),
    goalState: 'paused',
  });
  assert.equal(brief.next_action, 'COMPLETE_REQUESTED_REPLAN');
  assert.equal(brief.codex_goal_observation, 'paused');
  assert.equal(brief.app_goal_resume_is_not_performed_by_harness, true);
  const planned = append(state, {
    ...checkpoint('strategy_review'),
    reviewer_id: 'strategy-session',
    model: 'gpt-6.1-sol',
    outcome: 'Completed the requested recovery plan with concrete acceptance criteria.',
  });
  assertContinuationMayAdvance(planned, epoch());
  const plannedBrief = buildContinuationBrief({
    run: planned,
    epoch: epoch(),
    pr: pr(),
    goalState: 'paused',
  });
  assert.equal(plannedBrief.latest_human_directive.data.action, 'replan');
  assert.equal(plannedBrief.requested_replan_pending, false);
  assert.equal(plannedBrief.next_action, 'RESUME_CODEX_GOAL_IN_APP');
});

test('a compact brief uses the live head and includes the unresolved review and remaining slots', () => {
  const ep = epoch();
  ep.state = 'REVIEW_READY';
  ep.review_history = [
    { verdict: 'CORRECTIVE_REQUIRED', findings: [{ id: 'visible-original-title' }] },
  ];
  const state = append(run(), directive('continue'), ep);
  const brief = buildContinuationBrief({ run: state, epoch: ep, pr: pr(), goalState: 'active' });
  assert.equal(brief.next_action, 'CHECK_CURRENT_HEAD_CI_AND_REFRESH_CANDIDATE');
  assert.equal(brief.latest_review.findings[0].id, 'visible-original-title');
  assert.equal(brief.product_review_slots_remaining, 1);
  assert.equal(brief.epoch_review_slots_remaining, 1);
  assert.equal(
    buildContinuationBrief({ run: state, epoch: ep, pr: pr(), goalState: 'paused' }).next_action,
    'RESUME_CODEX_GOAL_IN_APP',
  );
  assert.throws(
    () => buildContinuationBrief({ run: state, epoch: ep, pr: { ...pr(), number: 267 } }),
    errorCode('CONTINUATION_EPOCH_MISMATCH'),
  );
});

test('legacy read-only inspection reports risk without silently opting the Run into new controls', () => {
  const state = run(),
    ep = epoch();
  ep.review_history = Array.from({ length: 5 }, () => ({ verdict: 'CORRECTIVE_REQUIRED' }));
  const brief = buildContinuationBrief({ run: state, epoch: ep, pr: pr() });
  assert.equal(brief.risk.strategy_review_required, true);
  assert.equal(brief.sequence, 0);
  assert.equal(brief.codex_goal_observation, 'unobserved');
  assert.equal(state.continuation, undefined);
  assertContinuationMayAdvance(state, ep);
});

test('checkpoint schema prevents an empty handoff, wrong Epoch, or inferred model identity', () => {
  assert.throws(
    () => append(run(), { ...checkpoint(), evidence_refs: [] }),
    errorCode('INVALID_CONTINUATION_EVENT'),
  );
  assert.throws(
    () => append(run(), { ...checkpoint(), epoch_pr: 267 }),
    errorCode('CONTINUATION_EPOCH_MISMATCH'),
  );
  assert.throws(
    () => append(run(), { ...checkpoint('strategy_review'), reviewer_id: '/root/reviewer' }),
    errorCode('INVALID_CONTINUATION_EVENT'),
  );
});

test('lossless compression preserves old directives, every event and the failure signal', () => {
  let state = append(run(), directive('pause'));
  state = append(state, directive('continue'));
  for (let i = 0; i < 20; i += 1) state = append(state, checkpoint());
  assert.equal(state.continuation.archive.encoding, 'gzip+base64');
  const saved = JSON.parse(JSON.stringify(state));
  assert.equal(continuationEvents(saved).length, 22);
  assert.equal(continuationEvents(saved)[0].data.action, 'pause');
  assert.equal(currentDirective(saved).data.action, 'continue');
  assert.equal(continuationRisk(saved, epoch()).repeated_no_progress, true);
  saved.continuation.archive.sha256 = '0'.repeat(64);
  assert.throws(() => continuationEvents(saved), errorCode('INVALID_CONTINUATION_HISTORY'));
});

test('a Run without an active Epoch can finish replanning without creating a fake Epoch', () => {
  const state = appendContinuationEvent(
    { ...run(), active_epoch_pr: null },
    null,
    directive('replan'),
    0,
  );
  const planned = appendContinuationEvent(
    state,
    null,
    {
      ...checkpoint('strategy_review'),
      epoch_pr: null,
      reviewer_id: 'strategy-session',
      model: 'gpt-6.1-sol',
    },
    1,
  );
  assertContinuationMayAdvance(planned, null);
  assert.equal(buildContinuationBrief({ run: planned }).requested_replan_pending, false);
});

test('replanning during a human pause cannot resume Product execution', () => {
  let state = append(run(), directive('pause'));
  state = append(state, directive('replan'));
  state = append(state, {
    ...checkpoint('strategy_review'),
    reviewer_id: 'strategy-session',
    model: 'gpt-6.1-sol',
  });
  const brief = buildContinuationBrief({ run: state, epoch: epoch(), pr: pr() });
  assert.equal(brief.requested_replan_pending, false);
  assert.equal(brief.human_execution_pause_active, true);
  assert.throws(
    () => assertContinuationMayAdvance(state, epoch()),
    errorCode('HUMAN_PAUSE_ACTIVE'),
  );
  state = append(state, directive('continue'));
  assertContinuationMayAdvance(state, epoch());
});

test('fulfilled human replan never resurrects after merge or the next Epoch', () => {
  let state = append(run(), directive('replan'));
  state = append(state, {
    ...checkpoint('strategy_review'),
    reviewer_id: 'strategy-session',
    model: 'gpt-6.1-sol',
  });
  const between = { ...state, active_epoch_pr: null };
  assertContinuationMayAdvance(between, null);
  assert.equal(buildContinuationBrief({ run: between }).requested_replan_pending, false);
  const next = { ...state, active_epoch_pr: 272 };
  const nextEpoch = { ...epoch(), pr_number: 272, state: 'IMPLEMENTING', candidate_sha: null };
  assertContinuationMayAdvance(next, nextEpoch);
  const brief = buildContinuationBrief({
    run: next,
    epoch: nextEpoch,
    pr: { ...pr(), number: 272 },
  });
  assert.equal(brief.requested_replan_pending, false);
  assert.equal(brief.next_action, 'IMPLEMENT_CURRENT_EPOCH');
});

test('blocked app Goals route to the app control without fabricating a repository blocker', () => {
  const state = append(run(), directive('continue'));
  const brief = buildContinuationBrief({
    run: state,
    epoch: epoch(),
    pr: pr(),
    goalState: 'blocked',
  });
  assert.equal(brief.next_action, 'RESUME_CODEX_GOAL_IN_APP');
  assert.equal(brief.run_state, 'EPOCH_ACTIVE');
});

test('interrupted terminal recovery routes to its same intent below current human and app controls', () => {
  let state = {
    ...run(),
    state: 'TERMINAL_RECOVERY_PENDING',
    active_epoch_pr: null,
    pending_terminal_recovery: { pr: 267 },
  };
  const brief = (goalState = 'active') => buildContinuationBrief({ run: state, goalState });
  assert.equal(brief().next_action, 'RESUME_TERMINAL_RECOVERY');
  assert.equal(brief('paused').next_action, 'RESUME_CODEX_GOAL_IN_APP');
  state = appendContinuationEvent(state, null, directive('pause'), 0);
  assert.equal(brief().next_action, 'WAIT_FOR_EXPLICIT_CONTINUE');
  assert.throws(() => assertContinuationMayAdvance(state, null), errorCode('HUMAN_PAUSE_ACTIVE'));
  state = appendContinuationEvent(state, null, directive('continue'), 1);
  assertContinuationMayAdvance(state, null);
  assert.equal(brief().next_action, 'RESUME_TERMINAL_RECOVERY');
  state = appendContinuationEvent(state, null, directive('replan'), 2);
  assert.equal(brief().next_action, 'COMPLETE_REQUESTED_REPLAN');
});
