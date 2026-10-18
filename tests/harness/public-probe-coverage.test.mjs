import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const probePath = 'docs/live-probes/public-tools-2026-10-08-234356643-30762.json';
const g19ProbePath = 'docs/live-probes/public-tools-2026-10-11-103934803-2116.json';
const g19AgentReportPath = 'docs/live-probes/g19-person-origin-agent-mcp-run95.json';
const g06CastOfflineV2ReportPath = 'docs/live-probes/g06-subject-cast-offline-agent-mcp-run95-v2.json';
const r04RenderOfflineV2ReportPath =
  'docs/live-probes/r04-render-series-watch-order-offline-agent-mcp-v2-run95.json';
const acceptedAgentReports = new Map([
  ['bangumi.get_person_activity', g19AgentReportPath],
  ['bangumi.get_subject_cast', g06CastOfflineV2ReportPath],
  ['bangumi.render_series_watch_order', r04RenderOfflineV2ReportPath],
]);
const acceptedAgentReportKinds = new Map([
  ['bangumi.get_person_activity', 'codex_g19_person_origin_agent_mcp'],
  ['bangumi.get_subject_cast', 'codex_cli_g06_subject_cast_offline_agent_mcp_v2'],
  [
    'bangumi.render_series_watch_order',
    'codex_cli_r04_render_series_watch_order_offline_agent_mcp_v2',
  ],
]);
const expectedTools = [
  'bangumi.get_person_activity',
  'bangumi.get_series_watch_order',
  'bangumi.get_subject_cast',
  'bangumi.get_subject_relations',
  'bangumi.query_subjects',
  'bangumi.render_query_subjects',
  'bangumi.render_series_watch_order',
].sort();
const report = JSON.parse(readFileSync(path.join(root, probePath), 'utf8'));
const g19Report = JSON.parse(readFileSync(path.join(root, g19ProbePath), 'utf8'));
const ledger = JSON.parse(readFileSync(path.join(root, 'docs/product/frontier-ledger.json'), 'utf8'));
const taskTable = readFileSync(path.join(root, 'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md'), 'utf8');

test('selected public probes do not promote stale evidence to Agent/MCP or client rows', () => {
  assert.equal(report.mode, 'read_only_public_api_smoke');
  assert.equal(report.probeCount, expectedTools.length);
  assert.equal(report.httpRequests, 11);
  assert.deepEqual([...report.selectedTools].sort(), expectedTools);
  assert.equal(report.results.length, expectedTools.length);
  for (const result of report.results) {
    assert.equal(result.assertions.passed, true, result.tool);
    assert.deepEqual(
      Object.keys(result).sort(),
      ['assertions', 'httpRequests', 'input', 'result', 'tool'],
    );
    assert.ok(!Object.hasOwn(result.input, 'username'));
    assert.ok(!Object.hasOwn(result, 'answer'));
    assert.ok(!Object.hasOwn(result, 'content'));
    const line = taskTable.split('\n').find((row) => row.startsWith(`| \`${result.tool}\` |`));
    assert.ok(line, `missing task row for ${result.tool}`);
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    // The evidence-derived matrix may demote a probe when its source or the
    // catalogued tool contract has changed since the report was produced.
    assert.ok(cells[6] === '⬜' || cells[6].startsWith('◐'), `${result.tool} public API status`);
    if (cells[9].startsWith('✅')) {
      const reportPath = acceptedAgentReports.get(result.tool);
      assert.ok(reportPath, `${result.tool} Agent/MCP credit must come from a dedicated report`);
      assert.ok(existsSync(path.join(root, reportPath)), 'matrix credit requires an accepted Agent/MCP report');
      const agentReport = JSON.parse(readFileSync(path.join(root, reportPath), 'utf8'));
      assert.equal(agentReport.evidenceKind, acceptedAgentReportKinds.get(result.tool));
    } else {
      assert.equal(cells[9], '⬜', `${result.tool} Agent/MCP must remain unchecked without a current report`);
    }
    assert.equal(cells[10], '⬜', `${result.tool} QQ must remain pending`);
    assert.equal(cells[11], '⬜', `${result.tool} TIM must remain pending`);
  }
});

test('S03 keeps the spent one-shot separate from the direct public API smoke', () => {
  const record = ledger.records.find(({ id }) => id === 'S03');
  assert.ok(record);
  assert.equal(record.status, 'PARTIAL');
  assert.ok(record.source_refs.includes(probePath));
  assert.match(record.next_action, /separate direct public ToolRegistry smoke/u);
  assert.match(record.next_action, /INCONCLUSIVE/u);
  assert.match(record.next_action, /Never retry/u);
  assert.match(record.next_action, /no accepted report/u);
});

test('G19 public probe is current, bounded, summary-only, and leaves the scenario partial', () => {
  const record = ledger.records.find(({ id }) => id === 'G19');
  assert.ok(record, 'G19 must remain in the canonical frontier');
  assert.equal(record.status, 'PARTIAL');
  assert.ok(record.source_refs.includes(g19ProbePath));
  assert.match(record.next_action, /not_observed and unknown remain insufficient/u);
  assert.doesNotMatch(record.next_action, /Run #95|Candidate [0-9a-f]{7,}|one-shot|INCONCLUSIVE|quota|claim/iu);

  assert.equal(g19Report.evidenceKind, 'bangumi_public_api_tool_registry_smoke');
  assert.equal(g19Report.mode, 'read_only_public_api_smoke');
  assert.equal(g19Report.probeCount, 1);
  assert.deepEqual(g19Report.selectedTools, ['bangumi.get_person_activity']);
  assert.ok(g19Report.httpRequests > 0);
  assert.equal(g19Report.results.length, 1);
  const [result] = g19Report.results;
  assert.deepEqual(result.input, {
    personId: 3474,
    windowMonths: 3,
    maxRelations: 1,
    maxSubjectDetails: 1,
    maxRows: 1,
  });
  assert.ok(result.httpRequests > 0);
  assert.equal(result.assertions.passed, true);
  assert.deepEqual(
    Object.keys(result).sort(),
    ['assertions', 'httpRequests', 'input', 'result', 'tool'],
  );
  assert.ok(!Object.hasOwn(result, 'rows'));
  assert.ok(!Object.hasOwn(result, 'answer'));

  const line = taskTable.split('\n').find((row) => row.startsWith('| `bangumi.get_person_activity` |'));
  assert.ok(line, 'missing task row for bangumi.get_person_activity');
  const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
  assert.ok(cells[6].startsWith('◐'));
  if (cells[9].startsWith('✅')) {
    assert.ok(existsSync(path.join(root, g19AgentReportPath)), 'matrix credit requires an accepted G19 Agent/MCP report');
    const agentReport = JSON.parse(readFileSync(path.join(root, g19AgentReportPath), 'utf8'));
    assert.equal(agentReport.evidenceKind, 'codex_g19_person_origin_agent_mcp');
    assert.equal(agentReport.resultSummary.personId, 3474);
    assert.equal(agentReport.answerChecks.adaptationNotInferred, true);
    assert.ok(!Object.hasOwn(agentReport, 'answer'));
    assert.ok(!Object.hasOwn(agentReport.resultSummary, 'rows'));
  } else {
    assert.equal(cells[9], '⬜', 'stale, invalid, or absent reports must remain unchecked after evidence generation');
  }
  assert.equal(cells[10], '⬜', 'public smoke must not count as QQ');
  assert.equal(cells[11], '⬜', 'public smoke must not count as TIM');
});
