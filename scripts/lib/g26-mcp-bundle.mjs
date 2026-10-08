import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIST_RELATIVE_PATHS = ['apps/mcp/dist'];
const G26_BUNDLE_ATTESTATION_PATH = 'docs/product/g26-mcp-bundle-attestation.json';
const GIT_REPOSITORY_OVERRIDE_KEYS = new Set([
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_COMMON_DIR',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_CEILING_DIRECTORIES',
  'GIT_DISCOVERY_ACROSS_FILESYSTEM',
  'GIT_NAMESPACE',
  'GIT_PREFIX',
]);

export function sanitizeGitRepositoryEnvironment(source = process.env) {
  const environment = { ...source };
  for (const key of Object.keys(environment)) {
    if (
      GIT_REPOSITORY_OVERRIDE_KEYS.has(key) ||
      key === 'GIT_CONFIG' ||
      key.startsWith('GIT_CONFIG_')
    ) {
      delete environment[key];
    }
  }
  environment.GIT_CONFIG_GLOBAL = os.devNull;
  environment.GIT_CONFIG_SYSTEM = os.devNull;
  environment.GIT_CONFIG_NOSYSTEM = '1';
  return environment;
}

export function gitRepositoryText(root, args, sourceEnvironment = process.env) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    env: sanitizeGitRepositoryEnvironment(sourceEnvironment),
  }).trim();
}

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

export function assertG26McpBundleAttestationMatches(bundleSha256, attestationSha256) {
  if (
    typeof bundleSha256 !== 'string' ||
    !/^[0-9a-f]{64}$/u.test(bundleSha256) ||
    typeof attestationSha256 !== 'string' ||
    !/^[0-9a-f]{64}$/u.test(attestationSha256) ||
    bundleSha256 !== attestationSha256
  ) {
    throw new Error('Built G26 MCP bundle does not match its exact-Candidate attestation.');
  }
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
