import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validSelectedEpisodePage } from '../../scripts/acceptance/calendar-account-closed-contract.mjs';

const page = () => ({
  items: [
    { type: 1, status: 'wish', episode: { subjectId: 991402, rawType: 0, category: 'main' } },
  ],
  offset: 0,
  limit: 1,
  coverage: {
    observed: 1,
    returned: 1,
    requestedLimit: 1,
    effectiveLimit: 1,
    offset: 0,
    truncated: true,
  },
  source: { authScope: 'account', operation: 'GET /v0/users/-/collections/{subject_id}/episodes' },
});
test('the actual DomainEpisode rawType/category DTO validates without an invented type field', () => {
  assert.equal(validSelectedEpisodePage(page(), 991402), true);
});
test('a legacy-looking invented episode type cannot replace main-category provenance', () => {
  const value = page();
  delete value.items[0].episode.rawType;
  delete value.items[0].episode.category;
  value.items[0].episode.type = 0;
  assert.equal(validSelectedEpisodePage(value, 991402), false);
});
test('selection identity, collection status, page bounds and account source remain mandatory', () => {
  for (const change of [
    (v) => v.items[0].episode.subjectId++,
    (v) => v.items.push(v.items[0]),
    (v) => (v.items[0].type = 0),
    (v) => (v.items[0].status = 'unknown'),
    (v) => (v.items[0].episode.rawType = 1),
    (v) => (v.items[0].episode.category = 'sp'),
    (v) => (v.coverage.returned = 2),
    (v) => (v.coverage.observed = 0),
    (v) => (v.coverage.requestedLimit = 2),
    (v) => (v.coverage.truncated = false),
    (v) => (v.source.authScope = 'public'),
    (v) => (v.source.operation = 'other'),
    (v) => (v.coverage.effectiveLimit = 2),
    (v) => (v.coverage.offset = 1),
  ]) {
    const value = page();
    change(value);
    assert.equal(validSelectedEpisodePage(value, 991402), false);
  }
  assert.equal(validSelectedEpisodePage(page(), undefined), false);
});
