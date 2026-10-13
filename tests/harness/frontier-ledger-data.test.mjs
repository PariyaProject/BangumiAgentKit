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
  assert.match(record.next_action, /one-shot (?:is|remains) consumed/u);
  assert.match(record.next_action, /INCONCLUSIVE/u);
  assert.match(record.next_action, /Never retry/u);
  assert.match(record.next_action, /different safe unspent frontier/u);
  assert.doesNotMatch(record.next_action, /then make the single .* call/u);
});

test('G04 frontier keeps stable query policy without Run 95 attempt state', () => {
  const record = ledger.records.find(({ id }) => id === 'G04');
  assert.ok(record, 'G04 must remain in the canonical frontier');
  const serialized = JSON.stringify(record);
  assert.doesNotMatch(serialized, /NOT_ATTEMPTED|claim_state|acceptance_count_advanced/u);
  assert.match(record.next_action, /assigned same-identity Luna Max PASS/u);
});

test('G16 frontier records its terminal Run 95 one-shot without retry guidance', () => {
  const record = ledger.records.find(({ id }) => id === 'G16');
  assert.ok(record, 'G16 must remain in the canonical frontier');
  assert.match(record.next_action, /PARTIAL/u);
  assert.match(record.next_action, /PR #137/u);
  assert.match(record.next_action, /INCONCLUSIVE/u);
  assert.match(record.next_action, /retryAllowed=false/u);
  assert.match(record.next_action, /Never rerun/u);
  assert.match(record.next_action, /complete director-filmography claim/u);
  assert.match(record.evidence.source_contract, /G16 query was invoked once through PR #137/u);
  assert.match(
    record.evidence.source_contract,
    /INCONCLUSIVE with no report and retryAllowed=false/u,
  );
  assert.doesNotMatch(record.evidence.source_contract, /no G16 one-shot query has been performed/u);
});

test('R01 frontier records the consumed terminal attempt without inviting a follow-up', () => {
  const record = ledger.records.find(({ id }) => id === 'R01');
  assert.ok(record, 'R01 must remain in the canonical frontier');
  assert.equal(record.status, 'PARTIAL');
  assert.match(record.next_action, /PR #147/u);
  assert.match(record.next_action, /INCONCLUSIVE\/no-report\/retryAllowed=false/u);
  assert.match(record.next_action, /Never rerun/u);
  assert.match(record.next_action, /fixed subjectId=41529\/includeEvidence=true profile/u);
  assert.doesNotMatch(
    record.next_action,
    /still-unspent one-shot|fresh Base-bound follow-up Epoch ID/u,
  );
});

test('spent D07, P01, and A01 one-shots stay terminal in frontier guidance', () => {
  const expected = [
    {
      id: 'D07',
      status: 'UNASSESSED',
      attempt: /PR #158/u,
      terminal: /INCONCLUSIVE\/no-report\/retryAllowed=false/u,
      noRetry: /Never rerun/u,
    },
    {
      id: 'P01',
      status: 'UNASSESSED',
      attempt: /PR #135/u,
      terminal: /INCONCLUSIVE\/no-report\/retryAllowed=false/u,
      noRetry: /Never rerun/u,
    },
    {
      id: 'A01',
      status: 'UNASSESSED',
      attempt: /one-shot was invoked once/u,
      terminal: /consumed INCONCLUSIVE:/u,
      noRetry: /never retry or count it/u,
    },
  ];

  for (const item of expected) {
    const record = ledger.records.find(({ id }) => id === item.id);
    assert.ok(record, `${item.id} must remain in the canonical frontier`);
    assert.equal(record.status, item.status);
    assert.match(record.next_action, item.attempt);
    assert.match(record.next_action, item.terminal);
    assert.match(record.next_action, item.noRetry);
    assert.doesNotMatch(record.next_action, /still-unspent one-shot|one-shot query may run/u);
  }
});

test('community source closure is evidence-bound and keeps discussion scenarios unresolved', () => {
  const source = ledger.records.find(({ id }) => id === 'SOURCE-COMMUNITY-STRUCTURED-WEB');
  assert.ok(source, 'the community source frontier must remain in the canonical ledger');
  assert.equal(source.status, 'CLOSED_NO_SAFE_SOURCE');
  assert.ok(
    source.source_refs.includes(
      'docs/research/run95-community-public-source-contract-2026-10-13.md',
    ),
  );
  assert.ok(
    source.research_closure.evidence_refs.includes(
      'docs/research/run95-community-public-source-contract-2026-10-13.md',
    ),
  );
  assert.match(source.closure_reason, /current explicit allowlist/u);
  assert.match(source.reopen_when, /official public API/u);

  for (const id of ['G10', 'G11', 'G21']) {
    assert.equal(ledger.records.find(({ id: current }) => current === id)?.status, 'PARTIAL');
  }
  assert.equal(ledger.records.find(({ id }) => id === 'OP-003')?.status, 'RESEARCH_READY');
});
