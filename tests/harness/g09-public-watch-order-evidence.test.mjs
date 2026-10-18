import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const reportPath = 'docs/live-probes/public-tools-2026-10-13-100900784-55053.json';
const readRepoFile = (path) => readFileSync(new URL(`../../${path}`, import.meta.url));
const readRepoJson = (path) => JSON.parse(readRepoFile(path).toString('utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('G09 direct-public watch-order evidence stays separate from its consumed Agent/MCP canary', () => {
  const report = readRepoJson(reportPath);
  const catalog = readRepoFile('docs/tool-catalog.json');
  const probeScript = readRepoFile('scripts/smoke-public-tools-online.ts');
  const frontier = readRepoJson('docs/product/frontier-ledger.json');
  const g09 = frontier.records.find((record) => record.id === 'G09');
  const acceptance = readRepoFile('docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md').toString('utf8');
  const toolRow = acceptance
    .split('\n')
    .find((line) => line.includes('`bangumi.get_series_watch_order`'));
  const result = report.results[0];

  assert.equal(report.evidenceKind, 'bangumi_public_api_tool_registry_smoke');
  assert.equal(report.mode, 'read_only_public_api_smoke');
  assert.deepEqual(report.selectedTools, ['bangumi.get_series_watch_order']);
  assert.equal(report.probeCount, 1);
  assert.equal(report.httpRequests, 2);
  assert.ok(report.limits.includes('no OAuth'));
  assert.ok(report.limits.includes('no writes'));
  assert.deepEqual(result.input, { subjectId: 41529, depth: 0, maxNodes: 1 });
  assert.equal(result.httpRequests, 2);
  assert.deepEqual(Object.keys(result.result).sort(), ['state', 'subjectId', 'warningsCount']);
  assert.deepEqual(result.result, { state: 'complete', subjectId: 41529, warningsCount: 2 });
  assert.equal(result.assertions.passed, true);
  assert.ok(Object.values(result.assertions).every((value) => value === true));
  assert.equal(
    report.catalogSha256,
    '2e3d216a282022fd01a2d1fac0cd0e8831c21461a28d304e41b20d3d4fc39c3e',
  );
  assert.notEqual(report.catalogSha256, sha256(catalog));
  assert.equal(report.probeScriptSha256, sha256(probeScript));

  assert.ok(g09);
  assert.equal(g09.status, 'PARTIAL');
  assert.ok(g09.source_refs.includes(reportPath));
  assert.equal(g09.evidence.direct_public_api_probe_2026_10_13.request_count, 2);
  assert.equal(
    g09.evidence.direct_public_api_probe_2026_10_13.acceptance_boundary.includes('not Agent/MCP'),
    true,
  );
  assert.match(g09.next_action, /never retry its consumed one-shot/);
  assert.match(g09.next_action, /do not replay the spent G09 one-shot\/canary/);
  assert.ok(toolRow?.includes('◐'));
  assert.ok(toolRow?.includes('docs/live-probes/public-tools-2026-10-15-094954394-75684.json'));
  assert.ok(!toolRow?.includes(reportPath));
  const publicEvidenceSummary = acceptance.match(/匿名可用的公开 API 工具有逐项实测：(\d+)\/65/);
  const publicEvidenceRows = acceptance
    .split('\n')
    .filter((line) => line.startsWith('| `bangumi.'))
    .filter((line) => line.split('|')[7]?.includes('◐')).length;
  assert.ok(publicEvidenceSummary);
  assert.equal(Number(publicEvidenceSummary[1]), publicEvidenceRows);
  assert.equal(Number(publicEvidenceSummary[1]), 65);
  assert.match(acceptance, /匿名可用的公开 API 工具有逐项实测：65\/65；待补 0/u);
  assert.match(acceptance, /Agent→MCP 模型调用证据：83\/96/);
});
