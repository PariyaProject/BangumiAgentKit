import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { R04_RENDER_SERIES_WATCH_ORDER_V2_PROFILE_ID } from '../../scripts/lib/r04-render-series-watch-order-offline-v2-fixture.mjs';

const PROFILE = getAgentMcpProfileById(R04_RENDER_SERIES_WATCH_ORDER_V2_PROFILE_ID);
const SERVER_SOURCE = readFileSync(
  new URL('../../apps/mcp/codex-one-tool-mcp-server.mjs', import.meta.url),
  'utf8',
);

test('R04 v2 server binds its catalog digest and tool view to sourceRevision bytes', () => {
  const snapshotStart = SERVER_SOURCE.indexOf('  const sourceRevision = gitRepositoryText(PRODUCT_ROOT,');
  const snapshotEnd = SERVER_SOURCE.indexOf('  const catalog =', snapshotStart);
  assert.ok(snapshotStart >= 0 && snapshotEnd > snapshotStart);
  const snapshot = SERVER_SOURCE.slice(snapshotStart, snapshotEnd);
  assert.match(snapshot, /config\.networkMode === R04_RENDER_SERIES_WATCH_ORDER_V2_NETWORK_MODE/u);
  assert.match(snapshot, /readToolCatalogAtSourceRevision\(PRODUCT_ROOT, sourceRevision\)/u);
  assert.match(snapshot, /catalogSnapshot\?\.bytes/u);
  assert.match(SERVER_SOURCE, /catalogSnapshot\?\.catalog/u);
  assert.match(
    SERVER_SOURCE,
    /catalogSha256: createHash\('sha256'\)\.update\(catalogBytes\)\.digest\('hex'\)/u,
  );
});

test('R04 v2 projection matches the actual ephemeral MCP artifact summary contract', () => {
  const summarizeStart = SERVER_SOURCE.indexOf('  summarize(id, { verifyPng = false } = {}) {');
  const summarizeEnd = SERVER_SOURCE.indexOf('\n  }\n}', summarizeStart);
  assert.ok(summarizeStart >= 0 && summarizeEnd > summarizeStart);
  const memoryStoreImplementation = SERVER_SOURCE.slice(summarizeStart, summarizeEnd);
  assert.match(memoryStoreImplementation, /returned: true/u);
  assert.match(memoryStoreImplementation, /persisted: false/u);
  assert.match(memoryStoreImplementation, /byteLength: item\.buffer\.length/u);
  assert.match(memoryStoreImplementation, /createHash\('sha256'\)/u);
  assert.match(memoryStoreImplementation, /pngSignatureValid:/u);
  assert.match(memoryStoreImplementation, /inspectC07PngArtifact/u);
  assert.match(
    SERVER_SOURCE,
    /artifactStore\.summarize\(result\?\.artifact\?\.id, \{ verifyPng: true \}\)/u,
  );

  const memoryStoreSummary = {
    returned: true,
    persisted: false,
    mimeType: 'image/png',
    width: 360,
    height: 272,
    byteLength: 4096,
    sha256: 'a'.repeat(64),
    pngSignatureValid: true,
    decoded: true,
    dimensionsMatch: true,
  };
  const projection = summarizeProfileToolResult(
    { artifact: { id: 'ephemeral-test-id' } },
    PROFILE.calls[0].arguments,
    PROFILE.id,
    memoryStoreSummary,
    PROFILE.toolName,
  );

  assert.deepEqual(projection, {
    resultState: 'artifact_returned',
    artifact: {
      returned: true,
      persisted: false,
      mimeType: 'image/png',
      width: 360,
      height: 272,
      byteLength: 4096,
      sha256: 'a'.repeat(64),
      pngSignatureValid: true,
      decoded: true,
      dimensionsMatch: true,
    },
  });
});
