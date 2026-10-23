import assert from 'node:assert/strict';
import test from 'node:test';
import {
  agentMcpProfileArgumentsSha256,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  R01_RELATIONS_TEXT_PROJECTION_OFFLINE_PROFILE_ID,
  R01_RELATIONS_TEXT_PROJECTION_OFFLINE_NETWORK_MODE,
} from '../../scripts/lib/r01-relations-text-projection-offline-profile.mjs';
import {
  R01_RELATIONS_OFFLINE_EXPECTED_ARGUMENTS,
  R01_RELATIONS_OFFLINE_NETWORK_MODE,
  R01_RELATIONS_OFFLINE_PROFILE_ID,
} from '../../scripts/lib/r01-relations-offline-profile.mjs';
import {
  buildR01CodexExecArgs,
  classifyR01AssertionFailure,
  recoverR01RunnerFailure,
  validateR01RunnerArgs,
  validateR01ServerSummary,
} from '../../scripts/acceptance/run-r01-relations-offline-agent-mcp.mjs';

const PROFILE = getAgentMcpProfileById(R01_RELATIONS_OFFLINE_PROFILE_ID);
const TEXT_PROJECTION_PROFILE = getAgentMcpProfileById(
  R01_RELATIONS_TEXT_PROJECTION_OFFLINE_PROFILE_ID,
);
const SOURCE_SHA = 'a'.repeat(40);
const BUNDLE_SHA = 'b'.repeat(64);
const SERVER_ID = 'bgk_r01_relations';
const SUMMARY = {
  state: 'observed',
  sourceDirection: 'source_subject_to_returned_target',
  responseRowsObserved: 1,
  rowsReturned: 1,
  schemaDriftRows: 0,
  truncated: false,
  paginationAvailable: false,
  totalCountAvailable: false,
  completeness: 'not_provided_by_source',
  relationLabels: ['改编'],
};

function serverSummary() {
  return {
    serverProfile: 'closed-profile-sequence-anonymous-offline-v1',
    profileId: PROFILE.id,
    argumentProfile: PROFILE.argumentProfile,
    networkMode: R01_RELATIONS_OFFLINE_NETWORK_MODE,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    sourceRevision: SOURCE_SHA,
    bundleSha256: BUNDLE_SHA,
    catalogSha256: 'c'.repeat(64),
    toolName: PROFILE.toolName,
    toolDescriptionSha256: 'd'.repeat(64),
    inputSchemaSha256: 'e'.repeat(64),
    serverToolNames: [PROFILE.toolName],
    serverToolCount: 1,
    expectedCallCount: 1,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    results: [{ sequenceIndex: 0, status: 'SUCCESS', resultSummary: SUMMARY }],
    offlineFixture: {
      profile: R01_RELATIONS_OFFLINE_NETWORK_MODE,
      requestCount: 1,
      relationRequestCount: 1,
      duplicateRequestCount: 0,
      unexpectedRequestCount: 0,
      authorizationHeaderCount: 0,
      expectedOperationsComplete: true,
    },
  };
}

test('R01 Codex invocation is ephemeral, read-only, and exposes only its fixed tool', () => {
  assert.equal(validateR01RunnerArgs(['--help']), 'help');
  assert.equal(validateR01RunnerArgs(['--run', '95']), 'run');
  assert.throws(() => validateR01RunnerArgs(['--run', '94']));
  const args = buildR01CodexExecArgs({
    nodePath: '/usr/bin/node',
    summaryPath: '/tmp/r01-summary.json',
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
    'web_search="disabled"',
    `mcp_servers.${SERVER_ID}.required=true`,
    `mcp_servers.${SERVER_ID}.enabled_tools=["${PROFILE.toolName}"]`,
    `mcp_servers.${SERVER_ID}.default_tools_approval_mode="approve"`,
  ])
    assert.ok(args.includes(setting), `missing ${setting}`);
  assert.equal(
    args.some((setting) => setting.includes(`mcp_servers.${SERVER_ID}.tools.`)),
    false,
  );
  assert.equal(
    args.at(-1).includes(JSON.stringify(R01_RELATIONS_OFFLINE_EXPECTED_ARGUMENTS)),
    true,
  );
});

test('R01 server summary accepts exactly one local fixture response', () => {
  const summary = serverSummary();
  assert.equal(validateR01ServerSummary(summary, SOURCE_SHA, BUNDLE_SHA), true);
  assert.equal(
    validateR01ServerSummary(
      {
        ...summary,
        offlineFixture: { ...summary.offlineFixture, requestCount: 2 },
      },
      SOURCE_SHA,
      BUNDLE_SHA,
    ),
    false,
  );
  assert.equal(
    validateR01ServerSummary(
      {
        ...summary,
        results: [{ ...summary.results[0], resultSummary: { ...SUMMARY, rowsReturned: 2 } }],
      },
      SOURCE_SHA,
      BUNDLE_SHA,
    ),
    false,
  );
});

test('R01 runner accepts only the exact new text-projection profile option', () => {
  assert.equal(
    validateR01RunnerArgs([
      '--run',
      '95',
      '--profile-id',
      R01_RELATIONS_TEXT_PROJECTION_OFFLINE_PROFILE_ID,
    ]),
    'run',
  );
  assert.throws(() =>
    validateR01RunnerArgs([
      '--run',
      '95',
      '--profile-id',
      'r01-subject-relations-offline-agent-mcp-v1',
    ]),
  );
});

test('R01 server summary accepts the v2 source-row summary only for its exact profile', () => {
  const v2 = {
    ...serverSummary(),
    profileId: TEXT_PROJECTION_PROFILE.id,
    argumentProfile: TEXT_PROJECTION_PROFILE.argumentProfile,
    networkMode: R01_RELATIONS_TEXT_PROJECTION_OFFLINE_NETWORK_MODE,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(TEXT_PROJECTION_PROFILE),
    results: [
      {
        sequenceIndex: 0,
        status: 'SUCCESS',
        resultSummary: {
          state: 'observed',
          sourceRowsObserved: 30,
          sourceRowsReturned: 30,
          sourceSchemaDriftRows: 0,
          sourceTruncated: false,
          paginationAvailable: false,
          totalCountAvailable: false,
          completeness: 'not_provided_by_source',
        },
      },
    ],
    offlineFixture: {
      ...serverSummary().offlineFixture,
      profile: R01_RELATIONS_TEXT_PROJECTION_OFFLINE_NETWORK_MODE,
    },
  };
  assert.equal(
    validateR01ServerSummary(v2, SOURCE_SHA, BUNDLE_SHA, TEXT_PROJECTION_PROFILE.id),
    true,
  );
  assert.equal(
    validateR01ServerSummary(
      {
        ...v2,
        results: [
          {
            ...v2.results[0],
            resultSummary: { ...v2.results[0].resultSummary, sourceRowsReturned: 29 },
          },
        ],
      },
      SOURCE_SHA,
      BUNDLE_SHA,
      TEXT_PROJECTION_PROFILE.id,
    ),
    false,
  );
});

test('R01 failure classification accepts only the bounded disabled-search error category', () => {
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
      codexMcpToolEventCount: 1,
      completedMcpCalls: [
        { tool: PROFILE.toolName, arguments: R01_RELATIONS_OFFLINE_EXPECTED_ARGUMENTS },
      ],
      answer: 'R01_SYNTHETIC_SUBJECT_RELATIONS_READ',
    },
    exactCall: true,
    exactToolEvent: true,
    serverSummary: {},
    serverSummaryValid: true,
    candidateBundleCurrent: true,
  };
  assert.equal(classifyR01AssertionFailure(base), 'AGENT_MCP_ASSERTION_FAILED');
  assert.equal(
    classifyR01AssertionFailure({
      ...base,
      events: { ...base.events, codexErrorItemCount: 3, blockedWebSearchErrorItemCount: 3 },
    }),
    'AGENT_MCP_ASSERTION_FAILED',
  );
  assert.equal(
    classifyR01AssertionFailure({
      ...base,
      events: { ...base.events, codexErrorItemCount: 1, unexpectedCodexErrorItemCount: 1 },
    }),
    'UNEXPECTED_CODEX_ERROR_EVENT',
  );
  assert.equal(
    classifyR01AssertionFailure({
      ...base,
      events: { ...base.events, codexErrorItemCount: 4, blockedWebSearchErrorItemCount: 4 },
    }),
    'UNEXPECTED_CODEX_ERROR_EVENT',
  );
});

test('R01 losing runner leaves the winner claim untouched and terminal claims cannot retry', () => {
  const winnerStatus = {
    state: 'CLAIMED',
    disposition: { claimId: 'winner-claim', runnerReceiptPublicKey: 'winner-public-key' },
  };
  const terminalizedClaims = [];
  const loser = recoverR01RunnerFailure(winnerStatus, {
    claimId: null,
    runnerReceiptPublicKey: 'loser-public-key',
    recordInconclusive: (claimId) => terminalizedClaims.push(claimId),
  });
  assert.deepEqual(loser, { state: 'R01_CLAIM_OWNERSHIP_MISMATCH' });
  assert.deepEqual(terminalizedClaims, []);
  const own = recoverR01RunnerFailure(
    {
      state: 'CLAIMED',
      disposition: { claimId: 'owned-claim', runnerReceiptPublicKey: 'runner-key' },
    },
    {
      claimId: 'owned-claim',
      runnerReceiptPublicKey: 'runner-key',
      recordInconclusive: (claimId) => terminalizedClaims.push(claimId),
    },
  );
  assert.deepEqual(own, { state: 'INCONCLUSIVE_RECORDED', claimId: 'owned-claim' });
  assert.deepEqual(terminalizedClaims, ['owned-claim']);
  assert.deepEqual(recoverR01RunnerFailure({ state: 'INCONCLUSIVE' }, {}), {
    state: 'INCONCLUSIVE',
    recovered: true,
  });
});
