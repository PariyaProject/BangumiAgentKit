import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const reportPath = 'docs/live-probes/public-tools-2026-10-13-110542656-20614.json';
const currentMatrixReportPath = 'docs/live-probes/public-tools-2026-10-16-003414160-29605.json';
const readRepoFile = (path) => readFileSync(new URL(`../../${path}`, import.meta.url));
const readRepoJson = (path) => JSON.parse(readRepoFile(path).toString('utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('G01 direct-public query renderer evidence stays separate from its spent canary', () => {
  const report = readRepoJson(reportPath);
  const catalog = readRepoFile('docs/tool-catalog.json');
  const probeScript = readRepoFile('scripts/smoke-public-tools-online.ts');
  const frontier = readRepoJson('docs/product/frontier-ledger.json');
  const g01 = frontier.records.find((record) => record.id === 'G01');
  const acceptance = readRepoFile('docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md').toString('utf8');
  const toolRow = acceptance
    .split('\n')
    .find((line) => line.includes('`bangumi.render_query_subjects`'));
  const result = report.results[0];

  assert.equal(report.evidenceKind, 'bangumi_public_api_tool_registry_smoke');
  assert.equal(report.mode, 'read_only_public_api_smoke');
  assert.deepEqual(report.selectedTools, ['bangumi.render_query_subjects']);
  assert.equal(report.probeCount, 1);
  assert.equal(report.httpRequests, 1);
  assert.ok(report.limits.includes('no OAuth'));
  assert.ok(report.limits.includes('no writes'));
  assert.deepEqual(result.input, {
    media: 'anime',
    year: 2012,
    resultMode: 'top',
    limit: 1,
  });
  assert.equal(result.httpRequests, 1);
  assert.deepEqual(Object.keys(result.result).sort(), ['keys', 'state']);
  assert.deepEqual(result.result, { state: 'value', keys: ['artifact'] });
  assert.equal(result.assertions.passed, true);
  assert.ok(Object.values(result.assertions).every((value) => value === true));
  assert.equal(
    report.catalogSha256,
    '2e3d216a282022fd01a2d1fac0cd0e8831c21461a28d304e41b20d3d4fc39c3e',
  );
  assert.notEqual(report.catalogSha256, sha256(catalog));
  assert.equal(report.probeScriptSha256, sha256(probeScript));

  assert.ok(g01);
  assert.equal(g01.status, 'PARTIAL');
  assert.ok(g01.source_refs.includes(reportPath));
  assert.equal(g01.evidence.direct_public_renderer_probe_2026_10_13.request_count, 1);
  assert.match(
    g01.evidence.direct_public_renderer_probe_2026_10_13.acceptance_boundary,
    /does not accept the G01 scenario/,
  );
  assert.match(g01.next_action, /never retry the consumed one-shot/);
  assert.match(g01.next_action, /do not replay the consumed G01 Agent\/MCP canary/);
  assert.ok(toolRow?.includes('◐'));
  assert.ok(toolRow?.includes(currentMatrixReportPath));
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
