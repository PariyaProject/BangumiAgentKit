import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertA01CandidateGate,
  buildCodexExecArgs,
  canonicalA01ClaimPath,
  createA01OneShotClaim,
  projectA01CohortQuery,
  validateRunnerArgs,
} from '../../scripts/acceptance/run-a01-codex-agent-mcp.mjs';

const candidateSha = '0123456789abcdef0123456789abcdef01234567';
const baseSha = '89abcdef0123456789abcdef0123456789abcdef';
const branch = 'codex/epoch-run95-a01-agent-mcp-acceptance';
const tempDirectories: string[] = [];

function makeGateFixture() {
  const checks = [
    'harness-control',
    'sqlite-default',
    'host-integration',
    'standalone-release-smoke',
    'postgres-compat',
    'provider-foundation',
    'discovery-foundation',
  ].map((name) => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' }));
  const status = {
    git: { branch, head: candidateSha, status: '' },
    run: {
      number: 95,
      state: {
        state: 'EPOCH_ACTIVE',
        active_epoch_pr: 124,
        pending_epoch: null,
      },
    },
    epoch: {
      number: 124,
      github_state: 'OPEN',
      state: {
        epoch_id: 'run95-a01-agent-mcp-acceptance',
        pr_number: 124,
        branch,
        state: 'REVIEW_PASSED',
        base_sha: baseSha,
        candidate_sha: candidateSha,
        reviewed_base_sha: baseSha,
        review_pass_sha: candidateSha,
        ci: { sha: candidateSha, status: 'SUCCESS' },
        review_history: [
          {
            candidate_sha: candidateSha,
            reviewed_base_sha: baseSha,
            verdict: 'PASS',
            reviewer_id: 'gpt-6-luna-max-run95-a01-agent-mcp-acceptance-pr124-round1',
          },
        ],
      },
      pr_head_sha: candidateSha,
    },
  };
  const pr = {
    state: 'OPEN',
    isDraft: false,
    headRefName: branch,
    headRefOid: candidateSha,
    baseRefName: 'master',
    baseRefOid: baseSha,
    statusCheckRollup: checks,
  };
  return { status, pr };
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('A01 Codex/MCP runner gates', () => {
  it('accepts only the governed Run 95 invocation', () => {
    expect(validateRunnerArgs(['--run', '95'])).toBe('run');
    expect(validateRunnerArgs(['--help'])).toBe('help');
    expect(() => validateRunnerArgs(['--run', '94'])).toThrow();
    expect(() => validateRunnerArgs(['--force'])).toThrow();
  });

  it('forces Luna Max reasoning, one anonymous target MCP tool, and read-only CLI surfaces', () => {
    const args = buildCodexExecArgs({
      root: '/tmp/bgk',
      nodePath: '/usr/bin/node',
      summaryPath: '/tmp/a01/summary.json',
      sourceRevision: candidateSha,
      bundleSha256: 'a'.repeat(64),
    });
    const config = args.flatMap((arg, index) => (arg === '--config' ? [args[index + 1]] : []));

    expect(args[args.indexOf('--model') + 1]).toBe('gpt-6-luna');
    expect(args.slice(args.indexOf('--sandbox'), args.indexOf('--cd'))).toEqual([
      '--sandbox',
      'read-only',
    ]);
    expect(config).toContain('model_reasoning_effort="max"');
    expect(config).toContain(
      'mcp_servers.bgk_a01_one_tool.enabled_tools=["bangumi.compare_subject_cohorts"]',
    );
    expect(config).toContain('features.shell_tool=false');
    expect(config).toContain('features.web_search=false');
    expect(config).toContain('features.multi_agent=false');
    expect(args.at(-1) ?? '').toContain(
      'call its sole tool bangumi.compare_subject_cohorts exactly once',
    );
    expect(args.at(-1) ?? '').toContain('2017-autumn');
  });

  it('preserves the bounded effective query and flags unexpected filters without leaking values', () => {
    const fixedQuery = {
      keyword: '少女终末旅行',
      media: 'anime',
      categories: 'tv',
      season: '2017-autumn',
      resultMode: 'all',
      nsfw: 'exclude',
    };
    const serviceQuery = {
      ...fixedQuery,
      limit: 8,
      budget: {
        maxPages: 6,
        maxCandidates: 300,
        maxHydrations: 60,
        concurrency: 6,
        maxConceptProbes: 8,
        maxReturnedItems: 8,
      },
    };
    expect(projectA01CohortQuery(serviceQuery)).toEqual(serviceQuery);

    const projectedUnexpected = projectA01CohortQuery({
      ...serviceQuery,
      tags: ['private-like-input-must-not-be-copied'],
    });
    expect(projectedUnexpected).toEqual({
      ...serviceQuery,
      __unexpectedA01QueryFields: true,
    });
    expect(JSON.stringify(projectedUnexpected)).not.toContain('private-like-input-must-not-be-copied');

    const projectedUnexpectedBudget = projectA01CohortQuery({
      ...serviceQuery,
      budget: {
        ...serviceQuery.budget,
        extra: 'do-not-project',
      },
    });
    expect(projectedUnexpectedBudget.__unexpectedA01QueryFields).toBe(true);
    expect(JSON.stringify(projectedUnexpectedBudget)).not.toContain('do-not-project');
  });

  it('requires the active A01 epoch, current exact SHA CI, and explicit Luna Max review identity', () => {
    const fixture = makeGateFixture();
    expect(
      assertA01CandidateGate(fixture.status, fixture.pr, {
        candidateSha,
        currentBaseSha: baseSha,
      }),
    ).toEqual({
      prNumber: 124,
      candidateSha,
      baseSha,
      reviewerId: 'gpt-6-luna-max-run95-a01-agent-mcp-acceptance-pr124-round1',
    });

    const wrongReviewer = structuredClone(fixture.status);
    wrongReviewer.epoch.state.review_history[0]!.reviewer_id = 'reviewer-with-unknown-model';
    expect(() =>
      assertA01CandidateGate(wrongReviewer, fixture.pr, {
        candidateSha,
        currentBaseSha: baseSha,
      }),
    ).toThrow();

    const staleCi = structuredClone(fixture.status);
    staleCi.epoch.state.ci.sha = baseSha;
    expect(() =>
      assertA01CandidateGate(staleCi, fixture.pr, {
        candidateSha,
        currentBaseSha: baseSha,
      }),
    ).toThrow();
  });

  it('creates one mode-0600 local claim and refuses a duplicate', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'bgk-a01-claim-test-'));
    tempDirectories.push(directory);
    execFileSync('git', ['init', '--quiet', directory]);
    const claimPath = canonicalA01ClaimPath(directory);
    const claim = createA01OneShotClaim(
      claimPath,
      {
        sourceRevision: candidateSha,
        baseSha,
        prNumber: 124,
        bundleSha256: 'a'.repeat(64),
      },
      directory,
    );
    expect(claim.state).toBe('CLAIMED');
    expect(statSync(claimPath).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(claimPath, 'utf8'))).toMatchObject({
      frontierId: 'A01',
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
      sourceRevision: candidateSha,
    });
    expect(() =>
      createA01OneShotClaim(
        claimPath,
        { sourceRevision: candidateSha, baseSha, prNumber: 124, bundleSha256: 'a'.repeat(64) },
        directory,
      ),
    ).toThrow();
  });

  it('refuses a one-shot claim directory redirected outside Git metadata', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'bgk-a01-claim-link-test-'));
    tempDirectories.push(directory);
    execFileSync('git', ['init', '--quiet', directory]);
    const metadataDirectory = path.join(directory, '.git', 'pariya-agent-state');
    const redirectedDirectory = path.join(directory, 'redirected');
    mkdirSync(redirectedDirectory);
    symlinkSync(redirectedDirectory, metadataDirectory);
    const claimPath = canonicalA01ClaimPath(directory);

    expect(() =>
      createA01OneShotClaim(
        claimPath,
        { sourceRevision: candidateSha, baseSha, prNumber: 124, bundleSha256: 'a'.repeat(64) },
        directory,
      ),
    ).toThrow(/canonical location/u);
    expect(existsSync(path.join(redirectedDirectory, path.basename(claimPath)))).toBe(false);
  });
});
