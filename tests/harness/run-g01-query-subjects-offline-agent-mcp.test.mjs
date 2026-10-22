import assert from 'node:assert/strict';
import test from 'node:test';
import {
  agentMcpProfileArgumentsSha256,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  G01_QUERY_SUBJECTS_OFFLINE_ACKNOWLEDGEMENT,
  G01_QUERY_SUBJECTS_OFFLINE_EXPECTED_ARGUMENTS,
  G01_QUERY_SUBJECTS_OFFLINE_NETWORK_MODE,
  G01_QUERY_SUBJECTS_OFFLINE_SERVER_ID,
  G01_QUERY_SUBJECTS_OFFLINE_V2_ACKNOWLEDGEMENT,
  G01_QUERY_SUBJECTS_OFFLINE_V2_EXPECTED_ARGUMENTS,
  G01_QUERY_SUBJECTS_OFFLINE_V2_PROFILE_ID,
  G01_QUERY_SUBJECTS_OFFLINE_V2_SERVER_ID,
} from '../../scripts/lib/g01-query-subjects-offline-matrix-profile.mjs';
import {
  assertG01QuerySubjectsOfflineCandidateReviewGate,
  buildG01QuerySubjectsOfflineCodexExecArgs,
  classifyG01QuerySubjectsOfflineFailure,
  g01QuerySubjectsClaimBelongsToRunner,
  validateG01QuerySubjectsOfflineRunnerArgs,
} from '../../scripts/acceptance/run-g01-query-subjects-offline-agent-mcp.mjs';
import { validateG01QuerySubjectsOfflineServerSummary } from '../../scripts/acceptance/write-g01-query-subjects-offline-agent-mcp-report.mjs';

const PROFILE = getAgentMcpProfileById('g01-query-subjects-offline-agent-mcp-matrix-v1');
const PROFILE_V2 = getAgentMcpProfileById(G01_QUERY_SUBJECTS_OFFLINE_V2_PROFILE_ID);
const SOURCE_SHA = 'a'.repeat(40);
const BASE_SHA = 'b'.repeat(40);
const BUNDLE_SHA = 'c'.repeat(64);
const CI_RUN_ID = '39033314210';
const PR_NUMBER = 230;
const BRANCH = 'codex/epoch-run95-g01-query-subjects-offline-agent-mcp-matrix-20261017';
const REVIEWER_ID = `gpt-6-luna-max-run95-pr${PR_NUMBER}-round1`;
const REQUIRED_CHECKS = [
  'harness-control',
  'sqlite-default',
  'host-integration',
  'standalone-release-smoke',
  'postgres-compat',
  'provider-foundation',
  'discovery-foundation',
];

function statusFixture() {
  return {
    git: { branch: BRANCH, head: SOURCE_SHA, status: '' },
    run: {
      state: {
        state: 'EPOCH_ACTIVE',
        profile: 'AUTONOMOUS_EVOLUTION',
        active_epoch_pr: PR_NUMBER,
        pending_epoch: null,
      },
    },
    epoch: {
      number: PR_NUMBER,
      github_state: 'OPEN',
      state: {
        epoch_id: PROFILE.epochId,
        pr_number: PR_NUMBER,
        branch: BRANCH,
        base_branch: 'master',
        base_sha: BASE_SHA,
        reviewed_base_sha: BASE_SHA,
        candidate_sha: SOURCE_SHA,
        review_pass_sha: SOURCE_SHA,
        ci: {
          sha: SOURCE_SHA,
          status: 'SUCCESS',
          url: `https://github.com/PariyaProject/BangumiAgentKit/actions/runs/${CI_RUN_ID}`,
        },
        state: 'REVIEW_PASSED',
        advances_frontier_ids: ['G01'],
        scope_closure: { related_work_remaining: false },
        adversarial_preflight: { completed: true },
        review_history: [
          {
            candidate_sha: SOURCE_SHA,
            reviewed_base_sha: BASE_SHA,
            verdict: 'PASS',
            reviewer_id: REVIEWER_ID,
          },
        ],
      },
    },
  };
}

function pullRequestFixture() {
  return {
    state: 'OPEN',
    isDraft: false,
    baseRefName: 'master',
    headRefName: BRANCH,
    headRefOid: SOURCE_SHA,
    statusCheckRollup: REQUIRED_CHECKS.map((name, index) => ({
      name,
      status: 'COMPLETED',
      conclusion: 'SUCCESS',
      detailsUrl: `https://github.com/PariyaProject/BangumiAgentKit/actions/runs/${CI_RUN_ID}/job/${116668186145 + index}`,
    })),
  };
}

function readGitFixture(...args) {
  if (args[0] === 'status') return '';
  if (args[0] === 'rev-parse') return SOURCE_SHA;
  throw new Error(`Unexpected Git query: ${args.join(' ')}`);
}

function serverSummaryFixture() {
  return {
    serverProfile: 'closed-profile-sequence-anonymous-offline-v1',
    profileId: PROFILE.id,
    argumentProfile: PROFILE.argumentProfile,
    networkMode: G01_QUERY_SUBJECTS_OFFLINE_NETWORK_MODE,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    sourceRevision: SOURCE_SHA,
    bundleSha256: BUNDLE_SHA,
    catalogSha256: 'd'.repeat(64),
    toolName: PROFILE.toolName,
    toolDescriptionSha256: 'e'.repeat(64),
    inputSchemaSha256: 'f'.repeat(64),
    serverToolNames: [PROFILE.toolName],
    serverToolCount: 1,
    expectedCallCount: 1,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    results: [
      {
        sequenceIndex: 0,
        status: 'SUCCESS',
        resultSummary: {
          resultState: 'ok',
          returnedItems: 1,
          coverageState: 'partial',
          requested: 1,
          returned: 1,
          pagesScanned: 1,
          totalKind: 'estimated',
          warningCount: 1,
        },
      },
    ],
    offlineFixture: {
      profile: G01_QUERY_SUBJECTS_OFFLINE_NETWORK_MODE,
      requestCount: 1,
      searchRequestCount: 1,
      duplicateRequestCount: 0,
      unexpectedRequestCount: 0,
      rejectedHeaderCount: 0,
      expectedOperationsComplete: true,
      rawFixturePayloadStored: false,
    },
  };
}

test('G01 query-subjects runner only accepts Run 95', () => {
  assert.equal(validateG01QuerySubjectsOfflineRunnerArgs(['--help']), 'help');
  assert.equal(validateG01QuerySubjectsOfflineRunnerArgs(['--run', '95']), 'run');
  assert.equal(
    validateG01QuerySubjectsOfflineRunnerArgs([
      '--run',
      '95',
      '--profile-id',
      G01_QUERY_SUBJECTS_OFFLINE_V2_PROFILE_ID,
    ]),
    'run',
  );
  assert.throws(() => validateG01QuerySubjectsOfflineRunnerArgs(['--run', '94']));
  assert.throws(() =>
    validateG01QuerySubjectsOfflineRunnerArgs(['--run', '95', '--profile-id', 'unknown']),
  );
});

test('v2 Codex invocation is pinned to its unique server and exact registered tool', () => {
  const args = buildG01QuerySubjectsOfflineCodexExecArgs({
    nodePath: '/usr/bin/node',
    summaryPath: '/tmp/g01-v2-summary.json',
    sourceRevision: SOURCE_SHA,
    bundleSha256: BUNDLE_SHA,
    profileId: G01_QUERY_SUBJECTS_OFFLINE_V2_PROFILE_ID,
  });
  assert.ok(args.some((value) => value.includes(G01_QUERY_SUBJECTS_OFFLINE_V2_SERVER_ID)));
  assert.ok(args.some((value) => value.includes(G01_QUERY_SUBJECTS_OFFLINE_V2_PROFILE_ID)));
  assert.ok(args.some((value) => value.includes('enabled_tools=["bangumi.query_subjects"]')));
  assert.ok(
    args.some((value) => value.includes(G01_QUERY_SUBJECTS_OFFLINE_V2_EXPECTED_ARGUMENTS.keyword)),
  );
});

test('G01 query-subjects Candidate gate binds exact Base, CI, and Luna Max PASS', () => {
  const result = assertG01QuerySubjectsOfflineCandidateReviewGate(
    statusFixture(),
    pullRequestFixture(),
    { sourceRevision: SOURCE_SHA, currentBaseSha: BASE_SHA, readGit: readGitFixture },
  );
  assert.deepEqual(result, {
    candidateSha: SOURCE_SHA,
    baseSha: BASE_SHA,
    prNumber: PR_NUMBER,
    reviewerId: REVIEWER_ID,
    ciRunId: CI_RUN_ID,
    ciChecks: REQUIRED_CHECKS.map((name) => ({
      name,
      status: 'COMPLETED',
      conclusion: 'SUCCESS',
    })),
  });
  assert.throws(() =>
    assertG01QuerySubjectsOfflineCandidateReviewGate(statusFixture(), pullRequestFixture(), {
      sourceRevision: SOURCE_SHA,
      currentBaseSha: '0'.repeat(40),
      readGit: readGitFixture,
    }),
  );
  const missingCheck = pullRequestFixture();
  missingCheck.statusCheckRollup.pop();
  assert.throws(() =>
    assertG01QuerySubjectsOfflineCandidateReviewGate(statusFixture(), missingCheck, {
      sourceRevision: SOURCE_SHA,
      currentBaseSha: BASE_SHA,
      readGit: readGitFixture,
    }),
  );
});

test('Codex invocation is ephemeral, read-only, and exposes only query_subjects', () => {
  const args = buildG01QuerySubjectsOfflineCodexExecArgs({
    nodePath: '/usr/bin/node',
    summaryPath: '/tmp/g01-query-subjects-summary.json',
    sourceRevision: SOURCE_SHA,
    bundleSha256: BUNDLE_SHA,
  });
  for (const flag of ['--ignore-user-config', '--strict-config', '--ephemeral', '--json'])
    assert.ok(args.includes(flag), `missing ${flag}`);
  assert.equal(args[args.indexOf('--model') + 1], 'gpt-6-luna');
  assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only');
  for (const setting of [
    'features.multi_agent=false',
    'features.shell_tool=false',
    'web_search="disabled"',
    `mcp_servers.${G01_QUERY_SUBJECTS_OFFLINE_SERVER_ID}.required=true`,
    `mcp_servers.${G01_QUERY_SUBJECTS_OFFLINE_SERVER_ID}.enabled_tools=["${PROFILE.toolName}"]`,
  ])
    assert.ok(args.includes(setting), `missing ${setting}`);
  assert.equal(
    args.at(-1).includes(JSON.stringify(G01_QUERY_SUBJECTS_OFFLINE_EXPECTED_ARGUMENTS)),
    true,
  );
});

test('server summary accepts exactly one intercepted synthetic search and no extra requests', () => {
  const summary = serverSummaryFixture();
  assert.equal(validateG01QuerySubjectsOfflineServerSummary(summary, SOURCE_SHA, BUNDLE_SHA), true);
  assert.equal(
    validateG01QuerySubjectsOfflineServerSummary(
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
    validateG01QuerySubjectsOfflineServerSummary(
      {
        ...summary,
        results: [
          {
            ...summary.results[0],
            resultSummary: { ...summary.results[0].resultSummary, returnedItems: 2 },
          },
        ],
      },
      SOURCE_SHA,
      BUNDLE_SHA,
    ),
    false,
  );
});

test('G01 query-subjects failure classification emits fixed safe codes', () => {
  const base = {
    execution: { failed: false, spawnErrorCode: null, rawStderr: 'PRIVATE OUTPUT' },
    parsed: { parsed: true },
    events: {
      eventStreamComplete: true,
      turnCompleted: true,
      codexErrorItemCount: 0,
      nonMcpToolEventCount: 0,
      shellToolCallCount: 0,
      mcpServerNames: [G01_QUERY_SUBJECTS_OFFLINE_SERVER_ID],
      codexMcpToolEventCount: 1,
      completedMcpCalls: [
        { tool: PROFILE.toolName, arguments: G01_QUERY_SUBJECTS_OFFLINE_EXPECTED_ARGUMENTS },
      ],
      answer: G01_QUERY_SUBJECTS_OFFLINE_ACKNOWLEDGEMENT,
    },
    exactCall: true,
    exactToolEvent: true,
    serverSummary: {},
    serverSummaryValid: true,
    candidateBundleCurrent: true,
  };
  assert.equal(classifyG01QuerySubjectsOfflineFailure(base), 'AGENT_MCP_ASSERTION_FAILED');
  assert.equal(
    classifyG01QuerySubjectsOfflineFailure({
      ...base,
      events: { ...base.events, nonMcpToolEventCount: 1 },
    }),
    'NON_MCP_TOOL_EVENT',
  );
  assert.equal(
    classifyG01QuerySubjectsOfflineFailure({ ...base, exactCall: false }),
    'MCP_CALL_ARGUMENT_MISMATCH',
  );
  assert.equal(
    JSON.stringify(classifyG01QuerySubjectsOfflineFailure(base)).includes('PRIVATE OUTPUT'),
    false,
  );
});

test('v2 only accepts bounded explicit disabled-web-search errors', () => {
  const validEvents = {
    eventStreamComplete: true,
    turnCompleted: true,
    codexErrorItemCount: 3,
    blockedWebSearchErrorItemCount: 3,
    unexpectedCodexErrorItemCount: 0,
    nonMcpToolEventCount: 0,
    shellToolCallCount: 0,
    mcpServerNames: [G01_QUERY_SUBJECTS_OFFLINE_V2_SERVER_ID],
    codexMcpToolEventCount: 1,
    completedMcpCalls: [
      { tool: PROFILE_V2.toolName, arguments: G01_QUERY_SUBJECTS_OFFLINE_V2_EXPECTED_ARGUMENTS },
    ],
    answer: G01_QUERY_SUBJECTS_OFFLINE_V2_ACKNOWLEDGEMENT,
  };
  const base = {
    execution: { failed: false, spawnErrorCode: null },
    parsed: { parsed: true },
    events: validEvents,
    exactCall: true,
    exactToolEvent: true,
    serverSummary: {},
    serverSummaryValid: true,
    candidateBundleCurrent: true,
    profileId: G01_QUERY_SUBJECTS_OFFLINE_V2_PROFILE_ID,
  };
  assert.equal(classifyG01QuerySubjectsOfflineFailure(base), 'AGENT_MCP_ASSERTION_FAILED');
  assert.equal(
    classifyG01QuerySubjectsOfflineFailure({
      ...base,
      events: { ...validEvents, codexErrorItemCount: 4, blockedWebSearchErrorItemCount: 4 },
    }),
    'CODEX_ERROR_EVENT',
  );
  assert.equal(
    classifyG01QuerySubjectsOfflineFailure({
      ...base,
      events: { ...validEvents, unexpectedCodexErrorItemCount: 1 },
    }),
    'CODEX_ERROR_EVENT',
  );
  assert.equal(
    classifyG01QuerySubjectsOfflineFailure({
      ...base,
      events: { ...validEvents, blockedWebSearchErrorItemCount: 2 },
    }),
    'CODEX_ERROR_EVENT',
  );
});

test('G01 query-subjects claim ownership rejects another runner key', () => {
  const status = {
    state: 'CLAIMED',
    disposition: { claimId: 'owned-claim', runnerReceiptPublicKey: 'owner-key' },
  };
  assert.equal(
    g01QuerySubjectsClaimBelongsToRunner(status, {
      claimId: 'owned-claim',
      runnerReceiptPublicKey: 'owner-key',
    }),
    true,
  );
  assert.equal(
    g01QuerySubjectsClaimBelongsToRunner(status, {
      claimId: 'owned-claim',
      runnerReceiptPublicKey: 'other-key',
    }),
    false,
  );
});
