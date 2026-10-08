import { closeSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeMcpBundleSha256, gitRepositoryText } from '../lib/g26-mcp-bundle.mjs';
import { S04_MCP_BUNDLE_ATTESTATION_PATH } from '../lib/s04-mcp-bundle.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function writeS04McpBundleAttestation(root = ROOT) {
  const sourceRevision = gitRepositoryText(root, ['rev-parse', 'HEAD']);
  if (
    !/^[0-9a-f]{40}$/u.test(sourceRevision) ||
    gitRepositoryText(root, ['status', '--porcelain'])
  ) {
    throw new Error('Build the attestation from a clean, committed S04 Candidate.');
  }
  const bundleSha256 = computeMcpBundleSha256(root);
  if (gitRepositoryText(root, ['rev-parse', 'HEAD']) !== sourceRevision) {
    throw new Error('S04 Candidate changed while computing the runtime bundle attestation.');
  }
  const pathName = path.join(root, S04_MCP_BUNDLE_ATTESTATION_PATH);
  const temporaryPath = `${pathName}.${process.pid}.tmp`;
  const payload = {
    schemaVersion: 1,
    kind: 's04-mcp-runtime-bundle-attestation-v1',
    bundleSha256,
  };
  let descriptor;
  try {
    descriptor = openSync(temporaryPath, 'wx', 0o644);
    writeFileSync(descriptor, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    closeSync(descriptor);
    renameSync(temporaryPath, pathName);
  } catch (error) {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        /* Preserve the write failure. */
      }
    }
    throw error;
  }
  const written = JSON.parse(readFileSync(pathName, 'utf8'));
  if (
    gitRepositoryText(root, ['rev-parse', 'HEAD']) !== sourceRevision ||
    written.kind !== payload.kind ||
    written.bundleSha256 !== bundleSha256
  ) {
    throw new Error('S04 runtime bundle attestation did not bind the unchanged Candidate.');
  }
  return payload;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(`${JSON.stringify(writeS04McpBundleAttestation())}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'S04 attestation failed.'}\n`);
    process.exitCode = 1;
  }
}
