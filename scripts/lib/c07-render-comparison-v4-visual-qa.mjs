import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

export const C07_V4_VISUAL_QA_MANIFEST_PATH =
  'docs/research/run95-c07-render-comparison-offline-agent-mcp-matrix-v4-visual-qa-2026-10-24-v36.json';
export const C07_V4_VISUAL_QA_ARTIFACT_DIRECTORY =
  '.artifacts/render/c07-cohort-comparison-v4-visual-qa-candidate-bound-20261024-v36';

const PROFILE_ID = 'c07-render-comparison-offline-agent-mcp-matrix-v4';
const WIDTHS = [320, 360, 520, 640, 960];
const DESIGN_PACKS = ['warm-editorial', 'clean-gallery', 'graphic-zine'];
const THEMES = ['bangumi-light', 'bangumi-dark'];
const CASES = ['complete-two-cohort', 'partial-two-cohort'];
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_HEIGHT = 5000;
const SOURCE_INPUT_PATHS = [
  'pnpm-lock.yaml',
  'packages/bangumi-core/package.json',
  'packages/bangumi-openapi/package.json',
  'packages/bangumi-transport/package.json',
  'packages/discovery/package.json',
  'packages/provider-core/package.json',
  'packages/renderer/package.json',
  'packages/renderer/tsconfig.json',
  'packages/tools/package.json',
  'scripts/acceptance/generate-c07-render-comparison-offline-v4-visuals.ts',
  'scripts/lib/c07-render-comparison-offline-fixture.d.mts',
  'scripts/lib/c07-render-comparison-offline-fixture.mjs',
  'scripts/lib/c07-render-comparison-offline-profile.d.mts',
  'scripts/lib/c07-render-comparison-offline-profile.mjs',
  'scripts/lib/c07-render-comparison-v4-visual-qa.d.mts',
  'scripts/lib/c07-render-comparison-v4-visual-qa.mjs',
  'tsconfig.base.json',
];
const SOURCE_DIRECTORIES = [
  'packages/bangumi-core/src',
  'packages/bangumi-openapi/src',
  'packages/bangumi-transport/src',
  'packages/discovery/src',
  'packages/provider-core/src',
  'packages/renderer/assets/illustrations',
  'packages/renderer/assets/fonts',
  'packages/renderer/src',
  'packages/tools/src',
];

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function collectFiles(root, relativeDirectory, output) {
  const absoluteDirectory = path.join(root, relativeDirectory);
  for (const entry of readdirSync(absoluteDirectory, { withFileTypes: true })) {
    const relativePath = path.join(relativeDirectory, entry.name).split(path.sep).join('/');
    if (entry.isDirectory()) collectFiles(root, relativePath, output);
    else if (entry.isFile()) output.push(relativePath);
  }
}

export function computeC07V4VisualQaGenerationSourceSha256(root) {
  if (typeof root !== 'string') throw new TypeError('C07 v4 visual QA source root is invalid.');
  const absoluteRoot = path.resolve(root);
  const files = [...SOURCE_INPUT_PATHS];
  for (const directory of SOURCE_DIRECTORIES) collectFiles(absoluteRoot, directory, files);
  files.sort();
  const digest = createHash('sha256');
  for (const relativePath of files) {
    digest.update(relativePath, 'utf8');
    digest.update('\0', 'utf8');
    digest.update(readFileSync(path.join(absoluteRoot, relativePath)));
    digest.update('\0', 'utf8');
  }
  return digest.digest('hex');
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  return isPlainObject(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}

function isIsoTimestamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value);
}

function validPngHeader(bytes, expectedWidth, expectedHeight) {
  return (
    Buffer.isBuffer(bytes) &&
    bytes.length >= 24 &&
    bytes.subarray(0, 8).equals(PNG_SIGNATURE) &&
    bytes.readUInt32BE(8) === 13 &&
    bytes.subarray(12, 16).toString('ascii') === 'IHDR' &&
    bytes.readUInt32BE(16) === expectedWidth &&
    bytes.readUInt32BE(20) === expectedHeight
  );
}

function expectedImages() {
  return CASES.flatMap((visualCase) =>
    DESIGN_PACKS.flatMap((designPack) =>
      THEMES.flatMap((theme) =>
        WIDTHS.map((width) => ({
          case: visualCase,
          designPack,
          theme,
          cssWidth: width,
          file: `${visualCase}-${designPack}-${theme}-${width}.png`,
        })),
      ),
    ),
  );
}

function validateManifestShape(manifest) {
  if (
    !hasExactKeys(manifest, [
      'schemaVersion',
      'profileId',
      'artifactDirectory',
      'cssWidths',
      'designPacks',
      'themes',
      'deviceScaleFactor',
      'buildBundleSha256',
      'generationSourceSha256',
      'reviewAcknowledgement',
      'images',
    ]) ||
    manifest.schemaVersion !== 1 ||
    manifest.profileId !== PROFILE_ID ||
    manifest.artifactDirectory !== C07_V4_VISUAL_QA_ARTIFACT_DIRECTORY ||
    JSON.stringify(manifest.cssWidths) !== JSON.stringify(WIDTHS) ||
    JSON.stringify(manifest.designPacks) !== JSON.stringify(DESIGN_PACKS) ||
    JSON.stringify(manifest.themes) !== JSON.stringify(THEMES) ||
    manifest.deviceScaleFactor !== 2 ||
    typeof manifest.buildBundleSha256 !== 'string' ||
    !/^[0-9a-f]{64}$/u.test(manifest.buildBundleSha256) ||
    typeof manifest.generationSourceSha256 !== 'string' ||
    !/^[0-9a-f]{64}$/u.test(manifest.generationSourceSha256) ||
    !hasExactKeys(manifest.reviewAcknowledgement, [
      'decision',
      'allImagesIndividuallyInspected',
      'reviewedBy',
      'reviewedAt',
      'summary',
    ]) ||
    manifest.reviewAcknowledgement.decision !== 'PASS' ||
    manifest.reviewAcknowledgement.allImagesIndividuallyInspected !== true ||
    manifest.reviewAcknowledgement.reviewedBy !== 'Codex' ||
    !isIsoTimestamp(manifest.reviewAcknowledgement.reviewedAt) ||
    typeof manifest.reviewAcknowledgement.summary !== 'string' ||
    manifest.reviewAcknowledgement.summary.length === 0 ||
    manifest.reviewAcknowledgement.summary.length > 600 ||
    !Array.isArray(manifest.images)
  ) {
    return false;
  }

  const expected = new Map(expectedImages().map((image) => [image.file, image]));
  if (manifest.images.length !== expected.size) return false;
  const seen = new Set();
  for (const image of manifest.images) {
    const identity = expected.get(image?.file);
    if (
      !identity ||
      seen.has(image.file) ||
      !hasExactKeys(image, [
        'case',
        'designPack',
        'theme',
        'file',
        'cssWidth',
        'pixelWidth',
        'pixelHeight',
        'byteLength',
        'sha256',
        'visualReview',
      ]) ||
      image.case !== identity.case ||
      image.designPack !== identity.designPack ||
      image.theme !== identity.theme ||
      image.cssWidth !== identity.cssWidth ||
      image.pixelWidth !== identity.cssWidth * 2 ||
      !Number.isSafeInteger(image.pixelHeight) ||
      image.pixelHeight < 1 ||
      image.pixelHeight > MAX_IMAGE_HEIGHT ||
      !Number.isSafeInteger(image.byteLength) ||
      image.byteLength < 24 ||
      image.byteLength > MAX_IMAGE_BYTES ||
      typeof image.sha256 !== 'string' ||
      !/^[0-9a-f]{64}$/u.test(image.sha256) ||
      !hasExactKeys(image.visualReview, ['decision', 'finding']) ||
      image.visualReview.decision !== 'PASS' ||
      typeof image.visualReview.finding !== 'string' ||
      image.visualReview.finding.length === 0 ||
      image.visualReview.finding.length > 500
    ) {
      return false;
    }
    seen.add(image.file);
  }
  return seen.size === expected.size;
}

/** Verify the exact two-cohort render receipts before the C07 v4 one-shot claim. */
export function validateC07V4VisualQaEvidence({
  root,
  expectedManifestSha256,
  expectedBundleSha256,
  manifestPath = C07_V4_VISUAL_QA_MANIFEST_PATH,
} = {}) {
  try {
    if (
      typeof root !== 'string' ||
      !/^[0-9a-f]{64}$/u.test(expectedManifestSha256 ?? '') ||
      !/^[0-9a-f]{64}$/u.test(expectedBundleSha256 ?? '') ||
      typeof manifestPath !== 'string' ||
      path.isAbsolute(manifestPath) ||
      manifestPath.split(path.sep).includes('..')
    ) {
      return false;
    }

    const absoluteRoot = path.resolve(root);
    const manifestBytes = readFileSync(path.resolve(absoluteRoot, manifestPath));
    if (sha256(manifestBytes) !== expectedManifestSha256) return false;
    const manifest = JSON.parse(manifestBytes.toString('utf8'));
    if (
      !validateManifestShape(manifest) ||
      manifest.buildBundleSha256 !== expectedBundleSha256 ||
      manifest.generationSourceSha256 !== computeC07V4VisualQaGenerationSourceSha256(absoluteRoot)
    ) {
      return false;
    }

    const artifactDirectory = path.resolve(absoluteRoot, manifest.artifactDirectory);
    const realArtifactDirectory = realpathSync(artifactDirectory);
    const realRoot = realpathSync(absoluteRoot);
    if (realArtifactDirectory !== path.resolve(realRoot, C07_V4_VISUAL_QA_ARTIFACT_DIRECTORY)) {
      return false;
    }

    for (const image of manifest.images) {
      const imagePath = path.resolve(artifactDirectory, image.file);
      const realImagePath = realpathSync(imagePath);
      if (!realImagePath.startsWith(`${realArtifactDirectory}${path.sep}`)) return false;
      const bytes = readFileSync(realImagePath);
      if (
        bytes.length !== image.byteLength ||
        sha256(bytes) !== image.sha256 ||
        !validPngHeader(bytes, image.pixelWidth, image.pixelHeight)
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}
