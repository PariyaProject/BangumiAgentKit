import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import {
  CONTROL_ARCHIVE_SCHEMA,
  MAX_CONTROL_STATE_BYTES,
  decodeControlState,
  encodeControlState,
} from '../../scripts/lib/harness-control-codec.mjs';
import {
  EPOCH_MARKER, RUN_MARKER, createEpochState, createRunState,
  parseControlBlock, renderControlBlock, renderRunBody, replaceControlBlock,
} from '../../scripts/lib/agent-harness-core.mjs';
import { appendContinuationEvent, continuationEvents } from '../../scripts/lib/harness-continuation.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const python = (json, marker = RUN_MARKER) => spawnSync('python3', ['-c',
  'import json,sys;sys.path.insert(0,"scripts");from harness_control_codec import decode_control_state;' +
  'print(json.dumps(decode_control_state(sys.stdin.read(),sys.argv[1]),ensure_ascii=False))', marker],
  { cwd: root, input: json, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const error = (code) => (err) => err.code === code;
function archive(bytes, marker = RUN_MARKER) {
  return { schema: CONTROL_ARCHIVE_SCHEMA, codec: 'gzip+base64', marker,
    bytes: bytes.length, sha256: digest(bytes), data: gzipSync(bytes).toString('base64') };
}
function largeState() {
  const run = createRunState({ runId: 'codec-synthetic' });
  run.outer_sol.product = { max: 463, consumed: 458, reserved: 0 };
  run.original_claim = { state: 'INCONCLUSIVE', reportWritten: false, retryAllowed: false, sha256: 'a'.repeat(64) };
  run.immutable_history = Array.from({ length: 450 }, (_, i) => ({
    index: i, candidate: String(i).padStart(40, '0'), passed: false,
    reason: '完整保留历史、失败原因与计数；no acceptance credit',
  }));
  return appendContinuationEvent(run, null, { type: 'directive', action: 'continue',
    source_ref: 'synthetic:continue', reason: 'Current instruction wins over historical pause text.' }, 0);
}

test('codec preserves small legacy JSON byte representation and old additive normalization', () => {
  const state = createRunState({ runId: 'old-json' });
  assert.equal(encodeControlState(state, RUN_MARKER), JSON.stringify(state));
  assert.deepEqual(parseControlBlock(renderRunBody(state), RUN_MARKER), state);
  const legacy = structuredClone(state); delete legacy.outer_sol.runtime_recovery;
  const parsed = parseControlBlock(renderRunBody(legacy), RUN_MARKER);
  assert.deepEqual(parsed.outer_sol.runtime_recovery, state.outer_sol.runtime_recovery);
  assert.deepEqual(JSON.parse(python(JSON.stringify(state)).stdout), state);
});

test('large Run roundtrip retains every field, claim, budget and continuation event hash', () => {
  const state = largeState(), before = JSON.stringify(state);
  assert.ok(Buffer.byteLength(before) > 65536);
  const body = renderRunBody(state);
  assert.ok(Buffer.byteLength(body) < 32768);
  assert.deepEqual(parseControlBlock(body, RUN_MARKER), state);
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(continuationEvents(parseControlBlock(body, RUN_MARKER)), continuationEvents(state));
});

test('large Epoch uses same codec and replacement preserves unrelated body text', () => {
  const epoch = createEpochState({ epochId: 'codec-epoch', baseSha: 'a'.repeat(40), objective: 'Synthetic',
    questions: ['Synthetic?'], workPackages: ['codec'], nonScope: ['product'], acceptanceCriteria: ['same state'] });
  epoch.retained_history = largeState().immutable_history;
  const block = renderControlBlock(EPOCH_MARKER, epoch);
  assert.deepEqual(parseControlBlock(block, EPOCH_MARKER), epoch);
  assert.deepEqual(JSON.parse(python(encodeControlState(epoch, EPOCH_MARKER), EPOCH_MARKER).stdout), epoch);
  const replaced = replaceControlBlock(`before\n${block}\nafter`, EPOCH_MARKER, epoch);
  assert.ok(replaced.startsWith('before\n')); assert.ok(replaced.endsWith('\nafter'));
});

test('JS encoder and Python acceptance reader agree on large Unicode history', () => {
  const state = largeState(), encoded = encodeControlState(state, RUN_MARKER);
  assert.equal(JSON.parse(encoded).schema, CONTROL_ARCHIVE_SCHEMA);
  const result = python(encoded);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), state);
});

for (const [field, value] of [['codec', 'unknown'], ['marker', EPOCH_MARKER], ['bytes', true],
  ['bytes', MAX_CONTROL_STATE_BYTES + 1], ['bytes', 1], ['sha256', '0'.repeat(64)],
  ['data', 'not base64!'], ['data', ''], ['unexpected', 'must not be ignored']]) {
  test(`invalid archive ${field}=${String(value).slice(0, 20)} is rejected in JS and Python`, () => {
    const encoded = JSON.parse(encodeControlState(largeState(), RUN_MARKER)); encoded[field] = value;
    const json = JSON.stringify(encoded);
    assert.throws(() => decodeControlState(json, RUN_MARKER), error('CONTROL_ARCHIVE_INVALID'));
    assert.notEqual(python(json).status, 0);
  });
}

test('gzip corruption, truncated payload and noncanonical base64 never produce state', () => {
  for (const mode of ['corrupt', 'truncate', 'noncanonical']) {
    const encoded = archive(Buffer.from(JSON.stringify(largeState())));
    if (mode === 'corrupt') encoded.data = Buffer.from('not gzip').toString('base64');
    if (mode === 'truncate') encoded.data = Buffer.from(encoded.data, 'base64').subarray(0, -1).toString('base64');
    if (mode === 'noncanonical') encoded.data += '\n';
    const json = JSON.stringify(encoded);
    assert.throws(() => decodeControlState(json, RUN_MARKER), error('CONTROL_ARCHIVE_INVALID'));
    assert.notEqual(python(json).status, 0);
  }
});

test('decompression bomb is bounded even with forged small declared length', () => {
  const encoded = archive(Buffer.alloc(MAX_CONTROL_STATE_BYTES + 1, 65)); encoded.bytes = 1;
  const json = JSON.stringify(encoded);
  assert.throws(() => decodeControlState(json, RUN_MARKER), error('CONTROL_ARCHIVE_INVALID'));
  assert.notEqual(python(json).status, 0);
});

test('nonstandard JSON constants are rejected in plain state and archived payload in both languages', () => {
  for (const value of ['NaN', 'Infinity', '-Infinity']) {
    const raw = `{"schema":"bangumi-harness/v3","unknown":${value}}`;
    for (const json of [raw, JSON.stringify(archive(Buffer.from(raw)))]) {
      assert.throws(() => decodeControlState(json, RUN_MARKER));
      assert.notEqual(python(json).status, 0, `Python must reject ${value}`);
    }
    const envelope = JSON.stringify(archive(Buffer.from('{}'))).replace(/"bytes":2/u, `"bytes":${value}`);
    assert.throws(() => decodeControlState(envelope, RUN_MARKER));
    assert.notEqual(python(envelope).status, 0);
  }
});

test('nested archive, invalid UTF8, nonobject JSON and wrong schema are not control states', () => {
  for (const bytes of [Buffer.from(JSON.stringify({ schema: CONTROL_ARCHIVE_SCHEMA })), Buffer.from([0xff]),
    Buffer.from('[]'), Buffer.from('{"schema":"wrong"}')]) {
    const json = JSON.stringify(archive(bytes));
    const block = `<!-- ${RUN_MARKER}:start -->\n\`\`\`json\n${json}\n\`\`\`\n<!-- ${RUN_MARKER}:end -->`;
    assert.throws(() => parseControlBlock(block, RUN_MARKER));
    const py = python(json);
    if (bytes.equals(Buffer.from('{"schema":"wrong"}'))) {
      // Schema policy belongs to the existing caller in both languages.
      assert.equal(py.status, 0); assert.equal(JSON.parse(py.stdout).schema, 'wrong');
    } else assert.notEqual(py.status, 0);
  }
});

test('gzip member concatenation and zero padding have identical bounded decoding', () => {
  const state = createRunState({ runId: 'multi-member' });
  const bytes = Buffer.from(JSON.stringify(state)), middle = Math.floor(bytes.length / 2);
  const encoded = archive(bytes);
  encoded.data = Buffer.concat([gzipSync(bytes.subarray(0, middle)), gzipSync(bytes.subarray(middle)), Buffer.alloc(3)]).toString('base64');
  const json = JSON.stringify(encoded);
  assert.deepEqual(decodeControlState(json, RUN_MARKER), state);
  assert.deepEqual(JSON.parse(python(json).stdout), state);
});

test('writer retains a visible bound and never silently drops incompressible evidence', () => {
  const state = largeState();
  state.random_evidence = Array.from({ length: 5000 }, (_, index) => digest(Buffer.from('salt:' + index)));
  const encoded = encodeControlState(state, RUN_MARKER);
  assert.ok(Buffer.byteLength(encoded) > 65536);
  assert.deepEqual(decodeControlState(encoded, RUN_MARKER), state);
  assert.throws(() => encodeControlState({ x: 'x'.repeat(MAX_CONTROL_STATE_BYTES) }, RUN_MARKER), error('CONTROL_STATE_TOO_LARGE'));
});
