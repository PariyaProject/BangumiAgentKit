// Explicit storage maintenance; no Product action, event append or budget use.
// All GitHub I/O is injected so uncertain writes can be exercised offline.
import { canonicalHash } from './frontier-ledger.mjs';
import {
  HarnessInvariantError, isTerminalRunState, renderRunBody,
} from './agent-harness-core.mjs';
import { continuationEvents, repackContinuationHistory } from './harness-continuation.mjs';
import {
  attachHistorySegment, historyContext, makeHistorySegment, verifyHistoryComment,
} from './harness-history-segments.mjs';

const fail = (code, message) => { throw new HarnessInvariantError(code, message); };

function requireObserved(result, expected, sequence) {
  if (result.view.state !== 'OPEN' || isTerminalRunState(result.state.state)) {
    fail('CONTINUATION_RUN_NOT_ACTIVE', 'Archive only an open nonterminal Run');
  }
  if (!/^[a-f0-9]{64}$/u.test(expected) || canonicalHash(result.state) !== expected) {
    fail('CONTINUATION_STATE_DRIFT', 'Read the complete current Run before storage maintenance');
  }
  if (!Number.isSafeInteger(sequence) || continuationEvents(result.state).length !== sequence) {
    fail('STALE_CONTINUATION_SEQUENCE', 'Read the current continuation sequence');
  }
}

function requireSameRun(latest, original, expected, sequence) {
  requireObserved(latest, expected, sequence);
  if (latest.view.number !== original.view.number || latest.view.url !== original.view.url) {
    fail('HISTORY_CONTEXT_INVALID', 'Run identity changed during storage maintenance');
  }
}

export function prepareHistoryArchive(observed, expected, sequence, author) {
  requireObserved(observed, expected, sequence);
  const context = historyContext(observed.view);
  const expanded = repackContinuationHistory(observed.state, sequence);
  const events = continuationEvents(expanded);
  const archived = expanded.continuation.storage?.segments.reduce((n, ref) => n + ref.count, 0) ?? 0;
  const available = Math.min(64, events.length - archived - 16);
  if (available < 16) return null;
  // Keep at least 16 recent events hot. Large individual events can reduce a
  // segment, but never silently drop or summarize one to make it fit.
  for (let count = available; count >= 16; count -= 1) {
    let segment;
    try { segment = makeHistorySegment(events.slice(archived, archived + count), context, expected); }
    catch (error) {
      if (error.code === 'HISTORY_SEGMENT_TOO_LARGE') continue;
      throw error;
    }
    const preview = attachHistorySegment(expanded, context, segment, {
      id: Number.MAX_SAFE_INTEGER, user: { login: author }, issue_url: context.apiIssueUrl, body: segment.body,
    });
    if (Buffer.byteLength(renderRunBody(preview)) > 65_536) {
      // Smaller prefixes cannot rescue a body that still fails after the
      // largest fitting prefix. Refuse before creating an orphan comment.
      fail('CONTROL_BODY_TOO_LARGE', 'The proposed history segment does not free enough body capacity');
    }
    return { context, expanded, segment };
  }
  fail('HISTORY_SEGMENT_TOO_LARGE', 'No bounded prefix fits; keep the existing Run unchanged');
}

export function archiveContinuationHistory(io, { expected, sequence, planOnly = false }) {
  const observed = io.readRun();
  const author = io.currentActor();
  const plan = prepareHistoryArchive(observed, expected, sequence, author);
  if (!plan) return { state: 'CONTINUATION_HISTORY_ALREADY_CURRENT', sequence };
  const { context, expanded, segment } = plan;
  const summary = { sequence, previous_state_sha256: expected, transaction: segment.transaction,
    first_sequence: segment.first_sequence, count: segment.count,
    segment_body_bytes: Buffer.byteLength(segment.body), segment_body_sha256: segment.body_sha256 };
  if (planOnly) return { state: 'CONTINUATION_HISTORY_ARCHIVE_PLANNED', ...summary };

  // Inventory first, including after an uncertain earlier POST/PATCH. Identical
  // deterministic transactions reuse the sole existing verified comment. A
  // comment alone is never authority until referenced by the Run body.
  const candidates = io.listComments().filter(comment => comment.body === segment.body);
  if (candidates.length > 1) fail('HISTORY_ORPHAN_AMBIGUOUS', 'Inspect duplicate archive comments before another write');
  requireSameRun(io.readRun(), observed, expected, sequence);
  let comment;
  if (candidates.length === 1) {
    comment = candidates[0];
  } else {
    try { comment = io.createComment(segment.body); }
    catch {
      fail('HISTORY_COMMENT_WRITE_UNCERTAIN', 'Inspect the same Run and comment inventory; never blindly repeat a POST');
    }
  }
  verifyHistoryComment(comment, context, { ...segment, author });
  const pinned = { ...segment, comment_id: comment.id, author };
  verifyHistoryComment(io.readComment(comment.id), context, pinned);
  requireSameRun(io.readRun(), observed, expected, sequence);
  const next = attachHistorySegment(expanded, context, segment, comment);
  try { io.writeRun(next); }
  catch {
    fail('HISTORY_RUN_WRITE_UNCERTAIN', 'Inspect the Run and existing comment before further maintenance');
  }
  const saved = io.readRun();
  if (saved.view.state !== 'OPEN' || isTerminalRunState(saved.state.state) ||
      saved.view.number !== observed.view.number || saved.view.url !== observed.view.url ||
      canonicalHash(saved.state) !== canonicalHash(next)) {
    fail('CONTINUATION_READBACK_MISMATCH', 'Inspect the Run; do not repeat archive or Product actions');
  }
  return { state: 'CONTINUATION_HISTORY_ARCHIVED', ...summary, comment_id: comment.id,
    state_sha256: canonicalHash(saved.state), body_bytes: Buffer.byteLength(renderRunBody(saved.state)) };
}
