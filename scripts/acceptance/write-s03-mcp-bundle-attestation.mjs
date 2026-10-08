import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeMcpBundleSha256,
  readS03McpBundleAttestation,
  S03_MCP_BUNDLE_ATTESTATION_KIND,
  S03_MCP_BUNDLE_ATTESTATION_PATH,
} from '../lib/s03-mcp-bundle.mjs';
import { gitRepositoryText, sanitizeGitRepositoryEnvironment } from '../lib/g26-mcp-bundle.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function writeS03McpBundleAttestation(root = ROOT) {
  const sourceRevision = gitRepositoryText(root, ['rev-parse', 'HEAD']);
  if (!/^[0-9a-f]{40}$/u.test(sourceRevision)) {
    throw new Error('S03 bundle attestation requires an exact Candidate commit.');
  }
  if (gitRepositoryText(root, ['status', '--porcelain'])) {
    throw new Error('S03 bundle attestation requires a clean Candidate checkout.');
  }
  const outputPath = path.join(root, S03_MCP_BUNDLE_ATTESTATION_PATH);
  const previousBytes = existsSync(outputPath) ? readFileSync(outputPath) : null;
  const previousSha = previousBytes ? readS03McpBundleAttestation(root) : null;
  const build = spawnSync('pnpm', ['build'], {
    cwd: root,
    env: sanitizeGitRepositoryEnvironment(),
    stdio: ['ignore', 'ignore', 'ignore'],
    timeout: 5 * 60 * 1000,
  });
  if (build.error || build.status !== 0) {
    throw new Error('Unable to build the S03 MCP runtime from the exact Candidate.');
  }
  if (
    gitRepositoryText(root, ['rev-parse', 'HEAD']) !== sourceRevision ||
    gitRepositoryText(root, ['status', '--porcelain']) ||
    (previousBytes && !readFileSync(outputPath).equals(previousBytes)) ||
    (!previousBytes && existsSync(outputPath))
  ) {
    throw new Error('Candidate changed or became dirty during the S03 bundle build.');
  }
  const bundleSha256 = computeMcpBundleSha256(root);
  if (previousSha === bundleSha256) {
    return { sourceRevision, bundleSha256, state: 'ALREADY_CURRENT' };
  }
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  writeFileSync(
    temporaryPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        kind: S03_MCP_BUNDLE_ATTESTATION_KIND,
        bundleSha256,
      },
      null,
      2,
    )}\n`,
    { mode: 0o644, flag: 'wx' },
  );
  renameSync(temporaryPath, outputPath);
  return {
    sourceRevision,
    bundleSha256,
    state: previousBytes ? 'UPDATED' : 'WRITTEN',
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(`${JSON.stringify(writeS03McpBundleAttestation())}\n`);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'S03 bundle attestation failed.'}\n`,
    );
    process.exitCode = 1;
  }
}
