import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assertD04CandidateReviewGate,
  assertSafeD04ClaimPath,
  buildCodexExecArgs,
  canonicalD04ClaimPath,
  createD04OneShotClaim,
  mandatoryChecksSuccessful,
  validateRunnerArgs,
} from '../../scripts/acceptance/run-d04-codex-agent-mcp.mjs';
import { D04_DISCOVERY_ARGUMENTS } from '../../scripts/acceptance/d04-discovery-answer-check.mjs';

const BASE = 'a'.repeat(40);
const CANDIDATE = 'b'.repeat(40);
const BUNDLE = 'c'.repeat(64);

function mandatoryChecks() {
  return [
    'harness-control',
    'sqlite-default',
    'host-integration',
    'standalone-release-smoke',
    'postgres-compat',
    'provider-foundation',
    'discovery-foundation',
  ].map((name) => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' }));
}

function gateFixture() {
  const reviewerId = 'run95-pr113-review1-gpt-6-luna-max';
  const epoch = {
    pr_number: 113,
    branch: 'codex/epoch-d04-reported-episodes-short-anime-discovery',
    base_branch: 'master',
    base_sha: BASE,
    candidate_sha: CANDIDATE,
    reviewed_base_sha: BASE,
    review_pass_sha: CANDIDATE,
    ci: { sha: CANDIDATE, status: 'SUCCESS' },
    state: 'REVIEW_PASSED',
    advances_frontier_ids: ['D04'],
    review_history: [
      {
        candidate_sha: CANDIDATE,
        reviewed_base_sha: BASE,
        reviewer_id: reviewerId,
        verdict: 'PASS',
      },
    ],
    scope_closure: {
      related_work_remaining: false,
      why_not_review_earlier: 'The first coherent implementation is now ready.',
      why_not_extend_further: 'Remaining account and client surfaces stay outside D04.',
    },
    adversarial_preflight: {
      completed: true,
      summary: 'Bounds, query filters, and unresolved eps were challenged.',
    },
  };
  const status = {
    git: { status: '', head: CANDIDATE, branch: epoch.branch },
    run: {
      state: {
        state: 'EPOCH_ACTIVE',
        profile: 'AUTONOMOUS_EVOLUTION',
        active_epoch_pr: 113,
        pending_epoch: null,
      },
    },
    epoch: { number: 113, github_state: 'OPEN', state: epoch },
  };
  const pr = {
    state: 'OPEN',
    isDraft: false,
    headRefOid: CANDIDATE,
    headRefName: epoch.branch,
    baseRefName: 'master',
    baseRefOid: BASE,
    statusCheckRollup: mandatoryChecks(),
  };
  return { status, pr };
}

function createGitRepo(root) {
  const result = spawnSync('git', ['init', root], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

test('D04 Codex profile pins Luna Max, one MCP tool, and disables unrelated tools', () => {
  assert.equal(validateRunnerArgs(['--run', '95']), 'run');
  assert.equal(validateRunnerArgs(['--help']), 'help');
  assert.throws(() => validateRunnerArgs(['--run', '96']));

  const args = buildCodexExecArgs({
    root: '/tmp/d04-candidate',
    nodePath: '/usr/bin/node',
    summaryPath: '/tmp/d04-summary.json',
    sourceRevision: CANDIDATE,
    bundleSha256: BUNDLE,
  });
  assert.equal(args[0], 'exec');
  assert.equal(args[args.indexOf('--model') + 1], 'gpt-6-luna');
  assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only');
  assert.ok(args.includes('features.shell_tool=false'));
  assert.ok(args.includes('features.web_search=false'));
  assert.ok(args.includes('mcp_servers.bgk_d04_one_tool.enabled_tools=["bangumi.query_subjects"]'));
  assert.ok(args.at(-1).includes(JSON.stringify(D04_DISCOVERY_ARGUMENTS)));
  assert.doesNotMatch(args.join('\n'), /gpt-6-sol|gpt-6-astra|gemini|anthropic/iu);
});

test('D04 query gate binds one exact candidate, current base, CI, scope closure, and Luna Max PASS', () => {
  const { status, pr } = gateFixture();
  assert.deepEqual(
    assertD04CandidateReviewGate(status, pr, {
      sourceRevision: CANDIDATE,
      currentBaseSha: BASE,
    }),
    { prNumber: 113, candidateSha: CANDIDATE, baseSha: BASE },
  );

  const wrongModel = structuredClone(status);
  wrongModel.epoch.state.review_history[0].reviewer_id = 'run95-review-gpt-6-sol';
  assert.throws(() =>
    assertD04CandidateReviewGate(wrongModel, pr, {
      sourceRevision: CANDIDATE,
      currentBaseSha: BASE,
    }),
  );

  const wrongBase = structuredClone(pr);
  wrongBase.baseRefOid = 'd'.repeat(40);
  assert.throws(() =>
    assertD04CandidateReviewGate(status, wrongBase, {
      sourceRevision: CANDIDATE,
      currentBaseSha: BASE,
    }),
  );
});

test('D04 mandatory CI requires each exact named job once with SUCCESS', () => {
  assert.equal(mandatoryChecksSuccessful(mandatoryChecks()), true);
  assert.equal(mandatoryChecksSuccessful(mandatoryChecks().slice(1)), false);
  assert.equal(mandatoryChecksSuccessful([...mandatoryChecks(), mandatoryChecks()[0]]), false);
  assert.equal(
    mandatoryChecksSuccessful(
      mandatoryChecks().map((row) =>
        row.name === 'discovery-foundation' ? { ...row, conclusion: 'FAILURE' } : row,
      ),
    ),
    false,
  );
});

test('D04 claim is canonical, create-once, mode 0600, and bound to candidate/base/runtime', () => {
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'd04-claim-test-'));
  const root = path.join(temporaryRoot, 'repo');
  mkdirSync(root);
  createGitRepo(root);
  try {
    const claimPath = canonicalD04ClaimPath(root);
    assert.equal(assertSafeD04ClaimPath(claimPath, root), claimPath);
    const claim = createD04OneShotClaim(
      claimPath,
      {
        sourceRevision: CANDIDATE,
        bundleSha256: BUNDLE,
        baseSha: BASE,
        prNumber: 113,
      },
      root,
    );
    assert.equal(claim.state, 'CLAIMED');
    assert.equal(claim.runNumber, 95);
    assert.equal(claim.frontierId, 'D04');
    assert.equal(claim.expectedArgumentsSha256.length, 64);
    assert.equal(statSync(claimPath).mode & 0o777, 0o600);
    assert.throws(() =>
      createD04OneShotClaim(
        claimPath,
        {
          sourceRevision: CANDIDATE,
          bundleSha256: BUNDLE,
          baseSha: BASE,
          prNumber: 113,
        },
        root,
      ),
    );
    assert.equal(JSON.parse(readFileSync(claimPath, 'utf8')).state, 'CLAIMED');
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('D04 claim path rejects a symlink through Git metadata into the checkout', () => {
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'd04-claim-link-test-'));
  const root = path.join(temporaryRoot, 'repo');
  const checkoutTarget = path.join(root, 'outside-metadata');
  mkdirSync(root);
  createGitRepo(root);
  try {
    mkdirSync(checkoutTarget);
    symlinkSync(checkoutTarget, path.join(root, '.git', 'pariya-agent-state'));
    const claimPath = canonicalD04ClaimPath(root);
    assert.throws(() => assertSafeD04ClaimPath(claimPath, root));
    assert.throws(() =>
      createD04OneShotClaim(
        claimPath,
        {
          sourceRevision: CANDIDATE,
          bundleSha256: BUNDLE,
          baseSha: BASE,
          prNumber: 113,
        },
        root,
      ),
    );
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
