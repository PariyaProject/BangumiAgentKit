import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const frontier = JSON.parse(readFileSync(path.join(ROOT, 'docs/product/frontier-ledger.json'), 'utf8'));
const c02 = frontier.records.find((record) => record.id === 'C02');
const reportPath = 'docs/live-probes/c02-tv-movie-comparison-agent-mcp-run95.json';
const terminalDispositionPath =
  'docs/research/run95-c02-profile-terminal-disposition-2026-10-18.md';

test('C02 remains unassessed without duplicating Harness runtime state in the frontier', () => {
  assert.ok(c02);
  assert.equal(c02.status, 'UNASSESSED');
  assert.equal(Object.hasOwn(c02.evidence ?? {}, 'profile_preparation'), false);
  const serialized = JSON.stringify(c02);
  for (const runtimeField of [
    'claimId',
    'reportWritten',
    'retryAllowed',
    'statusCheckedAt',
    'profileId',
  ]) {
    assert.equal(
      serialized.includes(runtimeField),
      false,
      `frontier must not duplicate ${runtimeField}`,
    );
  }
  assert.ok(/Keep C02 UNASSESSED/u.test(c02.next_action));
  assert.ok(/No accepted scenario answer/u.test(c02.next_action));
  assert.ok(/no additional Agent\/MCP matrix credit/iu.test(c02.next_action));
  assert.ok(c02.source_refs.includes(terminalDispositionPath));
  assert.equal(existsSync(path.join(ROOT, reportPath)), false);
  assert.equal(existsSync(path.join(ROOT, terminalDispositionPath)), true);
  const report = readFileSync(path.join(ROOT, terminalDispositionPath), 'utf8');
  assert.match(report, /PR #194 Harness control record/u);
  assert.match(report, /no accepted scenario answer/u);
  assert.doesNotMatch(
    report,
    /claimId|reportWritten|retryAllowed|statusCheckedAt|profile-run-95-pr-194-/u,
  );
});
