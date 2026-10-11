import { describe, expect, it } from 'vitest';
import {
  assertG04CandidateReviewGate,
  buildCodexExecArgs,
  canonicalG04ClaimPath,
  createG04OneShotClaim,
  validateRunnerArgs,
} from '../../scripts/acceptance/run-g04-codex-agent-mcp.mjs';

const candidate = 'a'.repeat(40);
const base = 'b'.repeat(40);
const branch = 'codex/epoch-run95-g04-person-activity';
const prNumber = 128;
const requiredChecks = [
  'harness-control',
  'sqlite-default',
  'host-integration',
  'standalone-release-smoke',
  'postgres-compat',
  'provider-foundation',
  'discovery-foundation',
];

function gateInput() {
  return {
    status: {
      git: { status: '', head: candidate, branch },
      run: { state: { state: 'EPOCH_ACTIVE', profile: 'AUTONOMOUS_EVOLUTION', active_epoch_pr: prNumber, pending_epoch: null } },
      epoch: {
        number: prNumber,
        github_state: 'OPEN',
        state: {
          epoch_id: 'run95-g04-person-activity-codex-current-evidence',
          pr_number: prNumber,
          branch,
          base_branch: 'master',
          base_sha: base,
          candidate_sha: candidate,
          advances_frontier_ids: ['G04'],
          ci: { sha: candidate, status: 'SUCCESS' },
          state: 'REVIEW_PASSED',
          review_pass_sha: candidate,
          review_history: [{
            candidate_sha: candidate,
            reviewed_base_sha: base,
            verdict: 'PASS',
            reviewer_id: 'gpt-6-luna-max-run95-pr128-round1',
          }],
          scope_closure: { related_work_remaining: false },
          adversarial_preflight: { completed: true },
        },
      },
    },
    pr: {
      state: 'OPEN',
      isDraft: false,
      baseRefName: 'master',
      headRefOid: candidate,
      headRefName: branch,
      statusCheckRollup: requiredChecks.map((name) => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' })),
    },
  };
}

describe('G04 one-tool Codex runner preflight', () => {
  it('builds an isolated Luna Max command with only the fixed read-only G04 tool', () => {
    const args = buildCodexExecArgs({
      root: '/repo',
      nodePath: '/node',
      serverScript: '/repo/apps/mcp/codex-one-tool-mcp-server.mjs',
      summaryPath: '/tmp/g04/server-summary.json',
      sourceRevision: candidate,
      bundleSha256: 'c'.repeat(64),
    });
    expect(args).toContain('gpt-6-luna');
    expect(args).toContain('model_reasoning_effort="max"');
    expect(args).toContain('read-only');
    expect(args).toContain('features.shell_tool=false');
    expect(args).toContain('features.web_search=false');
    expect(args.some((value) => value.includes('enabled_tools=["bangumi.get_person_activity"]'))).toBe(true);
    expect(args.some((value) => value.includes('maxSubjectDetails'))).toBe(true);
    expect(args).not.toContain('gpt-6-sol');
  });

  it('requires the exact reviewed G04 candidate, Luna Max reviewer, current base, and all CI checks', () => {
    const { status, pr } = gateInput();
    expect(assertG04CandidateReviewGate(status, pr, { sourceRevision: candidate, currentBaseSha: base }))
      .toEqual({ prNumber, candidateSha: candidate, reviewerId: 'gpt-6-luna-max-run95-pr128-round1' });

    const wrongReviewer = structuredClone(status);
    const review = wrongReviewer.epoch.state.review_history[0];
    if (!review) throw new Error('Expected the fixture review record.');
    review.reviewer_id = 'gpt-6-sol-run95';
    expect(() => assertG04CandidateReviewGate(wrongReviewer, pr, { sourceRevision: candidate, currentBaseSha: base }))
      .toThrow(/exact-identity GPT-6 Luna Max/u);

    const wrongLunaIdentity = structuredClone(status);
    const differentLunaReviewer = wrongLunaIdentity.epoch.state.review_history[0];
    if (!differentLunaReviewer) throw new Error('Expected the fixture review record.');
    differentLunaReviewer.reviewer_id = 'gpt-6-luna-max-run95-pr999-round1';
    expect(() => assertG04CandidateReviewGate(wrongLunaIdentity, pr, { sourceRevision: candidate, currentBaseSha: base }))
      .toThrow(/exact-identity GPT-6 Luna Max/u);

    const wrongRound = structuredClone(status);
    const laterRoundReviewer = wrongRound.epoch.state.review_history[0];
    if (!laterRoundReviewer) throw new Error('Expected the fixture review record.');
    laterRoundReviewer.reviewer_id = 'gpt-6-luna-max-run95-pr128-round2';
    expect(() => assertG04CandidateReviewGate(wrongRound, pr, { sourceRevision: candidate, currentBaseSha: base }))
      .toThrow(/exact-identity GPT-6 Luna Max/u);

    const stalePass = structuredClone(status);
    stalePass.epoch.state.review_history.push({
      candidate_sha: 'f'.repeat(40),
      reviewed_base_sha: base,
      verdict: 'PASS',
      reviewer_id: 'gpt-6-luna-max-run95-pr128-round2',
    });
    expect(() => assertG04CandidateReviewGate(stalePass, pr, { sourceRevision: candidate, currentBaseSha: base }))
      .toThrow(/exact-identity GPT-6 Luna Max/u);

    const failedCheck = structuredClone(pr);
    const check = failedCheck.statusCheckRollup[0];
    if (!check) throw new Error('Expected the fixture CI record.');
    check.conclusion = 'FAILURE';
    expect(() => assertG04CandidateReviewGate(status, failedCheck, { sourceRevision: candidate, currentBaseSha: base }))
      .toThrow(/GPT-6 Luna Max/u);
  });

  it('only accepts the one supported invocation and keeps its claim under local Git metadata', () => {
    expect(validateRunnerArgs(['--help'])).toBe('help');
    expect(validateRunnerArgs(['--run', '95'])).toBe('run');
    expect(() => validateRunnerArgs(['--run', '96'])).toThrow(/--run 95/u);
    expect(canonicalG04ClaimPath()).toMatch(/[\\/]\.git[\\/]pariya-agent-state[\\/]g04-run95-one-shot-claim\.json$/u);
  });

  it('refuses to create a claim under a different reviewer round identity', () => {
    expect(() => createG04OneShotClaim(
      '/tmp/unused-g04-claim.json',
      candidate,
      'c'.repeat(64),
      'gpt-6-luna-max-run95-pr128-round2',
    )).toThrow(/Harness reviewer identity/u);
  });
});
