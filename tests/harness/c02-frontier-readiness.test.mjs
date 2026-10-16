import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const frontier = JSON.parse(readFileSync(path.join(ROOT, 'docs/product/frontier-ledger.json'), 'utf8'));
const c02 = frontier.records.find((record) => record.id === 'C02');
const reportPath = 'docs/live-probes/c02-tv-movie-comparison-agent-mcp-run95.json';

test('C02 stays unassessed without its one-shot report', () => {
  assert.ok(c02);
  const preparation = c02.evidence?.profile_preparation;
  assert.ok(preparation);
  assert.equal(preparation.profileId, 'c02-cardcaptor-tv-movie-v1');
  assert.equal(preparation.acceptanceScope, 'frontier-scenario-only');

  if (c02.status === 'UNASSESSED') {
    assert.equal(preparation.scenarioAcceptance, 'NOT_ACCEPTED');
    assert.ok(/Keep C02 UNASSESSED/u.test(c02.next_action));
    assert.equal(c02.source_refs.includes(reportPath), false);
    assert.equal(existsSync(path.join(ROOT, reportPath)), false);
    return;
  }

  assert.equal(c02.status, 'PARTIAL');
  assert.equal(preparation.state, 'REPORT_WRITTEN_ACCEPTED');
  assert.equal(preparation.scenarioAcceptance, 'PARTIAL_ACCEPTED');
  assert.ok(c02.source_refs.includes(reportPath));
  assert.equal(existsSync(path.join(ROOT, reportPath)), true);
  const report = JSON.parse(readFileSync(path.join(ROOT, reportPath), 'utf8'));
  assert.equal(report.profileId, preparation.profileId);
  assert.equal(report.acceptanceScope, preparation.acceptanceScope);
  assert.equal(report.privacy.rawAnswerStored, false);
  assert.equal(report.privacy.rawResultStored, false);
});
