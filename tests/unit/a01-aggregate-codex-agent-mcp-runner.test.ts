import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assertA01AggregateCandidateGate,
  buildCodexExecArgs,
  canonicalA01AggregateClaimPath,
  createA01AggregateOneShotClaim,
  validateRunnerArgs,
} from '../../scripts/acceptance/run-a01-aggregate-codex-agent-mcp.mjs';

const tempRoots: string[] = [];

function makeGitRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'a01-aggregate-claim-test-'));
  tempRoots.push(root);
  execFileSync('git', ['init', '--quiet', root]);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('A01 aggregate Codex MCP runner', () => {
  it('requires the exact Run 95 invocation', () => {
    expect(validateRunnerArgs(['--help'])).toBe('help');
    expect(validateRunnerArgs(['--run', '95'])).toBe('run');
    expect(() => validateRunnerArgs(['--run', '94'])).toThrow(/exact Candidate/u);
    expect(() => validateRunnerArgs([])).toThrow(/--run 95/u);
  });

  it('pins Luna Max and exposes only one anonymous aggregate tool with no shell/web/app surfaces', () => {
    const args = buildCodexExecArgs({
      root: '/tmp/candidate',
      nodePath: '/usr/bin/node',
      summaryPath: '/tmp/a01-summary.json',
      sourceRevision: 'a'.repeat(40),
      bundleSha256: 'b'.repeat(64),
    });
    expect(args.slice(0, 8)).toEqual([
      'exec',
      '--ignore-user-config',
      '--strict-config',
      '--ephemeral',
      '--json',
      '--model',
      'gpt-6-luna',
      '--sandbox',
    ]);
    expect(args).toContain('read-only');
    expect(args.at(-1)).toContain('bangumi.aggregate_subject_cohort');
    expect(args).toContain('features.shell_tool=false');
    expect(args).toContain('features.web_search=false');
    expect(args).toContain('features.multi_agent=false');
    expect(args).toContain(
      'mcp_servers.bgk_a01_aggregate_one_tool.enabled_tools=["bangumi.aggregate_subject_cohort"]',
    );
    expect(args.at(-1)).toContain('"year":2012');
    expect(args.at(-1)).toContain('"maxSubjects":1');
  });

  it('requires the active exact Candidate, current Base, Luna Max PASS, and mandatory CI checks', () => {
    const candidateSha = 'a'.repeat(40);
    const baseSha = 'b'.repeat(40);
    const checks = [
      'harness-control',
      'sqlite-default',
      'host-integration',
      'standalone-release-smoke',
      'postgres-compat',
      'provider-foundation',
      'discovery-foundation',
    ].map((name) => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' }));
    const branch = 'codex/epoch-run95-a01-aggregate-state-precedence-followup';
    const status = {
      git: { branch, head: candidateSha, status: '' },
      run: { state: { state: 'EPOCH_ACTIVE', active_epoch_pr: 129, pending_epoch: null } },
      epoch: {
        number: 129,
        github_state: 'OPEN',
        state: {
          epoch_id: 'run95-a01-aggregate-state-precedence-followup',
          pr_number: 129,
          branch,
          candidate_sha: candidateSha,
          ci: { sha: candidateSha, status: 'SUCCESS' },
          review_pass_sha: candidateSha,
          base_sha: baseSha,
          review_history: [
            {
              candidate_sha: candidateSha,
              reviewed_base_sha: baseSha,
              reviewer_id: 'gpt-6-luna-max-run95-round1',
              verdict: 'PASS',
            },
          ],
        },
      },
    };
    const pr = {
      state: 'OPEN',
      isDraft: false,
      headRefOid: candidateSha,
      headRefName: branch,
      baseRefName: 'master',
      baseRefOid: baseSha,
      statusCheckRollup: checks,
    };
    expect(
      assertA01AggregateCandidateGate(status, pr, {
        candidateSha,
        currentBaseSha: baseSha,
      }),
    ).toMatchObject({ prNumber: 129, candidateSha, baseSha });

    const nonLunaStatus = structuredClone(status);
    nonLunaStatus.epoch.state.review_history[0]!.reviewer_id = 'gpt-6-sol-round1';
    expect(() =>
      assertA01AggregateCandidateGate(nonLunaStatus, pr, {
        candidateSha,
        currentBaseSha: baseSha,
      }),
    ).toThrow(/Luna Max PASS/u);
  });

  it('stores a private canonical claim and refuses a second attempt', () => {
    const root = makeGitRoot();
    const claimPath = canonicalA01AggregateClaimPath(root);
    expect(claimPath).toContain(path.join('.git', 'pariya-agent-state'));
    const claim = createA01AggregateOneShotClaim(
      claimPath,
      {
        sourceRevision: 'a'.repeat(40),
        baseSha: 'b'.repeat(40),
        prNumber: 129,
        bundleSha256: 'c'.repeat(64),
      },
      root,
    );
    expect(claim).toMatchObject({
      runNumber: 95,
      frontierId: 'A01',
      targetTool: 'bangumi.aggregate_subject_cohort',
      state: 'CLAIMED',
    });
    expect(fs.statSync(claimPath).mode & 0o777).toBe(0o600);
    expect(() =>
      createA01AggregateOneShotClaim(
        claimPath,
        {
          sourceRevision: 'a'.repeat(40),
          baseSha: 'b'.repeat(40),
          prNumber: 129,
          bundleSha256: 'c'.repeat(64),
        },
        root,
      ),
    ).toThrow(/already exists/u);
  });
});
