import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { C07_RENDER_COMPARISON_OFFLINE_V2_PROFILE_ID } from './c07-render-comparison-offline-profile.mjs';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_PNG_BYTES = 5_000_000;
const TEMP_ARTIFACT_SUFFIX = '.c07-v2-artifact.png';

function assertV2Profile(profileId) {
  if (profileId !== C07_RENDER_COMPARISON_OFFLINE_V2_PROFILE_ID) {
    throw new Error('Local C07 visual capture is restricted to the exact v2 profile.');
  }
}

export function c07OfflineVisualArtifactTempPath(profileId, summaryPath) {
  assertV2Profile(profileId);
  if (typeof summaryPath !== 'string' || summaryPath.length === 0) {
    throw new Error('Local C07 visual capture requires an exact temporary summary path.');
  }
  const absoluteSummaryPath = path.resolve(summaryPath);
  const temporaryRoot = path.resolve(os.tmpdir()) + path.sep;
  if (!absoluteSummaryPath.startsWith(temporaryRoot)) {
    throw new Error('Local C07 visual capture is restricted to the temporary directory.');
  }
  return `${absoluteSummaryPath}${TEMP_ARTIFACT_SUFFIX}`;
}

export function writeC07OfflineVisualArtifactTempCopy({ profileId, summaryPath, pngBytes }) {
  const artifactPath = c07OfflineVisualArtifactTempPath(profileId, summaryPath);
  if (
    !Buffer.isBuffer(pngBytes) ||
    pngBytes.length < PNG_SIGNATURE.length ||
    pngBytes.length > MAX_PNG_BYTES ||
    !pngBytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  ) {
    throw new Error('Local C07 visual capture requires a bounded PNG artifact.');
  }
  let descriptor;
  try {
    descriptor = openSync(artifactPath, 'wx', 0o600);
    writeFileSync(descriptor, pngBytes);
    closeSync(descriptor);
  } catch (error) {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        /* Preserve the create-only refusal. */
      }
    }
    throw error;
  }
  return artifactPath;
}

function ensureLocalArtifactDirectory(root) {
  const repositoryRoot = realpathSync(root);
  let current = repositoryRoot;
  for (const component of ['.artifacts', 'render']) {
    current = path.join(current, component);
    if (existsSync(current)) {
      const stat = lstatSync(current);
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new Error('Local C07 visual output directory is not a regular directory.');
      }
    } else {
      mkdirSync(current, { mode: 0o700 });
    }
  }
  return { repositoryRoot, outputDirectory: current };
}

export function persistC07OfflineVisualArtifactForInspection({
  profileId,
  summaryPath,
  root,
  sourceRevision,
  expectedSha256,
  expectedByteLength,
}) {
  const tempPath = c07OfflineVisualArtifactTempPath(profileId, summaryPath);
  if (
    typeof sourceRevision !== 'string' ||
    !/^[0-9a-f]{40}$/u.test(sourceRevision) ||
    typeof expectedSha256 !== 'string' ||
    !/^[0-9a-f]{64}$/u.test(expectedSha256) ||
    !Number.isSafeInteger(expectedByteLength) ||
    expectedByteLength <= 0 ||
    expectedByteLength > MAX_PNG_BYTES
  ) {
    throw new Error('Local C07 visual metadata is invalid.');
  }
  const pngBytes = readFileSync(tempPath);
  const sha256 = createHash('sha256').update(pngBytes).digest('hex');
  if (
    pngBytes.length !== expectedByteLength ||
    sha256 !== expectedSha256 ||
    !pngBytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  ) {
    throw new Error('Local C07 visual artifact does not match sanitized PNG metadata.');
  }

  const { repositoryRoot, outputDirectory } = ensureLocalArtifactDirectory(root);
  const absolutePath = path.join(
    outputDirectory,
    `c07-render-comparison-v2-mcp-${sourceRevision.slice(0, 12)}.png`,
  );
  const relativePath = path.relative(repositoryRoot, absolutePath).split(path.sep).join('/');
  let descriptor;
  try {
    descriptor = openSync(absolutePath, 'wx', 0o600);
    writeFileSync(descriptor, pngBytes);
    closeSync(descriptor);
  } catch (error) {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        /* Preserve the create-only refusal. */
      }
    }
    throw error;
  }
  return { absolutePath, relativePath, byteLength: pngBytes.length, sha256 };
}
