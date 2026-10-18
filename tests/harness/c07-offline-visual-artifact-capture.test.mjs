import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  c07OfflineVisualArtifactTempPath,
  persistC07OfflineVisualArtifactForInspection,
  writeC07OfflineVisualArtifactTempCopy,
} from '../../scripts/lib/c07-offline-visual-artifact-capture.mjs';
import {
  C07_RENDER_COMPARISON_OFFLINE_V2_PROFILE_ID,
  C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID,
} from '../../scripts/lib/c07-render-comparison-offline-profile.mjs';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test('C07 v2 visual capture remains create-only, temp-scoped, and hash-bound', () => {
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'c07-v2-visual-capture-'));
  try {
    const summaryPath = path.join(temporaryRoot, 'summary.json');
    const pngBytes = Buffer.concat([PNG_SIGNATURE, Buffer.from('synthetic-png-payload')]);
    const tempPath = writeC07OfflineVisualArtifactTempCopy({
      profileId: C07_RENDER_COMPARISON_OFFLINE_V2_PROFILE_ID,
      summaryPath,
      pngBytes,
    });
    assert.equal(
      tempPath,
      c07OfflineVisualArtifactTempPath(C07_RENDER_COMPARISON_OFFLINE_V2_PROFILE_ID, summaryPath),
    );
    assert.deepEqual(readFileSync(tempPath), pngBytes);

    const sha256 = createHash('sha256').update(pngBytes).digest('hex');
    const persisted = persistC07OfflineVisualArtifactForInspection({
      profileId: C07_RENDER_COMPARISON_OFFLINE_V2_PROFILE_ID,
      summaryPath,
      root: temporaryRoot,
      sourceRevision: 'a'.repeat(40),
      expectedSha256: sha256,
      expectedByteLength: pngBytes.length,
    });
    assert.equal(
      persisted.relativePath,
      '.artifacts/render/c07-render-comparison-v2-mcp-aaaaaaaaaaaa.png',
    );
    assert.deepEqual(readFileSync(persisted.absolutePath), pngBytes);
    assert.equal(statSync(persisted.absolutePath).mode & 0o777, 0o600);
    assert.throws(
      () =>
        writeC07OfflineVisualArtifactTempCopy({
          profileId: C07_RENDER_COMPARISON_OFFLINE_V2_PROFILE_ID,
          summaryPath,
          pngBytes,
        }),
      /EEXIST/u,
    );
    assert.throws(
      () =>
        persistC07OfflineVisualArtifactForInspection({
          profileId: C07_RENDER_COMPARISON_OFFLINE_V2_PROFILE_ID,
          summaryPath,
          root: temporaryRoot,
          sourceRevision: 'a'.repeat(40),
          expectedSha256: 'f'.repeat(64),
          expectedByteLength: pngBytes.length,
        }),
      /does not match sanitized PNG metadata/u,
    );
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('C07 v3 visual capture uses a distinct create-only temporary and output path', () => {
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'c07-v3-visual-capture-'));
  try {
    const summaryPath = path.join(temporaryRoot, 'summary.json');
    const pngBytes = Buffer.concat([PNG_SIGNATURE, Buffer.from('synthetic-v3-png')]);
    const tempPath = writeC07OfflineVisualArtifactTempCopy({
      profileId: C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID,
      summaryPath,
      pngBytes,
    });
    assert.equal(tempPath.endsWith('.c07-v3-artifact.png'), true);
    const persisted = persistC07OfflineVisualArtifactForInspection({
      profileId: C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID,
      summaryPath,
      root: temporaryRoot,
      sourceRevision: 'b'.repeat(40),
      expectedSha256: createHash('sha256').update(pngBytes).digest('hex'),
      expectedByteLength: pngBytes.length,
    });
    assert.equal(
      persisted.relativePath,
      '.artifacts/render/c07-render-comparison-v3-mcp-bbbbbbbbbbbb.png',
    );
    assert.deepEqual(readFileSync(persisted.absolutePath), pngBytes);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('C07 v2 visual capture rejects other profiles, non-PNGs, and paths outside tmp', () => {
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'c07-v2-visual-capture-'));
  try {
    assert.throws(
      () =>
        c07OfflineVisualArtifactTempPath(
          'c07-render-comparison-offline-agent-mcp-matrix-v1',
          path.join(temporaryRoot, 'summary.json'),
        ),
      /requires an exact registered matrix profile/u,
    );
    assert.throws(
      () =>
        writeC07OfflineVisualArtifactTempCopy({
          profileId: C07_RENDER_COMPARISON_OFFLINE_V2_PROFILE_ID,
          summaryPath: path.join(temporaryRoot, 'summary.json'),
          pngBytes: Buffer.from('not-a-png'),
        }),
      /requires a bounded PNG artifact/u,
    );
    assert.throws(
      () =>
        c07OfflineVisualArtifactTempPath(
          C07_RENDER_COMPARISON_OFFLINE_V2_PROFILE_ID,
          path.resolve(os.tmpdir(), '..', 'outside-summary.json'),
        ),
      /restricted to the temporary directory/u,
    );
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
