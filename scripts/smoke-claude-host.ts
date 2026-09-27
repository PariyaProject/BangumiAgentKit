import * as fs from 'node:fs';
import { LocalArtifactStore } from '../packages/renderer/dist/index.js';
import * as path from 'node:path';
import * as os from 'node:os';

async function main() {
  console.log('=== BangumiAgentKit PR-6C Claude Host Smoke Verification ===');

  const smokeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bangumi-claude-host-smoke-'));
  const artifactDir = path.join(smokeDir, 'artifacts');
  try {
    const store = new LocalArtifactStore({ artifactDir });

    console.log(`[ArtifactStore] Temporary data directory: ${artifactDir}`);
    const ref = await store.saveArtifact(Buffer.from('SMOKE_PNG_HEADER'), 'image/png', {
      width: 960,
      height: 600,
    });
    console.log(`[ArtifactStore] Created smoke artifact: ${ref.id}`);

    const resolvedPath = await store.resolveFilePath(ref.id);
    console.log(`[ArtifactStore] Resolved temporary path: ${resolvedPath}`);

    const invalidLookup = await store.resolveFilePath('../../../etc/passwd');
    if (invalidLookup === null) {
      console.log('[Security] Path traversal check PASSED: ../../../etc/passwd rejected.');
    } else {
      throw new Error('[Security] FAIL: Path traversal was not rejected.');
    }

    console.log('\n✅ PR-6C Host Smoke Verification Completed Successfully.');
  } finally {
    fs.rmSync(smokeDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('Smoke check error:', err);
  process.exit(1);
});
