import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const DIST_RELATIVE_PATHS = ['apps/mcp/dist'];
const G26_BUNDLE_ATTESTATION_PATH = 'docs/product/g26-mcp-bundle-attestation.json';

export function readG26McpBundleAttestation(root) {
  const attestation = JSON.parse(
    readFileSync(path.join(path.resolve(root), G26_BUNDLE_ATTESTATION_PATH), 'utf8'),
  );
  if (
    !attestation ||
    typeof attestation !== 'object' ||
    Array.isArray(attestation) ||
    Object.keys(attestation).sort().join(',') !== 'bundleSha256,kind,schemaVersion' ||
    attestation.schemaVersion !== 1 ||
    attestation.kind !== 'g26-mcp-runtime-bundle-attestation-v1' ||
    typeof attestation.bundleSha256 !== 'string' ||
    !/^[0-9a-f]{64}$/u.test(attestation.bundleSha256)
  ) {
    throw new Error('G26 Candidate MCP bundle attestation is missing or invalid.');
  }
  return attestation.bundleSha256;
}

export function computeMcpBundleSha256(root) {
  const absoluteRoot = path.resolve(root);
  const packageRoot = path.join(absoluteRoot, 'packages');
  const packageDirectories = readdirSync(packageRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join('packages', entry.name, 'dist'));
  const relativeFiles = [];

  for (const relativeDirectory of [...DIST_RELATIVE_PATHS, ...packageDirectories]) {
    const absoluteDirectory = path.join(absoluteRoot, relativeDirectory);
    if (!statExists(absoluteDirectory)) continue;
    collectFiles(absoluteRoot, absoluteDirectory, relativeFiles);
  }

  relativeFiles.sort();
  if (relativeFiles.length === 0) {
    throw new Error('G26 MCP build output is missing; build the exact Candidate first.');
  }

  const digest = createHash('sha256');
  for (const relativeFile of relativeFiles) {
    digest.update(relativeFile, 'utf8');
    digest.update('\0', 'utf8');
    digest.update(readFileSync(path.join(absoluteRoot, relativeFile)));
    digest.update('\0', 'utf8');
  }
  return digest.digest('hex');
}

function statExists(filePath) {
  try {
    return statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function collectFiles(root, directory, output) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectFiles(root, absolutePath, output);
    } else if (entry.isFile()) {
      output.push(path.relative(root, absolutePath).split(path.sep).join('/'));
    }
  }
}
