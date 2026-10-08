import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ledger = JSON.parse(
  readFileSync(path.join(root, 'docs/product/frontier-ledger.json'), 'utf8'),
);

test('consumed Run 95 S03 one-shot stays partial and cannot be retried', () => {
  const record = ledger.records.find(({ id }) => id === 'S03');
  assert.ok(record, 'S03 must remain in the canonical frontier');
  assert.equal(record.status, 'PARTIAL');
  assert.ok(
    record.source_refs.includes('docs/research/run95-s03-one-shot-disposition-2026-10-09.md'),
  );
  assert.match(record.next_action, /one-shot is consumed/u);
  assert.match(record.next_action, /INCONCLUSIVE/u);
  assert.match(record.next_action, /Never retry/u);
  assert.match(record.next_action, /different safe unspent frontier/u);
  assert.doesNotMatch(record.next_action, /then make the single .* call/u);
});
