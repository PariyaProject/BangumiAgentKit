import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertG04CandidateReviewGate,
  buildG04SafeEventSummary,
  buildCodexExecArgs,
  hasUnexpectedG04CodexToolActivity,
  canonicalG04ClaimPath,
  resolveG04ReportWriterOutcome,
  validateRunnerArgs,
} from '../../scripts/acceptance/run-g04-codex-agent-mcp.mjs';
import * as g04Runner from '../../scripts/acceptance/run-g04-codex-agent-mcp.mjs';
import {
  G04_EXPECTED_QUERY_ARGUMENTS,
  G04_REQUIRED_CAVEAT,
} from '../../scripts/acceptance/g04-person-activity-answer-check.mjs';
import {
  generateG04RunnerReceiptKeyPair,
  g04RunnerPublicKeySha256,
} from '../../scripts/acceptance/g04-runner-receipt.mjs';

const candidate = 'a'.repeat(40);
const base = 'b'.repeat(40);
const branch = 'codex/epoch-run95-g04-person-activity-global-one-shot-latch';
const prNumber = 136;
const reviewerId = 'gpt-6-luna-max-run95-pr136-round1';
const requiredChecks = [
  'harness-control',
  'sqlite-default',
  'host-integration',
  'standalone-release-smoke',
  'postgres-compat',
  'provider-foundation',
  'discovery-foundation',
];

function canonicalJson(value: unknown): string {
  const canonical = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(canonical);
    if (item !== null && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      return Object.fromEntries(
        Object.keys(record)
          .sort()
          .map((key) => [key, canonical(record[key])]),
      );
    }
    return item;
  };
  return JSON.stringify(canonical(value));
}

function canonicalSha256(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

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
          epoch_id: 'run95-g04-person-activity-global-one-shot-latch',
          pr_number: prNumber,
          branch,
          base_branch: 'master',
          base_sha: base,
          candidate_sha: candidate,
          advances_frontier_ids: ['G04'],
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
      statusCheckRollup: requiredChecks.map((name) => ({
        name,
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
      })),
    },
  };
}

describe('G04 one-tool Codex runner preflight', () => {
  it('retains only sanitized non-MCP event types in an inconclusive claim summary', () => {
    const summary = buildG04SafeEventSummary({
      codexMcpToolEventCount: 1,
      codexErrorItemCount: 3,
      nonMcpToolEventCount: 2,
      nonMcpToolTypes: ['web_search_call', 'private query text', 'web_search_call'],
      shellToolCallCount: 0,
      answer: 'private model answer',
      rawResult: { query: 'private query text' },
    });

    expect(summary).toEqual({
      codexMcpToolEventCount: 1,
      codexErrorItemCount: 3,
      nonMcpToolEventCount: 2,
      nonMcpToolTypes: ['unknown_tool_type', 'web_search_call'],
      shellToolCallCount: 0,
    });
    expect(JSON.stringify(summary)).not.toContain('private');
    expect(JSON.stringify(summary)).not.toContain('answer');
  });

  it('keeps the exact-run gate closed for every non-MCP or shell tool event', () => {
    expect(
      hasUnexpectedG04CodexToolActivity({
        codexErrorItemCount: 3,
        nonMcpToolEventCount: 0,
        shellToolCallCount: 0,
      }),
    ).toBe(false);
    expect(
      hasUnexpectedG04CodexToolActivity({
        codexErrorItemCount: 0,
        nonMcpToolEventCount: 1,
        shellToolCallCount: 0,
      }),
    ).toBe(true);
    expect(
      hasUnexpectedG04CodexToolActivity({
        codexErrorItemCount: 0,
        nonMcpToolEventCount: 0,
        shellToolCallCount: 1,
      }),
    ).toBe(true);
    expect(
      hasUnexpectedG04CodexToolActivity({ nonMcpToolEventCount: 0, shellToolCallCount: 0 }),
    ).toBe(true);
    expect(hasUnexpectedG04CodexToolActivity(undefined)).toBe(true);
  });

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
    expect(args).toContain('web_search="disabled"');
    expect(args.some((value) => value.includes(G04_REQUIRED_CAVEAT))).toBe(true);
    expect(
      args.some((value) => value.includes('enabled_tools=["bangumi.get_person_activity"]')),
    ).toBe(true);
    expect(args.some((value) => value.includes('maxSubjectDetails'))).toBe(true);
    expect(args).not.toContain('gpt-6-sol');
  });

  it('requires the exact reviewed G04 candidate, Luna Max reviewer, current base, and all CI checks', () => {
    const { status, pr } = gateInput();
    expect(
      assertG04CandidateReviewGate(status, pr, { sourceRevision: candidate, currentBaseSha: base }),
    ).toEqual({
      runNumber: 95,
      prNumber,
      candidateSha: candidate,
      baseSha: base,
      ciSha: candidate,
      ciStatus: 'SUCCESS',
      reviewerId,
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
    });

    const wrongReviewer = structuredClone(status);
    const review = wrongReviewer.epoch.state.review_history[0];
    if (!review) throw new Error('Expected the fixture review record.');
    review.reviewer_id = 'gpt-6-sol-run95';
    expect(() =>
      assertG04CandidateReviewGate(wrongReviewer, pr, {
        sourceRevision: candidate,
        currentBaseSha: base,
      }),
    ).toThrow(/exact-identity GPT-6 Luna Max/u);

    const wrongLunaIdentity = structuredClone(status);
    const differentLunaReviewer = wrongLunaIdentity.epoch.state.review_history[0];
    if (!differentLunaReviewer) throw new Error('Expected the fixture review record.');
    differentLunaReviewer.reviewer_id = 'gpt-6-luna-max-run95-pr128-round1';
    expect(() =>
      assertG04CandidateReviewGate(wrongLunaIdentity, pr, {
        sourceRevision: candidate,
        currentBaseSha: base,
      }),
    ).toThrow(/exact-identity GPT-6 Luna Max/u);

    const stalePass = structuredClone(status);
    stalePass.epoch.state.review_history.push({
      candidate_sha: 'f'.repeat(40),
      reviewed_base_sha: base,
      verdict: 'PASS',
      reviewer_id: 'gpt-6-luna-max-run95-pr136-round2',
    });
    expect(() =>
      assertG04CandidateReviewGate(stalePass, pr, {
        sourceRevision: candidate,
        currentBaseSha: base,
      }),
    ).toThrow(/exact-identity GPT-6 Luna Max/u);

    const failedCheck = structuredClone(pr);
    const check = failedCheck.statusCheckRollup[0];
    if (!check) throw new Error('Expected the fixture CI record.');
    check.conclusion = 'FAILURE';
    expect(() =>
      assertG04CandidateReviewGate(status, failedCheck, {
        sourceRevision: candidate,
        currentBaseSha: base,
      }),
    ).toThrow(/GPT-6 Luna Max/u);
  });

  it('requires a durable Harness CLAIMED disposition before the runner can execute the query', () => {
    const { status, pr } = gateInput();
    const claimId = 'g04-run-95-pr-136-aaaaaaaaaaaa-1';
    const bundleSha256 = 'c'.repeat(64);
    const keyPair = generateG04RunnerReceiptKeyPair();
    const gateOptions = {
      sourceRevision: candidate,
      currentBaseSha: base,
      allowClaimedDisposition: true,
      expectedClaimId: claimId,
      runnerReceiptPublicKey: keyPair.publicKeyBase64,
      bundleSha256,
    };

    expect(() => assertG04CandidateReviewGate(status, pr, gateOptions)).toThrow(
      /GPT-6 Luna Max PASS/u,
    );

    Object.assign(status.epoch.state.adversarial_preflight, {
      g04_one_shot_disposition: {
        state: 'CLAIMED',
        claimId,
        runNumber: 95,
        frontierId: 'G04',
        epochId: 'run95-g04-person-activity-global-one-shot-latch',
        prNumber,
        sourceCandidateSha: candidate,
        baseSha: base,
        ciSha: candidate,
        ciStatus: 'SUCCESS',
        reviewerId,
        bundleSha256,
        expectedArgumentsSha256: canonicalSha256(G04_EXPECTED_QUERY_ARGUMENTS),
        model: 'gpt-6-luna',
        reasoningEffort: 'max',
        toolName: 'bangumi.get_person_activity',
        argumentProfile: 'fixed-g04-person-13684-voice-tv-12m-48r-16d-8rows-v1',
        retryAllowed: false,
        runnerReceiptPublicKey: keyPair.publicKeyBase64,
        runnerReceiptPublicKeySha256: g04RunnerPublicKeySha256(keyPair.publicKeyBase64),
      },
    });
    expect(assertG04CandidateReviewGate(status, pr, gateOptions)).toMatchObject({
      prNumber,
      candidateSha: candidate,
      baseSha: base,
      reviewerId,
    });
  });

  it('refuses the fixed G04 query after a legacy terminal claim is reconciled', () => {
    for (const location of ['run', 'epoch'] as const) {
      const { status, pr } = gateInput();
      const tombstone = {
        state: 'LEGACY_TERMINAL_RECONCILED',
        sourceClaim: { state: 'INCONCLUSIVE', retryAllowed: false },
        queryInvoked: false,
        retryAllowed: false,
      };
      if (location === 'run') {
        Reflect.set(status.run.state, 'g04_one_shot_legacy_reconciliation', tombstone);
      } else {
        Reflect.set(
          status.epoch.state.adversarial_preflight,
          'g04_legacy_claim_reconciliation',
          tombstone,
        );
      }
      expect(() =>
        assertG04CandidateReviewGate(status, pr, {
          sourceRevision: candidate,
          currentBaseSha: base,
        }),
      ).toThrow(/G04 query requires the clean active exact Candidate/u);
    }
  });

  it('rejects a previously merged G04 PR even when its old reviewer identity is valid for that PR', () => {
    const { status, pr } = gateInput();
    status.run.state.active_epoch_pr = 128;
    status.epoch.number = 128;
    status.epoch.github_state = 'MERGED';
    status.epoch.state.pr_number = 128;
    status.epoch.state.review_history[0]!.reviewer_id = 'gpt-6-luna-max-run95-pr128-round1';
    expect(() =>
      assertG04CandidateReviewGate(status, pr, { sourceRevision: candidate, currentBaseSha: base }),
    ).toThrow(/exact-identity GPT-6 Luna Max/u);
  });

  it('only accepts the one supported invocation and keeps its claim under local Git metadata', () => {
    expect(validateRunnerArgs(['--help'])).toBe('help');
    expect(() => validateRunnerArgs(['--run', '95'])).toThrow(/Harness-owned/u);
    expect(canonicalG04ClaimPath()).toMatch(
      /[\\/]\.git[\\/]pariya-agent-state[\\/]g04-run95-one-shot-claim\.json$/u,
    );
    expect(Object.hasOwn(g04Runner, 'createG04OneShotClaim')).toBe(false);
  });
});

describe('G04 report-writer outcome recovery', () => {
  it('reconciles a validated report created before the writer exits unsuccessfully', () => {
    const directory = mkdtempSync(join(tmpdir(), 'g04-writer-outcome-'));
    const reportPath = join(directory, 'report.json');
    try {
      writeFileSync(reportPath, '{"sanitized":true}\n', 'utf8');
      const outcome = resolveG04ReportWriterOutcome(
        { exitCode: 1, output: null },
        { reportExists: existsSync(reportPath), reportValid: true },
      );
      expect(outcome).toEqual({ state: 'REPORT_WRITTEN', recovered: true });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('does not record inconclusive while any unvalidated report artifact exists', () => {
    const directory = mkdtempSync(join(tmpdir(), 'g04-writer-conflict-'));
    const reportPath = join(directory, 'report.json');
    try {
      writeFileSync(reportPath, '{"partial":', 'utf8');
      const outcome = resolveG04ReportWriterOutcome(
        { exitCode: 1, output: null },
        { reportExists: existsSync(reportPath), reportValid: false },
      );
      expect(outcome).toEqual({ state: 'REPORT_ARTIFACT_CONFLICT_PENDING', recovered: false });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('records an inconclusive writer result only when no report artifact exists', () => {
    const directory = mkdtempSync(join(tmpdir(), 'g04-writer-empty-'));
    const reportPath = join(directory, 'report.json');
    try {
      const outcome = resolveG04ReportWriterOutcome(
        { exitCode: 1, output: null },
        { reportExists: existsSync(reportPath), reportValid: false },
      );
      expect(outcome).toEqual({ state: 'INCONCLUSIVE', recovered: false });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
