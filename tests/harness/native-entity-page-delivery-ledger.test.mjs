import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (name) => readFileSync(new URL('../../' + name, import.meta.url));
const json = (name) => JSON.parse(read(name));
const bundle = 'docs/live-probes/run95-entity-page-account-source-compatibility-2026-11-06';

test('OP009 routes past completed native source compatibility without granting fresh live credit', () => {
  const row = json('docs/product/frontier-ledger.json').records.find((r) => r.id === 'OP-009');
  const page = row.native_entity_pagination_2026_11_06;
  const manifest = json(bundle + '/import-corrected.json');
  const proofBytes = read(bundle + '/native-proof-corrected.json');
  const proof = JSON.parse(proofBytes);
  assert.equal(row.status, 'PARTIAL');
  assert.equal(
    row.person_collection_wire_repair_2026_11_05.state,
    'delivered-by-PR290-historical-source-witness',
  );
  assert.doesNotMatch(
    JSON.stringify(row.person_collection_wire_repair_2026_11_05),
    /review-pending|integration review pending/iu,
  );
  assert.equal(page.state, 'native-paging-and-sealed-compiled-source-compatibility-delivered');
  assert.equal(page.compiled_compatibility, bundle + '/import-corrected.json');
  assert.equal(page.compiled_proof, bundle + '/native-proof-corrected.json');
  assert.equal(page.source_basis_revision, proof.sourceRevision);
  assert.equal(
    createHash('sha256').update(proofBytes).digest('hex'),
    manifest.evidenceFiles['native-proof-corrected.json'],
  );
  assert.equal(proof.passed, true);
  assert.equal(page.offline_verification.emitted_javascript, proof.projection.emittedFiles.length);
  assert.equal(page.offline_verification.overlays, proof.projection.files.length);
  assert.equal(page.offline_verification.protected_files, Object.keys(proof.protectedFiles).length);
  assert.equal(page.offline_verification.historical_inputs, proof.exactInputs.length);
  assert.equal(page.offline_verification.new_native_cases, proof.page.native.results.length);
  assert.equal(page.offline_verification.synthetic_fetches, proof.page.provider.calls.length);
  for (const name of [
    page.compiled_compatibility,
    page.compiled_proof,
    'docs/research/run95-entity-page-compiled-account-compatibility-contract-2026-11-06.md',
    'scripts/acceptance/entity_page_account_compatibility.py',
    'scripts/test_entity_page_account_compatibility.py',
    'tests/unit/http-response-lifetime.test.ts',
  ])
    assert.ok(row.source_refs.includes(name), name);
  assert.doesNotMatch(
    row.next_action,
    /still owes actual compiled|not yet account-source compatible|compatibility-pending/iu,
  );
  assert.match(row.next_action, /genuinely new native-page public\/model verification/u);
  assert.match(row.next_action, /public63\/65, Agent84\/96, account12\/33 and QQ0\/TIM0/u);
  assert.match(row.next_action, /deployed support remains unobserved/u);
  assert.match(row.next_action, /Preserve65\/all96 targets/u);
  assert.equal(page.first_candidate_witness.bytes_preserved, true);
  for (const key of ['import', 'proof']) {
    const name = page.first_candidate_witness[key];
    assert.equal(createHash('sha256').update(read(name)).digest('hex'), proof.protectedFiles[name]);
  }
});
