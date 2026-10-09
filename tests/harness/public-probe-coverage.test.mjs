import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const probePath = 'docs/live-probes/public-tools-2026-10-08-234356643-30762.json';
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
    assert.equal(cells[9], '⬜', `${result.tool} Agent/MCP must remain pending`);
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
