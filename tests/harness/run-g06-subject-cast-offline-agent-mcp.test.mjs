import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildG06CastOfflineCodexExecArgs,
  validateG06CastOfflineRunnerArgs,
  validateG06CastOfflineServerSummary,
  validateG06CastOfflineToolEvent,
} from '../../scripts/acceptance/run-g06-subject-cast-offline-agent-mcp.mjs';
import {
  hasExactCompletedCodexToolCalls,
  summarizeCodexEvents,
} from '../../scripts/acceptance/run-g26-codex-agent-mcp.mjs';
import {
  G06_CAST_OFFLINE_EXPECTED_ARGUMENTS,
  G06_CAST_OFFLINE_NETWORK_MODE,
  G06_CAST_OFFLINE_PROFILE_ID,
  G06_CAST_OFFLINE_ARGUMENT_PROFILE,
} from '../../scripts/lib/g06-subject-cast-offline-profile.mjs';
import {
  agentMcpProfileArgumentsSha256,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { canonicalAgentMcpProfileJson } from '../../scripts/lib/agent-mcp-profile-claims.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const TOOL_NAME = 'bangumi.get_subject_cast';
const SERVER_ID = 'bgk_g06_cast_offline_profile';

function expectedToolSummary() {
  return {
    status: 'ok',
    subjectIdMatches: true,
    rowsObserved: 2,
    rowsReturned: 2,
    multiRoleVoiceActorCount: 1,
    truncated: false,
    schemaDriftRows: 0,
    invalidActorIdRows: 0,
    sourceStatus: 'observed',
    paginationAvailable: false,
    totalCountAvailable: false,
  };
}

function expectedFixture() {
  return {
    profile: G06_CAST_OFFLINE_NETWORK_MODE,
    requestCount: 1,
    allowedRequestCount: 1,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    queryParameterCount: 0,
    requestBodyCount: 0,
    rowsReturned: 2,
    expectedOperationComplete: true,
  };
}

function serverSummary() {
  const catalogBytes = readFileSync(path.join(ROOT, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const tool = catalog.find((item) => item.name === TOOL_NAME);
  const profile = getAgentMcpProfileById(G06_CAST_OFFLINE_PROFILE_ID);
  return {
    serverProfile: 'closed-profile-sequence-anonymous-offline-v1',
    profileId: G06_CAST_OFFLINE_PROFILE_ID,
    argumentProfile: G06_CAST_OFFLINE_ARGUMENT_PROFILE,
    networkMode: G06_CAST_OFFLINE_NETWORK_MODE,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(profile),
    sourceRevision: 'a'.repeat(40),
    bundleSha256: 'b'.repeat(64),
    catalogSha256: createHash('sha256').update(catalogBytes).digest('hex'),
    toolName: TOOL_NAME,
    toolDescriptionSha256: createHash('sha256').update(tool.description, 'utf8').digest('hex'),
    inputSchemaSha256: createHash('sha256')
      .update(canonicalAgentMcpProfileJson(tool.inputSchema), 'utf8')
      .digest('hex'),
    serverToolCount: 1,
    serverToolNames: [TOOL_NAME],
    expectedCallCount: 1,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    results: [
      {
        sequenceIndex: 0,
        status: 'SUCCESS',
        resultSummary: expectedToolSummary(),
      },
    ],
    offlineFixture: expectedFixture(),
  };
}

test('G06 offline runner accepts only --run 95', () => {
  assert.equal(validateG06CastOfflineRunnerArgs(['--run', '95']), 'run');
  assert.equal(validateG06CastOfflineRunnerArgs(['--help']), 'help');
  assert.throws(() => validateG06CastOfflineRunnerArgs(['--run', '96']), /--run 95/u);
  assert.throws(() => validateG06CastOfflineRunnerArgs(['--run', '95', '--retry']), /--run 95/u);
});

test('G06 offline Codex invocation is ephemeral and exposes only the fixed tool', () => {
  const args = buildG06CastOfflineCodexExecArgs({
    root: '/tmp/g06-offline',
    nodePath: '/usr/bin/node',
    serverScript: '/tmp/server.mjs',
    summaryPath: '/tmp/summary.json',
    sourceRevision: 'a'.repeat(40),
    bundleSha256: 'b'.repeat(64),
  });
  assert.deepEqual(args.slice(0, 9), [
    'exec',
    '--ignore-user-config',
    '--strict-config',
    '--ephemeral',
    '--json',
    '--model',
    'gpt-6-luna',
    '--approve-for-me',
    '--cd',
  ]);
  assert.equal(args.includes('--sandbox'), false);
  assert.equal(args.includes('read-only'), false);
  assert.equal(
    args.some((arg) => arg.includes('features.web_search')),
    false,
  );
  assert.equal(
    args.some((arg) => arg === 'features.shell_tool=false'),
    true,
  );
  assert.equal(
    args.some((arg) => arg === `mcp_servers.${SERVER_ID}.enabled_tools=["${TOOL_NAME}"]`),
    true,
  );
  assert.equal(
    args.some(
      (arg) =>
        arg.includes('mcp_servers.') && arg.includes('enabled_tools') && !arg.includes(TOOL_NAME),
    ),
    false,
  );
  assert.equal(
    JSON.stringify(G06_CAST_OFFLINE_EXPECTED_ARGUMENTS),
    '{"subjectId":990804,"limit":2}',
  );
});

test('G06 offline server summary requires exactly one bounded synthetic response', () => {
  const valid = serverSummary();
  assert.equal(validateG06CastOfflineServerSummary(valid, 'a'.repeat(40), 'b'.repeat(64)), true);

  const repeated = structuredClone(valid);
  repeated.offlineFixture.requestCount = 2;
  assert.equal(
    validateG06CastOfflineServerSummary(repeated, 'a'.repeat(40), 'b'.repeat(64)),
    false,
  );

  const wrongArguments = structuredClone(valid);
  wrongArguments.expectedArgumentsSha256 = '0'.repeat(64);
  assert.equal(
    validateG06CastOfflineServerSummary(wrongArguments, 'a'.repeat(40), 'b'.repeat(64)),
    false,
  );

  const wrongTool = structuredClone(valid);
  wrongTool.serverToolNames = ['bangumi.get_person'];
  assert.equal(
    validateG06CastOfflineServerSummary(wrongTool, 'a'.repeat(40), 'b'.repeat(64)),
    false,
  );
});

test('G06 offline runner matches the MCP event summary field and rejects wrong or extra calls', () => {
  const events = summarizeCodexEvents([
    { type: 'thread.started' },
    { type: 'turn.started' },
    {
      type: 'item.completed',
      item: {
        id: 'synthetic-call',
        type: 'mcp_tool_call',
        server: SERVER_ID,
        tool: TOOL_NAME,
        arguments: G06_CAST_OFFLINE_EXPECTED_ARGUMENTS,
        status: 'completed',
        result: { isError: false },
      },
    },
    { type: 'turn.completed' },
  ]);

  assert.deepEqual(events.toolCalls, [
    {
      name: TOOL_NAME,
      arguments: G06_CAST_OFFLINE_EXPECTED_ARGUMENTS,
      state: 'DONE',
    },
  ]);
  assert.equal(hasExactCompletedCodexToolCalls(events.toolCalls, [TOOL_NAME]), true);
  assert.equal(validateG06CastOfflineToolEvent(events), true);

  const wrongTool = structuredClone(events);
  wrongTool.toolCalls[0].name = 'bangumi.get_person';
  assert.equal(hasExactCompletedCodexToolCalls(wrongTool.toolCalls, [TOOL_NAME]), false);
  assert.equal(validateG06CastOfflineToolEvent(wrongTool), false);

  const duplicate = structuredClone(events);
  duplicate.toolCalls.push(duplicate.toolCalls[0]);
  assert.equal(hasExactCompletedCodexToolCalls(duplicate.toolCalls, [TOOL_NAME]), false);
  assert.equal(validateG06CastOfflineToolEvent(duplicate), false);
});
