import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { historyFixture as fixture } from './fixtures/history-segments.mjs';
import { appendContinuationEvent, continuationEvents } from '../../scripts/lib/harness-continuation.mjs';
import {
  attachHistorySegment, historyContext, hydrateRunHistory, makeHistorySegment,
  persistRunHistory, verifyHistoryComment,
} from '../../scripts/lib/harness-history-segments.mjs';

const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const context = historyContext({ number: 95, url: 'https://github.com/example/repo/issues/95' });
function segment(run, count = 64, offset = 0, id = 123) {
  const draft = makeHistorySegment(continuationEvents(run).slice(offset, offset + count), context, sha(run));
  const comment = { id, user: { login: 'fixture-operator' }, issue_url: context.apiIssueUrl, body: draft.body };
  return { draft, comment };
}
const hasCode = code => error => error.code === code;

test('cold prefix roundtrip preserves every event, unknown field, claim and budget', () => {
  const run = fixture(); const { draft, comment } = segment(run);
  const hydrated = attachHistorySegment(run, context, draft, comment);
  const stored = persistRunHistory(hydrated);
  assert.equal(stored.continuation.events.length, 23);
  assert.equal(stored.continuation.storage, undefined);
  const restored = hydrateRunHistory(JSON.parse(JSON.stringify(stored)), { context,
    resolve: id => { assert.equal(id, 123); return comment; } });
  assert.deepEqual(restored, hydrated);
  delete restored.continuation.storage;
  assert.deepEqual(restored, run);
  assert.equal(continuationEvents(restored).length, 87);
  assert.equal(run.continuation.storage, undefined);
});

test('append follows the complete historical hash chain and old continue, never only the hot tail', () => {
  const run = fixture(); const { draft, comment } = segment(run);
  const archived = attachHistorySegment(run, context, draft, comment);
  const next = appendContinuationEvent(archived, null, { type: 'directive', action: 'continue',
    source_ref: 'user-message:after-archive', reason: 'A genuinely new directive.' }, 87);
  const stored = persistRunHistory(next);
  const restored = hydrateRunHistory(stored, { context, resolve: () => comment });
  assert.equal(continuationEvents(restored).length, 88);
  assert.equal(restored.continuation.events.at(-1).previous_sha256, run.continuation.events.at(-1).sha256);
  assert.deepEqual(restored.outer_sol, run.outer_sol);
});

test('pure readers cannot silently interpret unresolved prefixes or persist an unhydrated tail', () => {
  const run = fixture(); const { draft, comment } = segment(run);
  const stored = persistRunHistory(attachHistorySegment(run, context, draft, comment));
  assert.throws(() => hydrateRunHistory(stored), hasCode('HISTORY_RESOLVER_REQUIRED'));
  assert.throws(() => persistRunHistory(stored), hasCode('HISTORY_NOT_HYDRATED'));
});

test('wrong comment, owner, repository, Issue, author, payload or digest refuses', () => {
  const run = fixture(); const { draft, comment } = segment(run);
  const stored = persistRunHistory(attachHistorySegment(run, context, draft, comment));
  for (const change of [c => c.id++, c => c.user.login = 'foreign-user',
    c => c.issue_url = 'https://api.github.com/repos/other/repo/issues/95',
    c => c.issue_url = 'https://api.github.com/repos/example/repo/issues/96',
    c => c.body += '\n', c => c.body = c.body.replace('gzip+base64', 'unsupported')]) {
    const changed = structuredClone(comment); change(changed);
    assert.throws(() => hydrateRunHistory(stored, { context, resolve: () => changed }));
  }
  assert.throws(() => hydrateRunHistory(stored, { context: { ...context, issue: 96 }, resolve: () => comment }),
    hasCode('HISTORY_STORAGE_INVALID'));
});

test('missing, duplicate, cyclic and malformed references refuse before or during resolution', () => {
  const run = fixture(); const { draft, comment } = segment(run);
  const original = persistRunHistory(attachHistorySegment(run, context, draft, comment));
  for (const change of [s => s.segments.push(s.segments[0]), s => s.segments[0].comment_id = -1,
    s => s.segments[0].count = true, s => s.segments[0].count = 65,
    s => s.segments[0].first_sequence = 2, s => s.segments[0].previous_sha256 = 'a'.repeat(64),
    s => s.segments[0].bytes = 4 * 1024 * 1024 + 1, s => s.extra = true]) {
    const stored = structuredClone(original); change(stored.continuation.archived_prefix);
    assert.throws(() => hydrateRunHistory(stored, { context, resolve: () => { throw Error('not resolved'); } }));
  }
  assert.throws(() => hydrateRunHistory(original, { context, resolve: () => null }), hasCode('HISTORY_COMMENT_MISMATCH'));
});

test('changed hot tail or immutable prefix cannot be written back', () => {
  const run = fixture(); const { draft, comment } = segment(run);
  const hydrated = attachHistorySegment(run, context, draft, comment);
  const changed = structuredClone(hydrated); changed.continuation.events[0].data.action = 'continue';
  assert.throws(() => persistRunHistory(changed), hasCode('INVALID_CONTINUATION_HISTORY'));
  const stored = persistRunHistory(hydrated); stored.continuation.events[0].previous_sha256 = null;
  assert.throws(() => hydrateRunHistory(stored, { context, resolve: () => comment }), hasCode('INVALID_CONTINUATION_HISTORY'));
});

test('multiple segments are contiguous, pinned and bounded while unknown metadata survives', () => {
  const run = fixture(150); const a = segment(run, 64, 0, 123), b = segment(run, 64, 64, 456);
  const first = attachHistorySegment(run, context, a.draft, a.comment);
  const second = attachHistorySegment(first, context, b.draft, b.comment);
  const stored = persistRunHistory(second);
  assert.equal(stored.continuation.events.length, 22);
  const restored = hydrateRunHistory(stored, { context, resolve: id => id === 123 ? a.comment : b.comment });
  assert.deepEqual(restored, second);
  assert.deepEqual(restored.continuation.unknownJournalField, { exact: true });
});

test('segment preparation is deterministic, gzip-only and cannot emit old text mentions', () => {
  const run = fixture(); const { draft, comment } = segment(run);
  assert.deepEqual(draft, segment(run).draft);
  assert.equal(draft.body.includes('user-message:'), false);
  assert.match(draft.body, /gzip\+base64/u);
  assert.equal(verifyHistoryComment(comment, context, draft).length, 64);
  assert.throws(() => makeHistorySegment(run.continuation.events.slice(0, 15), context, sha(run)),
    hasCode('HISTORY_SEGMENT_INPUT_INVALID'));
});

test('legacy states are left byte-semantically unchanged and reserved-field collisions refuse', () => {
  const run = fixture();
  assert.equal(hydrateRunHistory(run), run);
  assert.equal(persistRunHistory(run), run);
  const changed = structuredClone(run); changed.continuation.storage = { unknown: 'must not erase' };
  assert.throws(() => hydrateRunHistory(changed), hasCode('HISTORY_RESERVED_FIELD'));
});

test('whole hydrated state, rather than just each prefix or the hot body, has the original4MiB cap', () => {
  const run = fixture(); const { draft, comment } = segment(run);
  const hydrated = attachHistorySegment(run, context, draft, comment);
  const stored = persistRunHistory(hydrated);
  const size = Buffer.byteLength(JSON.stringify(hydrated));
  stored.otherEvidence = 'x'.repeat(4 * 1024 * 1024 - size);
  assert.ok(Buffer.byteLength(JSON.stringify(stored)) < 4 * 1024 * 1024);
  assert.throws(() => hydrateRunHistory(stored, { context, resolve: () => comment }), hasCode('CONTROL_STATE_TOO_LARGE'));
  hydrated.otherEvidence = stored.otherEvidence;
  assert.throws(() => persistRunHistory(hydrated), hasCode('CONTROL_STATE_TOO_LARGE'));
});

test('segment expansion bombs are bounded even when body and declared byte metadata are pinned', () => {
  const run = fixture(); const { draft, comment } = segment(run);
  const encoded = { schema: 'bangumi-harness-control/gzip-v1', codec: 'gzip+base64',
    marker: 'bangumi-harness:v3:continuation-segment', bytes: 1, sha256: 'a'.repeat(64),
    data: gzipSync(Buffer.alloc(4 * 1024 * 1024 + 1, 65)).toString('base64') };
  comment.body = '<!-- bangumi-harness:v3:continuation-segment:start -->\n```json\n' + JSON.stringify(encoded) +
    '\n```\n<!-- bangumi-harness:v3:continuation-segment:end -->';
  const expected = { ...draft, bytes: 1, body_sha256: createHash('sha256').update(comment.body).digest('hex') };
  assert.throws(() => verifyHistoryComment(comment, context, expected), hasCode('CONTROL_ARCHIVE_INVALID'));
});
