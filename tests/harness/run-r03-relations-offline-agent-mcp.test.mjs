import assert from 'node:assert/strict';
import test from 'node:test';
import {
  agentMcpProfileArgumentsSha256,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  R03_RELATIONS_OFFLINE_ACKNOWLEDGEMENT,
  R03_RELATIONS_OFFLINE_EXPECTED_CALLS,
  R03_RELATIONS_OFFLINE_EXPECTED_RESULT_SUMMARIES,
  R03_RELATIONS_OFFLINE_NETWORK_MODE,
  R03_RELATIONS_OFFLINE_PROFILE_ID,
} from '../../scripts/lib/r03-relations-offline-profile.mjs';
import {
  buildR03CodexExecArgs,
  classifyR03AssertionFailure,
  recoverR03RunnerFailure,
  validateR03RunnerArgs,
  validateR03ServerSummary,
} from '../../scripts/acceptance/run-r03-relations-offline-agent-mcp.mjs';

const PROFILE = getAgentMcpProfileById(R03_RELATIONS_OFFLINE_PROFILE_ID);
const SOURCE_SHA = 'a'.repeat(40);
const BUNDLE_SHA = 'b'.repeat(64);
const SERVER_ID = 'bgk_r03_relations';

function serverSummary() {
  return {
    serverProfile: 'closed-profile-sequence-anonymous-offline-v1',
    profileId: PROFILE.id,
    argumentProfile: PROFILE.argumentProfile,
    networkMode: R03_RELATIONS_OFFLINE_NETWORK_MODE,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    sourceRevision: SOURCE_SHA,
    bundleSha256: BUNDLE_SHA,
    catalogSha256: 'c'.repeat(64),
    toolName: PROFILE.toolName,
    toolDescriptionSha256: 'd'.repeat(64),
    inputSchemaSha256: 'e'.repeat(64),
    serverToolNames: [PROFILE.toolName],
    serverToolCount: 1,
    expectedCallCount: 2,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 2,
    deniedCallCount: 0,
    results: R03_RELATIONS_OFFLINE_EXPECTED_RESULT_SUMMARIES.map(
      (resultSummary, sequenceIndex) => ({
        sequenceIndex,
        status: 'SUCCESS',
        resultSummary,
      }),
    ),
    offlineFixture: {
      profile: R03_RELATIONS_OFFLINE_NETWORK_MODE,
      requestCount: 2,
      relationRequestCount: 2,
      rootRequestCount: 1,
      intermediateRequestCount: 1,
      duplicateRequestCount: 0,
      unexpectedRequestCount: 0,
      authorizationHeaderCount: 0,
      expectedOperationsComplete: true,
    },
  };
}

test('R03 Codex invocation is ephemeral, read-only, and exposes only the fixed relations tool', () => {
  assert.equal(validateR03RunnerArgs(['--help']), 'help');
  assert.equal(validateR03RunnerArgs(['--run', '95']), 'run');
  assert.throws(() => validateR03RunnerArgs(['--run', '94']));
  const args = buildR03CodexExecArgs({
    nodePath: '/usr/bin/node',
    summaryPath: '/tmp/r03-summary.json',
    sourceRevision: SOURCE_SHA,
    bundleSha256: BUNDLE_SHA,
  });
  assert.equal(args[0], 'exec');
  for (const flag of ['--ignore-user-config', '--strict-config', '--ephemeral', '--json'])
    assert.ok(args.includes(flag), `missing ${flag}`);
  assert.equal(args[args.indexOf('--model') + 1], 'gpt-6-luna');
  assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only');
  for (const setting of [
    'features.multi_agent=false',
    'features.shell_tool=false',
    'features.web_search=false',
    `mcp_servers.${SERVER_ID}.required=true`,
    `mcp_servers.${SERVER_ID}.enabled_tools=["${PROFILE.toolName}"]`,
    `mcp_servers.${SERVER_ID}.default_tools_approval_mode="prompt"`,
    `mcp_servers.${SERVER_ID}.tools."${PROFILE.toolName}".approval_mode="approve"`,
  ])
    assert.ok(args.includes(setting), `missing ${setting}`);
  assert.equal(
    args
      .at(-1)
      .includes(JSON.stringify(R03_RELATIONS_OFFLINE_EXPECTED_CALLS.map((call) => call.arguments))),
    true,
  );
  assert.equal(args.at(-1).includes(R03_RELATIONS_OFFLINE_ACKNOWLEDGEMENT), true);
});

test('R03 server summary accepts exactly two ordered local relation responses', () => {
  const summary = serverSummary();
  assert.equal(validateR03ServerSummary(summary, SOURCE_SHA, BUNDLE_SHA), true);
  assert.equal(
    validateR03ServerSummary(
      { ...summary, offlineFixture: { ...summary.offlineFixture, requestCount: 3 } },
      SOURCE_SHA,
      BUNDLE_SHA,
    ),
    false,
  );
  assert.equal(
    validateR03ServerSummary(
      { ...summary, results: [...summary.results].reverse() },
      SOURCE_SHA,
      BUNDLE_SHA,
    ),
    false,
  );
  assert.equal(
    validateR03ServerSummary({ ...summary, results: [summary.results[0]] }, SOURCE_SHA, BUNDLE_SHA),
    false,
  );
});

test('R03 failure classification enforces two exact MCP calls and a clean tool-only turn', () => {
  const base = {
    execution: { failed: false, spawnErrorCode: null },
    parsed: { parsed: true },
    events: {
      eventStreamComplete: true,
      turnCompleted: true,
      codexErrorItemCount: 0,
      blockedWebSearchErrorItemCount: 0,
      unexpectedCodexErrorItemCount: 0,
      nonMcpToolEventCount: 0,
      shellToolCallCount: 0,
      mcpServerNames: [SERVER_ID],
      codexMcpToolEventCount: 2,
      completedMcpCalls: R03_RELATIONS_OFFLINE_EXPECTED_CALLS.map((call) => ({
        tool: call.toolName,
        arguments: call.arguments,
      })),
      answer: R03_RELATIONS_OFFLINE_ACKNOWLEDGEMENT,
    },
    exactCall: true,
    exactToolEvent: true,
    serverSummary: {},
    serverSummaryValid: true,
    candidateBundleCurrent: true,
  };
  assert.equal(classifyR03AssertionFailure(base), 'AGENT_MCP_ASSERTION_FAILED');
  assert.equal(
    classifyR03AssertionFailure({
      ...base,
      events: {
        ...base.events,
        codexMcpToolEventCount: 1,
        completedMcpCalls: base.events.completedMcpCalls.slice(0, 1),
      },
    }),
    'MCP_CALL_COUNT_MISMATCH',
  );
  assert.equal(
    classifyR03AssertionFailure({
      ...base,
      events: { ...base.events, nonMcpToolEventCount: 1 },
    }),
    'NON_MCP_TOOL_EVENT',
  );
  assert.equal(
    classifyR03AssertionFailure({
      ...base,
      events: { ...base.events, codexMcpToolEventCount: 2, answer: 'wrong' },
    }),
    'ACKNOWLEDGEMENT_MISMATCH',
  );
});

test('R03 runner failure cannot terminalize a different owner claim or retry terminal state', () => {
  const terminalizedClaims = [];
  const loser = recoverR03RunnerFailure(
    { state: 'CLAIMED', disposition: { claimId: 'winner', runnerReceiptPublicKey: 'winner-key' } },
    {
      claimId: null,
      runnerReceiptPublicKey: 'loser-key',
      recordInconclusive: (claimId) => terminalizedClaims.push(claimId),
    },
  );
  assert.deepEqual(loser, { state: 'R03_CLAIM_OWNERSHIP_MISMATCH' });
  assert.deepEqual(terminalizedClaims, []);
  assert.deepEqual(recoverR03RunnerFailure({ state: 'INCONCLUSIVE' }, {}), {
    state: 'INCONCLUSIVE',
    recovered: true,
  });
  assert.deepEqual(terminalizedClaims, []);
});
