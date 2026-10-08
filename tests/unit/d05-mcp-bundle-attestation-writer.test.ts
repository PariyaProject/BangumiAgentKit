import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeD05McpBundleAttestation } from '../../scripts/acceptance/write-d05-mcp-bundle-attestation.mjs';
import {
  computeMcpBundleSha256,
  D05_MCP_BUNDLE_ATTESTATION_KIND,
  D05_MCP_BUNDLE_ATTESTATION_PATH,
  readD05McpBundleAttestation,
} from '../../scripts/lib/d05-mcp-bundle.mjs';

function createCandidate(existingBundleSha256: string) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'd05-bundle-attestation-'));
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '--quiet');
  git('config', 'user.name', 'D05 bundle test');
  git('config', 'user.email', 'd05-bundle-test@example.invalid');
  mkdirSync(path.join(root, 'apps/mcp/dist'), { recursive: true });
  mkdirSync(path.join(root, 'packages/tools/dist'), { recursive: true });
  writeFileSync(path.join(root, 'apps/mcp/dist/server.js'), 'test bundle\n');
  writeFileSync(path.join(root, 'packages/tools/dist/index.js'), 'test tools\n');
  const attestationPath = path.join(root, D05_MCP_BUNDLE_ATTESTATION_PATH);
  mkdirSync(path.dirname(attestationPath), { recursive: true });
  writeFileSync(
    attestationPath,
    `${JSON.stringify({
      schemaVersion: 1,
      kind: D05_MCP_BUNDLE_ATTESTATION_KIND,
      bundleSha256: existingBundleSha256,
    })}\n`,
  );
  git('add', '-A');
  git('commit', '--quiet', '-m', 'test: create D05 candidate');
  return root;
}

function withMockPnpm(action: () => void) {
  const binDirectory = mkdtempSync(path.join(os.tmpdir(), 'd05-test-bin-'));
  const pnpmPath = path.join(binDirectory, 'pnpm');
  writeFileSync(pnpmPath, '#!/bin/sh\nexit 0\n');
  chmodSync(pnpmPath, 0o755);
  const previousPath = process.env.PATH;
  process.env.PATH = `${binDirectory}${path.delimiter}${previousPath ?? ''}`;
  try {
    action();
  } finally {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    rmSync(binDirectory, { recursive: true, force: true });
  }
}

describe('D05 MCP bundle attestation writer', () => {
  it('refreshes a stale bundle hash only from a clean exact Candidate', () => {
    const root = createCandidate('a'.repeat(64));
    try {
      withMockPnpm(() => {
        const result = writeD05McpBundleAttestation(root);
        const expectedBundleSha256 = computeMcpBundleSha256(root);
        expect(result).toMatchObject({
          state: 'UPDATED',
          bundleSha256: expectedBundleSha256,
        });
        expect(readD05McpBundleAttestation(root)).toBe(expectedBundleSha256);
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('leaves a matching attestation unchanged', () => {
    const root = createCandidate('a'.repeat(64));
    try {
      const bundleSha256 = computeMcpBundleSha256(root);
      writeFileSync(
        path.join(root, D05_MCP_BUNDLE_ATTESTATION_PATH),
        `${JSON.stringify({
          schemaVersion: 1,
          kind: D05_MCP_BUNDLE_ATTESTATION_KIND,
          bundleSha256,
        })}\n`,
      );
      execFileSync('git', ['add', D05_MCP_BUNDLE_ATTESTATION_PATH], { cwd: root });
      execFileSync('git', ['commit', '--quiet', '-m', 'build: attest current D05 bundle'], {
        cwd: root,
      });
      const headBefore = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: root,
        encoding: 'utf8',
      }).trim();

      withMockPnpm(() => {
        expect(writeD05McpBundleAttestation(root)).toMatchObject({
          state: 'ALREADY_CURRENT',
          bundleSha256,
        });
      });

      expect(
        execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      ).toBe(headBefore);
      expect(
        execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(),
      ).toBe('');
      expect(readD05McpBundleAttestation(root)).toBe(bundleSha256);
      expect(readFileSync(path.join(root, D05_MCP_BUNDLE_ATTESTATION_PATH), 'utf8')).toContain(
        bundleSha256,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
