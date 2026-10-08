import { spawnSync } from 'node:child_process';
import { existsSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeMcpBundleSha256,
  D05_MCP_BUNDLE_ATTESTATION_PATH,
  D05_MCP_BUNDLE_ATTESTATION_KIND,
} from '../lib/d05-mcp-bundle.mjs';
import { gitRepositoryText, sanitizeGitRepositoryEnvironment } from '../lib/g26-mcp-bundle.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function writeD05McpBundleAttestation(root = ROOT) {
  const sourceRevision = gitRepositoryText(root, ['rev-parse', 'HEAD']);
  if (!/^[0-9a-f]{40}$/u.test(sourceRevision)) {
    throw new Error('D05 bundle attestation requires an exact Candidate commit.');
  }
  if (gitRepositoryText(root, ['status', '--porcelain'])) {
    throw new Error('D05 bundle attestation requires a clean Candidate checkout.');
  }
  const outputPath = path.join(root, D05_MCP_BUNDLE_ATTESTATION_PATH);
  if (existsSync(outputPath)) {
    throw new Error('D05 bundle attestation already exists; refusing to replace it.');
  }
  const build = spawnSync('pnpm', ['build'], {
    cwd: root,
    env: sanitizeGitRepositoryEnvironment(),
    stdio: ['ignore', 'ignore', 'ignore'],
    timeout: 5 * 60 * 1000,
  });
  if (build.error || build.status !== 0) {
    throw new Error('Unable to build the D05 MCP runtime from the exact Candidate.');
  }
  if (
    gitRepositoryText(root, ['rev-parse', 'HEAD']) !== sourceRevision ||
    gitRepositoryText(root, ['status', '--porcelain'])
  ) {
    throw new Error('Candidate changed or became dirty during the D05 bundle build.');
  }
  const bundleSha256 = computeMcpBundleSha256(root);
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  const attestation = {
    schemaVersion: 1,
    kind: D05_MCP_BUNDLE_ATTESTATION_KIND,
    bundleSha256,
  };
  writeFileSync(temporaryPath, `${JSON.stringify(attestation, null, 2)}\n`, {
    mode: 0o644,
    flag: 'wx',
  });
  renameSync(temporaryPath, outputPath);
  return { sourceRevision, bundleSha256 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(`${JSON.stringify(writeD05McpBundleAttestation())}\n`);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'D05 bundle attestation failed.'}\n`,
    );
    process.exitCode = 1;
  }
}
