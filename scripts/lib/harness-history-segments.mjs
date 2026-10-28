// Pure storage seam. Only the CLI adapter reads/writes GitHub; unresolved
// references never become a partial execution history in a pure reader.
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import {
  CONTROL_ARCHIVE_SCHEMA,
  ControlCodecError,
  decodeControlState,
  MAX_CONTROL_STATE_BYTES,
} from './harness-control-codec.mjs';

export const HISTORY_STORAGE_SCHEMA = 'bangumi-continuation-segments/v1';
export const HISTORY_SEGMENT_SCHEMA = 'bangumi-continuation-segment/v1';
export const HISTORY_SEGMENT_MARKER = 'bangumi-harness:v3:continuation-segment';
export const MAX_HISTORY_SEGMENTS = 64;
export const MAX_SEGMENT_BODY_BYTES = 65_536;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hash = value => sha(JSON.stringify(value));
const fail = code => { throw new ControlCodecError(code); };
const positive = value => Number.isSafeInteger(value) && value > 0;
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const exact = (value, names) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...names].sort().join(',');

export function verifyHistoryEvents(events) {
  if (!Array.isArray(events)) fail('INVALID_CONTINUATION_HISTORY');
  let previous = null;
  for (const [index, event] of events.entries()) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) fail('INVALID_CONTINUATION_HISTORY');
    const { sha256, ...payload } = event;
    if (event.sequence !== index + 1 || event.previous_sha256 !== previous ||
        sha256 !== hash(payload) || !['directive', 'checkpoint'].includes(event.type)) {
      fail('INVALID_CONTINUATION_HISTORY');
    }
    previous = sha256;
  }
  return events;
}

export function historyContext(view) {
  if (!view || !positive(view.number) || typeof view.url !== 'string') fail('HISTORY_CONTEXT_INVALID');
  let url;
  try { url = new URL(view.url); } catch { fail('HISTORY_CONTEXT_INVALID'); }
  const match = /^\/([\w.-]+)\/([\w.-]+)\/issues\/([1-9][0-9]*)$/u.exec(url.pathname);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      !match || Number(match[3]) !== view.number) fail('HISTORY_CONTEXT_INVALID');
  return { repository: match[1] + '/' + match[2], issue: view.number,
    apiIssueUrl: (url.hostname === 'github.com' ? 'https://api.github.com' : url.origin + '/api/v3') +
      '/repos/' + match[1] + '/' + match[2] + '/issues/' + view.number };
}

function storageReferences(storage, context) {
  if (!exact(storage, ['schema', 'repository', 'issue', 'segments']) ||
      storage.schema !== HISTORY_STORAGE_SCHEMA || !Array.isArray(storage.segments) ||
      storage.segments.length < 1 || storage.segments.length > MAX_HISTORY_SEGMENTS ||
      storage.repository !== context?.repository || storage.issue !== context?.issue) {
    fail('HISTORY_STORAGE_INVALID');
  }
  const ids = new Set();
  let count = 0;
  let previous = null;
  let expanded = 0;
  for (const ref of storage.segments) {
    if (!exact(ref, ['comment_id', 'author', 'transaction', 'body_sha256', 'events_sha256',
      'bytes', 'count', 'first_sequence', 'first_sha256', 'previous_sha256', 'last_sha256']) ||
        !positive(ref.comment_id) || ids.has(ref.comment_id) ||
        typeof ref.author !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}(?:\[bot\])?$/u.test(ref.author) ||
        ![ref.transaction, ref.body_sha256, ref.events_sha256, ref.first_sha256, ref.last_sha256].every(digest) ||
        !positive(ref.bytes) || !positive(ref.count) || ref.count > 64 ||
        ref.first_sequence !== count + 1 || ref.previous_sha256 !== previous) {
      fail('HISTORY_REFERENCE_INVALID');
    }
    ids.add(ref.comment_id);
    count += ref.count;
    expanded += ref.bytes;
    if (expanded > MAX_CONTROL_STATE_BYTES) fail('CONTROL_STATE_TOO_LARGE');
    previous = ref.last_sha256;
  }
  return { count, bytes: expanded };
}

function segmentFrame(body) {
  const start = '<!-- ' + HISTORY_SEGMENT_MARKER + ':start -->\n```json\n';
  const end = '\n```\n<!-- ' + HISTORY_SEGMENT_MARKER + ':end -->';
  if (typeof body !== 'string' || Buffer.byteLength(body) > MAX_SEGMENT_BODY_BYTES ||
      !body.startsWith(start) || !body.endsWith(end)) fail('HISTORY_SEGMENT_INVALID');
  return body.slice(start.length, -end.length);
}

export function makeHistorySegment(events, context, expectedStateSha256) {
  if (!Array.isArray(events) || events.length < 16 || events.length > 64 ||
      !digest(expectedStateSha256) || !positive(context?.issue) ||
      typeof context?.repository !== 'string') fail('HISTORY_SEGMENT_INPUT_INVALID');
  const eventsSha256 = hash(events);
  const transaction = hash({ repository: context.repository, issue: context.issue,
    expectedStateSha256, eventsSha256 });
  const payload = { schema: HISTORY_SEGMENT_SCHEMA, repository: context.repository,
    issue: context.issue, transaction, events };
  const raw = Buffer.from(JSON.stringify(payload));
  if (raw.length > MAX_CONTROL_STATE_BYTES) fail('CONTROL_STATE_TOO_LARGE');
  // Always gzip: old event text must never create mentions or human requests.
  const encoded = JSON.stringify({ schema: CONTROL_ARCHIVE_SCHEMA, codec: 'gzip+base64',
    marker: HISTORY_SEGMENT_MARKER, bytes: raw.length, sha256: sha(raw),
    data: gzipSync(raw).toString('base64') });
  const body = '<!-- ' + HISTORY_SEGMENT_MARKER + ':start -->\n```json\n' + encoded +
    '\n```\n<!-- ' + HISTORY_SEGMENT_MARKER + ':end -->';
  if (Buffer.byteLength(body) > MAX_SEGMENT_BODY_BYTES) fail('HISTORY_SEGMENT_TOO_LARGE');
  return { body, transaction, body_sha256: sha(body), events_sha256: eventsSha256,
    bytes: raw.length, count: events.length, first_sequence: events[0].sequence,
    first_sha256: events[0].sha256, previous_sha256: events[0].previous_sha256,
    last_sha256: events.at(-1).sha256 };
}

export function verifyHistoryComment(comment, context, expected) {
  if (!comment || !positive(comment.id) || typeof comment.user?.login !== 'string' ||
      typeof comment.body !== 'string' ||
      comment.issue_url !== context.apiIssueUrl || sha(comment.body) !== expected.body_sha256 ||
      expected.comment_id !== undefined && comment.id !== expected.comment_id ||
      expected.author !== undefined && comment.user.login !== expected.author) fail('HISTORY_COMMENT_MISMATCH');
  const encoded = segmentFrame(comment.body);
  let envelope;
  try { envelope = JSON.parse(encoded); } catch { fail('HISTORY_SEGMENT_INVALID'); }
  if (envelope.schema !== CONTROL_ARCHIVE_SCHEMA || envelope.bytes !== expected.bytes) fail('HISTORY_SEGMENT_INVALID');
  const value = decodeControlState(encoded, HISTORY_SEGMENT_MARKER);
  if (!exact(value, ['schema', 'repository', 'issue', 'transaction', 'events']) ||
      value.schema !== HISTORY_SEGMENT_SCHEMA || value.repository !== context.repository ||
      value.issue !== context.issue || value.transaction !== expected.transaction ||
      !Array.isArray(value.events) || value.events.length !== expected.count ||
      hash(value.events) !== expected.events_sha256 ||
      value.events[0]?.sequence !== expected.first_sequence || value.events[0]?.sha256 !== expected.first_sha256 ||
      value.events[0]?.previous_sha256 !== expected.previous_sha256 ||
      value.events.at(-1)?.sha256 !== expected.last_sha256) fail('HISTORY_SEGMENT_INVALID');
  return value.events;
}

export function hydrateRunHistory(run, { context, resolve } = {}) {
  const journal = run?.continuation;
  if (journal?.archived_prefix === undefined) {
    if (journal?.storage !== undefined) fail('HISTORY_RESERVED_FIELD');
    return run;
  }
  if (typeof resolve !== 'function') fail('HISTORY_RESOLVER_REQUIRED');
  context = typeof context === 'function' ? context() : context;
  if (journal.schema !== 1 || journal.archive !== undefined || journal.storage !== undefined ||
      !Array.isArray(journal.events)) fail('HISTORY_STORAGE_INVALID');
  const storage = journal.archived_prefix;
  storageReferences(storage, context);
  const prefix = [];
  for (const ref of storage.segments) {
    prefix.push(...verifyHistoryComment(resolve(ref.comment_id), context, ref));
  }
  const next = structuredClone(run);
  delete next.continuation.archived_prefix;
  next.continuation.storage = structuredClone(storage);
  next.continuation.events = [...prefix, ...next.continuation.events];
  verifyHistoryEvents(next.continuation.events);
  if (Buffer.byteLength(JSON.stringify(next)) > MAX_CONTROL_STATE_BYTES) fail('CONTROL_STATE_TOO_LARGE');
  return next;
}

export function persistRunHistory(run) {
  const journal = run?.continuation;
  if (journal?.storage === undefined) {
    if (journal?.archived_prefix !== undefined) fail('HISTORY_NOT_HYDRATED');
    return run;
  }
  const storage = journal.storage;
  const { count } = storageReferences(storage, storage);
  if (journal.archived_prefix !== undefined || journal.archive !== undefined) fail('HISTORY_STORAGE_INVALID');
  const events = verifyHistoryEvents(journal.events);
  let offset = 0;
  for (const ref of storage.segments) {
    const part = events.slice(offset, offset + ref.count);
    if (part.length !== ref.count || hash(part) !== ref.events_sha256) fail('HISTORY_PREFIX_CHANGED');
    offset += ref.count;
  }
  if (Buffer.byteLength(JSON.stringify(run)) > MAX_CONTROL_STATE_BYTES) fail('CONTROL_STATE_TOO_LARGE');
  const next = structuredClone(run);
  delete next.continuation.storage;
  next.continuation.archived_prefix = structuredClone(storage);
  next.continuation.events = events.slice(count);
  return next;
}

export function attachHistorySegment(run, context, segment, comment) {
  verifyHistoryComment(comment, context, segment);
  const next = structuredClone(run);
  const journal = next.continuation;
  const storage = journal.storage ?? { schema: HISTORY_STORAGE_SCHEMA,
    repository: context.repository, issue: context.issue, segments: [] };
  const { body, ...reference } = segment;
  void body;
  storage.segments.push({ comment_id: comment.id, author: comment.user.login, ...reference });
  journal.storage = storage;
  storageReferences(storage, context);
  persistRunHistory(next); // Pin the actual immutable prefix before accepting it.
  return next;
}
