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

test('terminal C02 profile remains unassessed and cannot be retried', () => {
  assert.ok(c02);
  const preparation = c02.evidence?.profile_preparation;
  assert.ok(preparation);
  assert.equal(c02.status, 'UNASSESSED');
  assert.equal(preparation.state, 'TERMINAL_INCONCLUSIVE_NO_REPORT');
  assert.equal(preparation.profileId, 'c02-cardcaptor-tv-movie-v1');
  assert.equal(preparation.acceptanceScope, 'frontier-scenario-only');
  assert.equal(preparation.scenarioAcceptance, 'NOT_ACCEPTED');
  assert.equal(preparation.reportWritten, false);
  assert.equal(preparation.retryAllowed, false);
  assert.equal(
    preparation.terminalDispositionPath,
    terminalDispositionPath,
  );
  assert.ok(/Keep C02 UNASSESSED/u.test(c02.next_action));
  assert.ok(/Never run or recreate this profile/u.test(c02.next_action));
  assert.ok(c02.source_refs.includes(terminalDispositionPath));
  assert.equal(existsSync(path.join(ROOT, reportPath)), false);
  assert.equal(existsSync(path.join(ROOT, terminalDispositionPath)), true);
});
