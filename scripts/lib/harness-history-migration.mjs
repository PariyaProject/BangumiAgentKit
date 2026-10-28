// Explicit storage maintenance; no Product action, event append or budget use.
// All GitHub I/O is injected so uncertain writes can be exercised offline.
import { canonicalHash } from './frontier-ledger.mjs';
import { createHash } from 'node:crypto';
import {
  HarnessInvariantError, isTerminalRunState, renderRunBody,
} from './agent-harness-core.mjs';
import { continuationEvents, repackContinuationHistory } from './harness-continuation.mjs';
import {
  attachHistorySegment, historyContext, HISTORY_SEGMENT_MARKER, makeHistorySegment, verifyHistoryComment,
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

export function historyInventorySha(comments, context) {
  if (!Array.isArray(comments) || comments.length > 3200) fail('HISTORY_INVENTORY_INVALID', 'Invalid bounded comment inventory');
  const ids = new Set();
  let bytes = 0;
  const entries = comments.map(comment => {
    if (!Number.isSafeInteger(comment?.id) || comment.id < 1 || ids.has(comment.id) ||
        typeof comment.user?.login !== 'string' || !comment.user.login ||
        typeof comment.body !== 'string' || comment.issue_url !== context.apiIssueUrl) {
      fail('HISTORY_INVENTORY_INVALID', 'Comment inventory identity or body is invalid');
    }
    ids.add(comment.id);
    bytes += Buffer.byteLength(comment.body);
    if (bytes > 16 * 1024 * 1024) fail('HISTORY_INVENTORY_TOO_LARGE', 'Comment inventory exceeds its shared bound');
    return { id: comment.id, author: comment.user.login, issue_url: comment.issue_url,
      body_sha256: createHash('sha256').update(comment.body).digest('hex') };
  });
  return canonicalHash(entries.sort((a, b) => a.id - b.id));
}

export function archiveContinuationHistory(io, { expected, sequence, expectedInventory, planOnly = false }) {
  const observed = io.readRun();
  const author = io.currentActor();
  const plan = prepareHistoryArchive(observed, expected, sequence, author);
  if (!plan) return { state: 'CONTINUATION_HISTORY_ALREADY_CURRENT', sequence };
  const { context, expanded, segment } = plan;
  const summary = { sequence, previous_state_sha256: expected, transaction: segment.transaction,
    first_sequence: segment.first_sequence, count: segment.count,
    segment_body_bytes: Buffer.byteLength(segment.body), segment_body_sha256: segment.body_sha256 };
  // Inventory first, including after an uncertain earlier POST/PATCH. Identical
  // deterministic transactions reuse the sole existing verified comment. A
  // comment alone is never authority until referenced by the Run body.
  const comments = io.listComments();
  historyInventorySha(comments, context); // Validate all identities, uniqueness and aggregate bounds.
  const candidates = comments.filter(comment => comment.body === segment.body);
  if (candidates.length > 1) fail('HISTORY_ORPHAN_AMBIGUOUS', 'Inspect duplicate archive comments before another write');
  const referenced = new Set(expanded.continuation.storage?.segments.map(ref => ref.comment_id) ?? []);
  if (comments.some(comment => !referenced.has(comment.id) && comment.body.includes(HISTORY_SEGMENT_MARKER) &&
      comment.body !== segment.body)) {
    fail('HISTORY_ORPHAN_UNRESOLVED', 'Inspect edited or unresolved archive comments; do not prepare a replacement');
  }
  if (candidates.length === 1) verifyHistoryComment(candidates[0], context, { ...segment, author });
  const baseline = candidates.length === 1 ? comments.filter(comment => comment.id !== candidates[0].id) : comments;
  const baselineSha = historyInventorySha(baseline, context);
  if (planOnly) return { state: 'CONTINUATION_HISTORY_ARCHIVE_PLANNED', ...summary,
    expected_inventory_sha256: baselineSha, reusable_orphan_id: candidates[0]?.id ?? null };
  if (typeof expectedInventory !== 'string' || !/^[a-f0-9]{64}$/u.test(expectedInventory) || expectedInventory !== baselineSha) {
    fail('HISTORY_INVENTORY_DRIFT', 'Use the inspected original plan inventory; reconcile any change before another write');
  }
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
