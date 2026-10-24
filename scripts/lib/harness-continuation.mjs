import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { HarnessInvariantError } from './agent-harness-core.mjs';

const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = (code, message) => {
  throw new HarnessInvariantError(code, message);
};
const text = (value, field, max = 600) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    fail('INVALID_CONTINUATION_EVENT', field + ' requires 1–' + max + ' characters');
  }
  return value;
};
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const digest = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);

export function continuationEvents(run) {
  if (run.continuation === undefined) return [];
  const journal = run.continuation;
  if (journal?.schema !== 1) {
    fail('INVALID_CONTINUATION_HISTORY', 'Unsupported continuation journal');
  }
  let events = journal.events;
  if (journal.archive !== undefined) {
    if (
      events !== undefined ||
      journal.archive.encoding !== 'gzip+base64' ||
      !digest(journal.archive.sha256) ||
      !positive(journal.archive.count)
    ) {
      fail('INVALID_CONTINUATION_HISTORY', 'Invalid lossless history archive');
    }
    try {
      const bytes = gunzipSync(Buffer.from(journal.archive.data, 'base64'), {
        maxOutputLength: 4 * 1024 * 1024,
      });
      if (createHash('sha256').update(bytes).digest('hex') !== journal.archive.sha256) {
        fail('INVALID_CONTINUATION_HISTORY', 'History archive digest changed');
      }
      events = JSON.parse(bytes.toString('utf8'));
      if (events.length !== journal.archive.count) throw new Error('History count changed');
    } catch {
      fail('INVALID_CONTINUATION_HISTORY', 'History archive is unreadable or changed');
    }
  }
  if (!Array.isArray(events))
    fail('INVALID_CONTINUATION_HISTORY', 'History events must be an array');
  let previous = null;
  events.forEach((event, index) => {
    const { sha256, ...payload } = event;
    if (
      event.sequence !== index + 1 ||
      event.previous_sha256 !== previous ||
      sha256 !== hash(payload) ||
      !['directive', 'checkpoint'].includes(event.type)
    ) {
      fail('INVALID_CONTINUATION_HISTORY', 'Continuation history changed or lost an event');
    }
    previous = sha256;
  });
  return events;
}

export function currentDirective(run) {
  return continuationEvents(run).findLast((event) => event.type === 'directive') ?? null;
}

export function reviewHistorySha(epoch) {
  return hash(epoch?.review_history ?? []);
}

function checkpointData(input, epoch) {
  if (!['progress', 'no_progress', 'strategy_review'].includes(input?.kind)) {
    fail('INVALID_CONTINUATION_EVENT', 'Unknown checkpoint kind');
  }
  if (!positive(input.epoch_pr) || input.epoch_pr !== epoch?.pr_number) {
    fail('CONTINUATION_EPOCH_MISMATCH', 'Checkpoint must bind the active Epoch');
  }
  if (!digest(input.input_sha256)) {
    fail('INVALID_CONTINUATION_EVENT', 'input_sha256 must identify the actual attempt inputs');
  }
  if (
    !Array.isArray(input.evidence_refs) ||
    input.evidence_refs.length < 1 ||
    input.evidence_refs.length > 8
  ) {
    fail('INVALID_CONTINUATION_EVENT', 'Checkpoint needs 1–8 evidence references');
  }
  const result = {
    kind: input.kind,
    epoch_pr: input.epoch_pr,
    problem: text(input.problem, 'problem', 120),
    input_sha256: input.input_sha256,
    outcome: text(input.outcome, 'outcome'),
    next_action: text(input.next_action, 'next_action'),
    evidence_refs: input.evidence_refs.map((ref) => text(ref, 'evidence_ref', 300)),
  };
  if (input.kind === 'strategy_review') {
    result.reviewer_id = text(input.reviewer_id, 'reviewer_id', 150);
    result.model = text(input.model, 'model', 80);
    result.review_history_sha256 = reviewHistorySha(epoch);
    result.review_count = epoch.review_history?.length ?? 0;
  }
  return result;
}

// Structured intent comes from the latest human instruction. Never search old
// messages for pause/continue keywords or infer cancellation from quoted text.
export function appendContinuationEvent(
  run,
  epoch,
  input,
  expectedSequence,
  now = new Date().toISOString(),
) {
  const events = continuationEvents(run);
  if (!Number.isSafeInteger(expectedSequence) || expectedSequence !== events.length) {
    fail(
      'STALE_CONTINUATION_SEQUENCE',
      'Read continuation:show before appending; history was not changed',
    );
  }
  if (!Number.isFinite(Date.parse(now))) fail('INVALID_CONTINUATION_EVENT', 'Invalid event time');
  if (!['directive', 'checkpoint'].includes(input?.type)) {
    fail('INVALID_CONTINUATION_EVENT', 'Expected directive or checkpoint');
  }
  let data;
  if (input.type === 'directive') {
    if (!['continue', 'pause', 'replan'].includes(input.action)) {
      fail('INVALID_CONTINUATION_EVENT', 'Unknown human directive');
    }
    data = {
      action: input.action,
      source_ref: text(input.source_ref, 'source_ref', 180),
      reason: text(input.reason, 'reason'),
    };
    if (
      events.some(
        (event) => event.type === 'directive' && event.data.source_ref === data.source_ref,
      )
    ) {
      fail(
        'DIRECTIVE_ALREADY_RECORDED',
        'This instruction already has a durable event; read its outcome',
      );
    }
  } else {
    if (run.active_epoch_pr !== epoch?.pr_number) {
      fail('CONTINUATION_EPOCH_MISMATCH', 'Checkpoint is not for the Run active Epoch');
    }
    data = checkpointData(input, epoch);
  }
  const payload = {
    sequence: events.length + 1,
    previous_sha256: events.at(-1)?.sha256 ?? null,
    at: now,
    type: input.type,
    data,
  };
  const next = structuredClone(run);
  const history = [...events, { ...payload, sha256: hash(payload) }];
  const historyBytes = Buffer.from(JSON.stringify(history));
  next.continuation =
    historyBytes.length <= 4096
      ? { schema: 1, events: history }
      : {
          schema: 1,
          archive: {
            encoding: 'gzip+base64',
            count: history.length,
            sha256: createHash('sha256').update(historyBytes).digest('hex'),
            data: gzipSync(historyBytes).toString('base64'),
          },
        };
  return next;
}

export function continuationRisk(run, epoch) {
  const checkpoints = continuationEvents(run).filter(
    (event) => event.type === 'checkpoint' && event.data.epoch_pr === epoch?.pr_number,
  );
  const strategy = checkpoints.findLast((event) => event.data.kind === 'strategy_review');
  const acknowledged = strategy?.data.review_count ?? 0;
  const history = epoch?.review_history ?? [];
  if (
    acknowledged > history.length ||
    (strategy && strategy.data.review_history_sha256 !== hash(history.slice(0, acknowledged)))
  ) {
    fail(
      'INVALID_STRATEGY_BINDING',
      'Strategy review no longer matches the preserved review history',
    );
  }
  const corrections = history
    .slice(acknowledged)
    .filter((review) => review.verdict === 'CORRECTIVE_REQUIRED').length;
  const last = checkpoints.at(-1);
  const sameFailure =
    last?.data.kind === 'no_progress' &&
    checkpoints.at(-2)?.data.kind === 'no_progress' &&
    last.data.problem === checkpoints.at(-2).data.problem &&
    last.data.input_sha256 === checkpoints.at(-2).data.input_sha256;
  return {
    strategy_review_required: corrections >= 3 || Boolean(sameFailure),
    corrective_verdicts_since_strategy_review: corrections,
    repeated_no_progress: Boolean(sameFailure),
    last_strategy_sequence: strategy?.sequence ?? null,
  };
}

function replanPending(directive, risk) {
  return (
    directive?.data.action === 'replan' && (risk.last_strategy_sequence ?? 0) <= directive.sequence
  );
}

export function assertContinuationMayAdvance(run, epoch) {
  // Legacy Runs opt in via their first explicit directive. Reading a brief
  // reports risk without silently migrating or blocking an old control plane.
  if (run.continuation === undefined) return;
  const directive = currentDirective(run);
  const risk = continuationRisk(run, epoch);
  if (directive?.data.action === 'pause')
    fail('HUMAN_PAUSE_ACTIVE', 'Latest durable human instruction is pause');
  if (replanPending(directive, risk))
    fail('REPLAN_REQUIRED', 'Finish and record the requested strategy review first');
  if (risk.strategy_review_required) {
    fail(
      'STRATEGY_REVIEW_REQUIRED',
      'Reassess the approach before another review, extension, or claim',
    );
  }
}

export function buildContinuationBrief({ run, epoch, pr, goalState = 'unobserved' }) {
  if (epoch && (run.active_epoch_pr !== epoch.pr_number || pr?.number !== epoch.pr_number)) {
    fail('CONTINUATION_EPOCH_MISMATCH', 'Run, Epoch and PR must name the same active work');
  }
  if (!['active', 'paused', 'blocked', 'complete', 'unobserved'].includes(goalState)) {
    fail('INVALID_GOAL_OBSERVATION', 'Supply an observed Codex Goal state or leave it unobserved');
  }
  const events = continuationEvents(run);
  const directive = currentDirective(run);
  const risk = continuationRisk(run, epoch);
  let action = 'SELECT_OR_RESUME_EPOCH';
  if (directive?.data.action === 'pause') action = 'WAIT_FOR_EXPLICIT_CONTINUE';
  else if (replanPending(directive, risk)) action = 'COMPLETE_REQUESTED_REPLAN';
  else if (goalState === 'paused') action = 'RESUME_CODEX_GOAL_IN_APP';
  else if (goalState === 'complete') action = 'VERIFY_GOAL_COMPLETION';
  else if (risk.strategy_review_required) action = 'STRATEGY_REVIEW_REQUIRED';
  else if (epoch?.state === 'INTEGRATION_BLOCKED') action = 'RESUME_INTEGRATION';
  else if (['REVIEW_RUNNING', 'REVIEW_INTERRUPTED_RESUMABLE'].includes(epoch?.state))
    action = 'OBSERVE_SAME_REVIEWER_RUNTIME';
  else if (epoch && pr.headRefOid !== epoch.candidate_sha)
    action = 'CHECK_CURRENT_HEAD_CI_AND_REFRESH_CANDIDATE';
  else if (epoch?.state === 'REVIEW_PASSED')
    action = 'CHECK_PROFILE_DISPOSITION_AND_INTEGRATION_GATES';
  else if (epoch?.state === 'REVIEW_READY') action = 'RESERVE_SAME_REVIEWER';
  else if (epoch) action = epoch.next_action || 'IMPLEMENT_CURRENT_EPOCH';
  const product = run.outer_sol?.product;
  return {
    schema: 'bangumi-continuation-brief/v1',
    authoritative_source: 'GitHub Run Issue and Epoch PR',
    sequence: events.length,
    latest_human_directive: directive,
    requested_replan_pending: replanPending(directive, risk),
    codex_goal_observation: goalState,
    app_goal_resume_is_not_performed_by_harness: true,
    next_action: action,
    plan_ref: 'docs/agent/RUN95_RECOVERY_PLAN.md',
    run_state: run.state,
    active_epoch_pr: run.active_epoch_pr,
    epoch_state: epoch?.state ?? null,
    candidate_sha: epoch?.candidate_sha ?? null,
    live_pr_head: pr?.headRefOid ?? null,
    live_pr_base: pr?.baseRefOid ?? null,
    product_review_slots_remaining: product
      ? product.max - product.consumed - product.reserved
      : null,
    epoch_review_slots_remaining: epoch?.review
      ? epoch.review.max - epoch.review.consumed - epoch.review.reserved
      : null,
    latest_review: epoch?.review_history?.at(-1) ?? null,
    risk,
    recent_checkpoints: events.filter((event) => event.type === 'checkpoint').slice(-3),
    authority:
      'Advisory routing only. Existing exact CI, review, claim and merge gates still apply.',
  };
}
