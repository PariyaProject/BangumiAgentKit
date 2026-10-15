import assert from 'node:assert/strict';
import test from 'node:test';
import {
  agentMcpProfileArgumentsSha256,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  P02_PERSON_PROFILE_EXPECTED_ARGUMENTS,
  P02_PERSON_PROFILE_OFFLINE_NETWORK_MODE,
} from '../../scripts/lib/p02-person-profile-offline-fixture.mjs';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';
import {
  buildP02CodexExecArgs,
  validateP02RunnerArgs,
  validateServerSummary,
} from '../../scripts/acceptance/run-p02-person-profile-agent-mcp.mjs';

const PROFILE = getAgentMcpProfileById('p02-person-profile-offline-agent-mcp-v1');
const SOURCE_SHA = 'a'.repeat(40);
const BUNDLE_SHA = 'b'.repeat(64);
const SERVER_ID = 'bgk_p02_profile';

test('P02 Codex invocation is ephemeral, read-only, and exposes only the fixed offline tool', () => {
  assert.equal(validateP02RunnerArgs(['--help']), 'help');
  assert.equal(validateP02RunnerArgs(['--run', '95']), 'run');
  assert.throws(() => validateP02RunnerArgs(['--run', '94']));
  const args = buildP02CodexExecArgs({
    nodePath: '/usr/bin/node',
    summaryPath: '/tmp/p02-summary.json',
    sourceRevision: SOURCE_SHA,
    bundleSha256: BUNDLE_SHA,
  });
  assert.equal(args[0], 'exec');
  assert.ok(args.includes('--ephemeral'));
  assert.ok(args.includes('--sandbox'));
  assert.ok(args.includes('read-only'));
  assert.ok(args.includes('--model'));
  assert.ok(args.includes('gpt-6-luna'));
  const joined = args.join('\n');
  assert.match(joined, /mcp_servers\.bgk_p02_profile\.enabled_tools/u);
  assert.match(joined, /bangumi\.get_person_profile/u);
  assert.match(joined, /p02-person-profile-offline-agent-mcp-v1/u);
  assert.match(joined, /features\.shell_tool=false/u);
  assert.match(joined, /features\.web_search=false/u);
  assert.doesNotMatch(joined, /render_person_profile/u);
});

test('P02 server summary requires exactly the three synthetic responses', () => {
  const summary = {
    serverProfile: 'closed-profile-sequence-anonymous-offline-v1',
    profileId: PROFILE.id,
    argumentProfile: PROFILE.argumentProfile,
    networkMode: P02_PERSON_PROFILE_OFFLINE_NETWORK_MODE,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    sourceRevision: SOURCE_SHA,
    bundleSha256: BUNDLE_SHA,
    toolName: PROFILE.toolName,
    serverToolCount: 1,
    serverToolNames: [PROFILE.toolName],
    expectedCallCount: 1,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    results: [
      {
        sequenceIndex: 0,
        status: 'SUCCESS',
        resultSummary: { personId: 990701, state: 'partial' },
      },
    ],
    offlineFixture: {
      profile: P02_PERSON_PROFILE_OFFLINE_NETWORK_MODE,
      requestCount: 3,
      personRequestCount: 1,
      subjectsRequestCount: 1,
      charactersRequestCount: 1,
      duplicateRequestCount: 0,
      unexpectedRequestCount: 0,
      authorizationHeaderCount: 0,
      expectedOperationsComplete: true,
    },
  };
  assert.equal(validateServerSummary(summary, SOURCE_SHA, BUNDLE_SHA), true);
  assert.equal(
    validateServerSummary(
      { ...summary, offlineFixture: { ...summary.offlineFixture, requestCount: 4 } },
      SOURCE_SHA,
      BUNDLE_SHA,
    ),
    false,
  );
  assert.equal(
    validateServerSummary({ ...summary, deniedCallCount: 1 }, SOURCE_SHA, BUNDLE_SHA),
    false,
  );
  assert.equal(
    validateServerSummary(
      {
        ...summary,
        results: [{ ...summary.results[0], resultSummary: { personId: 4765, state: 'partial' } }],
      },
      SOURCE_SHA,
      BUNDLE_SHA,
    ),
    false,
  );
  const mismatchedResultSummary = summarizeProfileToolResult(
    { person: { id: 990702 }, state: 'partial' },
    P02_PERSON_PROFILE_EXPECTED_ARGUMENTS,
    PROFILE.id,
  );
  assert.deepEqual(mismatchedResultSummary, { personId: 990702, state: 'partial' });
  assert.equal(
    validateServerSummary(
      {
        ...summary,
        results: [{
          ...summary.results[0],
          resultSummary: mismatchedResultSummary,
        }],
      },
      SOURCE_SHA,
      BUNDLE_SHA,
    ),
    false,
  );
  const missingResultIdentitySummary = summarizeProfileToolResult(
    { person: {}, state: 'partial' },
    P02_PERSON_PROFILE_EXPECTED_ARGUMENTS,
    PROFILE.id,
  );
  assert.deepEqual(missingResultIdentitySummary, { personId: null, state: 'partial' });
  assert.equal(
    validateServerSummary(
      {
        ...summary,
        results: [{
          ...summary.results[0],
          resultSummary: missingResultIdentitySummary,
        }],
      },
      SOURCE_SHA,
      BUNDLE_SHA,
    ),
    false,
  );
  assert.equal(SERVER_ID, 'bgk_p02_profile');
});
