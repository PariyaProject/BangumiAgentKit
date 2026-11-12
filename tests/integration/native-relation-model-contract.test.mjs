import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createRelationSafetyMcpServer } from '../../scripts/acceptance/native-relation-safety-mcp.mjs';
import {
  createRelationModelTransportHost,
  readRelationModelServerGate,
  main as serverMain,
} from '../../scripts/acceptance/native-relation-model-server.mjs';
import { relationModelReportFixture } from '../harness/fixtures/native-relation-model-report.mjs';
import {
  validRelationModelSnapshot,
  relationModelResultSha,
} from '../../scripts/acceptance/native-relation-model-report.mjs';
import {
  RELATION_MODEL_PROFILE as P,
  RELATION_MODEL_SERVER_ID as server,
} from '../../scripts/lib/native-relation-model-profile.mjs';
import {
  projectRelationModelAnswer,
  relationModelAnswerMatches,
  relationModelWireResult,
} from '../../scripts/lib/native-relation-model-answer.mjs';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { observeAgentMcpFailure } from '../../scripts/lib/agent-mcp-failure-observation.mjs';
import { publishAgentMcpFailure } from '../../scripts/lib/agent-mcp-failure-publication.mjs';

let results, snapshot;
before(async () => {
  const host = createRelationSafetyMcpServer();
  const client = new Client({ name: 'relation-model-contract-test', version: '1.0.0' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  try {
    await host.server.connect(st);
    await client.connect(ct);
    results = [];
    for (const c of P.calls) {
      const result = await client.callTool({
        name: c.toolName,
        arguments: structuredClone(c.arguments),
      });
      assert.notEqual(result.isError, true);
      results.push(result);
    }
    snapshot = host.snapshot();
  } finally {
    await client.close();
    await host.close();
  }
});

test('private child gate rejects unsafe files and a consumed startup latch before control access', async () => {
  const fixture = relationModelReportFixture();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bgk-relation-model-gate-test-'));
  const gate = path.join(directory, 'gate.json');
  const bytes = JSON.stringify({ claim: fixture.claim });
  try {
    fs.chmodSync(directory, 0o700);
    fs.writeFileSync(gate, bytes, { mode: 0o600 });
    assert.deepEqual(readRelationModelServerGate(gate).claim, fixture.claim);
    fs.chmodSync(gate, 0o644);
    assert.throws(() => readRelationModelServerGate(gate), /RELATION_MODEL_GATE_FILE_INVALID/u);
    fs.chmodSync(gate, 0o600);
    const other = path.join(directory, 'other');
    fs.linkSync(gate, other);
    assert.throws(() => readRelationModelServerGate(gate), /RELATION_MODEL_GATE_FILE_INVALID/u);
    fs.unlinkSync(other);
    fs.renameSync(gate, other);
    fs.symlinkSync(other, gate);
    assert.throws(() => readRelationModelServerGate(gate), /RELATION_MODEL_GATE_FILE_INVALID/u);
    fs.unlinkSync(gate);
    fs.renameSync(other, gate);
    fs.writeFileSync(gate, JSON.stringify({ claim: { ...fixture.claim, retryAllowed: true } }));
    assert.throws(() => readRelationModelServerGate(gate), /RELATION_MODEL_GATE_CONTENT_INVALID/u);
    fs.writeFileSync(gate, bytes);
    const latch = path.join(directory, 'server-started.json');
    fs.writeFileSync(latch, 'consumed', { mode: 0o600 });
    await assert.rejects(serverMain(['--gate-file', gate]), /EEXIST/u);
    assert.equal(fs.readFileSync(latch, 'utf8'), 'consumed');
    assert.equal(fs.existsSync(path.join(directory, 'summary.json')), false);
    fs.chmodSync(directory, 0o755);
    assert.throws(() => readRelationModelServerGate(gate), /RELATION_MODEL_GATE_FILE_INVALID/u);
  } finally {
    fixture.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('exact distinct registered profile and semantic answer bind the actual native results', () => {
  assert.deepEqual(getAgentMcpProfileById(P.id), P);
  assert.equal(snapshot.fixtureReads, 5);
  const answer = projectRelationModelAnswer(results);
  assert.equal(answer.directRows.length, 5);
  assert.equal(answer.directRows[1].subjectId, answer.directRows[2].subjectId);
  assert.deepEqual(
    answer.directRows.slice(1, 3).map((x) => x.relation),
    ['前传', '续集'],
  );
  assert.deepEqual(
    answer.steps.map((x) => x.placement),
    ['before_root', 'root'],
  );
  assert.equal(answer.exclusions.length, 3);
  assert.equal(answer.coverage.relationRowsObserved, 6);
  assert.equal(answer.scope.sourceCompleteness, 'not_provided_by_source');
  assert(relationModelAnswerMatches(JSON.stringify(answer), answer));
  for (const edit of [
    (v) => v.directRows.splice(2, 1),
    (v) => v.steps.reverse(),
    (v) => {
      v.steps[0].subjectId = v.exclusions[0].subjectId;
    },
    (v) => {
      v.scope.canonicalOrderEstablished = true;
    },
    (v) => {
      v.scope.omissionsProveAbsence = true;
    },
    (v) => {
      v.exclusions[0].reason = 'media_type_not_anime';
    },
    (v) => {
      v.coverage.relationRowsObserved = 5;
    },
    (v) => {
      v.extra = 'unobserved';
    },
  ]) {
    const bad = structuredClone(answer);
    edit(bad);
    assert.equal(relationModelAnswerMatches(JSON.stringify(bad), answer), false);
  }
  assert.equal(relationModelAnswerMatches('x'.repeat(4097), answer), false);
  assert.equal(relationModelAnswerMatches('not JSON', answer), false);
});

test('normal wire aliases agree, while conflicting or malformed flags cannot borrow valid source data', () => {
  const full = results[1];
  const wire = relationModelWireResult(full);
  assert.deepEqual(
    relationModelWireResult({
      content: full.content,
      structured_content: full.structuredContent,
      is_error: false,
    }),
    wire,
  );
  for (const bad of [
    { ...full, structured_content: { forged: true } },
    { ...full, isError: false, is_error: true },
    { ...full, isError: 'false' },
    { ...full, isError: true },
    { ...full, content: [{ type: 'text', text: 'x'.repeat(3601) }] },
  ])
    assert.throws(() => relationModelWireResult(bad), /RELATION_MODEL_WIRE_RESULT_INVALID/u);
  const bad = structuredClone(results);
  bad[1].structuredContent.watchOrder[0].position = 9;
  assert.throws(() => projectRelationModelAnswer(bad), /RELATION_MODEL_WIRE_RESULT_INVALID/u);
});

test('new native summary retains only reported closed facts and a branded private observation survives cleanup', () => {
  const canary = 'private-canary-not-retained';
  const observation = observeAgentMcpFailure({
    expected: { server, calls: P.calls },
    processResult: {
      stdout:
        JSON.stringify({
          type: 'item.completed',
          item: {
            id: canary,
            type: 'mcp_tool_call',
            server,
            tool: P.toolName,
            arguments: P.calls[0].arguments,
            status: 'failed',
            result: {
              isError: true,
              structuredContent: {
                errorCode: 'NATIVE_RELATION_OBSERVATION_FAILED',
                message: canary,
              },
            },
          },
        }) + '\n',
      reason: null,
      exitCode: 0,
      stdoutBytes: 1,
      stderrBytes: 42,
    },
    serverSummary: JSON.stringify({
      schema: 'native-relation-safety-server-summary/v1',
      sourceMode: 'native-synthetic-relation-safety',
      observation: {
        ...snapshot,
        phase: 'FAILED',
        failure: { code: 'NATIVE_RELATION_OPERATION_DENIED', stage: 'source', message: canary },
      },
      closed: true,
      private: canary,
    }),
    stage: 'inspection',
  });
  assert.equal(JSON.stringify(observation).includes(canary), false);
  assert.equal(observation.native.fixtureReads, 5);
  assert.equal(observation.native.completedCalls, 2);
  assert.equal(observation.native.reportedFailureCode, 'NATIVE_RELATION_OPERATION_DENIED');
  assert.equal(observation.native.reportedNativeStage, 'source');
  assert.deepEqual(observation.verified, {
    model: false,
    source: false,
    artifact: false,
    cleanup: false,
  });
  assert.equal(observation.acceptanceCredit, false);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'relation-diagnostic-test-'));
  const executionDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'relation-execution-test-'));
  try {
    publishAgentMcpFailure(observation, { directory, executionDirectory });
    fs.rmSync(executionDirectory, { recursive: true });
    const retained = JSON.parse(
      fs.readFileSync(path.join(directory, 'agent-mcp-failure-observation.json')),
    );
    assert.equal(retained.native.reportedClosed, true);
    assert.equal(retained.retryAllowed, false);
    assert.equal(retained.acceptanceCredit, false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
    fs.rmSync(executionDirectory, { recursive: true, force: true });
  }
});

test('model bridge observes actual normal SDK results and closes native resources before final reply', async () => {
  const snapshots = [];
  const host = await createRelationModelTransportHost({
    onChange: () => snapshots.push(host.snapshot()),
  });
  const client = new Client({ name: 'relation-model-bridge-test', version: '1.0.0' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  try {
    await host.server.connect(st);
    await client.connect(ct);
    const received = [];
    for (const c of P.calls)
      received.push(
        await client.callTool({ name: c.toolName, arguments: structuredClone(c.arguments) }),
      );
    assert(received.every((r) => r.isError !== true));
    const s = host.snapshot();
    assert(validRelationModelSnapshot(s.observation));
    assert.equal(s.closed, true);
    assert.equal(s.captureFailed, false);
    assert.deepEqual(s.resultSha256, received.map(relationModelResultSha));
    assert.deepEqual(projectRelationModelAnswer(received), projectRelationModelAnswer(results));
    assert.equal(snapshots.at(-1).observation.closed, true);
    assert.equal(
      (await client.callTool({ name: P.toolName, arguments: P.calls[0].arguments })).isError,
      true,
    );
    assert.equal(host.snapshot().protocolDenied, 1);
    assert.equal(host.snapshot().observation.fixtureReads, 5);
  } finally {
    await client.close();
    await host.close();
    await host.close();
  }
});

test('overlapping SDK calls permanently deny the bridge without completing a second native operation', async () => {
  const host = await createRelationModelTransportHost();
  const client = new Client({ name: 'relation-model-overlap-test', version: '1.0.0' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  try {
    await host.server.connect(st);
    await client.connect(ct);
    const outcomes = await Promise.allSettled(
      P.calls.map((c) =>
        client.callTool({ name: c.toolName, arguments: structuredClone(c.arguments) }),
      ),
    );
    assert(outcomes.some((o) => o.status === 'fulfilled' && o.value.isError === true));
    const snapshot = host.snapshot();
    assert.equal(snapshot.captureFailed, true);
    assert.equal(snapshot.closed, true);
    assert(snapshot.protocolDenied >= 1);
    assert(snapshot.observation.completedCalls < 2);
    assert(snapshot.observation.fixtureReads <= 5);
    const reads = snapshot.observation.fixtureReads;
    assert.equal(
      (await client.callTool({ name: P.toolName, arguments: P.calls[0].arguments })).isError,
      true,
    );
    assert.equal(host.snapshot().observation.fixtureReads, reads);
  } finally {
    await client.close();
    await host.close();
  }
});
