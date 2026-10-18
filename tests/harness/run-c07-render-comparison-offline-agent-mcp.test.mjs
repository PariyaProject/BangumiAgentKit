import assert from 'node:assert/strict';
import test from 'node:test';
import {
  agentMcpProfileArgumentsSha256,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  C07_RENDER_COMPARISON_OFFLINE_NETWORK_MODE,
  C07_RENDER_COMPARISON_OFFLINE_V2_PROFILE_ID,
} from '../../scripts/lib/c07-render-comparison-offline-profile.mjs';
import {
  assertC07RenderComparisonCandidateReviewGate,
  buildC07RenderComparisonOfflineCodexExecArgs,
  validateC07RenderComparisonOfflineRunnerArgs,
  validateC07RenderComparisonOfflineServerSummary,
} from '../../scripts/acceptance/run-c07-render-comparison-offline-agent-mcp.mjs';

const PROFILE = getAgentMcpProfileById('c07-render-comparison-offline-agent-mcp-matrix-v1');
const SOURCE_SHA = 'a'.repeat(40);
const BASE_SHA = 'b'.repeat(40);
const BUNDLE_SHA = 'c'.repeat(64);
const CI_RUN_ID = '38806371672';
const PR_NUMBER = 222;
const BRANCH = 'codex/epoch-run95-c07-render-cohort-comparison-offline-agent-mcp-20261017';
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
        advances_frontier_ids: ['C07'],
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
    networkMode: C07_RENDER_COMPARISON_OFFLINE_NETWORK_MODE,
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
        resultSummary: { resultState: 'artifact_returned' },
      },
    ],
    offlineFixture: {
      profile: C07_RENDER_COMPARISON_OFFLINE_NETWORK_MODE,
      requestCount: 2,
      searchRequestCount: 1,
      subjectDetailRequestCount: 1,
      duplicateRequestCount: 0,
      unexpectedRequestCount: 0,
      authorizationHeaderCount: 0,
      expectedOperationsComplete: true,
      rawFixturePayloadStored: false,
    },
    offlineAssetBoundary: {
      assetResolutionCallCount: 0,
      nonEmptyAssetUrlCount: 0,
      blockedAssetRequestCount: 0,
    },
  };
}

test('C07 runner accepts only its single governed Run #95 entry point', () => {
  assert.equal(validateC07RenderComparisonOfflineRunnerArgs(['--help']), 'help');
  assert.equal(validateC07RenderComparisonOfflineRunnerArgs(['--run', '95']), 'run');
  assert.equal(
    validateC07RenderComparisonOfflineRunnerArgs([
      '--run',
      '95',
      '--profile-id',
      C07_RENDER_COMPARISON_OFFLINE_V2_PROFILE_ID,
    ]),
    'run',
  );
  for (const args of [[], ['--run', '94'], ['--run', '95', '--retry'], ['--help', '--run']]) {
    assert.throws(() => validateC07RenderComparisonOfflineRunnerArgs(args));
  }
});

test('C07 Candidate gate requires exact CI, Base, and same-identity Luna Max PASS', () => {
  const gate = assertC07RenderComparisonCandidateReviewGate(statusFixture(), pullRequestFixture(), {
    sourceRevision: SOURCE_SHA,
    currentBaseSha: BASE_SHA,
    readGit: readGitFixture,
  });
  assert.deepEqual(gate, {
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

  const missingCheck = pullRequestFixture();
  missingCheck.statusCheckRollup.pop();
  assert.throws(() =>
    assertC07RenderComparisonCandidateReviewGate(statusFixture(), missingCheck, {
      sourceRevision: SOURCE_SHA,
      currentBaseSha: BASE_SHA,
      readGit: readGitFixture,
    }),
  );

  const missingCheckRun = pullRequestFixture();
  missingCheckRun.statusCheckRollup[0].detailsUrl = null;
  assert.throws(() =>
    assertC07RenderComparisonCandidateReviewGate(statusFixture(), missingCheckRun, {
      sourceRevision: SOURCE_SHA,
      currentBaseSha: BASE_SHA,
      readGit: readGitFixture,
    }),
  );

  const mismatchedCheckRun = pullRequestFixture();
  mismatchedCheckRun.statusCheckRollup[0].detailsUrl =
    'https://github.com/PariyaProject/BangumiAgentKit/actions/runs/99999999999/job/1';
  assert.throws(() =>
    assertC07RenderComparisonCandidateReviewGate(statusFixture(), mismatchedCheckRun, {
      sourceRevision: SOURCE_SHA,
      currentBaseSha: BASE_SHA,
      readGit: readGitFixture,
    }),
  );

  const wrongReviewer = statusFixture();
  wrongReviewer.epoch.state.review_history[0].reviewer_id = 'gpt-6-sol-run95-reviewer';
  assert.throws(() =>
    assertC07RenderComparisonCandidateReviewGate(wrongReviewer, pullRequestFixture(), {
      sourceRevision: SOURCE_SHA,
      currentBaseSha: BASE_SHA,
      readGit: readGitFixture,
    }),
  );

  assert.throws(() =>
    assertC07RenderComparisonCandidateReviewGate(statusFixture(), pullRequestFixture(), {
      sourceRevision: SOURCE_SHA,
      currentBaseSha: BASE_SHA,
      readGit: (...args) => (args[0] === 'status' ? ' M dirty-file' : SOURCE_SHA),
    }),
  );
});

test('C07 Codex invocation is ephemeral, read-only, and exposes only the fixed offline tool', () => {
  const args = buildC07RenderComparisonOfflineCodexExecArgs({
    nodePath: '/usr/bin/node',
    summaryPath: '/tmp/c07-render-comparison-summary.json',
    sourceRevision: SOURCE_SHA,
    bundleSha256: BUNDLE_SHA,
  });
  assert.equal(args[0], 'exec');
  assert.ok(args.includes('--approve-for-me'));
  assert.ok(args.includes('--ignore-user-config'));
  assert.ok(args.includes('--strict-config'));
  assert.ok(args.includes('--ephemeral'));
  assert.ok(args.includes('--sandbox'));
  assert.ok(args.includes('read-only'));
  assert.ok(args.includes('--model'));
  assert.ok(args.includes('gpt-6-luna'));
  for (const config of [
    'features.apps=false',
    'features.browser_use=false',
    'features.computer_use=false',
    'features.multi_agent=false',
    'features.shell_tool=false',
    'features.web_search=false',
    'features.web_search_request=false',
    'features.remote_plugin=false',
    'mcp_servers.bgk_c07_render_comparison.enabled_tools=["bangumi.render_subject_cohort_comparison"]',
  ]) {
    assert.ok(args.includes(config), config);
  }
  assert.equal(
    args.some((argument) => argument.includes('network_mode=')),
    false,
  );
  assert.match(
    args.at(-1),
    /Call its sole tool bangumi\.render_subject_cohort_comparison exactly once/u,
  );
});

test('C07 server summary requires exactly two local reads and zero renderer asset work', () => {
  const summary = serverSummaryFixture();
  assert.equal(
    validateC07RenderComparisonOfflineServerSummary(summary, SOURCE_SHA, BUNDLE_SHA),
    true,
  );

  const extraRequest = structuredClone(summary);
  extraRequest.offlineFixture.requestCount = 4;
  assert.equal(
    validateC07RenderComparisonOfflineServerSummary(extraRequest, SOURCE_SHA, BUNDLE_SHA),
    false,
  );

  const assetResolution = structuredClone(summary);
  assetResolution.offlineAssetBoundary.blockedAssetRequestCount = 1;
  assert.equal(
    validateC07RenderComparisonOfflineServerSummary(assetResolution, SOURCE_SHA, BUNDLE_SHA),
    false,
  );

  const missingArtifact = structuredClone(summary);
  missingArtifact.results[0].resultSummary.resultState = 'artifact_missing';
  assert.equal(
    validateC07RenderComparisonOfflineServerSummary(missingArtifact, SOURCE_SHA, BUNDLE_SHA),
    false,
  );
});
