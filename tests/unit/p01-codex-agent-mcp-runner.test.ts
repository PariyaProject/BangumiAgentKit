import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  P01_ARGUMENT_PROFILE,
  P01_EXPECTED_QUERY_ARGUMENTS,
} from '../../scripts/acceptance/p01-person-position-answer-check.mjs';
import {
  assertP01CandidateReviewGate,
  buildCodexExecArgs,
  canonicalP01ClaimPath,
  canonicalP01SafeEventSummary,
  createP01OneShotClaim,
  hasUnexpectedP01CodexToolActivity,
  validateP01RunnerArgs,
} from '../../scripts/acceptance/run-p01-codex-agent-mcp.mjs';

const temporaryRoots: string[] = [];
const candidate = 'a'.repeat(40);
const base = 'b'.repeat(40);
const bundle = 'c'.repeat(64);
const branch = 'codex/epoch-run95-p01-person-role-agent-mcp';
const prNumber = 142;
const reviewerId = `gpt-6-luna-max-run95-pr${prNumber}-round1`;
const checks = [
  'harness-control',
  'sqlite-default',
  'host-integration',
  'standalone-release-smoke',
  'postgres-compat',
  'provider-foundation',
  'discovery-foundation',
];
const canonicalize = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonicalize)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => [key, canonicalize(item)]),
        )
      : value;
const canonicalHash = (value: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');

function gateInput() {
  return {
    status: {
      git: { status: '', head: candidate, branch },
      run: {
        state: {
          state: 'EPOCH_ACTIVE',
          profile: 'AUTONOMOUS_EVOLUTION',
          active_epoch_pr: prNumber,
          pending_epoch: null,
        },
      },
      epoch: {
        number: prNumber,
        github_state: 'OPEN',
        state: {
          epoch_id: 'run95-p01-person-role-agent-mcp',
          pr_number: prNumber,
          branch,
          base_branch: 'master',
          base_sha: base,
          candidate_sha: candidate,
          advances_frontier_ids: ['P01'],
          ci: { sha: candidate, status: 'SUCCESS' },
          state: 'REVIEW_PASSED',
          review_pass_sha: candidate,
          review_history: [
            {
              candidate_sha: candidate,
              reviewed_base_sha: base,
              verdict: 'PASS',
              reviewer_id: reviewerId,
            },
          ],
          scope_closure: { related_work_remaining: false },
          adversarial_preflight: { completed: true } as Record<string, unknown>,
        },
      },
    },
    pr: {
      state: 'OPEN',
      isDraft: false,
      baseRefName: 'master',
      headRefOid: candidate,
      headRefName: branch,
      statusCheckRollup: checks.map((name) => ({
        name,
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
      })),
    },
  };
}

function temporaryGitRepository() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'bgk-p01-claim-test-'));
  temporaryRoots.push(root);
  execFileSync('git', ['init', '-q'], { cwd: root });
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('P01 one-tool Codex runner', () => {
  it('requires the exact P01 Candidate/Base, all mandatory CI, and same-identity Luna Max PASS', () => {
    const { status, pr } = gateInput();
    expect(
      assertP01CandidateReviewGate(status, pr, {
        sourceRevision: candidate,
        currentBaseSha: base,
      }),
    ).toMatchObject({ prNumber, candidateSha: candidate, baseSha: base, reviewerId });

    const staleBase = structuredClone(status);
    staleBase.epoch.state.review_history[0]!.reviewed_base_sha = 'd'.repeat(40);
    expect(() =>
      assertP01CandidateReviewGate(staleBase, pr, {
        sourceRevision: candidate,
        currentBaseSha: base,
      }),
    ).toThrow();

    const spent = structuredClone(status);
    spent.epoch.state.adversarial_preflight['p01_one_shot_disposition'] = {
      frontierId: 'P01',
      state: 'INCONCLUSIVE',
      retryAllowed: false,
    };
    expect(() =>
      assertP01CandidateReviewGate(spent, pr, {
        sourceRevision: candidate,
        currentBaseSha: base,
      }),
    ).toThrow(/durable Harness control plane/u);

    const ownClaim = structuredClone(status);
    ownClaim.epoch.state.adversarial_preflight['p01_one_shot_disposition'] = {
      frontierId: 'P01',
      epochId: 'run95-p01-person-role-agent-mcp',
      runNumber: 95,
      toolName: 'bangumi.get_person_activity',
      argumentProfile: P01_ARGUMENT_PROFILE,
      expectedArgumentsSha256: canonicalHash(P01_EXPECTED_QUERY_ARGUMENTS),
      bundleSha256: bundle,
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
      ciSha: candidate,
      ciStatus: 'SUCCESS',
      state: 'CLAIMED',
      sourceCandidateSha: candidate,
      baseSha: base,
      prNumber,
      reviewerId,
    };
    expect(
      assertP01CandidateReviewGate(ownClaim, pr, {
        sourceRevision: candidate,
        currentBaseSha: base,
        bundleSha256: bundle,
        allowClaimed: true,
      }),
    ).toMatchObject({ candidateSha: candidate, baseSha: base });
    expect(() =>
      assertP01CandidateReviewGate(ownClaim, pr, {
        sourceRevision: candidate,
        currentBaseSha: base,
        bundleSha256: 'e'.repeat(64),
        allowClaimed: true,
      }),
    ).toThrow();
  });

  it('builds GPT-6 Luna Max read-only execution with only the fixed P01 tool/profile', () => {
    const args = buildCodexExecArgs({
      root: '/tmp/p01-test-root',
      nodePath: '/usr/bin/node',
      serverScript: '/tmp/p01-test-root/apps/mcp/codex-one-tool-mcp-server.mjs',
      summaryPath: '/tmp/p01-summary.json',
      sourceRevision: candidate,
      bundleSha256: bundle,
    });
    expect(args[0]).toBe('exec');
    expect(args).toContain('--ignore-user-config');
    expect(args).toContain('--strict-config');
    expect(args).toContain('--sandbox');
    expect(args).toContain('read-only');
    expect(args[args.indexOf('--model') + 1]).toBe('gpt-6-luna');
    expect(args.join('\n')).toContain('model_reasoning_effort="max"');
    expect(args.join('\n')).toContain(JSON.stringify(P01_EXPECTED_QUERY_ARGUMENTS));
    expect(args.join('\n')).toContain('enabled_tools=["bangumi.get_person_activity"]');
    expect(args.join('\n')).toContain('features.shell_tool=false');
    expect(args.join('\n')).toContain('features.multi_agent=false');
    expect(args.join('\n')).toContain('mcp_servers.bgk_p01_one_tool.required=true');
    expect(args.join('\n')).toContain('Do not call another tool');
  });

  it('creates a mode-0600 local claim exactly once and binds Candidate, arguments, and reviewer', () => {
    const root = temporaryGitRepository();
    const claimPath = canonicalP01ClaimPath(root);
    const input = {
      sourceRevision: candidate,
      baseSha: base,
      prNumber,
      bundleSha256: bundle,
      reviewerId,
    };
    const claim = createP01OneShotClaim(claimPath, input, {
      root,
      claimedAt: '2026-10-11T00:00:00.000Z',
    });
    const stored = JSON.parse(readFileSync(claimPath, 'utf8'));
    expect(claim).toMatchObject({
      runNumber: 95,
      frontierId: 'P01',
      epochId: 'run95-p01-person-role-agent-mcp',
      state: 'CLAIMED',
      toolName: 'bangumi.get_person_activity',
      argumentProfile: P01_ARGUMENT_PROFILE,
      ...input,
      ciSha: candidate,
      ciStatus: 'SUCCESS',
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
    });
    expect(stored.expectedArgumentsSha256).toBe(canonicalHash(P01_EXPECTED_QUERY_ARGUMENTS));
    expect(statSync(claimPath).mode & 0o777).toBe(0o600);
    expect(() => createP01OneShotClaim(claimPath, input, { root })).toThrow(/already exists/u);
    expect(() =>
      createP01OneShotClaim(claimPath, { ...input, model: 'gpt-6-sol' }, { root }),
    ).toThrow(/Luna Max/u);
    expect(() =>
      createP01OneShotClaim(path.join(root, 'outside-claim.json'), input, { root }),
    ).toThrow(/canonical/u);
  });

  it('retains only safe event counts/types and fails closed on extra activity', () => {
    const summary = canonicalP01SafeEventSummary({
      codexMcpToolEventCount: 1,
      nonMcpToolEventCount: 2,
      nonMcpToolTypes: ['error', 'private query text', 'error'],
      shellToolCallCount: 0,
      answer: 'private answer',
    });
    expect(summary).toEqual({
      codexMcpToolEventCount: 1,
      nonMcpToolEventCount: 2,
      nonMcpToolTypes: ['error', 'unknown_tool_type'],
      shellToolCallCount: 0,
    });
    expect(JSON.stringify(summary)).not.toContain('private');
    expect(
      hasUnexpectedP01CodexToolActivity({ nonMcpToolEventCount: 0, shellToolCallCount: 0 }),
    ).toBe(false);
    expect(
      hasUnexpectedP01CodexToolActivity({ nonMcpToolEventCount: 1, shellToolCallCount: 0 }),
    ).toBe(true);
    expect(
      hasUnexpectedP01CodexToolActivity({ nonMcpToolEventCount: 0, shellToolCallCount: 1 }),
    ).toBe(true);
  });

  it('accepts only the gated invocation form', () => {
    expect(validateP01RunnerArgs(['--help'])).toBe('help');
    expect(validateP01RunnerArgs(['--run', '95'])).toBe('run');
    expect(() => validateP01RunnerArgs(['--run', '96'])).toThrow();
    expect(() => validateP01RunnerArgs(['--run', '95', '--retry'])).toThrow();
  });
});
