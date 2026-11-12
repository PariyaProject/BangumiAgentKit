import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  observeAgentMcpFailure,
  FAILURE_OBSERVATION_LIMITS as LIMITS,
} from '../../scripts/lib/agent-mcp-failure-observation.mjs';
import { publishAgentMcpFailure } from '../../scripts/lib/agent-mcp-failure-publication.mjs';
import { inspectG03ModelResult } from '../../scripts/acceptance/run-native-g03-date-png-model.mjs';
import { normalizeAgentMcpProfileDiagnostics } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  G03_MODEL_PROFILE as P,
  G03_MODEL_SERVER_ID as SERVER,
} from '../../scripts/lib/native-g03-date-png-profile.mjs';
import { validateG03ModelReport } from '../../scripts/acceptance/native-g03-date-png-report.mjs';

const expected = { server: SERVER, calls: P.calls };
const call = (errorCode = 'G03_NATIVE_RESULT_INVALID', overrides = {}) => ({
  type: 'item.completed',
  item: {
    type: 'mcp_tool_call',
    id: 'one',
    server: SERVER,
    tool: P.toolName,
    arguments: P.calls[0].arguments,
    status: 'completed',
    result: {
      isError: true,
      structuredContent: { errorCode },
      content: [{ type: 'text', text: JSON.stringify({ errorCode }) }],
    },
    ...overrides,
  },
});
const processFor = (items) => {
  const events = [
    { type: 'thread.started' },
    { type: 'turn.started' },
    ...items,
    { type: 'turn.completed' },
  ];
  let stdout = events.map((e) => JSON.stringify(e)).join('\n') + '\n';
  if (Buffer.byteLength(stdout) < 4096) stdout += ' '.repeat(4096 - Buffer.byteLength(stdout));
  return {
    stdout,
    stdoutBytes: Buffer.byteLength(stdout),
    stderrBytes: 0,
    exitCode: 0,
    reason: null,
  };
};
const observe = (items, extra = {}) =>
  observeAgentMcpFailure({ expected, processResult: processFor(items), ...extra });
const native = (phase = 'FAILED', extra = {}) =>
  JSON.stringify({
    schema: 'native-g03-date-png-server-summary/v1',
    closed: true,
    observation: { phase, searchRequests: 1, detailRequests: 0, denied: 1 },
    ...extra,
  });
const noAuthority = (o) => {
  assert.equal(o.observationOnly, true);
  assert.equal(o.acceptanceCredit, false);
  assert.equal(o.retryAllowed, false);
  assert.deepEqual(o.verified, { model: false, source: false, artifact: false, cleanup: false });
};

test('minimal frozen-path collapse stays historical; the offline seam preserves distinct safe errors', () => {
  const a = processFor([call('G03_NATIVE_OPERATION_DENIED')]);
  const b = processFor([call('G03_NATIVE_RESULT_INVALID')]);
  const old = (p) => {
    const r = inspectG03ModelResult(p, null, {});
    return normalizeAgentMcpProfileDiagnostics({
      schemaVersion: 1,
      reasonCode: r.reason,
      checks: r.checks,
      counters: r.counters,
    });
  };
  assert.deepEqual(old(a), old(b), 'executed historical program remains unchanged');
  const currentA = observeAgentMcpFailure({ expected, processResult: a });
  const currentB = observeAgentMcpFailure({ expected, processResult: b });
  assert.notDeepEqual(currentA, currentB);
  assert.deepEqual(currentA.calls[0].errorCodes, ['G03_NATIVE_OPERATION_DENIED']);
  assert.deepEqual(currentB.calls[0].errorCodes, ['G03_NATIVE_RESULT_INVALID']);
  assert.equal(currentA.native.reportedPhase, null);
  assert.throws(
    () => normalizeAgentMcpProfileDiagnostics({ ...old(a), calls: currentA.calls }),
    /allowlisted/u,
  );
  noAuthority(currentA);
});

test('retains only expected public shape and closed errors, never raw names, values, text or answers', () => {
  for (let n = 0; n < 64; n++) {
    const secret = `PRIVATE_TOKEN_${n}_do_not_retain`;
    const e = call(secret, {
      server: secret,
      tool: secret,
      arguments: {
        media: secret,
        from: { [secret]: secret },
        rating: { min: secret, [secret]: secret },
        [secret]: secret,
      },
      result: {
        isError: true,
        structuredContent: { errorCode: secret, private: secret },
        content: [{ type: 'text', text: secret }],
      },
      error: { code: secret, message: secret },
    });
    const o = observe(
      [e, { type: 'item.completed', item: { type: 'agent_message', text: secret } }],
      { serverSummary: JSON.stringify({ private: secret }), stage: secret },
    );
    assert.equal(JSON.stringify(o).includes(secret), false);
    assert.deepEqual(o.calls[0].errorCodes, ['UNCLASSIFIED_TOOL_ERROR']);
    assert.equal(o.calls[0].serverMatches, false);
    assert.equal(o.calls[0].toolMatches, false);
    assert.equal(o.calls[0].arguments.matches, false);
    assert.equal(o.calls[0].arguments.unexpectedFields, 2);
    assert.equal(o.calls[0].arguments.fields.find((x) => x.path === 'rating.min').type, 'string');
    noAuthority(o);
  }
});

test('deduplicates partial lifecycle IDs, records identity changes, and keeps earlier error facts', () => {
  const started = { type: 'item.started', item: { id: 'one', type: 'mcp_tool_call' } };
  const e = call();
  let o = observe([started, e]);
  assert.equal(o.calls.length, 1);
  assert.equal(o.calls[0].identityChanged, false);
  assert.equal(o.calls[0].arguments.matches, true);
  const changed = call('G03_NATIVE_OPERATION_DENIED', {
    arguments: { ...P.calls[0].arguments, from: null },
  });
  o = observe([e, changed]);
  assert.equal(o.calls.length, 1);
  assert.equal(o.calls[0].identityChanged, true);
  assert.equal(o.calls[0].completionEvents, 2);
  assert.equal(o.calls[0].arguments.matches, false);
  assert.deepEqual(o.calls[0].errorCodes, [
    'G03_NATIVE_OPERATION_DENIED',
    'G03_NATIVE_RESULT_INVALID',
  ]);
});

test('normalizes snake-case result fields and reports conflicting aliases conservatively', () => {
  const e = call(undefined, {
    result: { is_error: true, structured_content: { errorCode: 'INVALID_ARGUMENTS' } },
  });
  assert.deepEqual(observe([e]).calls[0].errorCodes, ['INVALID_ARGUMENTS']);
  e.item.result.isError = false;
  const o = observe([e]);
  assert.equal(o.calls[0].aliasConflict, true);
  assert.equal(o.calls[0].state, 'failed');
  assert.deepEqual(observe([call(undefined, { error: { code: -32602 } })]).calls[0].errorCodes, [
    'G03_NATIVE_RESULT_INVALID',
    'RPC_INVALID_PARAMS',
  ]);
});

test('separates missing, malformed, partial and bounded streams without turning them into success', () => {
  const build = (stdout, reason = null) =>
    observeAgentMcpFailure({ expected, processResult: { stdout, reason } });
  assert.equal(build('').stream.status, 'missing');
  assert.equal(build('{').stream.status, 'malformed');
  assert.equal(build(JSON.stringify(call())).stream.status, 'partial');
  assert.equal(build('x'.repeat(LIMITS.lineBytes + 1)).stream.status, 'limited');
  const huge = build(' '.repeat(LIMITS.inputBytes + 1), 'AGENT_MCP_PROCESS_OUTPUT_LIMIT');
  assert.equal(huge.stream.status, 'limited');
  assert.equal(huge.process.reason, 'output_limit');
  noAuthority(huge);
  const many = build(
    Array.from({ length: LIMITS.events + 1 }, () => '{"type":"turn.started"}').join('\n'),
  );
  assert.equal(many.stream.eventCount, LIMITS.events);
  assert.equal(many.stream.status, 'limited');
  const calls = Array.from({ length: LIMITS.calls + 1 }, (_, n) =>
    call('INTERNAL_ERROR', { id: `n${n}` }),
  );
  assert.equal(observe(calls).calls.length, LIMITS.calls);
  assert.equal(observe(calls).stream.status, 'limited');
});

test('native summary fields are reported facts, never verified cleanup, source or artifact evidence', () => {
  for (const phase of ['READY', 'RUNNING', 'QUERY_VERIFIED', 'COMPLETE', 'FAILED', 'STOPPED']) {
    const o = observe([call()], { serverSummary: native(phase) });
    assert.equal(o.native.reportedPhase, phase);
    assert.equal(o.native.reportedClosed, true);
    noAuthority(o);
  }
  assert.equal(observe([], { serverSummary: '{}' }).native.status, 'invalid');
  assert.equal(observe([], { serverSummary: { phase: 'COMPLETE' } }).native.status, 'invalid');
  assert.equal(observe([], { serverSummary: 'x'.repeat(65537) }).native.status, 'oversize');
  const o = observe([], {
    serverSummary: native('PRIVATE_PHASE', {
      closed: 'true',
      observation: { phase: 'PRIVATE_PHASE', searchRequests: 999, detailRequests: -1 },
    }),
  });
  assert.equal(o.native.reportedPhase, null);
  assert.equal(o.native.reportedClosed, null);
  assert.equal(o.native.searchRequests, null);
  assert.equal(o.native.detailRequests, null);
});

test('hostile nested aliases remain diagnosable while oversized trusted policies fail explicitly', () => {
  const nested = '{"x":'.repeat(6000) + '0' + '}'.repeat(6000);
  const different = '{"x":'.repeat(6000) + '1' + '}'.repeat(6000);
  const stdout =
    '{"type":"item.completed","item":{"type":"mcp_tool_call","id":"one","server":"' +
    SERVER +
    '","tool":"' +
    P.toolName +
    '","status":"completed","result":{"isError":true,"structuredContent":' +
    nested +
    ',"structured_content":' +
    different +
    '}}}';
  const o = observeAgentMcpFailure({ expected, processResult: { stdout } });
  assert.equal(o.calls[0].aliasConflict, true);
  assert.deepEqual(o.calls[0].errorCodes, ['UNCLASSIFIED_TOOL_ERROR']);
  noAuthority(o);
  for (const argumentsValue of [
    { tags: Array.from({ length: 17 }, () => 'x') },
    { query: { a: { b: { c: { d: { e: 1 } } } } } },
    Object.fromEntries(Array.from({ length: 33 }, (_, n) => [`k${n}`, 0])),
    { value: 'x'.repeat(257) },
  ]) {
    assert.throws(
      () =>
        observeAgentMcpFailure({
          expected: {
            server: SERVER,
            calls: [{ toolName: P.toolName, arguments: argumentsValue }],
          },
        }),
      /POLICY_INVALID/u,
    );
  }
});

function directories() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bgk-failure-test-'));
  const executionDirectory = path.join(root, 'execution'),
    directory = path.join(root, 'observations');
  fs.mkdirSync(executionDirectory, { mode: 0o700 });
  fs.mkdirSync(directory, { mode: 0o700 });
  return {
    root,
    executionDirectory,
    directory,
    close: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

test('private first-result publication survives cleanup for every synthetic failure stage', () => {
  for (const stage of [
    'preflight',
    'startup',
    'tool',
    'inspection',
    'publication',
    'acknowledgement',
    'cleanup',
  ]) {
    const d = directories();
    try {
      fs.writeFileSync(
        path.join(d.executionDirectory, 'private-summary.json'),
        'PRIVATE_NATIVE_RAW',
      );
      const o = observe([call()], { stage, serverSummary: native() });
      assert.equal(publishAgentMcpFailure(o, d).published, true);
      fs.rmSync(d.executionDirectory, { recursive: true });
      const target = path.join(d.directory, 'agent-mcp-failure-observation.json');
      const retained = JSON.parse(fs.readFileSync(target));
      assert.deepEqual(retained, o);
      assert.equal(fs.statSync(target).mode & 0o777, 0o600);
      assert.equal(JSON.stringify(retained).includes('PRIVATE_NATIVE_RAW'), false);
      noAuthority(retained);
    } finally {
      d.close();
    }
  }
});

test('publication refuses raw objects, overwrite, unsafe directories, symlinks and cleanup descendants', () => {
  const d = directories();
  const o = observe([call()]);
  try {
    assert.throws(() => publishAgentMcpFailure({ ...o, raw: 'PRIVATE' }, d), /NOT_PRODUCED/u);
    assert.throws(
      () =>
        publishAgentMcpFailure(o, {
          directory: d.executionDirectory,
          executionDirectory: d.executionDirectory,
        }),
      /PUBLICATION_FAILED/u,
    );
    const inside = path.join(d.executionDirectory, 'inside');
    fs.mkdirSync(inside, { mode: 0o700 });
    assert.throws(
      () =>
        publishAgentMcpFailure(o, { directory: inside, executionDirectory: d.executionDirectory }),
      /PUBLICATION_FAILED/u,
    );
    const link = path.join(d.root, 'linked');
    fs.symlinkSync(d.directory, link);
    assert.throws(
      () =>
        publishAgentMcpFailure(o, { directory: link, executionDirectory: d.executionDirectory }),
      /PUBLICATION_FAILED/u,
    );
    fs.chmodSync(d.directory, 0o755);
    assert.throws(() => publishAgentMcpFailure(o, d), /PUBLICATION_FAILED/u);
    fs.chmodSync(d.directory, 0o700);
    const target = path.join(d.directory, 'agent-mcp-failure-observation.json');
    fs.symlinkSync(path.join(d.root, 'outside'), target);
    assert.throws(() => publishAgentMcpFailure(o, d), /PUBLICATION_FAILED/u);
    fs.unlinkSync(target);
    publishAgentMcpFailure(o, d);
    const first = fs.readFileSync(target);
    assert.throws(
      () => publishAgentMcpFailure(observe([call('TIMEOUT')]), d),
      /PUBLICATION_FAILED/u,
    );
    assert.deepEqual(fs.readFileSync(target), first);
  } finally {
    d.close();
  }
});

test('stdin CLI remains offline, creates only sanitized observations and rejects run/invalid input', () => {
  const script = new URL('../../scripts/acceptance/observe-agent-mcp-failure.mjs', import.meta.url)
    .pathname;
  const run = (argv, input) =>
    spawnSync(process.execPath, [script, ...argv], { input, encoding: 'utf8', timeout: 5000 });
  const d = directories();
  try {
    const secret = 'PRIVATE_STDERR_MUST_NOT_SURVIVE';
    for (const reason of [
      'AGENT_MCP_PROCESS_TIMED_OUT',
      'AGENT_MCP_PROCESS_OUTPUT_LIMIT',
      'AGENT_MCP_PROCESS_SPAWN_FAILED',
      null,
    ]) {
      const processResult = { ...processFor([call('CANCELLED')]), reason, stderr: secret };
      const x = run([], JSON.stringify({ expected, processResult, stage: 'tool' }));
      assert.equal(x.status, 0, x.stderr);
      assert.equal(x.stdout.includes(secret), false);
      noAuthority(JSON.parse(x.stdout));
    }
    const published = run(
      ['--output-directory', d.directory, '--execution-directory', d.executionDirectory],
      JSON.stringify({ expected, processResult: processFor([call()]) }),
    );
    assert.equal(published.status, 0, published.stderr);
    assert.equal(run(['--run'], '').status, 2);
    assert.equal(run([], secret).status, 2);
    assert.equal(run([], secret).stdout.includes(secret), false);
    assert.equal(run([], 'x'.repeat(12 * 1024 * 1024 + 1)).status, 2);
  } finally {
    d.close();
  }
});

test('a durability failure cannot return publication success or disclose an OS error', () => {
  const d = directories(),
    original = fs.fsyncSync;
  try {
    fs.fsyncSync = () => {
      throw new Error('PRIVATE_OS_DETAIL');
    };
    assert.throws(
      () => publishAgentMcpFailure(observe([call()]), d),
      (error) => error.message === 'FAILURE_OBSERVATION_PUBLICATION_FAILED',
    );
    const target = path.join(d.directory, 'agent-mcp-failure-observation.json');
    assert.equal(fs.readFileSync(target, 'utf8').includes('PRIVATE_OS_DETAIL'), false);
  } finally {
    fs.fsyncSync = original;
    d.close();
  }
});

test('a complete synthetic success stream remains diagnostic-only and cannot validate as an acceptance report', () => {
  const first = call(undefined, {
    result: { isError: false, content: [{ type: 'text', text: 'synthetic only' }] },
  });
  const second = structuredClone(first);
  second.item.id = 'two';
  second.item.tool = P.calls[1].toolName;
  const o = observe([first, second], { serverSummary: native('COMPLETE') });
  assert.equal(o.stream.status, 'complete');
  assert.equal(o.calls.length, 2);
  noAuthority(o);
  assert.equal(validateG03ModelReport(o, {}).passed, false);
});

test('output saturation fails explicitly instead of publishing a clipped or raw observation', () => {
  const argumentsValue = Object.fromEntries(
    Array.from({ length: 32 }, (_, n) => [
      `${'f'.repeat(45)}${String(n).padStart(2, '0')}`,
      'known',
    ]),
  );
  const policy = {
    server: SERVER,
    calls: Array.from({ length: 8 }, () => ({ toolName: P.toolName, arguments: argumentsValue })),
  };
  const codes = [
    'G03_NATIVE_OPERATION_DENIED',
    'G03_NATIVE_RESULT_INVALID',
    'G03_NATIVE_FIXTURE_REQUEST_INVALID',
    'G03_NATIVE_RENDER_INVALID',
    'G03_NATIVE_CANCELLED',
    'G03_NATIVE_EXECUTION_FAILED',
    'G03_NATIVE_ARTIFACT_INVALID',
    'G03_NATIVE_OBSERVATION_FAILED',
    'G03_MODEL_CONTROL_QUERY_FAILED',
    'G03_MODEL_REVIEW_GATE_FAILED',
    'G03_MODEL_SOURCE_GATE_FAILED',
    'G03_MODEL_CLAIM_READBACK_FAILED',
    'G03_MODEL_NATIVE_CONSTRUCTION_FAILED',
    'G03_MODEL_SERVER_START_FAILED',
  ];
  const items = Array.from({ length: 8 }, (_, n) =>
    codes.map((code) => call(code, { id: `n${n}`, arguments: argumentsValue })),
  ).flat();
  assert.throws(
    () => observeAgentMcpFailure({ expected: policy, processResult: processFor(items) }),
    /OUTPUT_LIMIT/u,
  );
});

test('even expected metadata cannot introduce private tool or field names into an offline receipt', () => {
  const secret = 'private_identifier_123456';
  const policy = {
    server: SERVER,
    calls: [{ toolName: P.toolName, arguments: { [secret]: secret } }],
  };
  const o = observeAgentMcpFailure({
    expected: policy,
    processResult: processFor([call('TIMEOUT', { arguments: { [secret]: secret } })]),
  });
  assert.equal(JSON.stringify(o).includes(secret), false);
  assert.equal(o.calls[0].arguments.fields[0].path, '$field1');
  assert.throws(
    () =>
      observeAgentMcpFailure({
        expected: { server: SERVER, calls: [{ toolName: secret, arguments: {} }] },
      }),
    /POLICY_INVALID/u,
  );
});

test('a syntactically complete captured prefix is limited when the producer reports truncation', () => {
  for (const change of [{ reason: 'AGENT_MCP_PROCESS_OUTPUT_LIMIT' }, { stdoutBytes: 8192 }]) {
    const processResult = { ...processFor([call()]), ...change };
    const o = observeAgentMcpFailure({ expected, processResult });
    assert.equal(o.stream.status, 'limited');
    noAuthority(o);
  }
});
