import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  C07_V4_VISUAL_QA_ARTIFACT_DIRECTORY,
  C07_V4_VISUAL_QA_MANIFEST_PATH,
  computeC07V4VisualQaGenerationSourceSha256,
  validateC07V4VisualQaEvidence,
} from '../../scripts/lib/c07-render-comparison-v4-visual-qa.mjs';

const WIDTHS = [320, 360, 520, 640, 960];
const DESIGN_PACKS = ['warm-editorial', 'clean-gallery', 'graphic-zine'];
const THEMES = ['bangumi-light', 'bangumi-dark'];
const CASES = ['complete-two-cohort', 'partial-two-cohort'];
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function pngHeader(width, height) {
  const bytes = Buffer.alloc(24);
  PNG_SIGNATURE.copy(bytes);
  bytes.writeUInt32BE(13, 8);
  bytes.write('IHDR', 12, 'ascii');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

function createFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'c07-v4-visual-qa-'));
  const artifactDirectory = path.join(root, C07_V4_VISUAL_QA_ARTIFACT_DIRECTORY);
  const manifestPath = path.join(root, C07_V4_VISUAL_QA_MANIFEST_PATH);
  mkdirSync(artifactDirectory, { recursive: true });
  mkdirSync(path.dirname(manifestPath), { recursive: true });

  const sourcePaths = [
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
  for (const sourcePath of sourcePaths) {
    const absolutePath = path.join(root, sourcePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, `fixture source for ${sourcePath}`);
  }
  for (const directory of [
    'packages/bangumi-core/src',
    'packages/bangumi-openapi/src',
    'packages/bangumi-transport/src',
    'packages/discovery/src',
    'packages/provider-core/src',
    'packages/renderer/assets/illustrations',
    'packages/renderer/assets/fonts',
    'packages/renderer/src',
    'packages/tools/src',
  ]) {
    const absolutePath = path.join(root, directory, 'fixture.ts');
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, `fixture source for ${directory}`);
  }

  const images = [];
  for (const visualCase of CASES) {
    for (const designPack of DESIGN_PACKS) {
      for (const theme of THEMES) {
        for (const cssWidth of WIDTHS) {
          const file = `${visualCase}-${designPack}-${theme}-${cssWidth}.png`;
          const bytes = pngHeader(cssWidth * 2, 1200);
          writeFileSync(path.join(artifactDirectory, file), bytes);
          images.push({
            case: visualCase,
            designPack,
            theme,
            file,
            cssWidth,
            pixelWidth: cssWidth * 2,
            pixelHeight: 1200,
            byteLength: bytes.length,
            sha256: sha256(bytes),
            visualReview: {
              decision: 'PASS',
              finding: `Inspected ${visualCase}/${designPack}/${theme} at ${cssWidth}px; no clipping.`,
            },
          });
        }
      }
    }
  }

  const manifest = {
    schemaVersion: 1,
    profileId: 'c07-render-comparison-offline-agent-mcp-matrix-v4',
    artifactDirectory: C07_V4_VISUAL_QA_ARTIFACT_DIRECTORY,
    cssWidths: WIDTHS,
    designPacks: DESIGN_PACKS,
    themes: THEMES,
    deviceScaleFactor: 2,
    buildBundleSha256: 'c'.repeat(64),
    generationSourceSha256: computeC07V4VisualQaGenerationSourceSha256(root),
    reviewAcknowledgement: {
      decision: 'PASS',
      allImagesIndividuallyInspected: true,
      reviewedBy: 'Codex',
      reviewedAt: '2026-10-23T12:30:00.000Z',
      summary: 'All 60 complete and partial two-cohort images were inspected individually.',
    },
    images,
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(manifestPath, manifestBytes);
  return { root, artifactDirectory, manifest, manifestPath, manifestBytes };
}

function verify(fixture, expectedManifestSha256 = sha256(fixture.manifestBytes)) {
  return validateC07V4VisualQaEvidence({
    root: fixture.root,
    expectedManifestSha256,
    expectedBundleSha256: fixture.manifest.buildBundleSha256,
  });
}

test('C07 v4 runner pin matches the tracked visual QA manifest', () => {
  const manifestBytes = readFileSync(path.join(ROOT, C07_V4_VISUAL_QA_MANIFEST_PATH));
  const runnerSource = readFileSync(
    path.join(ROOT, 'scripts/acceptance/run-c07-render-comparison-offline-agent-mcp.mjs'),
    'utf8',
  );
  const pin = runnerSource.match(/const C07_V4_VISUAL_QA_MANIFEST_SHA256\s*=\s*'([0-9a-f]{64})'/u);

  assert.ok(pin, 'C07 v4 runner must pin the expected visual QA manifest');
  assert.equal(pin[1], sha256(manifestBytes));
});

test('C07 v4 visual QA requires exact 60-image receipts, current sources and full review', () => {
  const fixture = createFixture();
  try {
    assert.equal(fixture.manifest.images.length, 60);
    assert.equal(verify(fixture), true);

    const changedImage = path.join(fixture.artifactDirectory, fixture.manifest.images[0].file);
    writeFileSync(changedImage, Buffer.concat([PNG_SIGNATURE, Buffer.from('changed')]));
    assert.equal(verify(fixture), false);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('C07 v4 visual QA rejects stale bundle hashes and unreviewed manifests', () => {
  const fixture = createFixture();
  try {
    assert.equal(
      validateC07V4VisualQaEvidence({
        root: fixture.root,
        expectedManifestSha256: sha256(fixture.manifestBytes),
        expectedBundleSha256: 'd'.repeat(64),
      }),
      false,
    );
    fixture.manifest.reviewAcknowledgement.allImagesIndividuallyInspected = false;
    const changedManifest = Buffer.from(`${JSON.stringify(fixture.manifest, null, 2)}\n`);
    writeFileSync(fixture.manifestPath, changedManifest);
    assert.equal(verify(fixture, sha256(changedManifest)), false);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});
