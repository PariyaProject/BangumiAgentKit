import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assertD05CandidateReviewGate,
  buildCodexExecArgs,
  createD05OneShotClaim,
  mandatoryChecksSuccessful,
  sanitizeD05CodexEnvironment,
  validateRunnerArgs,
} from '../../scripts/acceptance/run-d05-codex-agent-mcp.mjs';
import { readD05McpBundleAttestation } from '../../scripts/lib/d05-mcp-bundle.mjs';

const candidate = 'a'.repeat(40);
const base = 'b'.repeat(40);
const branch = 'codex/epoch-discovery-current-season-multitag-heat';
const prNumber = 123;

function successfulChecks() {
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

function gateState() {
  const epoch = {
    state: 'REVIEW_PASSED',
    pr_number: prNumber,
    branch,
    base_branch: 'master',
    base_sha: base,
    candidate_sha: candidate,
    ci: { sha: candidate, status: 'SUCCESS' },
    review_pass_sha: candidate,
    advances_frontier_ids: ['D05'],
    review_history: [{ candidate_sha: candidate, verdict: 'PASS' }],
    scope_closure: {
      related_work_remaining: false,
      why_not_review_earlier: 'The coherent D05 work packages are complete.',
      why_not_extend_further: 'Community trend questions use a separate source and objective.',
    },
    adversarial_preflight: {
      completed: true,
      summary: 'Bounds, failures, and disclosure were falsified.',
    },
  };
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
      epoch: { number: prNumber, github_state: 'OPEN', state: epoch },
    },
    pr: {
      state: 'OPEN',
      isDraft: false,
      headRefOid: candidate,
      headRefName: branch,
      baseRefName: 'master',
      statusCheckRollup: successfulChecks(),
    },
  };
}

describe('D05 Codex one-tool Agent/MCP runner', () => {
  it('pins GPT-6 Luna Max, exact query arguments, read-only mode, and a single MCP tool', () => {
    const args = buildCodexExecArgs({
      root: '/repo',
      nodePath: '/usr/bin/node',
      serverScript: '/repo/apps/mcp/d05-one-tool-mcp-server.mjs',
      summaryPath: '/tmp/d05/summary.json',
      sourceRevision: candidate,
      bundleSha256: 'c'.repeat(64),
    });
    const configs = args.flatMap((item, index) => (item === '--config' ? [args[index + 1]!] : []));

    expect(args).toContain('--strict-config');
    expect(args).toContain('--ephemeral');
    expect(args).toContain('--json');
    expect(args).toContain('--model');
    expect(args).toContain('gpt-6-luna');
    expect(args).toContain('read-only');
    expect(configs).toContain('model_reasoning_effort="max"');
    expect(configs).toContain('features.shell_tool=false');
    expect(configs).toContain('features.multi_agent=false');
    expect(configs).toContain('web_search="disabled"');
    expect(configs).toContain(
      'mcp_servers.bgk_d05_one_tool.enabled_tools=["bangumi.query_subjects"]',
    );
    expect(configs.some((value) => value.includes('d05-one-tool-mcp-server.mjs'))).toBe(true);
    expect(args.at(-1)).toContain('season":"current');
    expect(args.at(-1)).toContain('"校园","恋爱"');
  });

  it('allows only an explicit --run 95 and requires the exact reviewed Candidate with all CI gates', () => {
    expect(validateRunnerArgs(['--help'])).toBe('help');
    expect(validateRunnerArgs(['--run', '95'])).toBe('run');
    expect(() => validateRunnerArgs(['--run'])).toThrow(/exact-Candidate CI/u);
    expect(() => validateRunnerArgs(['--run', '95', '--force'])).toThrow(/exact-Candidate CI/u);

    const { status, pr } = gateState();
    expect(
      assertD05CandidateReviewGate(status, pr, { sourceRevision: candidate, currentBaseSha: base }),
    ).toEqual({
      prNumber,
      candidateSha: candidate,
      baseSha: base,
    });
    expect(mandatoryChecksSuccessful(successfulChecks())).toBe(true);
    expect(mandatoryChecksSuccessful([...successfulChecks(), successfulChecks()[0]])).toBe(false);

    const wrongReview = structuredClone(status);
    wrongReview.epoch.state.review_pass_sha = '0'.repeat(40);
    expect(() =>
      assertD05CandidateReviewGate(wrongReview, pr, {
        sourceRevision: candidate,
        currentBaseSha: base,
      }),
    ).toThrow(/exact-Candidate current-base CI/u);
    expect(() =>
      assertD05CandidateReviewGate(status, pr, {
        sourceRevision: candidate,
        currentBaseSha: '0'.repeat(40),
      }),
    ).toThrow(/exact-Candidate current-base CI/u);
  });

  it('creates a create-once local claim bound to the exact Candidate and runtime bundle', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'd05-one-shot-claim-'));
    try {
      execFileSync('git', ['init', '--quiet'], { cwd: root });
      const claimPath = path.join(root, '.git', 'pariya-agent-state', 'd05-claim.json');
      const claim = createD05OneShotClaim(claimPath, candidate, 'd'.repeat(64), root);
      const stored = JSON.parse(readFileSync(claimPath, 'utf8')) as Record<string, unknown>;

      expect(claim).toMatchObject({
        runNumber: 95,
        frontierId: 'D05',
        state: 'CLAIMED',
        sourceRevision: candidate,
        bundleSha256: 'd'.repeat(64),
      });
      expect(stored).toEqual(claim);
      expect(() => createD05OneShotClaim(claimPath, candidate, 'd'.repeat(64), root)).toThrow(
        /already exists/u,
      );
      expect(() =>
        createD05OneShotClaim(path.join(root, 'outside.json'), candidate, 'd'.repeat(64), root),
      ).toThrow(/Git metadata/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reads only the D05 runtime bundle attestation shape and kind', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'd05-bundle-attestation-'));
    const attestationPath = path.join(root, 'docs/product/d05-mcp-bundle-attestation.json');
    try {
      mkdirSync(path.dirname(attestationPath), { recursive: true });
      writeFileSync(
        attestationPath,
        JSON.stringify({
          schemaVersion: 1,
          kind: 'd05-mcp-runtime-bundle-attestation-v1',
          bundleSha256: 'e'.repeat(64),
        }),
      );
      expect(readD05McpBundleAttestation(root)).toBe('e'.repeat(64));

      writeFileSync(
        attestationPath,
        JSON.stringify({
          schemaVersion: 1,
          kind: 'g26-mcp-runtime-bundle-attestation-v1',
          bundleSha256: 'e'.repeat(64),
        }),
      );
      expect(() => readD05McpBundleAttestation(root)).toThrow(/missing or invalid/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps the local one-shot environment variable out of the Codex child', () => {
    const childEnvironment = sanitizeD05CodexEnvironment({
      PATH: '/usr/bin',
      PARIYA_D05_RUN95_CLAIM_FILE: '/private/d05-claim.json',
      BANGUMI_ACCESS_TOKEN: 'secret',
    });

    expect(childEnvironment).toEqual({
      PATH: '/usr/bin',
      GIT_CONFIG_GLOBAL: os.devNull,
      GIT_CONFIG_SYSTEM: os.devNull,
      GIT_CONFIG_NOSYSTEM: '1',
    });
  });
});
