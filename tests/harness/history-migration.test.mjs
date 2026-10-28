import assert from 'node:assert/strict';
import test from 'node:test';
import { archiveContinuationHistory, historyInventorySha } from '../../scripts/lib/harness-history-migration.mjs';
import { canonicalHash } from '../../scripts/lib/frontier-ledger.mjs';
import { parseControlBlock, renderRunBody, RUN_MARKER } from '../../scripts/lib/agent-harness-core.mjs';
import { historyContext } from '../../scripts/lib/harness-history-segments.mjs';
import { historyFixture } from './fixtures/history-segments.mjs';

function fixture(count = 87) {
  const run = historyFixture(count), view = { number: 95, state: 'OPEN',
    url: 'https://github.com/example/repo/issues/95' };
  const context = historyContext(view), comments = [];
  const calls = { post: 0, patch: 0, reads: 0, inventory: 0 };
  let body = renderRunBody(run);
  const io = {
    currentActor: () => 'fixture-operator',
    readRun: () => {
      calls.reads++;
      return { view: { ...view }, state: parseControlBlock(body, RUN_MARKER, { context,
        resolve: id => comments.find(comment => comment.id === id) }) };
    },
    listComments: () => { calls.inventory++; return comments; },
    createComment: body => {
      calls.post++;
      const comment = { id: comments.length + 1, issue_url: context.apiIssueUrl,
        user: { login: 'fixture-operator' }, body };
      comments.push(comment); return comment;
    },
    readComment: id => comments.find(comment => comment.id === id),
    writeRun: next => { calls.patch++; body = renderRunBody(next); },
  };
  return { run, view, comments, calls, io, options: { expected: canonicalHash(run), sequence: count,
    expectedInventory: canonicalHash([]) } };
}
const code = expected => error => error.code === expected;

test('plan is read-only; migration preserves all87 events, directive83, claims, budgets and unknown fields', () => {
  const f = fixture();
  const plan = archiveContinuationHistory(f.io, { ...f.options, planOnly: true });
  assert.equal(plan.count, 64);
  assert.deepEqual([f.calls.post, f.calls.patch, f.calls.inventory], [0, 0, 1]);
  assert.equal(plan.expected_inventory_sha256, canonicalHash([]));
  const result = archiveContinuationHistory(f.io, f.options);
  assert.equal(result.state, 'CONTINUATION_HISTORY_ARCHIVED');
  const saved = f.io.readRun().state;
  assert.equal(saved.continuation.storage.segments.length, 1);
  delete saved.continuation.storage;
  assert.deepEqual(saved, f.run);
  assert.equal(saved.continuation.events[82].data.action, 'continue');
  assert.deepEqual([f.calls.post, f.calls.patch], [1, 1]);
});

for (const where of ['initial', 'prepost', 'prepatch', 'readback']) {
  test(`closed metadata at ${where} refuses without further writes`, () => {
    const f = fixture(); const read = f.io.readRun;
    const at = { initial: 1, prepost: 2, prepatch: 3, readback: 4 }[where];
    f.io.readRun = () => { const result = read(); if (f.calls.reads === at) result.view.state = 'CLOSED'; return result; };
    assert.throws(() => archiveContinuationHistory(f.io, f.options));
    assert.equal(f.calls.post, at >= 3 ? 1 : 0);
    assert.equal(f.calls.patch, at >= 4 ? 1 : 0);
  });
}

test('stale state/sequence, terminal Run and concurrent budget drift refuse', () => {
  for (const mode of ['state', 'sequence', 'terminal', 'concurrent']) {
    const f = fixture(); const read = f.io.readRun;
    if (mode === 'state') f.options.expected = '0'.repeat(64);
    if (mode === 'sequence') f.options.sequence--;
    f.io.readRun = () => {
      const result = read();
      if (mode === 'terminal') result.state.state = 'STOPPED_NO_SAFE_WORK';
      if (mode === 'concurrent' && f.calls.reads === 3) result.state.outer_sol.product.consumed++;
      return result;
    };
    assert.throws(() => archiveContinuationHistory(f.io, f.options));
    assert.equal(f.calls.patch, 0);
  }
});

test('uncertain POST stops; explicit recovery inventories and reuses its unique verified orphan', () => {
  const f = fixture(); const post = f.io.createComment;
  f.io.createComment = body => { post(body); throw Error('lost response'); };
  assert.throws(() => archiveContinuationHistory(f.io, f.options), code('HISTORY_COMMENT_WRITE_UNCERTAIN'));
  assert.deepEqual([f.calls.post, f.calls.patch], [1, 0]);
  f.io.createComment = () => assert.fail('orphan must be reused, not posted again');
  archiveContinuationHistory(f.io, f.options);
  assert.deepEqual([f.calls.post, f.calls.patch], [1, 1]);
});

test('failed PATCH keeps orphan; completed uncertain PATCH is detected by fresh state and cannot duplicate', () => {
  for (const applied of [false, true]) {
    const f = fixture(); const patch = f.io.writeRun;
    f.io.writeRun = next => { if (applied) patch(next); throw Error('lost response'); };
    assert.throws(() => archiveContinuationHistory(f.io, f.options), code('HISTORY_RUN_WRITE_UNCERTAIN'));
    f.io.writeRun = patch;
    if (applied) assert.throws(() => archiveContinuationHistory(f.io, f.options), code('CONTINUATION_STATE_DRIFT'));
    else archiveContinuationHistory(f.io, f.options);
    assert.deepEqual([f.calls.post, f.calls.patch], [1, 1]);
  }
});

test('ambiguous/foreign/edited orphan or corrupt readback cannot authorize a PATCH', () => {
  for (const mode of ['duplicate', 'author', 'issue', 'id', 'edited-readback']) {
    const f = fixture(); const post = f.io.createComment;
    f.io.createComment = body => { post(body); throw Error('lost response'); };
    assert.throws(() => archiveContinuationHistory(f.io, f.options));
    f.io.createComment = post;
    if (mode === 'duplicate') f.comments.push({ ...f.comments[0], id: 9 });
    if (mode === 'author') f.comments[0].user.login = 'other';
    if (mode === 'issue') f.comments[0].issue_url += '0';
    if (mode === 'id') f.comments[0].id = -1;
    if (mode === 'edited-readback') f.io.readComment = () => ({ ...f.comments[0], body: 'edited' });
    assert.throws(() => archiveContinuationHistory(f.io, f.options));
    assert.equal(f.calls.post, 1);
    assert.equal(f.calls.patch, 0);
  }
});

test('small journal no-op and segmented no-op require fresh exact state and retain hot tail', () => {
  const small = fixture(31);
  assert.equal(archiveContinuationHistory(small.io, small.options).state, 'CONTINUATION_HISTORY_ALREADY_CURRENT');
  assert.deepEqual([small.calls.post, small.calls.patch], [0, 0]);
  const f = fixture(80);
  archiveContinuationHistory(f.io, f.options);
  const current = f.io.readRun().state;
  const result = archiveContinuationHistory(f.io, { ...f.options, expected: canonicalHash(current) });
  assert.equal(result.state, 'CONTINUATION_HISTORY_ALREADY_CURRENT');
  assert.equal(current.continuation.storage.segments[0].count, 64);
  assert.deepEqual([f.calls.post, f.calls.patch], [1, 1]);
});

test('inventory errors and lost readback stop at the observed boundary with no automatic replay', () => {
  const inventory = fixture();
  inventory.io.listComments = () => { throw Error('inventory unavailable'); };
  assert.throws(() => archiveContinuationHistory(inventory.io, inventory.options));
  assert.deepEqual([inventory.calls.post, inventory.calls.patch], [0, 0]);
  const f = fixture(); const read = f.io.readRun;
  f.io.readRun = () => { if (f.calls.reads === 3) throw Error('readback unavailable'); return read(); };
  assert.throws(() => archiveContinuationHistory(f.io, f.options), /readback unavailable/u);
  assert.deepEqual([f.calls.post, f.calls.patch], [1, 1]);
});

test('edited orphan, even with its entire marker removed, refuses a second POST under the original plan', () => {
  for (const body of ['newline', 'marker-removed']) {
    const f = fixture(); const post = f.io.createComment;
    f.io.createComment = content => { post(content); throw Error('lost response'); };
    assert.throws(() => archiveContinuationHistory(f.io, f.options), code('HISTORY_COMMENT_WRITE_UNCERTAIN'));
    f.io.createComment = post;
    f.comments[0].body = body === 'newline' ? f.comments[0].body + '\n' : 'edited orphan';
    assert.throws(() => archiveContinuationHistory(f.io, f.options),
      code(body === 'newline' ? 'HISTORY_ORPHAN_UNRESOLVED' : 'HISTORY_INVENTORY_DRIFT'));
    assert.deepEqual([f.calls.post, f.calls.patch], [1, 0]);
  }
});

test('inventory digest pins existing comments, bounds identities and rejects unsolicited changes before POST', () => {
  const f = fixture();
  const comment = { id: 9, body: 'existing ordinary comment', user: { login: 'fixture-operator' },
    issue_url: 'https://api.github.com/repos/example/repo/issues/95' };
  f.comments.push(comment);
  const plan = archiveContinuationHistory(f.io, { ...f.options, planOnly: true });
  assert.notEqual(plan.expected_inventory_sha256, f.options.expectedInventory);
  f.options.expectedInventory = plan.expected_inventory_sha256;
  f.comments[0].body += ' edited';
  assert.throws(() => archiveContinuationHistory(f.io, f.options), code('HISTORY_INVENTORY_DRIFT'));
  assert.deepEqual([f.calls.post, f.calls.patch], [0, 0]);
  const context = historyContext(f.view);
  assert.throws(() => historyInventorySha([comment, comment], context), code('HISTORY_INVENTORY_INVALID'));
  assert.throws(() => historyInventorySha([{ ...comment, issue_url: 'foreign' }], context), code('HISTORY_INVENTORY_INVALID'));
  f.comments[0].body = 'existing ordinary comment';
  archiveContinuationHistory(f.io, f.options);
  assert.deepEqual([f.calls.post, f.calls.patch], [1, 1]);
});
