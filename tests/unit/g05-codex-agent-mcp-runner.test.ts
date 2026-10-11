import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertG05CandidateReviewGate,
  buildCodexExecArgs,
  canonicalG05ClaimPath,
  createG05OneShotClaim,
  hasUnexpectedG05CodexToolActivity,
  validateG05RunnerArgs,
} from '../../scripts/acceptance/run-g05-person-activity-comparison-codex-agent-mcp.mjs';

const candidate = 'a'.repeat(40);
const base = 'b'.repeat(40);
const prNumber = 130;
const branch = 'codex/epoch-run95-g05-current-source-luna-agent-mcp-refresh';
const reviewerId = 'gpt-6-luna-max-run95-pr130-round1';
const checkNames = [
  'harness-control', 'sqlite-default', 'host-integration', 'standalone-release-smoke',
  'postgres-compat', 'provider-foundation', 'discovery-foundation',
];

function gateFixture() {
  const status = {
    git: { status: '', head: candidate, branch },
    run: { state: {
      state: 'EPOCH_ACTIVE', profile: 'AUTONOMOUS_EVOLUTION', active_epoch_pr: prNumber, pending_epoch: null,
    } },
    epoch: {
      number: prNumber,
      github_state: 'OPEN',
      state: {
        epoch_id: 'run95-g05-current-source-luna-agent-mcp-refresh',
        pr_number: prNumber,
        branch,
        base_branch: 'master',
        base_sha: base,
        candidate_sha: candidate,
        advances_frontier_ids: ['G05'],
        ci: { sha: candidate, status: 'SUCCESS' },
        state: 'REVIEW_PASSED',
        review_pass_sha: candidate,
        review_history: [{
          candidate_sha: candidate,
          reviewed_base_sha: base,
          verdict: 'PASS',
          reviewer_id: reviewerId,
        }],
        scope_closure: { related_work_remaining: false },
        adversarial_preflight: { completed: true },
      },
    },
  };
  const pr = {
    state: 'OPEN', isDraft: false, baseRefName: 'master', headRefOid: candidate, headRefName: branch,
    statusCheckRollup: checkNames.map((name) => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' })),
  };
  return { status, pr };
}

describe('G05 one-tool Codex runner gates', () => {
  const tempDirs: string[] = [];
  afterEach(() => {
    for (const directory of tempDirs.splice(0)) rmSync(directory, { recursive: true, force: true });
  });

  it('binds review readiness to the exact dynamic G05 PR Candidate/Base and Luna Max identity', () => {
    const { status, pr } = gateFixture();
    expect(assertG05CandidateReviewGate(status, pr, { sourceRevision: candidate, currentBaseSha: base }))
      .toEqual({ prNumber, candidateSha: candidate, baseSha: base, reviewerId });

    const wrongPrIdentity = structuredClone(status);
    const staleReview = wrongPrIdentity.epoch.state.review_history[0];
    if (!staleReview) throw new Error('Expected the fixture review record.');
    staleReview.reviewer_id = 'gpt-6-luna-max-run95-pr128-round1';
    expect(() => assertG05CandidateReviewGate(wrongPrIdentity, pr, { sourceRevision: candidate, currentBaseSha: base }))
      .toThrow(/exact-identity GPT-6 Luna Max PASS/u);

    expect(() => assertG05CandidateReviewGate(status, pr, { sourceRevision: 'c'.repeat(40), currentBaseSha: base }))
      .toThrow(/exact-identity GPT-6 Luna Max PASS/u);
  });

  it('requires every exact-Candidate check and the fail-closed event summary', () => {
    const { status, pr } = gateFixture();
    const failed = structuredClone(pr);
    const firstCheck = failed.statusCheckRollup[0];
    if (!firstCheck) throw new Error('Expected the first mandatory check.');
    firstCheck.conclusion = 'FAILURE';
    expect(() => assertG05CandidateReviewGate(status, failed, { sourceRevision: candidate, currentBaseSha: base }))
      .toThrow(/exact-identity GPT-6 Luna Max PASS/u);

    expect(hasUnexpectedG05CodexToolActivity({ nonMcpToolEventCount: 0, shellToolCallCount: 0 })).toBe(false);
    expect(hasUnexpectedG05CodexToolActivity({ nonMcpToolEventCount: 1, shellToolCallCount: 0 })).toBe(true);
    expect(hasUnexpectedG05CodexToolActivity({ nonMcpToolEventCount: 0, shellToolCallCount: 1 })).toBe(true);
    expect(hasUnexpectedG05CodexToolActivity({ shellToolCallCount: 0 })).toBe(true);
  });

  it('exposes only the fixed read-only tool and GPT-6 Luna Max in Codex config', () => {
    const args = buildCodexExecArgs({
      root: '/repo', nodePath: '/node', serverScript: '/repo/server.mjs', summaryPath: '/tmp/summary.json',
      sourceRevision: candidate, bundleSha256: 'd'.repeat(64),
    });
    const serialized = args.join('\n');
    expect(args).toContain('gpt-6-luna');
    expect(serialized).toContain('model_reasoning_effort="max"');
    expect(serialized).toContain('features.shell_tool=false');
    expect(serialized).toContain('features.multi_agent=false');
    expect(serialized).toContain('features.web_search=false');
    expect(serialized).toContain('enabled_tools=["bangumi.get_person_activity"]');
    expect(serialized).toContain('comparePreviousWindow":true');
    expect(serialized).toContain('exactly once');
  });

  it('rejects an external claim path and only accepts the explicit Run #95 command', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'g05-claim-gate-'));
    tempDirs.push(directory);
    const claim = path.join(directory, 'claim.json');
    expect(canonicalG05ClaimPath()).toContain('g05-run95-one-shot-claim.json');
    expect(() => createG05OneShotClaim(claim, {
      sourceRevision: candidate, baseSha: base, prNumber, bundleSha256: 'e'.repeat(64), reviewerId,
    })).toThrow(/local Git metadata/u);
    expect(() => validateG05RunnerArgs(['--run', '94'])).toThrow(/Pass --run 95/u);
    expect(validateG05RunnerArgs(['--help'])).toBe('help');
    expect(validateG05RunnerArgs(['--run', '95'])).toBe('run');
  });

  it('creates one private local claim and refuses to replace it', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'g05-one-shot-claim-'));
    tempDirs.push(directory);
    execFileSync('git', ['init', '--quiet'], { cwd: directory });
    const claimPath = canonicalG05ClaimPath(directory);
    const claimInput = {
      sourceRevision: candidate,
      baseSha: base,
      prNumber,
      bundleSha256: 'f'.repeat(64),
      reviewerId,
    };
    const first = createG05OneShotClaim(claimPath, claimInput, { root: directory });
    expect(first).toMatchObject({
      runNumber: 95,
      frontierId: 'G05',
      epochId: 'run95-g05-current-source-luna-agent-mcp-refresh',
      state: 'CLAIMED',
      sourceRevision: candidate,
      reviewerId,
    });
    expect(statSync(claimPath).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(claimPath, 'utf8')).state).toBe('CLAIMED');
    expect(() => createG05OneShotClaim(claimPath, claimInput, { root: directory }))
      .toThrow(/already exists/u);
    expect(JSON.parse(readFileSync(claimPath, 'utf8')).state).toBe('CLAIMED');
  });
});
