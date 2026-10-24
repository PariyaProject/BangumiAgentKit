import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { r04SignedReportInput } from './fixtures/r04-signed-report.mjs';
import { evaluateR04Execution } from '../../scripts/acceptance/run-r04-series-watch-order-offline-agent-mcp-v2.mjs';
import {
  buildR04ProfileReport,
  validateR04SeriesWatchOrderOfflineV2SanitizedReportFile,
} from '../../scripts/acceptance/write-r04-series-watch-order-offline-agent-mcp-v2-report.mjs';
import {
  summarizeAgentMcpProcess,
  firstAgentMcpExecutionFailure,
  agentMcpExecutionDiagnostics,
} from '../../scripts/lib/agent-mcp-execution.mjs';
import { normalizeAgentMcpProfileDiagnostics } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { fixtureInput } from './fixtures/c07-signed-report.mjs';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  configureC07RenderComparisonOfflineRunnerProfile,
  evaluateC07RenderComparisonOfflineExecution,
} from '../../scripts/acceptance/run-c07-render-comparison-offline-agent-mcp.mjs';
import { buildC07RenderComparisonOfflineProfileReport } from '../../scripts/acceptance/write-c07-render-comparison-offline-agent-mcp-report.mjs';

const PROFILE_ID = 'c07-render-comparison-offline-agent-mcp-matrix-v4';
function replayFixture() {
  configureC07RenderComparisonOfflineRunnerProfile(PROFILE_ID);
  const { input, keyPair } = fixtureInput(getAgentMcpProfileById(PROFILE_ID));
  const call = input.completedMcpCalls[0];
  const events = [
    { type: 'thread.started' },
    { type: 'turn.started' },
    {
      type: 'item.completed',
      item: {
        id: 'fixture-call',
        type: 'mcp_tool_call',
        server: 'bgk_c07_render_comparison',
        tool: call.tool,
        arguments: call.arguments,
        status: 'completed',
        result: { structured_content: { status: 'SUCCESS' }, is_error: false },
      },
    },
    {
      type: 'item.completed',
      item: { id: 'fixture-answer', type: 'agent_message', text: input.answer },
    },
    { type: 'turn.completed' },
  ];
  return {
    input,
    keyPair,
    observations: {
      execution: {
        exitCode: 0,
        failed: false,
        stdout: events.map((e) => JSON.stringify(e)).join('\n'),
      },
      serverSummary: input.serverSummary,
      sourceRevision: input.claim.sourceCandidateSha,
      bundleSha256: input.claim.bundleSha256,
      candidateBundleCurrent: () => true,
    },
  };
}

test('C07 actual replay seam preserves process failure before missing-artifact capture', () => {
  const { observations } = replayFixture();
  let captures = 0;
  const result = evaluateC07RenderComparisonOfflineExecution({
    ...observations,
    execution: { exitCode: 2, failed: true, stdout: '' },
    serverSummary: null,
    captureArtifact: () => {
      captures++;
      throw new Error('private mock output must not survive');
    },
  });
  assert.equal(result.passed, false);
  assert.equal(result.failureDiagnostics.reasonCode, 'AGENT_MCP_PROCESS_EXIT_NONZERO');
  assert.equal(captures, 0);
  assert.equal(JSON.stringify(result.failureDiagnostics).includes('private mock'), false);
});

test('C07 complete event replay with missing summary never attempts artifact capture', () => {
  const { observations } = replayFixture();
  let captures = 0;
  const result = evaluateC07RenderComparisonOfflineExecution({
    ...observations,
    serverSummary: null,
    captureArtifact: () => {
      captures++;
      throw new Error('capture cannot classify a missing summary');
    },
  });
  assert.equal(result.failureDiagnostics.reasonCode, 'AGENT_MCP_SUMMARY_MISSING');
  assert.equal(captures, 0);
});

test('C07 malformed event replay retains parse failure even with otherwise valid summary', () => {
  const { observations } = replayFixture();
  let captures = 0;
  const result = evaluateC07RenderComparisonOfflineExecution({
    ...observations,
    execution: { exitCode: 0, failed: false, stdout: '{broken private fixture text' },
    captureArtifact: () => {
      captures++;
      return {};
    },
  });
  assert.equal(result.failureDiagnostics.reasonCode, 'AGENT_MCP_EVENT_STREAM_INVALID');
  assert.equal(captures, 0);
  assert.equal(JSON.stringify(result.failureDiagnostics).includes('private fixture'), false);
});

test('C07 invalid summary cannot reach image persistence', () => {
  const { observations } = replayFixture();
  let captures = 0;
  observations.serverSummary.offlineFixture.requestCount = 2;
  const result = evaluateC07RenderComparisonOfflineExecution({
    ...observations,
    captureArtifact: () => {
      captures++;
      return {};
    },
  });
  assert.equal(result.failureDiagnostics.reasonCode, 'AGENT_MCP_SUMMARY_INVALID');
  assert.equal(captures, 0);
});

test('C07 capture failure after valid observations is classified without raw exception text', () => {
  const { observations } = replayFixture();
  const result = evaluateC07RenderComparisonOfflineExecution({
    ...observations,
    captureArtifact: () => {
      throw new Error('private fixture path or token');
    },
  });
  assert.equal(result.passed, false);
  assert.equal(result.failureDiagnostics.reasonCode, 'AGENT_MCP_ARTIFACT_CAPTURE_FAILED');
  assert.equal(JSON.stringify(result.failureDiagnostics).includes('private fixture'), false);
});

test('C07 synthetic snake-case replay reaches the real signed report without a model or claim', () => {
  const { observations, input, keyPair } = replayFixture();
  const result = evaluateC07RenderComparisonOfflineExecution({
    ...observations,
    captureArtifact: () => ({
      sha256: input.serverSummary.results[0].resultSummary.artifact.sha256,
    }),
  });
  assert.equal(result.passed, true);
  const report = buildC07RenderComparisonOfflineProfileReport(
    {
      ...input,
      events: result.safeEvents,
      completedMcpCalls: result.events.completedMcpCalls,
      answer: result.events.answer,
    },
    { privateKey: keyPair.privateKey },
  );
  assert.equal(report.passed, true, report.reason);
});

test('R04 uses the same bounded failure envelope before summary/report work', () => {
  const result = evaluateR04Execution({
    execution: { exitCode: 3, failed: true, stdout: '' },
    serverSummary: null,
    sourceRevision: 'a'.repeat(40),
    bundleSha256: 'c'.repeat(64),
    candidateBundleCurrent: () => true,
  });
  assert.equal(result.passed, false);
  assert.equal(result.failureDiagnostics.reasonCode, 'AGENT_MCP_PROCESS_EXIT_NONZERO');
  assert.deepEqual(
    normalizeAgentMcpProfileDiagnostics(result.failureDiagnostics),
    result.failureDiagnostics,
  );
});

test('R04 complete synthetic replay reaches the real signed report and validator', () => {
  const value = r04SignedReportInput();
  const ack = 'R04_SYNTHETIC_WATCH_ORDER_PREQUEL_CHAIN_READ';
  const events = [
    { type: 'thread.started' },
    { type: 'turn.started' },
    {
      type: 'item.completed',
      item: {
        id: 'r04-call',
        type: 'mcp_tool_call',
        server: 'bgk_r04_watch_order_v2',
        tool: value.claim.toolName,
        arguments: value.claim.expectedArguments[0],
        status: 'completed',
        result: { isError: false, structuredContent: { status: 'SUCCESS' } },
      },
    },
    { type: 'item.completed', item: { id: 'r04-answer', type: 'agent_message', text: ack } },
    { type: 'turn.completed' },
  ];
  const replay = evaluateR04Execution({
    execution: {
      exitCode: 0,
      failed: false,
      stdout: events.map((e) => JSON.stringify(e)).join('\n'),
    },
    serverSummary: value.serverSummary,
    sourceRevision: value.claim.sourceCandidateSha,
    bundleSha256: value.claim.bundleSha256,
    candidateBundleCurrent: () => true,
  });
  assert.equal(replay.passed, true);
  const root = mkdtempSync(path.join(os.tmpdir(), 'rec04-r04-signed-replay-'));
  const reportPath = path.join(root, getAgentMcpProfileById(value.claim.profileId).reportPath);
  mkdirSync(path.dirname(reportPath), { recursive: true });
  try {
    const built = buildR04ProfileReport(
      {
        claim: value.claim,
        serverSummary: value.serverSummary,
        events: replay.safeEvents,
        answer: replay.events.answer,
        codexCliVersion: '0.1.0',
        eventStreamSha256: '1'.repeat(64),
        serverSummarySha256: '2'.repeat(64),
      },
      { privateKey: value.keys.privateKey, root, reportPath },
    );
    assert.equal(built.passed, true, built.reason);
    assert.equal(
      validateR04SeriesWatchOrderOfflineV2SanitizedReportFile(value.claim, root, reportPath).passed,
      true,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('process failures retain observable categories without stderr or exception payloads', () => {
  const cases = [
    [{ status: null, error: { code: 'ENOENT' } }, 'AGENT_MCP_PROCESS_SPAWN_FAILED'],
    [{ pid: 7, status: null, error: { code: 'ETIMEDOUT' } }, 'AGENT_MCP_PROCESS_TIMED_OUT'],
    [{ pid: 7, status: null, error: { code: 'ENOBUFS' } }, 'AGENT_MCP_PROCESS_OUTPUT_LIMIT'],
    [{ pid: 7, status: 9 }, 'AGENT_MCP_PROCESS_EXIT_NONZERO'],
    [{ status: null, error: { code: 'UNKNOWN' } }, 'AGENT_MCP_PROCESS_OBSERVATION_FAILED'],
  ];
  for (const [spawn, reason] of cases) {
    const execution = summarizeAgentMcpProcess({
      ...spawn,
      stdout: 'private mock stdout',
      stderr: 'private mock stderr',
      error: spawn.error ? { ...spawn.error, message: 'private exception' } : undefined,
    });
    const diagnostics = firstAgentMcpExecutionFailure({
      execution,
      parsed: { parsed: false },
      events: {},
      checks: {},
      summary: null,
    });
    assert.equal(diagnostics.reasonCode, reason);
    assert.equal(JSON.stringify(diagnostics).includes('private'), false);
    assert.equal(Object.hasOwn(execution, 'stderr'), false);
    assert.equal(diagnostics.counters.codexStderrBytes, Buffer.byteLength('private mock stderr'));
    if (spawn.error?.code === 'UNKNOWN') {
      assert.equal(diagnostics.checks.invocationStateUnknown, true);
      assert.equal(Object.hasOwn(diagnostics.checks, 'processSpawned'), false);
    }
  }
});

test('diagnostics fail closed on payload-shaped additions and keep unknown counters null', () => {
  assert.throws(() =>
    agentMcpExecutionDiagnostics('AGENT_MCP_SUMMARY_MISSING', {
      execution: { exitCode: 0, failed: false, stdout: '' },
      checks: { prompt: 'private mock text' },
    }),
  );
  const diagnostic = agentMcpExecutionDiagnostics('AGENT_MCP_SUMMARY_MISSING', {
    execution: { exitCode: 0, failed: false, stdout: '' },
    checks: { serverSummaryPresent: false },
  });
  assert.equal(diagnostic.counters.allowedToolCalls, null);
  assert.equal(diagnostic.counters.codexStderrBytes, null);
});

test('shared classification preserves the C07 error-count agreement gate before artifact/report work', () => {
  const { observations } = replayFixture();
  const replay = evaluateC07RenderComparisonOfflineExecution({
    ...observations,
    candidateBundleCurrent: () => true,
    captureArtifact: () => ({ sha256: 'a'.repeat(64) }),
  });
  assert.equal(replay.passed, true);
  const context = structuredClone(replay.diagnosticContext);
  context.checks.codexErrorCountsMatch = false;
  assert.equal(firstAgentMcpExecutionFailure(context).reasonCode, 'AGENT_MCP_TOOL_RESULT_INVALID');
});

test('C07 rejects contradictory MCP aliases, foreign calls and incomplete event streams before capture', () => {
  for (const variant of [
    'conflicting-error',
    'foreign-server',
    'wrong-arguments',
    'incomplete-turn',
    'unknown-event',
  ]) {
    const { observations } = replayFixture();
    const events = observations.execution.stdout.split('\n').map((line) => JSON.parse(line));
    if (variant === 'conflicting-error') events[2].item.result.isError = true;
    if (variant === 'foreign-server') events[2].item.server = 'foreign';
    if (variant === 'wrong-arguments') events[2].item.arguments = {};
    if (variant === 'incomplete-turn') events.pop();
    if (variant === 'unknown-event') events.push({ type: 'unexpected.protocol' });
    let captures = 0;
    const result = evaluateC07RenderComparisonOfflineExecution({
      ...observations,
      execution: {
        exitCode: 0,
        failed: false,
        stdout: events.map((e) => JSON.stringify(e)).join('\n'),
      },
      captureArtifact: () => {
        captures++;
        return {};
      },
    });
    assert.equal(result.passed, false, variant);
    assert.equal(
      result.failureDiagnostics.reasonCode,
      ['incomplete-turn', 'unknown-event'].includes(variant)
        ? 'AGENT_MCP_EVENT_STREAM_INVALID'
        : 'AGENT_MCP_TOOL_RESULT_INVALID',
      variant,
    );
    assert.equal(captures, 0, variant);
  }
});

test('C07 distinguishes an unreadable summary, invalid answer and unverifiable bundle', () => {
  const cases = [
    [{ serverSummary: null, summaryPresent: true }, 'AGENT_MCP_SUMMARY_INVALID'],
    [{ candidateBundleCurrent: () => false }, 'AGENT_MCP_CANDIDATE_BUNDLE_INVALID'],
    [
      {
        candidateBundleCurrent: () => {
          throw new Error('private git error');
        },
      },
      'AGENT_MCP_CANDIDATE_BUNDLE_INVALID',
    ],
  ];
  for (const [override, reason] of cases) {
    const { observations } = replayFixture();
    let captures = 0;
    const result = evaluateC07RenderComparisonOfflineExecution({
      ...observations,
      ...override,
      captureArtifact: () => {
        captures++;
        return {};
      },
    });
    assert.equal(result.failureDiagnostics.reasonCode, reason);
    assert.equal(captures, 0);
  }
  const { observations } = replayFixture();
  observations.execution.stdout = observations.execution.stdout.replace(
    'C07_SYNTHETIC_COHORT_RENDERED',
    'wrong private acknowledgement',
  );
  const result = evaluateC07RenderComparisonOfflineExecution({
    ...observations,
    captureArtifact: () => assert.fail('answer must be checked before capture'),
  });
  assert.equal(result.failureDiagnostics.reasonCode, 'AGENT_MCP_ANSWER_INVALID');
  assert.equal(
    JSON.stringify(result.failureDiagnostics).includes('private acknowledgement'),
    false,
  );
});

test('diagnostic bounds are explicit rather than silent exact counters', () => {
  const diagnostic = agentMcpExecutionDiagnostics('AGENT_MCP_SUMMARY_INVALID', {
    execution: { exitCode: 0, failed: false, stdout: '' },
    summary: { offlineFixture: { requestCount: 10_000_001 } },
    checks: { serverSummaryValid: false },
  });
  assert.equal(diagnostic.counters.httpRequests, 10_000_000);
  assert.equal(diagnostic.checks.diagnosticCountersClamped, true);
});
