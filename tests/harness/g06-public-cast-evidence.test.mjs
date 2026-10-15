import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const reportPath = 'docs/live-probes/public-tools-2026-10-13-094144522-15089.json';
const readRepoFile = (path) => readFileSync(new URL(`../../${path}`, import.meta.url));
const readRepoJson = (path) => JSON.parse(readRepoFile(path).toString('utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('G06 direct cast API evidence stays separate from its consumed Agent/MCP claim', () => {
  const report = readRepoJson(reportPath);
  const catalog = readRepoFile('docs/tool-catalog.json');
  const probeScript = readRepoFile('scripts/smoke-public-tools-online.ts');
  const frontier = readRepoJson('docs/product/frontier-ledger.json');
  const g06 = frontier.records.find((record) => record.id === 'G06');
  const acceptance = readRepoFile('docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md').toString('utf8');
  const castRow = acceptance.split('\n').find((line) => line.includes('`bangumi.get_subject_cast`'));
  const result = report.results[0];

  assert.equal(report.evidenceKind, 'bangumi_public_api_tool_registry_smoke');
  assert.equal(report.mode, 'read_only_public_api_smoke');
  assert.deepEqual(report.selectedTools, ['bangumi.get_subject_cast']);
  assert.equal(report.probeCount, 1);
  assert.equal(report.httpRequests, 1);
  assert.deepEqual(result.input, { subjectId: 41529, limit: 2 });
  assert.equal(result.httpRequests, 1);
  assert.deepEqual(Object.keys(result.result).sort(), ['castCount', 'observed', 'returned', 'subjectId']);
  assert.deepEqual(result.result, { subjectId: 41529, observed: 9, returned: 2, castCount: 2 });
  assert.equal(result.assertions.passed, true);
  assert.ok(Object.values(result.assertions).every((value) => value === true));
  assert.equal(
    report.catalogSha256,
    '2e3d216a282022fd01a2d1fac0cd0e8831c21461a28d304e41b20d3d4fc39c3e',
  );
  assert.notEqual(report.catalogSha256, sha256(catalog));
  assert.equal(report.probeScriptSha256, sha256(probeScript));
  assert.ok(g06);
  assert.equal(g06.status, 'PARTIAL');
  assert.ok(g06.source_refs.includes(reportPath));
  assert.match(g06.next_action, /Never rerun the G06 profile/);
  assert.match(g06.next_action, /does not count as Agent\/MCP answer acceptance/);
  assert.ok(castRow?.includes('⬜'));
  assert.ok(!castRow?.includes(reportPath));
});
