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
  assertR03CandidateReviewGate,
  buildR03CodexExecArgs,
  classifyR03AssertionFailure,
  recoverR03RunnerFailure,
  sameR03CandidateReviewGate,
  validateR03RunnerArgs,
  validateR03ServerSummary,
} from '../../scripts/acceptance/run-r03-relations-offline-agent-mcp.mjs';

const PROFILE = getAgentMcpProfileById(R03_RELATIONS_OFFLINE_PROFILE_ID);
const SOURCE_SHA = 'a'.repeat(40);
const BUNDLE_SHA = 'b'.repeat(64);
const SERVER_ID = 'bgk_r03_relations_v2';
const CANDIDATE_SHA = 'c'.repeat(40);
const BASE_SHA = 'd'.repeat(40);
const CI_RUN_ID = '38820001234';
const REQUIRED_CHECKS = [
  'harness-control',
  'sqlite-default',
  'host-integration',
  'standalone-release-smoke',
  'postgres-compat',
  'provider-foundation',
  'discovery-foundation',
];

function candidateGateFixture() {
  const branch = 'codex/epoch-run95-r03-direct-relations-offline-agent-mcp-matrix-v2-20261017';
  const reviewerId = 'gpt-6-luna-max-run95-pr222-round1';
  const status = {
    git: { status: '', head: CANDIDATE_SHA, branch },
    run: {
      state: {
        state: 'EPOCH_ACTIVE',
        profile: 'AUTONOMOUS_EVOLUTION',
        active_epoch_pr: 222,
        pending_epoch: null,
      },
    },
    epoch: {
      number: 222,
      github_state: 'OPEN',
      state: {
        epoch_id: PROFILE.epochId,
        pr_number: 222,
        branch,
        base_branch: 'master',
        base_sha: BASE_SHA,
        reviewed_base_sha: BASE_SHA,
        candidate_sha: CANDIDATE_SHA,
        review_pass_sha: CANDIDATE_SHA,
        ci: {
          sha: CANDIDATE_SHA,
          status: 'SUCCESS',
          url: `https://github.com/PariyaProject/BangumiAgentKit/actions/runs/${CI_RUN_ID}`,
        },
        state: 'REVIEW_PASSED',
        advances_frontier_ids: ['R03'],
        scope_closure: { related_work_remaining: false },
        adversarial_preflight: { completed: true },
        review_history: [
          {
            reviewer_id: reviewerId,
            candidate_sha: CANDIDATE_SHA,
            reviewed_base_sha: BASE_SHA,
            verdict: 'PASS',
          },
        ],
      },
    },
  };
  const pr = {
    state: 'OPEN',
    isDraft: false,
    baseRefName: 'master',
    headRefName: branch,
    headRefOid: CANDIDATE_SHA,
    statusCheckRollup: REQUIRED_CHECKS.map((name, index) => ({
      name,
      status: 'COMPLETED',
      conclusion: 'SUCCESS',
      detailsUrl: `https://github.com/PariyaProject/BangumiAgentKit/actions/runs/${CI_RUN_ID}/job/${index + 1}`,
    })),
  };
  const readGit = (...args) =>
    args[0] === 'status' ? '' : args[0] === 'rev-parse' && args[1] === 'HEAD' ? CANDIDATE_SHA : '';
  return { status, pr, readGit, reviewerId };
}

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
    expectedCallCount: 1,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
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
      requestCount: 1,
      relationRequestCount: 1,
      rootRequestCount: 1,
      intermediateRequestCount: 0,
      duplicateRequestCount: 0,
      unexpectedRequestCount: 0,
      authorizationHeaderCount: 0,
      expectedOperationsComplete: true,
    },
  };
}

test('R03 review gate binds the current Candidate, Base, seven checks, and Luna Max PASS', () => {
  const fixture = candidateGateFixture();
  const gate = assertR03CandidateReviewGate(fixture.status, fixture.pr, {
    sourceRevision: CANDIDATE_SHA,
    currentBaseSha: BASE_SHA,
    readGit: fixture.readGit,
  });
  assert.deepEqual(gate, {
    candidateSha: CANDIDATE_SHA,
    baseSha: BASE_SHA,
    prNumber: 222,
    reviewerId: fixture.reviewerId,
    ciRunId: CI_RUN_ID,
    ciChecks: REQUIRED_CHECKS.map((name) => ({
      name,
      status: 'COMPLETED',
      conclusion: 'SUCCESS',
    })),
  });

  assert.throws(() =>
    assertR03CandidateReviewGate(fixture.status, fixture.pr, {
      sourceRevision: CANDIDATE_SHA,
      currentBaseSha: 'e'.repeat(40),
      readGit: fixture.readGit,
    }),
  );
  const staleCandidate = structuredClone(fixture.status);
  staleCandidate.epoch.state.candidate_sha = 'f'.repeat(40);
  assert.throws(() =>
    assertR03CandidateReviewGate(staleCandidate, fixture.pr, {
      sourceRevision: CANDIDATE_SHA,
      currentBaseSha: BASE_SHA,
      readGit: fixture.readGit,
    }),
  );
  const wrongReview = structuredClone(fixture.status);
  wrongReview.epoch.state.review_history[0].verdict = 'CORRECTIVE_REQUIRED';
  assert.throws(() =>
    assertR03CandidateReviewGate(wrongReview, fixture.pr, {
      sourceRevision: CANDIDATE_SHA,
      currentBaseSha: BASE_SHA,
      readGit: fixture.readGit,
    }),
  );
  const wrongCiRun = structuredClone(fixture.pr);
  wrongCiRun.statusCheckRollup[0].detailsUrl =
    'https://github.com/PariyaProject/BangumiAgentKit/actions/runs/38820001235/job/1';
  assert.throws(() =>
    assertR03CandidateReviewGate(fixture.status, wrongCiRun, {
      sourceRevision: CANDIDATE_SHA,
      currentBaseSha: BASE_SHA,
      readGit: fixture.readGit,
    }),
  );
});

test('R03 pre-invocation gate comparison includes Candidate, Base, review, and exact CI', () => {
  const fixture = candidateGateFixture();
  const gate = assertR03CandidateReviewGate(fixture.status, fixture.pr, {
    sourceRevision: CANDIDATE_SHA,
    currentBaseSha: BASE_SHA,
    readGit: fixture.readGit,
  });
  assert.equal(sameR03CandidateReviewGate(gate, structuredClone(gate)), true);
  for (const [field, value] of [
    ['candidateSha', 'e'.repeat(40)],
    ['baseSha', 'e'.repeat(40)],
    ['prNumber', 223],
    ['reviewerId', 'different-reviewer'],
    ['ciRunId', '38820001235'],
  ]) {
    assert.equal(sameR03CandidateReviewGate(gate, { ...gate, [field]: value }), false);
  }
  assert.equal(
    sameR03CandidateReviewGate(gate, {
      ...gate,
      ciChecks: gate.ciChecks.map((check, index) =>
        index === 0 ? { ...check, conclusion: 'FAILURE' } : check,
      ),
    }),
    false,
  );
});

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
    args.at(-1).includes(JSON.stringify(R03_RELATIONS_OFFLINE_EXPECTED_CALLS[0].arguments)),
    true,
  );
  assert.equal(args.at(-1).includes(R03_RELATIONS_OFFLINE_ACKNOWLEDGEMENT), true);
});

test('R03 server summary accepts exactly one local relation response', () => {
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
      { ...summary, results: [{ ...summary.results[0], sequenceIndex: 1 }] },
      SOURCE_SHA,
      BUNDLE_SHA,
    ),
    false,
  );
  assert.equal(
    validateR03ServerSummary({ ...summary, results: [] }, SOURCE_SHA, BUNDLE_SHA),
    false,
  );
});

test('R03 failure classification enforces one exact MCP call and a clean tool-only turn', () => {
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
        codexMcpToolEventCount: 0,
        completedMcpCalls: base.events.completedMcpCalls.slice(0, 0),
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
      events: { ...base.events, answer: 'wrong' },
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
