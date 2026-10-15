import assert from 'node:assert/strict';
import test from 'node:test';
import {
  agentMcpProfileArgumentsSha256,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { P06_RENDER_PERSON_PROFILE_OFFLINE_NETWORK_MODE } from '../../scripts/lib/p06-render-person-profile-offline-fixture.mjs';
import {
  assertCandidateReviewGate,
  buildP06CodexExecArgs,
  validateP06RunnerArgs,
  validateServerSummary,
} from '../../scripts/acceptance/run-p06-render-person-profile-agent-mcp.mjs';

const PROFILE = getAgentMcpProfileById('p06-render-person-profile-offline-agent-mcp-v1');
const SOURCE_SHA = 'a'.repeat(40);
const BASE_SHA = 'b'.repeat(40);
const BUNDLE_SHA = 'c'.repeat(64);
const CI_RUN_ID = '38806371672';
const PR_NUMBER = 222;
const BRANCH = 'codex/epoch-run95-p06-render-person-profile-agent-mcp-offline-20261016';
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
        advances_frontier_ids: ['P06'],
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
    networkMode: P06_RENDER_PERSON_PROFILE_OFFLINE_NETWORK_MODE,
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
      profile: P06_RENDER_PERSON_PROFILE_OFFLINE_NETWORK_MODE,
      requestCount: 3,
      personRequestCount: 1,
      subjectsRequestCount: 1,
      charactersRequestCount: 1,
      duplicateRequestCount: 0,
      unexpectedRequestCount: 0,
      authorizationHeaderCount: 0,
      expectedOperationsComplete: true,
    },
    offlineAssetBoundary: {
      assetResolutionCallCount: 0,
      nonEmptyAssetUrlCount: 0,
      blockedAssetRequestCount: 0,
    },
  };
}

test('P06 runner accepts only its single governed Run #95 entry point', () => {
  assert.equal(validateP06RunnerArgs(['--help']), 'help');
  assert.equal(validateP06RunnerArgs(['--run', '95']), 'run');
  for (const args of [[], ['--run', '94'], ['--run', '95', '--retry'], ['--help', '--run']]) {
    assert.throws(() => validateP06RunnerArgs(args));
  }
});

test('P06 Candidate gate requires exact CI, Base, and same-identity Luna Max PASS', () => {
  const gate = assertCandidateReviewGate(statusFixture(), pullRequestFixture(), {
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
    assertCandidateReviewGate(statusFixture(), missingCheck, {
      sourceRevision: SOURCE_SHA,
      currentBaseSha: BASE_SHA,
      readGit: readGitFixture,
    }),
  );

  const missingCheckRun = pullRequestFixture();
  missingCheckRun.statusCheckRollup[0].detailsUrl = null;
  assert.throws(() =>
    assertCandidateReviewGate(statusFixture(), missingCheckRun, {
      sourceRevision: SOURCE_SHA,
      currentBaseSha: BASE_SHA,
      readGit: readGitFixture,
    }),
  );

  const mismatchedCheckRun = pullRequestFixture();
  mismatchedCheckRun.statusCheckRollup[0].detailsUrl =
    'https://github.com/PariyaProject/BangumiAgentKit/actions/runs/99999999999/job/1';
  assert.throws(() =>
    assertCandidateReviewGate(statusFixture(), mismatchedCheckRun, {
      sourceRevision: SOURCE_SHA,
      currentBaseSha: BASE_SHA,
      readGit: readGitFixture,
    }),
  );

  const wrongReviewer = statusFixture();
  wrongReviewer.epoch.state.review_history[0].reviewer_id = 'gpt-6-sol-run95-reviewer';
  assert.throws(() =>
    assertCandidateReviewGate(wrongReviewer, pullRequestFixture(), {
      sourceRevision: SOURCE_SHA,
      currentBaseSha: BASE_SHA,
      readGit: readGitFixture,
    }),
  );

  assert.throws(() =>
    assertCandidateReviewGate(statusFixture(), pullRequestFixture(), {
      sourceRevision: SOURCE_SHA,
      currentBaseSha: BASE_SHA,
      readGit: (...args) => (args[0] === 'status' ? ' M dirty-file' : SOURCE_SHA),
    }),
  );
});

test('P06 Codex invocation is ephemeral, read-only, and exposes only the fixed offline tool', () => {
  const args = buildP06CodexExecArgs({
    nodePath: '/usr/bin/node',
    summaryPath: '/tmp/p06-summary.json',
    sourceRevision: SOURCE_SHA,
    bundleSha256: BUNDLE_SHA,
  });
  assert.equal(args[0], 'exec');
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
    'mcp_servers.bgk_p06_profile.enabled_tools=["bangumi.render_person_profile"]',
  ]) {
    assert.ok(args.includes(config), config);
  }
  assert.equal(
    args.some((argument) => argument.includes('network_mode=')),
    false,
  );
  assert.match(args.at(-1), /Call its sole tool bangumi\.render_person_profile exactly once/u);
});

test('P06 server summary requires exactly three local reads and zero renderer asset work', () => {
  const summary = serverSummaryFixture();
  assert.equal(validateServerSummary(summary, SOURCE_SHA, BUNDLE_SHA), true);

  const extraRequest = structuredClone(summary);
  extraRequest.offlineFixture.requestCount = 4;
  assert.equal(validateServerSummary(extraRequest, SOURCE_SHA, BUNDLE_SHA), false);

  const assetResolution = structuredClone(summary);
  assetResolution.offlineAssetBoundary.blockedAssetRequestCount = 1;
  assert.equal(validateServerSummary(assetResolution, SOURCE_SHA, BUNDLE_SHA), false);

  const missingArtifact = structuredClone(summary);
  missingArtifact.results[0].resultSummary.resultState = 'artifact_missing';
  assert.equal(validateServerSummary(missingArtifact, SOURCE_SHA, BUNDLE_SHA), false);
});
