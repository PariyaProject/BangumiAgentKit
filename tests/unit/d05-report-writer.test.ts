import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assertD05ReportCandidate,
  writeD05AgentMcpReport,
} from '../../scripts/acceptance/write-d05-agent-mcp-report.mjs';
import { createD05OneShotClaim } from '../../scripts/acceptance/run-d05-codex-agent-mcp.mjs';
import {
  computeMcpBundleSha256,
  D05_MCP_BUNDLE_ATTESTATION_KIND,
  D05_MCP_BUNDLE_ATTESTATION_PATH,
} from '../../scripts/lib/d05-mcp-bundle.mjs';

function createCandidate() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'd05-report-candidate-'));
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

  git('init', '--quiet');
  git('config', 'user.name', 'D05 report test');
  git('config', 'user.email', 'd05-report-test@example.invalid');
  mkdirSync(path.join(root, 'apps/mcp/dist'), { recursive: true });
  mkdirSync(path.join(root, 'packages/tools/dist'), { recursive: true });
  writeFileSync(path.join(root, 'apps/mcp/dist/server.js'), 'test bundle\n');
  writeFileSync(path.join(root, 'packages/tools/dist/index.js'), 'test tools\n');

  const bundleSha256 = computeMcpBundleSha256(root);
  const attestationPath = path.join(root, D05_MCP_BUNDLE_ATTESTATION_PATH);
  mkdirSync(path.dirname(attestationPath), { recursive: true });
  writeFileSync(
    attestationPath,
    `${JSON.stringify({
      schemaVersion: 1,
      kind: D05_MCP_BUNDLE_ATTESTATION_KIND,
      bundleSha256,
    })}\n`,
  );
  git('add', '-A');
  git('commit', '--quiet', '-m', 'test: create D05 candidate');

  return { root, bundleSha256, sourceRevision: git('rev-parse', 'HEAD') };
}

describe('D05 sanitized report writer', () => {
  it('rejects direct synthetic report inputs without the canonical one-shot claim', () => {
    const candidate = createCandidate();
    try {
      expect(() =>
        writeD05AgentMcpReport(
          {
            sourceRevision: candidate.sourceRevision,
            bundleSha256: candidate.bundleSha256,
            processExitCode: 0,
            resultStatus: 'SUCCESS',
            allowedCallCount: 1,
          },
          candidate.root,
        ),
      ).toThrow(/canonical create-once query claim/u);
      expect(
        existsSync(
          path.join(
            candidate.root,
            'docs/live-probes/d05-current-season-multitag-heat-agent-mcp-run95.json',
          ),
        ),
      ).toBe(false);
    } finally {
      rmSync(candidate.root, { recursive: true, force: true });
    }
  });

  it('requires the exact clean Candidate, bundle attestation, and matching create-once claim', () => {
    const candidate = createCandidate();
    try {
      const claimPath = path.join(
        candidate.root,
        '.git/pariya-agent-state/d05-run95-one-shot-claim.json',
      );
      expect(() =>
        assertD05ReportCandidate(
          { sourceRevision: candidate.sourceRevision, bundleSha256: candidate.bundleSha256 },
          candidate.root,
        ),
      ).toThrow(/canonical create-once query claim/u);

      createD05OneShotClaim(
        claimPath,
        candidate.sourceRevision,
        candidate.bundleSha256,
        candidate.root,
      );
      expect(
        assertD05ReportCandidate(
          { sourceRevision: candidate.sourceRevision, bundleSha256: candidate.bundleSha256 },
          candidate.root,
        ),
      ).toEqual({
        sourceRevision: candidate.sourceRevision,
        bundleSha256: candidate.bundleSha256,
      });
      expect(() =>
        assertD05ReportCandidate(
          { sourceRevision: candidate.sourceRevision, bundleSha256: 'f'.repeat(64) },
          candidate.root,
        ),
      ).toThrow(/exact attested MCP bundle/u);
    } finally {
      rmSync(candidate.root, { recursive: true, force: true });
    }
  });
});
