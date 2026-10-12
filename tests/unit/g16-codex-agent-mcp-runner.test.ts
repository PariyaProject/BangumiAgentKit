import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertG16CandidateReviewGate,
  buildCodexExecArgs,
  canonicalG16ClaimPath,
  canonicalG16SafeEventSummary,
  createG16OneShotClaim,
  hasUnexpectedG16CodexToolActivity,
  recoverG16PreexistingAttempt,
  runG16CodexAgentMcp,
  validateG16HarnessClaim,
  validateG16RunnerArgs,
} from '../../scripts/acceptance/run-g16-codex-agent-mcp.mjs';
import { G16_EXPECTED_QUERY_ARGUMENTS } from '../../scripts/acceptance/g16-person-activity-answer-check.mjs';
import {
  generateG16RunnerReceiptKeyPair,
  g16RunnerPublicKeySha256,
} from '../../scripts/acceptance/g16-agent-mcp-runner-receipt.mjs';

const temporaryRoots: string[] = [];
const candidate = 'a'.repeat(40);
const base = 'b'.repeat(40);
const branch = 'codex/epoch-run95-g16-director-person-activity-agent-mcp';
const prNumber = 141;
const checks = [
  'harness-control',
  'sqlite-default',
  'host-integration',
  'standalone-release-smoke',
  'postgres-compat',
  'provider-foundation',
  'discovery-foundation',
];
const expectedArgumentsSha256 = createHash('sha256')
  .update(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(G16_EXPECTED_QUERY_ARGUMENTS).sort(([a], [b]) => a.localeCompare(b)),
      ),
    ),
  )
  .digest('hex');

function gateInput(reviewerId = `gpt-6-luna-max-run95-pr${prNumber}-round1`) {
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
          epoch_id: 'run95-g16-director-person-activity-agent-mcp',
          pr_number: prNumber,
          branch,
          base_branch: 'master',
          base_sha: base,
          candidate_sha: candidate,
          advances_frontier_ids: ['G16'],
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
      statusCheckRollup: checks.map((name) => ({
        name,
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
      })),
    },
  };
}

function temporaryGitRepository() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'bgk-g16-claim-test-'));
  temporaryRoots.push(root);
  execFileSync('git', ['init', '-q'], { cwd: root });
  return root;
}

function oneShotDisposition(
  root: string,
  reviewerId = `gpt-6-luna-max-run95-pr${prNumber}-round1`,
) {
  const keyPair = generateG16RunnerReceiptKeyPair();
  const bundleSha256 = 'e'.repeat(64);
  const claimId = `g16-run-95-pr-${prNumber}-${candidate.slice(0, 12)}-123`;
  const gate = {
    claimId,
    sourceRevision: candidate,
    baseSha: base,
    ciSha: candidate,
    ciStatus: 'SUCCESS' as const,
    prNumber,
    bundleSha256,
    reviewerId,
    runnerReceiptPublicKey: keyPair.publicKeyBase64,
  };
  const claimPath = canonicalG16ClaimPath(root);
  const localClaim = createG16OneShotClaim(claimPath, gate, { root });
  const disposition = {
    ...gate,
    runNumber: 95,
    frontierId: 'G16',
    epochId: 'run95-g16-director-person-activity-agent-mcp',
    sourceCandidateSha: candidate,
    expectedArgumentsSha256,
    model: 'gpt-6-luna',
    reasoningEffort: 'max',
    runnerReceiptPublicKeySha256: g16RunnerPublicKeySha256(keyPair.publicKeyBase64),
    reportWritten: false,
    retryAllowed: false,
    state: 'CLAIMED',
  };
  return { claimPath, localClaim, disposition };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('G16 one-tool Codex runner', () => {
  it('gates a dynamic current PR on the exact Candidate/Base, all required CI, and Luna Max PASS', () => {
    const { status, pr } = gateInput();
    expect(
      assertG16CandidateReviewGate(status, pr, { sourceRevision: candidate, currentBaseSha: base }),
    ).toMatchObject({
      prNumber,
      candidateSha: candidate,
      baseSha: base,
      reviewerId: `gpt-6-luna-max-run95-pr${prNumber}-round1`,
    });

    const staleBase = structuredClone(status);
    staleBase.epoch.state.review_history[0]!.reviewed_base_sha = 'c'.repeat(40);
    expect(() =>
      assertG16CandidateReviewGate(staleBase, pr, {
        sourceRevision: candidate,
        currentBaseSha: base,
      }),
    ).toThrow();
    const wrongRole = structuredClone(status);
    wrongRole.epoch.state.review_history[0]!.reviewer_id = `gpt-5-sol-run95-pr${prNumber}-round1`;
    expect(() =>
      assertG16CandidateReviewGate(wrongRole, pr, {
        sourceRevision: candidate,
        currentBaseSha: base,
      }),
    ).toThrow();
    const missingCheck = { ...pr, statusCheckRollup: pr.statusCheckRollup.slice(1) };
    expect(() =>
      assertG16CandidateReviewGate(status, missingCheck, {
        sourceRevision: candidate,
        currentBaseSha: base,
      }),
    ).toThrow();
  });

  it('preserves the stable GPT-6 Luna Max reviewer identity issued by Harness', () => {
    const reviewerId = 'run95-g16-review1-gpt-6-luna-max-98df510';
    const { status, pr } = gateInput(reviewerId);
    expect(
      assertG16CandidateReviewGate(status, pr, { sourceRevision: candidate, currentBaseSha: base }),
    ).toMatchObject({ reviewerId });

    const wrongStableRole = structuredClone(status);
    wrongStableRole.epoch.state.review_history[0]!.reviewer_id =
      'run95-g16-review1-gpt-5-sol-98df510';
    expect(() =>
      assertG16CandidateReviewGate(wrongStableRole, pr, {
        sourceRevision: candidate,
        currentBaseSha: base,
      }),
    ).toThrow();

    const root = temporaryGitRepository();
    const { localClaim } = oneShotDisposition(root, reviewerId);
    expect(localClaim.reviewerId).toBe(reviewerId);
    const harnessClaim = {
      ...localClaim,
      state: 'G16_ONE_SHOT_CLAIMED',
      candidateSha: candidate,
    };
    const durableGate = {
      prNumber,
      sourceRevision: candidate,
      baseSha: base,
      bundleSha256: 'e'.repeat(64),
      reviewerId,
      runnerReceiptPublicKey: String(localClaim.runnerReceiptPublicKey),
    };
    expect(validateG16HarnessClaim(harnessClaim, durableGate)).toEqual(harnessClaim);
    expect(() => validateG16HarnessClaim(harnessClaim, {
      ...durableGate,
      reviewerId: 'run95-g16-review1-gpt-6-luna-max-deadbee',
    })).toThrow();
  });

  it('requires a durable Harness claim before execution and binds its exact receipt key', () => {
    expect(() => runG16CodexAgentMcp({})).toThrow(/Harness-owned claim and result/u);
    const keyPair = generateG16RunnerReceiptKeyPair();
    const gate = {
      prNumber,
      sourceRevision: candidate,
      baseSha: base,
      bundleSha256: 'e'.repeat(64),
      reviewerId: `gpt-6-luna-max-run95-pr${prNumber}-round2`,
      runnerReceiptPublicKey: keyPair.publicKeyBase64,
    };
    const claim = {
      state: 'G16_ONE_SHOT_CLAIMED',
      claimId: `g16-run-95-pr-${prNumber}-${candidate.slice(0, 12)}-123`,
      runNumber: 95,
      frontierId: 'G16',
      epochId: 'run95-g16-director-person-activity-agent-mcp',
      prNumber,
      candidateSha: candidate,
      baseSha: base,
      ciSha: candidate,
      ciStatus: 'SUCCESS',
      reviewerId: gate.reviewerId,
      bundleSha256: gate.bundleSha256,
      expectedArgumentsSha256,
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
      runnerReceiptPublicKey: keyPair.publicKeyBase64,
      runnerReceiptPublicKeySha256: g16RunnerPublicKeySha256(keyPair.publicKeyBase64),
      retryAllowed: false,
    };
    expect(validateG16HarnessClaim(claim, gate)).toEqual(claim);
    expect(() =>
      validateG16HarnessClaim({ ...claim, candidateSha: 'c'.repeat(40) }, gate),
    ).toThrow();
    expect(() => validateG16HarnessClaim({ ...claim, retryAllowed: true }, gate)).toThrow();
    expect(() =>
      validateG16HarnessClaim({ ...claim, runnerReceiptPublicKey: 'forged' }, gate),
    ).toThrow();
  });

  it('requires the claimed disposition to remain bound during post-query revalidation', () => {
    const { status, pr } = gateInput();
    const keyPair = generateG16RunnerReceiptKeyPair();
    const claimId = `g16-run-95-pr-${prNumber}-${candidate.slice(0, 12)}-123`;
    const bundleSha256 = 'e'.repeat(64);
    const disposition = {
      state: 'CLAIMED',
      claimId,
      runNumber: 95,
      frontierId: 'G16',
      epochId: 'run95-g16-director-person-activity-agent-mcp',
      prNumber,
      sourceCandidateSha: candidate,
      baseSha: base,
      ciSha: candidate,
      ciStatus: 'SUCCESS',
      reviewerId: `gpt-6-luna-max-run95-pr${prNumber}-round1`,
      bundleSha256,
      expectedArgumentsSha256,
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
      runnerReceiptPublicKey: keyPair.publicKeyBase64,
      runnerReceiptPublicKeySha256: g16RunnerPublicKeySha256(keyPair.publicKeyBase64),
      retryAllowed: false,
    };
    (status.epoch.state.adversarial_preflight as Record<string, unknown>).g16_one_shot_disposition =
      disposition;
    const options = {
      sourceRevision: candidate,
      currentBaseSha: base,
      allowClaimedDisposition: true,
      expectedClaimId: claimId,
      runnerReceiptPublicKey: keyPair.publicKeyBase64,
      bundleSha256,
    };
    expect(assertG16CandidateReviewGate(status, pr, options).prNumber).toBe(prNumber);
    expect(() =>
      assertG16CandidateReviewGate(status, pr, { ...options, expectedClaimId: 'forged' }),
    ).toThrow();
    expect(() =>
      assertG16CandidateReviewGate(status, pr, { ...options, bundleSha256: 'f'.repeat(64) }),
    ).toThrow();
  });

  it('reconciles an existing claim to terminal INCONCLUSIVE without invoking a second query', () => {
    const root = temporaryGitRepository();
    const { claimPath, localClaim, disposition } = oneShotDisposition(root);
    const persisted: unknown[][] = [];
    const result = recoverG16PreexistingAttempt({
      claimPath,
      reportPath: path.join(root, 'docs/live-probes/g16-report.json'),
      readStatus: () => ({
        epoch: {
          state: {
            epoch_id: 'run95-g16-director-person-activity-agent-mcp',
            adversarial_preflight: { g16_one_shot_disposition: disposition },
          },
        },
      }),
      persistResult: (...args) => {
        persisted.push(args);
        return true;
      },
    });
    expect(result).toBe(1);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.[0]).toMatchObject({ claimId: localClaim.claimId });
    expect(persisted[0]?.[1]).toBe('INCONCLUSIVE');
    expect(JSON.parse(readFileSync(claimPath, 'utf8')).state).toBe('INCONCLUSIVE');
  });

  it('hands an existing report and receipt to Harness reconciliation without rerunning Codex', () => {
    const root = temporaryGitRepository();
    const { claimPath, disposition } = oneShotDisposition(root);
    const reportPath = path.join(root, 'docs/live-probes/g16-report.json');
    mkdirSync(path.dirname(reportPath), { recursive: true });
    const runnerReceipt = { kind: 'g16-runner-acceptance-receipt-v1', signature: 'signed' };
    writeFileSync(reportPath, `${JSON.stringify({ runnerReceipt })}\n`);
    const persisted: unknown[][] = [];
    const result = recoverG16PreexistingAttempt({
      claimPath,
      reportPath,
      readStatus: () => ({
        epoch: {
          state: {
            epoch_id: 'run95-g16-director-person-activity-agent-mcp',
            adversarial_preflight: { g16_one_shot_disposition: disposition },
          },
        },
      }),
      persistResult: (...args) => {
        persisted.push(args);
        return true;
      },
    });
    expect(result).toBe(0);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.[1]).toBe('REPORT_WRITTEN');
    expect(persisted[0]?.[2]).toMatch(/^[0-9a-f]{64}$/u);
    expect(persisted[0]?.[3]).toEqual(runnerReceipt);
    expect(JSON.parse(readFileSync(claimPath, 'utf8')).state).toBe('REPORT_WRITTEN');
  });

  it('builds isolated GPT-6 Luna Max read-only execution with exactly the fixed get_person_activity profile', () => {
    const args = buildCodexExecArgs({
      root: '/tmp/g16-test-root',
      nodePath: '/usr/bin/node',
      serverScript: '/tmp/g16-test-root/apps/mcp/codex-one-tool-mcp-server.mjs',
      summaryPath: '/tmp/g16-summary.json',
      sourceRevision: candidate,
      bundleSha256: 'd'.repeat(64),
    });
    expect(args[0]).toBe('exec');
    expect(args).toContain('--ignore-user-config');
    expect(args).toContain('--strict-config');
    expect(args).toContain('--sandbox');
    expect(args).toContain('read-only');
    expect(args[args.indexOf('--model') + 1]).toBe('gpt-6-luna');
    expect(args.join('\n')).toContain('model_reasoning_effort="max"');
    expect(args.join('\n')).toContain(JSON.stringify(G16_EXPECTED_QUERY_ARGUMENTS));
    expect(args.join('\n')).toContain('enabled_tools=["bangumi.get_person_activity"]');
    expect(args.join('\n')).toContain('Do not call another tool');
  });

  it('creates a mode-0600 local-only claim exactly once and binds its argument, candidate, and reviewer hashes', () => {
    const root = temporaryGitRepository();
    const claimPath = canonicalG16ClaimPath(root);
    const keyPair = generateG16RunnerReceiptKeyPair();
    const input = {
      claimId: `g16-run-95-pr-${prNumber}-${candidate.slice(0, 12)}-123`,
      sourceRevision: candidate,
      baseSha: base,
      ciSha: candidate,
      ciStatus: 'SUCCESS',
      prNumber,
      bundleSha256: 'e'.repeat(64),
      reviewerId: `gpt-6-luna-max-run95-pr${prNumber}-round2`,
      runnerReceiptPublicKey: keyPair.publicKeyBase64,
    };
    const claim = createG16OneShotClaim(claimPath, input, {
      root,
      claimedAt: '2026-10-11T00:00:00.000Z',
    });
    const stored = JSON.parse(readFileSync(claimPath, 'utf8'));
    expect(claim).toMatchObject({
      runNumber: 95,
      frontierId: 'G16',
      epochId: 'run95-g16-director-person-activity-agent-mcp',
      state: 'CLAIMED',
      ...input,
    });
    expect(stored.expectedArgumentsSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(statSync(claimPath).mode & 0o777).toBe(0o600);
    expect(() => createG16OneShotClaim(claimPath, input, { root })).toThrow(/already exists/u);
    expect(() =>
      createG16OneShotClaim(path.join(root, 'outside-claim.json'), input, { root }),
    ).toThrow(/canonical/u);
  });

  it('retains only normalized safe event labels and fails closed on any non-MCP or shell event', () => {
    const summary = canonicalG16SafeEventSummary({
      codexMcpToolEventCount: 1,
      codexErrorItemCount: 0,
      nonMcpToolEventCount: 2,
      nonMcpToolTypes: ['error', 'private query text', 'error'],
      shellToolCallCount: 0,
      answer: 'private answer',
    });
    expect(summary).toEqual({
      codexMcpToolEventCount: 1,
      codexErrorItemCount: 0,
      nonMcpToolEventCount: 2,
      nonMcpToolTypes: ['error', 'unknown_tool_type'],
      shellToolCallCount: 0,
    });
    expect(JSON.stringify(summary)).not.toContain('private');
    expect(
      hasUnexpectedG16CodexToolActivity({
        codexErrorItemCount: 0,
        nonMcpToolEventCount: 0,
        shellToolCallCount: 0,
      }),
    ).toBe(false);
    expect(
      hasUnexpectedG16CodexToolActivity({
        codexErrorItemCount: 1,
        nonMcpToolEventCount: 0,
        shellToolCallCount: 0,
      }),
    ).toBe(true);
    expect(
      hasUnexpectedG16CodexToolActivity({ nonMcpToolEventCount: 1, shellToolCallCount: 0 }),
    ).toBe(true);
    expect(
      hasUnexpectedG16CodexToolActivity({ nonMcpToolEventCount: 0, shellToolCallCount: 1 }),
    ).toBe(true);
  });

  it('accepts only the exact supported invocation form', () => {
    expect(validateG16RunnerArgs(['--help'])).toBe('help');
    expect(validateG16RunnerArgs(['--run', '95'])).toBe('run');
    expect(() => validateG16RunnerArgs(['--run', '96'])).toThrow();
    expect(() => validateG16RunnerArgs(['--run', '95', '--retry'])).toThrow();
  });
});
