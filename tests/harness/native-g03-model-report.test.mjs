import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { generateKeyPairSync, sign } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  G03_MODEL_PROFILE as P,
  G03_MODEL_SERVER_ID as SERVER,
  isG03ModelProfile,
} from '../../scripts/lib/native-g03-date-png-profile.mjs';
import { profileExecutionModelMatches } from '../../scripts/lib/agent-mcp-execution-model.mjs';
import { profileRequiresExactCiRunEvidence } from '../../scripts/lib/agent-mcp-profile-ci-evidence.mjs';
import {
  canonicalAgentMcpProfileJson as canonical,
  listAgentMcpProfiles,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  validateG03ModelReport,
  validateG03ModelReportFile,
  writeG03ModelReport,
  g03ModelAnswerMatches,
  g03ModelSha,
  g03ModelResultSha,
  validG03ModelSnapshot,
} from '../../scripts/acceptance/native-g03-date-png-report.mjs';
import {
  buildG03ModelCodexArgs,
  inspectG03ModelResult,
  reconcileG03ModelResult,
} from '../../scripts/acceptance/run-native-g03-date-png-model.mjs';
import {
  g03ModelEnvironment,
  readG03ModelBundleAttestation,
} from '../../scripts/lib/native-g03-date-png-gates.mjs';
import { createG03ModelWireObservation } from '../../scripts/lib/native-g03-date-png-wire.mjs';
import { g03ModelReportFixture } from './fixtures/native-g03-model-report.mjs';

test('only the exact new native G03 profile gets the new Sol execution branch', () => {
  assert.equal(profileRequiresExactCiRunEvidence(P.id), true);
  assert.equal(isG03ModelProfile(getAgentMcpProfileById(P.id)), true);
  for (const profile of listAgentMcpProfiles())
    assert.equal(profileExecutionModelMatches(profile), true);
  for (const change of [
    { model: 'gpt-6-luna', reasoningEffort: 'max' },
    { calls: P.calls.slice(0, 1) },
    { networkMode: 'live' },
    { maxAnswerBytes: 65536 },
    { toolNames: [P.toolName] },
  ])
    assert.equal(profileExecutionModelMatches({ ...P, ...change }), false);
  const old = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../docs/research/run95-native-g03-date-png-prior-contracts-2026-11-12.json',
        import.meta.url,
      ),
    ),
  );
  for (const prior of old.prior) {
    assert.deepEqual(getAgentMcpProfileById(prior.id).calls, prior.calls);
    assert.notDeepEqual(P.calls, prior.calls);
  }
});

test('signed synthetic report binds source, key, CI, artifact proof and zero live HTTP', () => {
  const f = g03ModelReportFixture();
  try {
    const report = f.build();
    assert.deepEqual(validateG03ModelReport(report, f.claim, { root: f.root }), { passed: true });
    assert.equal(report.execution.fixtureResponses, 14);
    assert.equal(report.execution.liveHttpRequests, 0);
    assert.equal(report.source.bundleSha256, readG03ModelBundleAttestation(f.root));
    writeG03ModelReport(report, f.root);
    const file = validateG03ModelReportFile(f.claim, f.root);
    assert.equal(file.passed, true);
    const verified = spawnSync(
      process.execPath,
      [path.join(f.root, 'scripts/acceptance/validate-native-g03-date-png-report.mjs')],
      {
        input: JSON.stringify({
          claim: f.claim,
          reportBytesBase64: fs.readFileSync(path.join(f.root, P.reportPath)).toString('base64'),
        }),
        encoding: 'utf8',
        timeout: 5000,
      },
    );
    assert.equal(verified.status, 0, verified.stderr);
    const output = JSON.parse(verified.stdout);
    assert.equal(output.reportSha256, file.reportSha256);
    assert.equal(output.runnerReceiptSha256, file.runnerReceiptSha256);
    for (const forbidden of ['expectedArguments"', 'rawAnswer', 'stdout', 'stderr', '搜索日期保留'])
      assert.equal(JSON.stringify(report).includes(forbidden), false);
    assert.throws(() => writeG03ModelReport(report, f.root));
    assert.equal(
      validateG03ModelReportFile(f.claim, f.root, path.join(f.root, 'other.json')).passed,
      false,
    );
    assert.equal(
      validateG03ModelReport(report, { ...f.claim, retryAllowed: true }, { root: f.root }).passed,
      false,
    );
    const forged = { ...report },
      payload = { ...report };
    delete payload.signature;
    forged.signature = sign(
      null,
      Buffer.from(canonical(payload)),
      generateKeyPairSync('ed25519').privateKey,
    ).toString('base64');
    assert.equal(validateG03ModelReport(forged, f.claim, { root: f.root }).passed, false);
  } finally {
    f.close();
  }
});

test('a valid signature cannot grant invented dates, completeness, extra work or live/account credit', () => {
  const f = g03ModelReportFixture();
  try {
    const report = f.build();
    for (const mutate of [
      (r) => {
        r.execution.sourceMode = 'native-public-fetch';
      },
      (r) => {
        r.execution.model = 'gpt-6-luna';
      },
      (r) => {
        r.execution.fixtureResponses = 13;
      },
      (r) => {
        r.execution.liveHttpRequests = 1;
      },
      (r) => {
        r.execution.cleanupComplete = false;
      },
      (r) => {
        r.execution.protocolDeniedCalls = 1;
      },
      (r) => {
        r.execution.artifactMatched = false;
      },
      (r) => {
        r.execution.codexMcpToolEventCount = 3;
      },
      (r) => {
        r.execution.providerInternalHttpCount = 0;
      },
      (r) => {
        r.observation.observation.rows.reverse();
      },
      (r) => {
        r.observation.observation.rows[3].date = '2024-04-05';
      },
      (r) => {
        r.observation.observation.coverage.totalKind = 'exact';
      },
      (r) => {
        r.observation.modelEvidence = true;
      },
      (r) => {
        r.observation.forbiddenServices = 1;
      },
      (r) => {
        r.observation.image.decoded = false;
      },
      (r) => {
        r.observation.image.width = 721;
      },
      (r) => {
        r.observation.image.bytes = 5000001;
      },
      (r) => {
        r.source.descriptors[0].auth = 'required';
      },
      (r) => {
        r.source.bundleSha256 = '2'.repeat(64);
      },
      (r) => {
        r.gate.ciChecks[0].conclusion = 'SKIPPED';
      },
      (r) => {
        r.rawAnswer = 'untrusted';
      },
    ]) {
      const value = structuredClone(report);
      mutate(value);
      const payload = { ...value };
      delete payload.signature;
      value.signature = sign(null, Buffer.from(canonical(payload)), f.privateKey).toString(
        'base64',
      );
      assert.equal(validateG03ModelReport(value, f.claim, { root: f.root }).passed, false);
    }
    assert.equal(validG03ModelSnapshot({ ...f.observation, observation: null }), false);
    const sealed = path.join(f.root, 'scripts/lib/g03-native-discovery-verification.mjs');
    fs.appendFileSync(sealed, '\n// source drift\n');
    assert.equal(validateG03ModelReport(report, f.claim, { root: f.root }).passed, false);
  } finally {
    f.close();
  }
});

function eventsFor(f) {
  const events = [{ type: 'thread.started' }, { type: 'turn.started' }];
  P.calls.forEach((call, index) =>
    events.push({
      type: 'item.completed',
      item: {
        type: 'mcp_tool_call',
        id: `g03call${index}`,
        server: SERVER,
        tool: call.toolName,
        arguments: call.arguments,
        status: 'completed',
        result: f.results[index],
      },
    }),
  );
  events.push(
    { type: 'item.completed', item: { type: 'agent_message', text: f.answer } },
    { type: 'turn.completed' },
  );
  return structuredClone(events);
}
function inspect(f, events = eventsFor(f), summary = f.summary(), extra = {}) {
  const stdout = events.map((event) => JSON.stringify(event)).join('\n') + '\n';
  return inspectG03ModelResult(
    {
      exitCode: 0,
      reason: null,
      stdout,
      stdoutBytes: Buffer.byteLength(stdout),
      stderrBytes: 0,
      ...extra,
    },
    summary,
    f.claim,
  );
}

test('actual event shape binds full normal results, ordered answer and observed cleanup', () => {
  const f = g03ModelReportFixture();
  try {
    assert.equal(inspect(f).passed, true);
    for (const mutate of [
      (e) => {
        e[2].item.arguments = {};
      },
      (e) => {
        e.splice(3, 1);
      },
      (e) => {
        const extra = structuredClone(e[2]);
        extra.item.id = 'extra-call';
        e.splice(3, 0, extra);
      },
      (e) => {
        e[2].item.result.isError = true;
      },
      (e) => {
        e[2].item.result.structuredContent.items.reverse();
      },
      (e) => {
        e[3].item.result.content[0].text = JSON.stringify({
          artifact: { ...f.artifact, id: 'art_' + 'c'.repeat(32) },
        });
      },
      (e) => {
        e.splice(2, 0, {
          type: 'item.completed',
          item: { type: 'command_execution', command: 'echo unsafe', exit_code: 0 },
        });
      },
      (e) => {
        e[e.length - 2].item.text = '{}';
      },
      (e) => {
        e.pop();
      },
    ]) {
      const events = eventsFor(f);
      mutate(events);
      assert.equal(inspect(f, events).passed, false);
    }
    for (const mutate of [
      (s) => {
        s.closed = false;
      },
      (s) => {
        s.protocolDenied = 1;
      },
      (s) => {
        s.captureFailed = true;
      },
      (s) => {
        s.resultSha256.reverse();
      },
      (s) => {
        s.observation.image = null;
      },
      (s) => {
        s.observation.denied = 1;
      },
      (s) => {
        s.claimSha256 = '0'.repeat(64);
      },
      (s) => {
        s.artifact.height++;
      },
    ]) {
      const summary = f.summary();
      mutate(summary);
      assert.equal(inspect(f, eventsFor(f), summary).passed, false);
    }
    assert.equal(
      inspect(f, eventsFor(f), f.summary(), {
        reason: 'AGENT_MCP_PROCESS_TIMED_OUT',
        exitCode: null,
      }).passed,
      false,
    );
    const wrong = JSON.parse(f.answer);
    wrong.rows[3].date = '2024-04-05';
    assert.equal(g03ModelAnswerMatches(JSON.stringify(wrong), f.observation, f.artifact), false);
  } finally {
    f.close();
  }
});

test('wire digest normalizes JSON transport representation without losing semantic fields', () => {
  const absent = { content: [{ type: 'text', text: 'value' }], ignored: undefined };
  assert.equal(
    g03ModelResultSha(absent),
    g03ModelResultSha({ ...absent, isError: false, _meta: { transport: true } }),
  );
  assert.notEqual(
    g03ModelResultSha(absent),
    g03ModelResultSha({ ...absent, structuredContent: { value: 1 } }),
  );
  assert.notEqual(g03ModelResultSha(absent), g03ModelResultSha({ ...absent, isError: true }));
});

test('wire observation follows kernel phases and independently checks returned PNG bytes', () => {
  const f = g03ModelReportFixture();
  try {
    for (const corrupt of [false, true]) {
      const bytes = Buffer.from('fixture-only-bytes'),
        snapshot = structuredClone(f.observation);
      snapshot.image.sha256 = g03ModelSha(bytes);
      const host = {
        snapshot: () => snapshot,
        verifiedPng: () => (corrupt ? Buffer.from('corrupt') : bytes),
      };
      const wire = createG03ModelWireObservation(host);
      snapshot.phase = 'QUERY_VERIFIED';
      wire.capture({ result: f.results[0] });
      snapshot.phase = 'COMPLETE';
      wire.capture({ result: f.results[1] });
      assert.equal(wire.snapshot().captureFailed, corrupt);
      assert.equal(wire.snapshot().resultSha256.length, corrupt ? 1 : 2);
      if (!corrupt) {
        wire.capture({ result: f.results[1] });
        assert.equal(wire.snapshot().captureFailed, true);
      }
    }
  } finally {
    f.close();
  }
});

test('model CLI is isolated and its prompt does not disclose expected result rows or image facts', () => {
  const args = buildG03ModelCodexArgs('/tmp/fixture/gate.json'),
    prompt = args.at(-1);
  assert.equal(args[args.indexOf('--model') + 1], 'gpt-6.1-sol');
  for (const flag of [
    '--ignore-user-config',
    '--strict-config',
    '--ephemeral',
    '--json',
    '--sandbox',
  ])
    assert.equal(args.includes(flag), true);
  for (const option of [
    'model_reasoning_effort="xhigh"',
    'features.shell_tool=false',
    'features.goals=false',
    'features.multi_agent=false',
    `mcp_servers.${SERVER}.supports_parallel_tool_calls=false`,
  ])
    assert.equal(args.includes(option), true);
  for (const forbidden of ['9631002', '2024-04-01', '1926', '96a115da'])
    assert.equal(prompt.includes(forbidden), false);
  const env = g03ModelEnvironment({
    PATH: '/bin',
    OPENAI_API_KEY: 'fixture',
    BANGUMI_TOKEN: 'fixture',
    GH_TOKEN: 'fixture',
    GIT_DIR: '/bad',
    RENDERER_TIMEOUT_MS: '99999999',
  });
  assert.equal(env.RENDERER_TIMEOUT_MS, '8000');
  assert.equal(env.RENDERER_MAX_OUTPUT_BYTES, '5000000');
  assert.equal(env.RENDERER_MAX_CONCURRENCY, '1');
  for (const key of ['OPENAI_API_KEY', 'BANGUMI_TOKEN', 'GH_TOKEN', 'GIT_DIR'])
    assert.equal(key in env, false);
});

test('terminal result reconciliation never dispatches another process or overwrites a conflicting report', () => {
  const f = g03ModelReportFixture();
  try {
    let calls = 0;
    const status = {
      profile_id: P.id,
      state: 'CLAIMED',
      disposition: f.claim,
      terminal_label_present: false,
    };
    const persist = (_claim, state, sha) => {
      calls++;
      return { state, sha };
    };
    const r = reconcileG03ModelResult(status, { passed: false }, null, persist);
    assert.equal(r.state, 'INCONCLUSIVE');
    assert.equal(calls, 1);
    const spent = {
      ...status,
      state: 'INCONCLUSIVE',
      disposition: { ...f.claim, state: 'INCONCLUSIVE' },
    };
    assert.equal(
      reconcileG03ModelResult(spent, { passed: false }, null, persist).state,
      'INCONCLUSIVE',
    );
    assert.equal(calls, 1);
    const written = {
      ...status,
      state: 'REPORT_WRITTEN',
      disposition: { ...f.claim, state: 'REPORT_WRITTEN', reportSha256: 'a'.repeat(64) },
    };
    assert.throws(() =>
      reconcileG03ModelResult(written, { passed: true }, 'b'.repeat(64), persist),
    );
    assert.equal(calls, 1);
  } finally {
    f.close();
  }
});
