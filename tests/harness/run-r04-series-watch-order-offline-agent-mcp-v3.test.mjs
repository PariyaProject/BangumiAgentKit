import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  agentMcpProfileArgumentsSha256,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { R04_SERIES_WATCH_ORDER_V2_PROFILE_ID } from '../../scripts/lib/r04-series-watch-order-offline-v2-fixture.mjs';
import { R04_SERIES_WATCH_ORDER_V3_PROFILE_ID } from '../../scripts/lib/r04-series-watch-order-offline-v3-fixture.mjs';
import { getR04SeriesWatchOrderOfflineProfileConfig } from '../../scripts/lib/r04-series-watch-order-offline-profile-config.mjs';
import { parseCodexOneToolMcpArguments } from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';
import {
  buildR04CodexExecArgs,
  configureR04RunnerProfile,
  evaluateR04Execution,
  validateR04RunnerArgs,
  validateR04ServerSummary,
} from '../../scripts/acceptance/run-r04-series-watch-order-offline-agent-mcp-v2.mjs';
import { r04SignedReportInput } from './fixtures/r04-signed-report.mjs';

const SOURCE_SHA = 'a'.repeat(40);
const BUNDLE_SHA = 'b'.repeat(64);

test('R04 v3 retains shared first-failure replay with its exact multi-node arguments', () => {
  const value = r04SignedReportInput(R04_SERIES_WATCH_ORDER_V3_PROFILE_ID);
  const events = [
    { type: 'thread.started' },
    { type: 'turn.started' },
    {
      type: 'item.completed',
      item: {
        type: 'mcp_tool_call',
        id: 'r04-v3-replay',
        server: value.config.serverId,
        tool: value.profile.toolName,
        arguments: value.config.expectedArguments,
        status: 'completed',
        result: { isError: false },
      },
    },
    { type: 'item.completed', item: { type: 'agent_message', text: value.config.acknowledgement } },
    { type: 'turn.completed' },
  ];
  const replay = (serverSummary, stream = events) =>
    evaluateR04Execution({
      execution: {
        exitCode: 0,
        failed: false,
        stdout: stream.map((event) => JSON.stringify(event)).join('\n'),
      },
      serverSummary,
      sourceRevision: value.claim.sourceCandidateSha,
      bundleSha256: value.claim.bundleSha256,
      candidateBundleCurrent: () => true,
    });
  try {
    configureR04RunnerProfile(value.profile.id);
    assert.equal(replay(value.serverSummary).passed, true);
    const missing = replay(null);
    assert.equal(missing.failureDiagnostics.reasonCode, 'AGENT_MCP_SUMMARY_MISSING');
    assert.equal(missing.failureDiagnostics.counters.allowedToolCalls, null);
    const wrongArgs = structuredClone(events);
    wrongArgs[2].item.arguments = getR04SeriesWatchOrderOfflineProfileConfig(
      R04_SERIES_WATCH_ORDER_V2_PROFILE_ID,
    ).expectedArguments;
    assert.equal(
      replay(value.serverSummary, wrongArgs).failureDiagnostics.reasonCode,
      'AGENT_MCP_TOOL_RESULT_INVALID',
    );
    assert.equal(
      replay(value.serverSummary, events.slice(0, -1)).failureDiagnostics.reasonCode,
      'AGENT_MCP_EVENT_STREAM_INVALID',
    );
  } finally {
    configureR04RunnerProfile(R04_SERIES_WATCH_ORDER_V2_PROFILE_ID);
  }
});

function summaryFor(profileId) {
  const profile = getAgentMcpProfileById(profileId);
  const config = getR04SeriesWatchOrderOfflineProfileConfig(profileId);
  return {
    serverProfile: 'closed-profile-sequence-anonymous-offline-v1',
    profileId,
    argumentProfile: profile.argumentProfile,
    networkMode: config.networkMode,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(profile),
    sourceRevision: SOURCE_SHA,
    bundleSha256: BUNDLE_SHA,
    toolName: profile.toolName,
    serverToolCount: 1,
    serverToolNames: [profile.toolName],
    expectedCallCount: 1,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    results: [{ sequenceIndex: 0, status: 'SUCCESS', resultSummary: config.expectedResultSummary }],
    offlineFixture: config.expectedFixture,
  };
}

test('R04 v3 runner binds the exact profile arguments and six-operation summary', () => {
  const profile = getAgentMcpProfileById(R04_SERIES_WATCH_ORDER_V3_PROFILE_ID);
  const config = getR04SeriesWatchOrderOfflineProfileConfig(profile.id);
  try {
    configureR04RunnerProfile(profile.id);
    const parsedServerArguments = parseCodexOneToolMcpArguments([
      '--profile-id',
      profile.id,
      '--summary-file',
      '/tmp/r04-v3-summary.json',
      '--candidate-sha',
      SOURCE_SHA,
      '--bundle-sha256',
      BUNDLE_SHA,
    ]);
    assert.equal(parsedServerArguments.profile.id, profile.id);
    assert.equal(parsedServerArguments.networkMode, config.networkMode);
    assert.deepEqual(parsedServerArguments.expectedArgumentSequence, [config.expectedArguments]);
    assert.equal(
      validateR04RunnerArgs(['--run', '95', '--profile-id', R04_SERIES_WATCH_ORDER_V3_PROFILE_ID]),
      'run',
    );
    const args = buildR04CodexExecArgs({
      nodePath: '/usr/bin/node',
      summaryPath: '/tmp/r04-v3-summary.json',
      sourceRevision: SOURCE_SHA,
      bundleSha256: BUNDLE_SHA,
    });
    assert.ok(args.includes(`mcp_servers.${config.serverId}.required=true`));
    assert.ok(args.at(-1).includes(JSON.stringify(config.expectedArguments)));
    assert.ok(args.at(-1).includes(config.acknowledgement));
    assert.equal(validateR04ServerSummary(summaryFor(profile.id), SOURCE_SHA, BUNDLE_SHA), true);
    const altered = summaryFor(profile.id);
    altered.offlineFixture = { ...altered.offlineFixture, requestCount: 5 };
    assert.equal(validateR04ServerSummary(altered, SOURCE_SHA, BUNDLE_SHA), false);
  } finally {
    configureR04RunnerProfile(R04_SERIES_WATCH_ORDER_V2_PROFILE_ID);
  }
});

test('R04 v3 wrapper rejects a different profile before any claim', () => {
  const result = spawnSync(
    process.execPath,
    [
      'scripts/acceptance/run-r04-series-watch-order-offline-agent-mcp-v3.mjs',
      '--run',
      '95',
      '--profile-id',
      R04_SERIES_WATCH_ORDER_V2_PROFILE_ID,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stdout), {
    state: 'R04_PREFLIGHT_FAILED',
    profileId: R04_SERIES_WATCH_ORDER_V3_PROFILE_ID,
    retryAllowed: false,
  });
});
