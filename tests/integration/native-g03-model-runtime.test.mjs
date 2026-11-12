import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createG03NativeMcpServer } from '../../scripts/acceptance/g03-native-discovery-mcp.mjs';
import { createG03ModelWireObservation } from '../../scripts/lib/native-g03-date-png-wire.mjs';
import {
  readG03ModelServerGate,
  createG03ModelTransportHost,
} from '../../scripts/acceptance/native-g03-date-png-server.mjs';
import {
  inspectG03ModelResult,
  runG03ModelProcess,
} from '../../scripts/acceptance/run-native-g03-date-png-model.mjs';
import {
  G03_MODEL_PROFILE as P,
  G03_MODEL_SERVER_ID as SERVER,
} from '../../scripts/lib/native-g03-date-png-profile.mjs';
import {
  g03ModelSha,
  buildG03ModelReport,
  validateG03ModelReport,
} from '../../scripts/acceptance/native-g03-date-png-report.mjs';
import { canonicalAgentMcpProfileJson as canonical } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { g03ModelReportFixture } from '../harness/fixtures/native-g03-model-report.mjs';

test('immediate model exit cannot race native PNG cleanup', { timeout: 15000 }, async () => {
  const f = g03ModelReportFixture(),
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bgk-g03-date-png-model-'));
  try {
    fs.writeFileSync(path.join(directory, 'test-input.json'), JSON.stringify(f.claim));
    const processResult = await runG03ModelProcess(
      process.execPath,
      [new URL('fixtures/native-g03-immediate-exit.mjs', import.meta.url).pathname, directory],
      { timeoutMs: 10000, maxStdout: 8 * 1024 * 1024 },
    );
    assert.equal(processResult.exitCode, 0);
    assert.equal(processResult.reason, null);
    const summary = JSON.parse(fs.readFileSync(path.join(directory, 'model-summary.json')));
    assert.equal(
      summary.closed,
      true,
      'native runtime/artifacts must close before the final successful reply',
    );
    assert.equal(inspectG03ModelResult(processResult, summary, f.claim).passed, true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
    f.close();
  }
});

// Synthetic model events/claim only. Actual Registry, SDK, Chromium and store;
// no Codex process, GitHub control access, real claim or acceptance report.
test(
  'native resources close before the final reply and later calls cannot reopen them',
  { timeout: 15000 },
  async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bgk-g03-date-png-model-'));
    const originalTmp = process.env.TMPDIR;
    let host, client;
    try {
      process.env.TMPDIR = directory;
      host = await createG03ModelTransportHost();
      const [ct, st] = InMemoryTransport.createLinkedPair();
      client = new Client({ name: 'g03-resource-close-boundary', version: '1.0.0' });
      await host.server.connect(st);
      await client.connect(ct);
      for (const call of P.calls)
        assert.notEqual(
          (await client.callTool({ name: call.toolName, arguments: call.arguments })).isError,
          true,
        );
      assert.equal(host.snapshot().closed, true);
      assert.equal(host.snapshot().protocolDenied, 0);
      assert.deepEqual(fs.readdirSync(directory), []);
      const extra = await client.callTool({
        name: P.calls[1].toolName,
        arguments: P.calls[1].arguments,
      });
      assert.equal(extra.isError, true);
      assert.equal(host.snapshot().protocolDenied, 1);
      assert.equal(
        host.snapshot().observation.searchRequests + host.snapshot().observation.detailRequests,
        14,
      );
      assert.deepEqual(fs.readdirSync(directory), []);
    } finally {
      await client?.close();
      await host?.close();
      if (originalTmp === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = originalTmp;
      fs.rmSync(directory, { recursive: true, force: true });
    }
  },
);

test(
  'native SDK wire results and closed PNG evidence agree with the signed model contract',
  { timeout: 20000 },
  async (t) => {
    const f = g03ModelReportFixture();
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bgk-g03-date-png-model-'));
    const originalTmp = process.env.TMPDIR;
    let host, client;
    try {
      process.env.TMPDIR = directory;
      host = await createG03NativeMcpServer();
      const wire = createG03ModelWireObservation(host),
        [ct, st] = InMemoryTransport.createLinkedPair();
      const send = st.send.bind(st);
      st.send = async (message) => {
        wire.capture(message);
        await send(message);
      };
      client = new Client({ name: 'g03-synthetic-model-events', version: '1.0.0' });
      await host.server.connect(st);
      await client.connect(ct);
      const results = [];
      for (const call of P.calls)
        results.push(await client.callTool({ name: call.toolName, arguments: call.arguments }));
      const snapshot = host.snapshot();
      assert.equal(snapshot.phase, 'COMPLETE');
      assert.equal(snapshot.searchRequests + snapshot.detailRequests, 14);
      assert.equal(wire.snapshot().captureFailed, false);
      assert.equal(wire.snapshot().resultSha256.length, 2);
      assert.equal(
        fs.readdirSync(directory).some((name) => name.startsWith('bgk-g03-native-')),
        true,
      );
      await client.close();
      await host.close();
      assert.deepEqual(fs.readdirSync(directory), []);
      const artifact = wire.snapshot().artifact;
      const answer = JSON.stringify({
        rows: snapshot.observation.rows,
        bounds: {
          from: P.calls[0].arguments.from,
          to: P.calls[0].arguments.to,
          fromInclusive: true,
          toExclusive: true,
        },
        estimated: true,
        experimental: true,
        unknownDatesDependOnUpstream: true,
        artifact,
      });
      const summary = {
        schema: 'native-g03-date-png-server-summary/v1',
        sourceMode: 'native-synthetic-discovery-date-png',
        sourceRevision: f.claim.sourceCandidateSha,
        bundleSha256: f.claim.bundleSha256,
        claimSha256: g03ModelSha(canonical(f.claim)),
        serverInstanceId: '11111111-1111-4111-8111-111111111111',
        toolNames: P.toolNames,
        observation: host.snapshot(),
        ...wire.snapshot(),
        closed: true,
        protocolDenied: 0,
      };
      const events = [
        { type: 'thread.started' },
        { type: 'turn.started' },
        ...P.calls.map((call, index) => ({
          type: 'item.completed',
          item: {
            type: 'mcp_tool_call',
            id: `actual-sdk-${index}`,
            server: SERVER,
            tool: call.toolName,
            arguments: call.arguments,
            status: 'completed',
            result: results[index],
          },
        })),
        { type: 'item.completed', item: { type: 'agent_message', text: answer } },
        { type: 'turn.completed' },
      ];
      const stdout = events.map((event) => JSON.stringify(event)).join('\n') + '\n';
      const inspected = inspectG03ModelResult(
        {
          stdout,
          stdoutBytes: Buffer.byteLength(stdout),
          stderrBytes: 0,
          exitCode: 0,
          reason: null,
        },
        summary,
        f.claim,
      );
      assert.equal(inspected.passed, true, JSON.stringify(inspected.checks));
      const report = buildG03ModelReport(
        {
          claim: f.claim,
          observation: inspected.observation,
          answer: inspected.answer,
          artifact: inspected.artifact,
          execution: { ...inspected.execution, codexCliVersion: '0.167.0-alpha.3.2' },
        },
        f.privateKey,
        { root: f.root },
      );
      assert.equal(validateG03ModelReport(report, f.claim, { root: f.root }).passed, true);
      t.diagnostic(
        JSON.stringify({
          queryStructuredBytes: Buffer.byteLength(JSON.stringify(results[0].structuredContent)),
          modelEventBytes: Buffer.byteLength(stdout),
          pngBytes: snapshot.image.bytes,
          fixtureResponses: 14,
          liveBangumiHttp: 0,
        }),
      );
    } finally {
      await client?.close();
      await host?.close();
      if (originalTmp === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = originalTmp;
      fs.rmSync(directory, { recursive: true, force: true });
      f.close();
    }
  },
);

test('private native gate refuses unsafe files and modes before any control or runtime start', () => {
  const f = g03ModelReportFixture(),
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bgk-g03-date-png-model-'));
  const gate = path.join(directory, 'gate.json');
  try {
    fs.writeFileSync(gate, JSON.stringify({ claim: f.claim }), { mode: 0o600 });
    assert.equal(readG03ModelServerGate(gate).claim.claimId, f.claim.claimId);
    fs.chmodSync(gate, 0o644);
    assert.throws(() => readG03ModelServerGate(gate), /GATE_FILE_INVALID/u);
    fs.chmodSync(gate, 0o600);
    fs.chmodSync(directory, 0o755);
    assert.throws(() => readG03ModelServerGate(gate), /GATE_FILE_INVALID/u);
    fs.chmodSync(directory, 0o700);
    const other = path.join(directory, 'other.json');
    fs.writeFileSync(other, JSON.stringify({ claim: f.claim }), { mode: 0o600 });
    fs.unlinkSync(gate);
    fs.symlinkSync(other, gate);
    assert.throws(() => readG03ModelServerGate(gate), /GATE_FILE_INVALID/u);
    fs.unlinkSync(gate);
    fs.writeFileSync(gate, 'x'.repeat(65537), { mode: 0o600 });
    assert.throws(() => readG03ModelServerGate(gate), /GATE_FILE_INVALID/u);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
    f.close();
  }
});

test(
  'a failed native child startup consumes its private latch and cannot restart',
  { timeout: 15000 },
  () => {
    const f = g03ModelReportFixture(),
      directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bgk-g03-date-png-model-'));
    try {
      const gate = path.join(directory, 'gate.json');
      fs.writeFileSync(gate, JSON.stringify({ claim: f.claim }), { mode: 0o600 });
      const args = [
        new URL('../../scripts/acceptance/native-g03-date-png-server.mjs', import.meta.url)
          .pathname,
        '--gate-file',
        gate,
      ];
      const run = () =>
        spawnSync(process.execPath, args, {
          encoding: 'utf8',
          timeout: 5000,
          env: { ...process.env, HARNESS_MOCK_STATE: 'synthetic-denial-before-control' },
        });
      const first = run();
      assert.equal(first.status, 2, first.stderr);
      assert.match(first.stderr, /G03_MODEL_MOCK_CONTROL_FORBIDDEN/u);
      const latch = fs.readFileSync(path.join(directory, 'server-started.json'), 'utf8');
      const second = run();
      assert.equal(second.status, 2, second.stderr);
      assert.match(second.stderr, /G03_MODEL_SERVER_START_FAILED/u);
      assert.equal(fs.readFileSync(path.join(directory, 'server-started.json'), 'utf8'), latch);
      assert.deepEqual(fs.readdirSync(directory).sort(), ['gate.json', 'server-started.json']);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
      f.close();
    }
  },
);
