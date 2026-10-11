import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const report = readFileSync(
  path.join(root, 'docs/research/run95-g04-mcp-bundle-attestation-refresh-2026-10-11.md'),
  'utf8',
);

test('G04 bundle attestation report records reproducible build provenance only', () => {
  assert.match(report, /663a2d185548394812801acef51902f9ac682983355c70fb1110be46ad63b6cf/u);
  assert.match(report, /apps\/mcp\/src\/result-presenter\.ts/u);
  assert.match(report, /3de59a7/u);
  assert.match(report, /a7185e0/u);
  assert.match(report, /computeMcpBundleSha256/u);
  assert.doesNotMatch(
    report,
    /\b(?:runner|claim|retry|attempt|invoked|query)\b/iu,
    'transient Run 95 execution state belongs in the Harness control plane, not this report',
  );
});
