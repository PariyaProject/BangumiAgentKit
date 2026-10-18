import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  C07_V3_VISUAL_QA_ARTIFACT_DIRECTORY,
  C07_V3_VISUAL_QA_MANIFEST_PATH,
  computeC07V3VisualQaGenerationSourceSha256,
  validateC07V3VisualQaEvidence,
} from '../../scripts/lib/c07-render-comparison-visual-qa.mjs';

const WIDTHS = [320, 360, 520, 640, 960];
const CASES = ['complete-single-cohort-e', 'partial-single-cohort-e'];
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

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
  const root = mkdtempSync(path.join(os.tmpdir(), 'c07-v3-visual-qa-'));
  const artifactDirectory = path.join(root, C07_V3_VISUAL_QA_ARTIFACT_DIRECTORY);
  const manifestPath = path.join(root, C07_V3_VISUAL_QA_MANIFEST_PATH);
  mkdirSync(artifactDirectory, { recursive: true });
  mkdirSync(path.dirname(manifestPath), { recursive: true });
  for (const sourcePath of [
    'pnpm-lock.yaml',
    'packages/renderer/package.json',
    'packages/renderer/tsconfig.json',
    'scripts/acceptance/generate-c07-render-comparison-offline-v3-visuals.ts',
    'tests/render/fixtures/subject-cohort-comparison.fixture.ts',
    'tsconfig.base.json',
    'packages/renderer/src/fixture.ts',
  ]) {
    const absolutePath = path.join(root, sourcePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, `fixture source for ${sourcePath}`);
  }

  const images = [];
  for (const visualCase of CASES) {
    for (const cssWidth of WIDTHS) {
      const file = `${visualCase}-${cssWidth}.png`;
      const bytes = pngHeader(cssWidth, 1200);
      writeFileSync(path.join(artifactDirectory, file), bytes);
      images.push({
        case: visualCase,
        file,
        cssWidth,
        pixelWidth: cssWidth,
        pixelHeight: 1200,
        byteLength: bytes.length,
        sha256: sha256(bytes),
        visualReview: {
          decision: 'PASS',
          finding: `Inspected ${visualCase} at ${cssWidth}px; no clipping or overflow.`,
        },
      });
    }
  }

  const manifest = {
    schemaVersion: 1,
    profileId: 'c07-render-comparison-offline-agent-mcp-matrix-v3',
    artifactDirectory: C07_V3_VISUAL_QA_ARTIFACT_DIRECTORY,
    cssWidths: WIDTHS,
    deviceScaleFactor: 1,
    buildBundleSha256: 'c'.repeat(64),
    generationSourceSha256: computeC07V3VisualQaGenerationSourceSha256(root),
    reviewAcknowledgement: {
      decision: 'PASS',
      allImagesIndividuallyInspected: true,
      reviewedBy: 'Codex',
      reviewedAt: '2026-10-18T15:49:05.000Z',
      summary: 'All ten complete and partial images were inspected individually.',
    },
    images,
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(manifestPath, manifestBytes);
  return { root, artifactDirectory, manifest, manifestPath, manifestBytes };
}

function verify(
  fixture,
  expectedManifestSha256 = sha256(fixture.manifestBytes),
  expectedBundleSha256 = fixture.manifest.buildBundleSha256,
) {
  return validateC07V3VisualQaEvidence({
    root: fixture.root,
    expectedManifestSha256,
    expectedBundleSha256,
  });
}

function clean(fixture) {
  rmSync(fixture.root, { recursive: true, force: true });
}

test('C07 v3 visual QA requires a pinned PASS acknowledgement and all ten matching PNGs', (t) => {
  const fixture = createFixture();
  t.after(() => clean(fixture));

  assert.equal(verify(fixture), true);
});

test('C07 v3 visual QA rejects an unpinned or unreviewed manifest', (t) => {
  const fixture = createFixture();
  t.after(() => clean(fixture));

  assert.equal(verify(fixture, '0'.repeat(64)), false);
  assert.equal(verify(fixture, undefined, 'd'.repeat(64)), false);
  fixture.manifest.reviewAcknowledgement.allImagesIndividuallyInspected = false;
  fixture.manifestBytes = Buffer.from(`${JSON.stringify(fixture.manifest, null, 2)}\n`);
  writeFileSync(fixture.manifestPath, fixture.manifestBytes);
  assert.equal(verify(fixture), false);
});

test('C07 v3 visual QA rejects missing or changed local image bytes', (t) => {
  const fixture = createFixture();
  t.after(() => clean(fixture));
  const target = path.join(fixture.artifactDirectory, 'partial-single-cohort-e-320.png');

  rmSync(target);
  assert.equal(verify(fixture), false);

  const bytes = pngHeader(320, 1200);
  bytes[23] = 1;
  writeFileSync(target, bytes);
  assert.equal(verify(fixture), false);
});

test('C07 v3 visual QA rejects generation inputs that no longer match the reviewed images', (t) => {
  const fixture = createFixture();
  t.after(() => clean(fixture));
  writeFileSync(
    path.join(fixture.root, 'packages/renderer/src/fixture.ts'),
    'changed after the visual review',
  );

  assert.equal(verify(fixture), false);
});

test('C07 v3 visual QA rejects incomplete or inconsistent image manifests', (t) => {
  const fixture = createFixture();
  t.after(() => clean(fixture));

  fixture.manifest.images.pop();
  fixture.manifestBytes = Buffer.from(`${JSON.stringify(fixture.manifest, null, 2)}\n`);
  writeFileSync(fixture.manifestPath, fixture.manifestBytes);
  assert.equal(verify(fixture), false);

  fixture.manifest.images.push({
    case: 'partial-single-cohort-e',
    file: '../partial-single-cohort-e-960.png',
    cssWidth: 960,
    pixelWidth: 960,
    pixelHeight: 1200,
    byteLength: 24,
    sha256: 'a'.repeat(64),
    visualReview: { decision: 'PASS', finding: 'Path traversal must be rejected.' },
  });
  fixture.manifestBytes = Buffer.from(`${JSON.stringify(fixture.manifest, null, 2)}\n`);
  writeFileSync(fixture.manifestPath, fixture.manifestBytes);
  assert.equal(verify(fixture), false);
});
