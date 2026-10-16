import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertC04CandidateReviewGate,
  buildC04CodexExecArgs,
  buildC04Prompt,
  classifyC04AssertionFailure,
  runC04CodexCalls,
  validateC04RunnerArgs,
} from '../../scripts/acceptance/run-c04-cohort-comparison-agent-mcp.mjs';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  C04_COHORT_COMPARISON_PROFILE_ID,
  C04_COHORT_COMPARISON_SERVER_ID,
} from '../../scripts/lib/c04-cohort-comparison-public-profile.mjs';

const PROFILE = getAgentMcpProfileById(C04_COHORT_COMPARISON_PROFILE_ID);
const CANDIDATE = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
const CI_RUN = '38849999999';
const SERVER_ID = C04_COHORT_COMPARISON_SERVER_ID;
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
  const branch = 'codex/epoch-run95-c04-cohort-comparison-agent-mcp-matrix-20261016';
  const reviewerId = 'gpt-6-luna-max-run95-pr191-round1';
  const status = {
    git: { status: '', head: CANDIDATE, branch },
    run: {
      state: {
        state: 'EPOCH_ACTIVE',
        profile: 'AUTONOMOUS_EVOLUTION',
        active_epoch_pr: 191,
        pending_epoch: null,
      },
    },
    epoch: {
      number: 191,
      github_state: 'OPEN',
      state: {
        epoch_id: PROFILE.epochId,
        pr_number: 191,
        branch,
        base_branch: 'master',
        base_sha: BASE,
        reviewed_base_sha: BASE,
        candidate_sha: CANDIDATE,
        review_pass_sha: CANDIDATE,
        ci: {
          sha: CANDIDATE,
          status: 'SUCCESS',
          url: `https://github.com/PariyaProject/BangumiAgentKit/actions/runs/${CI_RUN}`,
        },
        state: 'REVIEW_PASSED',
        advances_frontier_ids: ['A01'],
        scope_closure: { related_work_remaining: false },
        adversarial_preflight: { completed: true },
        review_history: [
          {
            reviewer_id: reviewerId,
            candidate_sha: CANDIDATE,
            reviewed_base_sha: BASE,
            verdict: 'PASS',
          },
        ],
      },
    },
  };
  const statusCheckRollup = REQUIRED_CHECKS.map((name, index) => ({
    name,
    status: 'COMPLETED',
    conclusion: 'SUCCESS',
    detailsUrl: `https://github.com/PariyaProject/BangumiAgentKit/actions/runs/${CI_RUN}/job/${index + 1}`,
  }));
  const pr = {
    state: 'OPEN',
    isDraft: false,
    baseRefName: 'master',
    headRefName: branch,
    headRefOid: CANDIDATE,
    statusCheckRollup,
  };
  const readGit = (...args) =>
    args[0] === 'status' ? '' : args[0] === 'rev-parse' && args[1] === 'HEAD' ? CANDIDATE : '';
  return { status, pr, readGit, reviewerId, branch };
}

test('runner accepts only the explicit Run95 command after Harness gates', () => {
  assert.equal(validateC04RunnerArgs(['--help']), 'help');
  assert.equal(validateC04RunnerArgs(['--run', '95']), 'run');
  assert.throws(() => validateC04RunnerArgs(['--run', '94']), /exact Candidate\/Base\/CI/u);
  assert.throws(() => validateC04RunnerArgs([]), /exact Candidate\/Base\/CI/u);
});

test('each Codex run exposes only its one exact profile tool with shell and web disabled', () => {
  for (const [callIndex, call] of PROFILE.calls.entries()) {
    const args = buildC04CodexExecArgs({
      callIndex,
      nodePath: '/usr/bin/node',
      summaryPath: `/tmp/c04-summary-${callIndex}.json`,
      sourceRevision: CANDIDATE,
      bundleSha256: 'c'.repeat(64),
    });
    assert.ok(args.includes('--ignore-user-config'));
    assert.ok(args.includes('--strict-config'));
    assert.ok(args.includes('--sandbox'));
    assert.ok(args.includes('read-only'));
    const configValues = [];
    for (let index = 0; index < args.length - 1; index += 1) {
      if (args[index] === '--config') configValues.push(args[index + 1]);
    }
    assert.ok(configValues.includes('features.shell_tool=false'));
    assert.ok(configValues.includes('web_search="disabled"'));
    assert.ok(configValues.includes(
      `mcp_servers.${SERVER_ID}.enabled_tools=[${JSON.stringify(call.toolName)}]`,
    ));
    const serverArgsValue = configValues.find((item) => item.startsWith(`mcp_servers.${SERVER_ID}.args=`));
    assert.ok(serverArgsValue);
    assert.match(serverArgsValue, /--profile-id/u);
    assert.ok(serverArgsValue.includes(`--profile-call-index", "${callIndex}"`));
    assert.doesNotMatch(serverArgsValue, /--tool|--arguments-json/u);
    assert.match(buildC04Prompt(callIndex), new RegExp(call.toolName.replaceAll('.', '\\.'), 'u'));
    assert.ok(buildC04Prompt(callIndex).includes(JSON.stringify(call.arguments)));
  }
});

test('Candidate review gate binds Run95, A01 Epoch, exact Base, Candidate, seven CI checks, and Luna Max PASS', () => {
  const fixture = candidateGateFixture();
  const gate = assertC04CandidateReviewGate(fixture.status, fixture.pr, {
    sourceRevision: CANDIDATE,
    currentBaseSha: BASE,
    readGit: fixture.readGit,
  });
  assert.deepEqual(
    {
      candidateSha: gate.candidateSha,
      baseSha: gate.baseSha,
      prNumber: gate.prNumber,
      reviewerId: gate.reviewerId,
      ciRunId: gate.ciRunId,
    },
    {
      candidateSha: CANDIDATE,
      baseSha: BASE,
      prNumber: 191,
      reviewerId: fixture.reviewerId,
      ciRunId: CI_RUN,
    },
  );
  const wrongBase = structuredClone(fixture.status);
  wrongBase.epoch.state.reviewed_base_sha = 'd'.repeat(40);
  assert.throws(
    () =>
      assertC04CandidateReviewGate(wrongBase, fixture.pr, {
        sourceRevision: CANDIDATE,
        currentBaseSha: BASE,
        readGit: fixture.readGit,
      }),
    /exact Candidate/u,
  );
  const failedCheck = structuredClone(fixture.pr);
  failedCheck.statusCheckRollup[0].conclusion = 'FAILURE';
  assert.throws(
    () =>
      assertC04CandidateReviewGate(fixture.status, failedCheck, {
        sourceRevision: CANDIDATE,
        currentBaseSha: BASE,
        readGit: fixture.readGit,
      }),
    /exact Candidate/u,
  );
});

test('failure classifier gives Codex errors a terminal safe code before tool-count mismatch', () => {
  assert.equal(
    classifyC04AssertionFailure({
      execution: { failed: false },
      parsed: { parsed: true },
      events: {
        eventStreamComplete: true,
        turnCompleted: true,
        codexErrorItemCount: 3,
        nonMcpToolEventCount: 0,
        shellToolCallCount: 0,
        codexMcpToolEventCount: 0,
        completedMcpCalls: [],
        mcpServerNames: [],
      },
    }),
    'CODEX_ERROR_EVENT',
  );
});

test('C04 stops after the first failed one-tool run and only then starts the second run', () => {
  const attempted = [];
  const failed = runC04CodexCalls((callIndex) => {
    attempted.push(callIndex);
    return { passed: callIndex === 1 };
  });
  assert.equal(failed.passed, false);
  assert.equal(failed.failedCallIndex, 0);
  assert.deepEqual(attempted, [0]);

  attempted.length = 0;
  const passed = runC04CodexCalls((callIndex) => {
    attempted.push(callIndex);
    return { passed: true, callIndex };
  });
  assert.equal(passed.passed, true);
  assert.deepEqual(attempted, [0, 1]);
  assert.deepEqual(passed.results.map((result) => result.callIndex), [0, 1]);
});
