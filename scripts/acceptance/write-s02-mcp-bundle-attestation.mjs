import { spawnSync } from 'node:child_process';
import { renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeMcpBundleSha256,
  S02_MCP_BUNDLE_ATTESTATION_PATH,
} from '../lib/s02-mcp-bundle.mjs';
import {
  gitRepositoryText,
  sanitizeGitRepositoryEnvironment,
} from '../lib/g26-mcp-bundle.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function writeS02McpBundleAttestation(root = ROOT) {
  const sourceRevision = gitRepositoryText(root, ['rev-parse', 'HEAD']);
  if (!/^[0-9a-f]{40}$/u.test(sourceRevision)) {
    throw new Error('S02 bundle attestation requires an exact Candidate commit.');
  }
  if (gitRepositoryText(root, ['status', '--porcelain'])) {
    throw new Error('S02 bundle attestation requires a clean Candidate checkout.');
  }
  const build = spawnSync('pnpm', ['build'], {
    cwd: root,
    env: sanitizeGitRepositoryEnvironment(),
    stdio: ['ignore', 'ignore', 'ignore'],
    timeout: 5 * 60 * 1000,
  });
  if (build.error || build.status !== 0) {
    throw new Error('Unable to build the S02 MCP runtime from the exact Candidate.');
  }
  if (
    gitRepositoryText(root, ['rev-parse', 'HEAD']) !== sourceRevision ||
    gitRepositoryText(root, ['status', '--porcelain'])
  ) {
    throw new Error('Candidate changed or became dirty during the S02 bundle build.');
  }
  const bundleSha256 = computeMcpBundleSha256(root);
  const outputPath = path.join(root, S02_MCP_BUNDLE_ATTESTATION_PATH);
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  const attestation = {
    schemaVersion: 1,
    kind: 's02-mcp-runtime-bundle-attestation-v1',
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
    process.stdout.write(`${JSON.stringify(writeS02McpBundleAttestation())}\n`);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'S02 bundle attestation failed.'}\n`,
    );
    process.exitCode = 1;
  }
}
