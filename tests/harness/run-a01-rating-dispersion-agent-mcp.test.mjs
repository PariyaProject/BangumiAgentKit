import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertA01RatingDispersionCandidateReviewGate,
  buildA01RatingDispersionCodexExecArgs,
  validateA01RatingDispersionRunnerArgs,
} from '../../scripts/acceptance/run-a01-rating-dispersion-agent-mcp.mjs';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { A01_RATING_DISPERSION_PROFILE_ID } from '../../scripts/lib/a01-rating-dispersion-profile.mjs';

const CHECKS = [
  'harness-control',
  'sqlite-default',
  'host-integration',
  'standalone-release-smoke',
  'postgres-compat',
  'provider-foundation',
  'discovery-foundation',
];

function gateFixture() {
  const candidateSha = 'a'.repeat(40);
  const currentBaseSha = 'b'.repeat(40);
  const reviewerId = 'gpt-6-luna-max-run95-pr210-round1';
  const status = {
    git: { status: '', head: candidateSha, branch: 'codex/epoch-run95-a01-rating-dispersion' },
    run: {
      state: {
        state: 'EPOCH_ACTIVE',
        profile: 'AUTONOMOUS_EVOLUTION',
        active_epoch_pr: 210,
        pending_epoch: null,
      },
    },
    epoch: {
      number: 210,
      github_state: 'OPEN',
      state: {
        epoch_id: 'run95-a01-rating-dispersion-agent-mcp-1998-spring',
        pr_number: 210,
        branch: 'codex/epoch-run95-a01-rating-dispersion',
        base_branch: 'master',
        base_sha: currentBaseSha,
        reviewed_base_sha: currentBaseSha,
        candidate_sha: candidateSha,
        review_pass_sha: candidateSha,
        ci: { sha: candidateSha, status: 'SUCCESS' },
        state: 'REVIEW_PASSED',
        advances_frontier_ids: ['A01'],
        scope_closure: { related_work_remaining: false },
        adversarial_preflight: { completed: true },
        review_history: [
          {
            reviewer_id: reviewerId,
            candidate_sha: candidateSha,
            reviewed_base_sha: currentBaseSha,
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
    baseRefOid: currentBaseSha,
    headRefName: status.git.branch,
    headRefOid: candidateSha,
    mergeStateStatus: 'CLEAN',
    statusCheckRollup: CHECKS.map((name) => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' })),
  };
  return { candidateSha, currentBaseSha, reviewerId, status, pr };
}

test('A01 runner accepts only a clean exact Candidate with current seven-check CI and same-identity PASS', () => {
  const fixture = gateFixture();
  const options = {
    sourceRevision: fixture.candidateSha,
    currentBaseSha: fixture.currentBaseSha,
    gitTextFn: (...args) => (args[0] === 'status' ? '' : fixture.candidateSha),
  };
  assert.deepEqual(
    assertA01RatingDispersionCandidateReviewGate(fixture.status, fixture.pr, options),
    {
      candidateSha: fixture.candidateSha,
      baseSha: fixture.currentBaseSha,
      prNumber: 210,
      reviewerId: fixture.reviewerId,
    },
  );

  const changedBase = structuredClone(fixture.status);
  changedBase.epoch.state.base_sha = 'c'.repeat(40);
  assert.throws(
    () => assertA01RatingDispersionCandidateReviewGate(changedBase, fixture.pr, options),
    /exact Candidate, current Base/u,
  );
  const wrongReviewer = structuredClone(fixture.status);
  wrongReviewer.epoch.state.review_history[0].reviewer_id = 'gpt-6-sol-run95-pr210-round1';
  assert.throws(
    () => assertA01RatingDispersionCandidateReviewGate(wrongReviewer, fixture.pr, options),
    /same-identity Luna Max PASS/u,
  );
});

test('A01 Codex invocation exposes one tool and disables shell, browser, web, and multi-agent', () => {
  const profile = getAgentMcpProfileById(A01_RATING_DISPERSION_PROFILE_ID);
  const args = buildA01RatingDispersionCodexExecArgs({
    nodePath: '/usr/bin/node',
    summaryPath: '/tmp/a01-summary.json',
    sourceRevision: 'a'.repeat(40),
    bundleSha256: 'b'.repeat(64),
  });
  const config = args.filter((argument, index) => args[index - 1] === '--config');
  const serialized = args.join('\n');
  assert.equal(profile.calls.length, 1);
  assert.equal(profile.calls[0].toolName, 'bangumi.compare_subject_cohorts');
  assert.equal(serialized.includes('features.shell_tool=false'), true);
  assert.equal(serialized.includes('features.browser_use=false'), true);
  assert.equal(serialized.includes('features.web_search=false'), true);
  assert.equal(serialized.includes('features.multi_agent=false'), true);
  assert.equal(serialized.includes('enabled_tools=["bangumi.compare_subject_cohorts"]'), true);
  assert.equal(
    config.some((entry) => entry.includes('https://')),
    false,
  );
});

test('A01 runner arguments reject modes other than one run or help', () => {
  assert.equal(validateA01RatingDispersionRunnerArgs([]), 'run');
  assert.equal(validateA01RatingDispersionRunnerArgs(['--help']), 'help');
  assert.throws(() => validateA01RatingDispersionRunnerArgs(['--retry']), /Usage:/u);
});
