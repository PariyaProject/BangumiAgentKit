import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { generateKeyPairSync, sign } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { NATIVE_PAGE_PROFILE as P, profileExecutionModelMatches, isNativeEntityPageProfile } from '../../scripts/lib/native-entity-page-profile.mjs';
import { canonicalAgentMcpProfileJson as canonical, listAgentMcpProfiles, getAgentMcpProfileById,
  agentMcpProfileTerminalLabelDescription } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { profileRequiresExactCiRunEvidence } from '../../scripts/lib/agent-mcp-profile-ci-evidence.mjs';
import { validateNativePageReport, validateNativePageReportFile, writeNativePageReport } from '../../scripts/acceptance/native-entity-page-report.mjs';
import { nativePageEnvironment, nativePageHarness, assertNativePageClaimReadback } from '../../scripts/lib/native-entity-page-gates.mjs';
import { buildNativePageCodexArgs, inspectNativePageModelResult, runNativePageProcess,
  reconcileNativePageResult } from '../../scripts/acceptance/run-native-entity-page-model.mjs';
import { nativePageReportFixture } from './fixtures/native-page-report.mjs';

test('new closed native profile permits only Sol xhigh while preserving every legacy execution pin', () => {
  assert.equal(isNativeEntityPageProfile(getAgentMcpProfileById(P.id)), true);
  assert.equal(profileRequiresExactCiRunEvidence(P.id), true);
  assert.equal(profileExecutionModelMatches(P), true);
  for (const entry of listAgentMcpProfiles().filter((p) => p.id !== P.id)) {
    assert.equal(profileExecutionModelMatches(entry), true);
    assert.equal(profileExecutionModelMatches({ ...entry, model: 'gpt-6.1-sol', reasoningEffort: 'xhigh' }), false);
  }
  for (const change of [{ model: 'gpt-6-luna', reasoningEffort: 'max' }, { toolNames: [P.toolName] },
    { calls: P.calls.slice(0, 1) }, { maxAnswerBytes: 65536 }, { networkMode: 'unbounded' }]) {
    assert.equal(profileExecutionModelMatches({ ...P, ...change }), false);
  }
});

test('new signed native report binds the exact key, source files, catalog, selection, CI and two scoped summaries', () => {
  const f = nativePageReportFixture();
  try {
    const report = f.build();
    assert.deepEqual(validateNativePageReport(report, f.claim, { root: f.root }), { passed: true });
    writeNativePageReport(report, f.root);
    const file = validateNativePageReportFile(f.claim, f.root);
    assert.equal(file.passed, true);
    assert.equal(file.reportPath, P.reportPath);
    assert.match(file.runnerReceiptSha256, /^[0-9a-f]{64}$/u);
    const verified = spawnSync(process.execPath, [path.join(f.root, 'scripts/acceptance/validate-native-entity-page-report.mjs')], {
      input: JSON.stringify({ claim: f.claim,
        reportBytesBase64: fs.readFileSync(path.join(f.root, P.reportPath)).toString('base64') }),
      encoding: 'utf8', timeout: 5000,
    });
    assert.equal(verified.status, 0, verified.stderr);
    assert.equal(JSON.parse(verified.stdout).reportSha256, file.reportSha256);
    assert.equal(JSON.parse(verified.stdout).runnerReceiptSha256, file.runnerReceiptSha256);
    for (const forbidden of ['expectedArguments"', 'untrusted-row-do-not-retain', 'created_at', 'stdout', 'stderr'])
      assert.equal(JSON.stringify(report).includes(forbidden), false);
    assert.throws(() => writeNativePageReport(report, f.root));
    assert.equal(validateNativePageReportFile(f.claim, f.root, path.join(f.root, 'other.json')).passed, false);
    assert.equal(validateNativePageReport(report, { ...f.claim, retryAllowed: true }, { root: f.root }).passed, false);
    assert.equal(validateNativePageReport(report, { ...f.claim, state: 'INCONCLUSIVE' }, { root: f.root }).passed, false);
    const otherKey = generateKeyPairSync('ed25519').privateKey;
    const payload = { ...report }; delete payload.signature;
    const forged = { ...payload, signature: sign(null, Buffer.from(canonical(payload)), otherKey).toString('base64') };
    assert.equal(validateNativePageReport(forged, f.claim, { root: f.root }).passed, false);
  } finally { f.close(); }
});

test('even valid signatures cannot grant synthetic, account, extra-call or forged completeness credit', () => {
  const f = nativePageReportFixture();
  try {
    const report = f.build();
    for (const mutate of [
      (r) => { r.execution.sourceMode = 'synthetic'; },
      (r) => { r.execution.model = 'gpt-6-luna'; },
      (r) => { r.execution.reasoningEffort = 'max'; },
      (r) => { r.execution.exactStructuredResults = false; },
      (r) => { r.execution.codexErrorItemCount = 1; },
      (r) => { r.execution.providerInternalHttpCount = 1; },
      (r) => { r.observation.requestCount = 3; },
      (r) => { r.observation.forbiddenServiceAttempts = 1; },
      (r) => { r.observation.phase = 'FAILED'; },
      (r) => { r.observation.results[0].hasMore = false; },
      (r) => { r.observation.results[0].name = 'untrusted'; },
      (r) => { r.source.descriptors[0].auth = 'none'; },
      (r) => { r.gate.ciChecks[0].conclusion = 'SKIPPED'; },
      (r) => { r.rawOutput = 'untrusted'; },
    ]) {
      const value = structuredClone(report);
      mutate(value);
      const payload = { ...value }; delete payload.signature;
      value.signature = sign(null, Buffer.from(canonical(payload)), f.privateKey).toString('base64');
      assert.equal(validateNativePageReport(value, f.claim, { root: f.root }).passed, false);
    }
  } finally { f.close(); }
});

test('unrelated current catalog metadata cannot invalidate the fixed signed source; own metadata and program changes do', () => {
  const f = nativePageReportFixture();
  try {
    const report = f.build();
    const target = path.join(f.root, 'docs/tool-catalog.json');
    const catalog = JSON.parse(fs.readFileSync(target, 'utf8'));
    catalog.find((tool) => !P.toolNames.includes(tool.name)).description += ' unrelated';
    fs.writeFileSync(target, JSON.stringify(catalog));
    assert.equal(validateNativePageReport(report, f.claim, { root: f.root }).passed, true);
    catalog.find((tool) => tool.name === P.toolName).description += ' changed';
    fs.writeFileSync(target, JSON.stringify(catalog));
    assert.equal(validateNativePageReport(report, f.claim, { root: f.root }).passed, false);
    f.git('checkout', '--', 'docs/tool-catalog.json');
    fs.appendFileSync(path.join(f.root, 'scripts/lib/native-entity-page-verification.mjs'), '\n// changed contract\n');
    assert.equal(validateNativePageReport(report, f.claim, { root: f.root }).passed, false);
  } finally { f.close(); }
});

function eventFixture(f) {
  const events = [{ type: 'thread.started' }, { type: 'turn.started' }];
  P.calls.forEach((call, index) => events.push({ type: 'item.completed', item: {
    type: 'mcp_tool_call', id: `call${index}`, server: 'bgk_native_entity_pages', tool: call.toolName,
    arguments: call.arguments, status: 'completed', result: { isError: false,
      structuredContent: { observation: f.observation.results[index] },
      content: [{ type: 'text', text: JSON.stringify(f.observation.results[index]) }] },
  } }));
  events.push({ type: 'item.completed', item: { type: 'agent_message', text: f.answer } }, { type: 'turn.completed' });
  return structuredClone(events);
}

test('model lifecycle diagnostics preserve exact structured readback and reject errors, extra tools or invalid answers', () => {
  const f = nativePageReportFixture();
  try {
    const inspect = (events, summary = f.summary()) => inspectNativePageModelResult({
      exitCode: 0, reason: null, stdout: events.map((v) => JSON.stringify(v)).join('\n'), stdoutBytes: 1000, stderrBytes: 0,
    }, summary, f.claim);
    assert.equal(inspect(eventFixture(f)).passed, true);
    const broken = eventFixture(f); broken[2].item.result.structuredContent.observation.total = 999;
    assert.equal(inspect(broken).passed, false);
    const errors = eventFixture(f); errors.push({ type: 'error' });
    assert.equal(inspect(errors).passed, false);
    const extra = eventFixture(f); extra.splice(3, 0, structuredClone(extra[2])); extra[3].item.id = 'extra';
    assert.equal(inspect(extra).passed, false);
    const answer = eventFixture(f); answer.at(-2).item.text = '{}';
    assert.equal(inspect(answer).reason, 'AGENT_MCP_ANSWER_INVALID');
    assert.equal(inspect(eventFixture(f), null).passed, false);
  } finally { f.close(); }
});

test('new model launch is finite, isolated, Sol xhigh and contains no legacy profile retry', () => {
  const args = buildNativePageCodexArgs('/tmp/synthetic/gate.json');
  assert.equal(args.includes('gpt-6.1-sol'), true);
  assert.equal(args.includes('model_reasoning_effort="xhigh"'), true);
  for (const flag of ['--ignore-user-config', '--strict-config', '--ephemeral', '--json']) assert.equal(args.includes(flag), true);
  assert.equal(args.some((arg) => arg.includes('features.shell_tool=false')), true);
  const input = { PATH: '/synthetic', GH_TOKEN: 'fake', BANGUMI_TOKEN: 'fake', NODE_OPTIONS: '--import=/fake' };
  const safe = nativePageEnvironment(input);
  assert.equal(safe.GH_TOKEN, undefined); assert.equal(safe.BANGUMI_TOKEN, undefined); assert.equal(safe.NODE_OPTIONS, undefined);
  assert.equal(nativePageEnvironment(input, true).GH_TOKEN, 'fake');
});

test('new native runtime refuses mocked control and claim readback with another PR, state or key', () => {
  const previous = process.env.HARNESS_MOCK_STATE;
  process.env.HARNESS_MOCK_STATE = '/synthetic-never-read';
  try { assert.throws(() => nativePageHarness(['status', '--run', '95']), /MOCK_CONTROL_FORBIDDEN/u); }
  finally {
    if (previous === undefined) delete process.env.HARNESS_MOCK_STATE;
    else process.env.HARNESS_MOCK_STATE = previous;
  }
  const f = nativePageReportFixture();
  try {
    const status = { state: 'CLAIMED', issue_state: 'EPOCH_ACTIVE', run: 95, pr: f.claim.prNumber,
      profile_id: P.id, epoch_id: P.epochId, claim_label_present: true, terminal_label_present: false,
      disposition: f.claim };
    assert.doesNotThrow(() => assertNativePageClaimReadback(status, f.claim));
    for (const change of [{ pr: 999 }, { state: 'UNCLAIMED' }, { terminal_label_present: true },
      { disposition: { ...f.claim, runnerReceiptPublicKey: 'invalid' } }]) {
      assert.throws(() => assertNativePageClaimReadback({ ...status, ...change }, f.claim), /READBACK_FAILED/u);
    }
  } finally { f.close(); }
});

test('owned model process group is bounded by success, output cap, timeout and spawn failure', { timeout: 10000 }, async () => {
  const success = await runNativePageProcess(process.execPath, ['-e', 'process.stdout.write("ok")'], { timeoutMs: 2000 });
  assert.equal(success.exitCode, 0); assert.equal(success.stdout, 'ok');
  const output = await runNativePageProcess(process.execPath, ['-e', 'process.stdout.write("x".repeat(4096))'], { maxStdout: 32, timeoutMs: 2000 });
  assert.equal(output.reason, 'AGENT_MCP_PROCESS_OUTPUT_LIMIT');
  const timed = await runNativePageProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeoutMs: 40 });
  assert.equal(timed.reason, 'AGENT_MCP_PROCESS_TIMED_OUT');
  const absent = await runNativePageProcess('/nonexistent-native-page-command', [], { timeoutMs: 2000 });
  assert.equal(absent.reason, 'AGENT_MCP_PROCESS_SPAWN_FAILED');
});

test('terminal recovery preserves uncertain acknowledgements and stale/competing one-shot outcomes without replay', () => {
  const f = nativePageReportFixture();
  try {
    const status = { profile_id: P.id, state: 'CLAIMED', disposition: f.claim, terminal_label_present: false };
    const sha = '5'.repeat(64), valid = { passed: true };
    const calls = [];
    const persist = (_claim, state, digest) => { calls.push({ state, digest }); return { state, retryAllowed: false }; };
    assert.equal(reconcileNativePageResult(status, valid, sha, persist).state, 'REPORT_WRITTEN');
    assert.deepEqual(calls.splice(0), [{ state: 'REPORT_WRITTEN', digest: sha }]);
    assert.equal(reconcileNativePageResult(status, valid, sha, () => { throw new Error('unknown network'); }).state, 'REPORT_ACK_PENDING');
    const stale = (_claim, state, digest) => {
      calls.push({ state, digest });
      if (state === 'REPORT_WRITTEN') { const error = new Error('sanitized'); error.controlCode = 'AGENT_MCP_PROFILE_CLAIM_STALE'; throw error; }
      return { state };
    };
    assert.equal(reconcileNativePageResult(status, valid, sha, stale).state, 'INCONCLUSIVE');
    assert.deepEqual(calls.splice(0), [{ state: 'REPORT_WRITTEN', digest: sha }, { state: 'INCONCLUSIVE', digest: sha }]);
    const ambiguous = { ...status, state: 'AMBIGUOUS_TERMINAL_LATCH', terminal_label_present: true,
      terminal_label_description: agentMcpProfileTerminalLabelDescription(P, 'INCONCLUSIVE', null) };
    assert.equal(reconcileNativePageResult(ambiguous, { passed: false }, null, persist).state, 'INCONCLUSIVE');
    assert.deepEqual(calls.splice(0), [{ state: 'INCONCLUSIVE', digest: null }]);
    const acknowledged = { ...status, state: 'REPORT_WRITTEN', disposition: { ...f.claim, state: 'REPORT_WRITTEN', reportSha256: sha } };
    assert.equal(reconcileNativePageResult(acknowledged, valid, sha, persist).state, 'REPORT_WRITTEN');
    assert.equal(calls.length, 0);
    assert.throws(() => reconcileNativePageResult(acknowledged, valid, '6'.repeat(64), persist), /MISMATCH/u);
  } finally { f.close(); }
});
