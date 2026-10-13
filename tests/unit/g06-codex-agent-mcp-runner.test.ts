import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertG06CandidateReviewGate,
  buildG06CodexExecArgs,
  canonicalG06ClaimPath,
  createG06OneShotClaim,
  G06_RUNNER_CONSTANTS,
  localG06ClaimMatchesHarnessClaim,
  validateG06RunnerArgs,
} from '../../scripts/acceptance/run-g06-codex-agent-mcp.mjs';
import {
  G06_EXPECTED_QUERY_ARGUMENTS,
  G06_TOOL_NAME,
} from '../../scripts/acceptance/g06-subject-cast-answer-check.mjs';
import { createG06RunnerReceiptKeyPair } from '../../scripts/acceptance/g06-runner-receipt.mjs';

const roots: string[] = [];
const candidateSha = 'a'.repeat(40);
const baseSha = 'b'.repeat(40);
const bundleSha256 = 'c'.repeat(64);
const reviewerId = 'gpt-6-luna-max-run95-pr170-round1';
const receiptPublicKey = createG06RunnerReceiptKeyPair().receiptPublicKey;

function temporaryRoot() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'bgk-g06-runner-'));
  roots.push(root);
  return root;
}

function gateFixture() {
  const status = {
    git: {
      status: '',
      head: candidateSha,
      branch: 'codex/epoch-run95-g06-subject-cast-current-source',
    },
    run: {
      state: {
        state: 'EPOCH_ACTIVE',
        profile: 'AUTONOMOUS_EVOLUTION',
        active_epoch_pr: 170,
        pending_epoch: null,
      },
    },
    epoch: {
      number: 170,
      state: {
        state: 'REVIEW_PASSED',
        epoch_id: G06_RUNNER_CONSTANTS.epochId,
        pr_number: 170,
        advances_frontier_ids: ['G06'],
        scope_closure: { related_work_remaining: false },
        adversarial_preflight: { completed: true },
        branch: 'codex/epoch-run95-g06-subject-cast-current-source',
        candidate_sha: candidateSha,
        review_pass_sha: candidateSha,
        base_branch: 'master',
        base_sha: baseSha,
        reviewed_base_sha: baseSha,
        ci: { sha: candidateSha, status: 'SUCCESS' },
        review_history: [
          {
            candidate_sha: candidateSha,
            reviewed_base_sha: baseSha,
            verdict: 'PASS',
            reviewer_id: reviewerId,
          },
        ],
      },
    },
  };
  const statusCheckRollup = [
    'harness-control',
    'sqlite-default',
    'host-integration',
    'standalone-release-smoke',
    'postgres-compat',
    'provider-foundation',
    'discovery-foundation',
  ].map((name) => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' }));
  const pr = {
    state: 'OPEN',
    isDraft: false,
    baseRefName: 'master',
    headRefName: 'codex/epoch-run95-g06-subject-cast-current-source',
    headRefOid: candidateSha,
    statusCheckRollup,
  };
  return { status, pr };
}

function durableClaim() {
  return {
    claimId: 'g06-run-95-pr-170-abcdef123456-1791860000000',
    state: 'CLAIMED',
    runNumber: 95,
    frontierId: 'G06',
    epochId: G06_RUNNER_CONSTANTS.epochId,
    toolName: G06_TOOL_NAME,
    argumentProfile: G06_RUNNER_CONSTANTS.argumentProfile,
    expectedArgumentsSha256: G06_RUNNER_CONSTANTS.argumentSha256,
    sourceCandidateSha: candidateSha,
    baseSha,
    ciSha: candidateSha,
    ciStatus: 'SUCCESS',
    bundleSha256,
    prNumber: 170,
    reviewerId,
    receiptPublicKey,
    model: 'gpt-6-luna',
    reasoningEffort: 'max',
    retryAllowed: false,
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('G06 one-tool Candidate runner', () => {
  it('accepts only the active exact-Candidate/Base, seven-check CI, and Luna Max PASS', () => {
    const { status, pr } = gateFixture();
    expect(
      assertG06CandidateReviewGate(status, pr, {
        sourceRevision: candidateSha,
        currentBaseSha: baseSha,
      }),
    ).toEqual({ prNumber: 170, candidateSha, baseSha, reviewerId });
  });

  it('revalidates the exact claimed disposition after its one permitted query', () => {
    const { status, pr } = gateFixture();
    const preflight = status.epoch.state.adversarial_preflight as Record<string, unknown>;
    preflight.g06_one_shot_disposition = {
      state: 'CLAIMED',
      claimId: 'g06-run-95-pr-170-abcdef123456-1791860000000',
      sourceCandidateSha: candidateSha,
      baseSha,
      retryAllowed: false,
    };
    const gate = {
      sourceRevision: candidateSha,
      currentBaseSha: baseSha,
      allowClaimedDisposition: true,
      expectedClaimId: 'g06-run-95-pr-170-abcdef123456-1791860000000',
    };

    expect(assertG06CandidateReviewGate(status, pr, gate)).toEqual({
      prNumber: 170,
      candidateSha,
      baseSha,
      reviewerId,
    });
    expect(() =>
      assertG06CandidateReviewGate(status, pr, {
        ...gate,
        expectedClaimId: 'g06-run-95-pr-170-deadbeefdead-1791860000000',
      }),
    ).toThrow();
  });

  it('rejects stale Candidate, reviewer, Base, CI, and prior one-shot disposition', () => {
    const { status, pr } = gateFixture();
    expect(() =>
      assertG06CandidateReviewGate(status, pr, {
        sourceRevision: 'd'.repeat(40),
        currentBaseSha: baseSha,
      }),
    ).toThrow();

    const wrongReviewer = structuredClone(status);
    wrongReviewer.epoch.state.review_history[0]!.reviewer_id = 'gpt-6-sol-run95-pr170-round1';
    expect(() =>
      assertG06CandidateReviewGate(wrongReviewer, pr, {
        sourceRevision: candidateSha,
        currentBaseSha: baseSha,
      }),
    ).toThrow();

    const staleBase = structuredClone(status);
    staleBase.epoch.state.base_sha = 'e'.repeat(40);
    expect(() =>
      assertG06CandidateReviewGate(staleBase, pr, {
        sourceRevision: candidateSha,
        currentBaseSha: baseSha,
      }),
    ).toThrow();

    const failedCheck = structuredClone(pr);
    failedCheck.statusCheckRollup[0]!.conclusion = 'FAILURE';
    expect(() =>
      assertG06CandidateReviewGate(status, failedCheck, {
        sourceRevision: candidateSha,
        currentBaseSha: baseSha,
      }),
    ).toThrow();

    const priorClaim = structuredClone(status);
    const priorPreflight = priorClaim.epoch.state.adversarial_preflight as Record<string, unknown>;
    priorPreflight.g06_one_shot_disposition = { state: 'CLAIMED' };
    expect(() =>
      assertG06CandidateReviewGate(priorClaim, pr, {
        sourceRevision: candidateSha,
        currentBaseSha: baseSha,
      }),
    ).toThrow();
  });

  it('builds an ephemeral GPT-6 Luna Max read-only session with only the fixed MCP tool enabled', () => {
    const args = buildG06CodexExecArgs({
      root: '/tmp/g06-root',
      nodePath: '/usr/bin/node',
      serverScript: '/tmp/g06-server.mjs',
      summaryPath: '/tmp/g06-summary.json',
      sourceRevision: candidateSha,
      bundleSha256,
    });

    expect(args.slice(0, 10)).toEqual([
      'exec',
      '--ignore-user-config',
      '--strict-config',
      '--ephemeral',
      '--json',
      '--model',
      'gpt-6-luna',
      '--sandbox',
      'read-only',
      '--cd',
    ]);
    expect(args).toContain('model_reasoning_effort="max"');
    expect(args).toContain(
      'mcp_servers.bgk_g06_one_tool.enabled_tools=["bangumi.get_subject_cast"]',
    );
    expect(args.join('\n')).toContain(JSON.stringify(G06_EXPECTED_QUERY_ARGUMENTS));
    expect(args.join('\n')).toContain('features.shell_tool=false');
    expect(args.join('\n')).toContain('features.multi_agent=false');
    expect(args.join('\n')).not.toContain('features.shell_tool=true');
  });

  it('accepts only --run 95 for a query and mirrors one durable claim in canonical Git metadata once', () => {
    expect(validateG06RunnerArgs(['--run', '95'])).toBe('run');
    expect(validateG06RunnerArgs(['--help'])).toBe('help');
    expect(() => validateG06RunnerArgs(['--run', '89'])).toThrow();

    const root = temporaryRoot();
    execFileSync('git', ['init', '-q'], { cwd: root });
    const claimPath = canonicalG06ClaimPath(root);
    const claim = durableClaim();
    const local = createG06OneShotClaim(claimPath, claim, { root });

    expect(localG06ClaimMatchesHarnessClaim(local, claim)).toBe(true);
    expect(localG06ClaimMatchesHarnessClaim({ ...local, model: 'gpt-6-sol' }, claim)).toBe(false);
    expect(
      localG06ClaimMatchesHarnessClaim({ ...local, toolName: 'bangumi.get_subject' }, claim),
    ).toBe(false);
    expect(statSync(claimPath).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(claimPath, 'utf8')).retryAllowed).toBe(false);
    expect(() => createG06OneShotClaim(claimPath, claim, { root })).toThrow(/already exists/u);
  });

  it('rejects a Git-metadata symlink that would move the local claim outside the repository metadata', () => {
    const root = temporaryRoot();
    execFileSync('git', ['init', '-q'], { cwd: root });
    const outside = path.join(root, 'outside-state');
    mkdirSync(outside);
    symlinkSync(outside, path.join(root, '.git', 'pariya-agent-state'));

    expect(() =>
      createG06OneShotClaim(canonicalG06ClaimPath(root), durableClaim(), { root }),
    ).toThrow(/physically inside local Git metadata/u);
    expect(() => readFileSync(path.join(outside, 'g06-run95-one-shot-claim.json'))).toThrow();
  });
});
