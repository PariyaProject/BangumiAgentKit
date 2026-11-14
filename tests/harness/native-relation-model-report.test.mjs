import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { sign, generateKeyPairSync } from 'node:crypto';
import { relationModelReportFixture } from './fixtures/native-relation-model-report.mjs';
import {
  RELATION_MODEL_PROFILE as P,
  RELATION_MODEL_SERVER_ID as SERVER,
} from '../../scripts/lib/native-relation-model-profile.mjs';
import { canonicalAgentMcpProfileJson as canonical } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  validateRelationModelReport,
  validateRelationModelReportFile,
  writeRelationModelReport,
  validRelationModelClaim,
} from '../../scripts/acceptance/native-relation-model-report.mjs';
import {
  inspectRelationModelResult,
  reconcileRelationModelResult,
  preflightRelationDiagnosticStorage,
} from '../../scripts/acceptance/run-native-relation-model.mjs';
import { relationModelEnvironment } from '../../scripts/lib/native-relation-model-gates.mjs';

const eventsFor = (f) => [
  { type: 'thread.started' },
  { type: 'turn.started' },
  ...P.calls.map((call, index) => ({
    type: 'item.completed',
    item: {
      type: 'mcp_tool_call',
      id: 'call' + index,
      server: SERVER,
      tool: call.toolName,
      arguments: call.arguments,
      status: 'completed',
      result: f.results[index],
    },
  })),
  { type: 'item.completed', item: { type: 'agent_message', text: f.answer } },
  { type: 'turn.completed' },
];
function inspect(f, events = eventsFor(f), summary = f.summary(), extra = {}) {
  const stdout = events.map((v) => JSON.stringify(v)).join('\n') + '\n';
  return inspectRelationModelResult(
    {
      stdout,
      stdoutBytes: Buffer.byteLength(stdout),
      stderrBytes: 0,
      exitCode: 0,
      reason: null,
      ...extra,
    },
    summary,
    f.claim,
  );
}

test('real signature/source fixture binds exact new profile, native facts and retained-diagnostic proof', () => {
  const f = relationModelReportFixture();
  try {
    assert(validRelationModelClaim(f.claim));
    const report = f.build();
    assert.deepEqual(validateRelationModelReport(report, f.claim, { root: f.root }), {
      passed: true,
    });
    writeRelationModelReport(report, f.root);
    assert.equal(validateRelationModelReportFile(f.claim, f.root).passed, true);
    assert.throws(() => writeRelationModelReport(report, f.root), /EEXIST/u);
    for (const edit of [
      (v) => {
        v.execution.model = 'gpt-6-luna';
      },
      (v) => {
        v.execution.reasoningEffort = 'max';
      },
      (v) => {
        v.execution.fixtureResponses = 6;
      },
      (v) => {
        v.execution.liveHttpRequests = 1;
      },
      (v) => {
        v.execution.diagnosticPublished = false;
      },
      (v) => {
        v.execution.cleanupComplete = false;
      },
      (v) => {
        v.execution.providerInternalHttpCount = 0;
      },
      (v) => {
        v.execution.invoiceHardCap = 0;
      },
      (v) => {
        v.observation.closed = false;
      },
      (v) => {
        v.observation.fixtureReads = 4;
      },
      (v) => {
        v.observation.observations[1].exclusions.pop();
      },
      (v) => {
        v.gate.ciSha = 'f'.repeat(40);
      },
      (v) => {
        v.gate.reviewerId = 'different';
      },
      (v) => {
        v.source.programFiles['scripts/lib/native-relation-model-cli.mjs'] = '0'.repeat(64);
      },
    ]) {
      const bad = structuredClone(report);
      edit(bad);
      const payload = { ...bad };
      delete payload.signature;
      bad.signature = sign(null, Buffer.from(canonical(payload)), f.privateKey).toString('base64');
      assert.equal(validateRelationModelReport(bad, f.claim, { root: f.root }).passed, false);
    }
    const foreign = structuredClone(report),
      { privateKey } = generateKeyPairSync('ed25519');
    const body = { ...foreign };
    delete body.signature;
    foreign.signature = sign(null, Buffer.from(canonical(body)), privateKey).toString('base64');
    assert.equal(validateRelationModelReport(foreign, f.claim, { root: f.root }).passed, false);
    fs.appendFileSync(
      path.join(f.root, 'scripts/lib/native-relation-model-cli.mjs'),
      '\n// changed\n',
    );
    assert.equal(validateRelationModelReport(report, f.claim, { root: f.root }).passed, false);
  } finally {
    f.close();
  }
});

test('inspector requires complete exact native/model event binding and rejects every extra authority path', () => {
  const f = relationModelReportFixture();
  try {
    assert.equal(inspect(f).passed, true);
    for (const edit of [
      (e) => e.splice(2, 1),
      (e) => {
        e[2].item.arguments.subjectId = 1;
      },
      (e) => {
        e[3].item.result.isError = true;
      },
      (e) => {
        e[3].item.result.structured_content = { forged: true };
      },
      (e) => {
        e[4].item.text = '{}';
      },
      (e) => e.push({ type: 'turn.started' }),
      (e) =>
        e.splice(3, 0, {
          type: 'item.completed',
          item: { type: 'command_execution', command: 'synthetic' },
        }),
      (e) => e.splice(3, 0, { type: 'item.completed', item: { type: 'unknown_tool' } }),
      (e) => e.push({ type: 'error', message: 'not retained' }),
    ]) {
      const events = structuredClone(eventsFor(f));
      edit(events);
      assert.equal(inspect(f, events).passed, false);
    }
    for (const edit of [
      (s) => {
        s.sourceRevision = 'f'.repeat(40);
      },
      (s) => {
        s.claimSha256 = '0'.repeat(64);
      },
      (s) => {
        s.closed = false;
      },
      (s) => {
        s.observation.closed = false;
      },
      (s) => {
        s.protocolDenied = 1;
      },
      (s) => {
        s.captureFailed = true;
      },
      (s) => {
        s.resultSha256[0] = '0'.repeat(64);
      },
    ]) {
      const s = f.summary();
      edit(s);
      assert.equal(inspect(f, eventsFor(f), s).passed, false);
    }
    assert.equal(inspect(f, eventsFor(f), null).passed, false);
    assert.equal(
      inspect(f, eventsFor(f), f.summary(), { reason: 'AGENT_MCP_PROCESS_TIMED_OUT' }).passed,
      false,
    );
  } finally {
    f.close();
  }
});

test('reconciliation and publication preflight have no invocation path or retry authority', () => {
  const f = relationModelReportFixture();
  try {
    const status = {
      profile_id: P.id,
      state: 'INCONCLUSIVE',
      disposition: { ...f.claim, state: 'INCONCLUSIVE' },
    };
    let writes = 0;
    const out = reconcileRelationModelResult(status, { passed: false }, null, () => {
      writes++;
    });
    assert.equal(out.retryAllowed, false);
    assert.equal(writes, 0);
    status.state = 'CLAIMED';
    status.disposition = f.claim;
    const pending = reconcileRelationModelResult(status, { passed: true }, '1'.repeat(64), () => {
      writes++;
      throw new Error();
    });
    assert.equal(pending.state, 'REPORT_ACK_PENDING');
    assert.equal(pending.retryAllowed, false);
    assert.equal(writes, 1);
    preflightRelationDiagnosticStorage();
  } finally {
    f.close();
  }
});

test('environment excludes inherited task context and source credentials without replacing auth home', () => {
  const input = {
    PATH: process.env.PATH,
    CODEX_HOME: '/synthetic/existing-auth-home',
    CODEX_THREAD_ID: 'private',
    CODEX_GOAL_ID: 'private',
    GH_TOKEN: 'private',
    BANGUMI_ACCESS_TOKEN: 'private',
    NODE_OPTIONS: 'private',
  };
  const env = relationModelEnvironment(input);
  assert.equal(env.CODEX_HOME, input.CODEX_HOME);
  for (const key of [
    'CODEX_THREAD_ID',
    'CODEX_GOAL_ID',
    'GH_TOKEN',
    'BANGUMI_ACCESS_TOKEN',
    'NODE_OPTIONS',
  ])
    assert.equal(env[key], undefined);
});
