import assert from 'node:assert/strict';
import test from 'node:test';
import {
  C07_COHORT_RENDER_OFFLINE_FIXTURE_PROFILE,
  C07_COHORT_RENDER_EXPECTED_ARGUMENTS,
  assertC07CohortRenderOfflineProfile,
  createC07CohortRenderOfflineFixtureFetch,
} from '../../scripts/lib/c07-cohort-render-offline-fixture.mjs';

test('C07 offline mode is bound to the exact read-only renderer and fixed arguments', () => {
  assert.equal(
    assertC07CohortRenderOfflineProfile({
      networkMode: C07_COHORT_RENDER_OFFLINE_FIXTURE_PROFILE,
      toolName: 'bangumi.render_subject_cohort_comparison',
      expectedArguments: C07_COHORT_RENDER_EXPECTED_ARGUMENTS,
    }),
    true,
  );
  assert.equal(
    assertC07CohortRenderOfflineProfile({
      toolName: 'bangumi.compare_subject_cohorts',
      expectedArguments: C07_COHORT_RENDER_EXPECTED_ARGUMENTS,
    }),
    false,
  );
  assert.throws(() =>
    assertC07CohortRenderOfflineProfile({
      networkMode: C07_COHORT_RENDER_OFFLINE_FIXTURE_PROFILE,
      toolName: 'bangumi.compare_subject_cohorts',
      expectedArguments: C07_COHORT_RENDER_EXPECTED_ARGUMENTS,
    }),
  );
  assert.throws(() =>
    assertC07CohortRenderOfflineProfile({
      networkMode: C07_COHORT_RENDER_OFFLINE_FIXTURE_PROFILE,
      toolName: 'bangumi.render_subject_cohort_comparison',
      expectedArguments: { cohorts: [] },
    }),
  );
});

test('C07 offline fixture serves only two fixed cohort searches and their subject details', async () => {
  const fixture = createC07CohortRenderOfflineFixtureFetch();
  const search = async (keyword) => {
    const response = await fixture.fetchFn(
      `https://api.bgm.tv/v0/search/subjects?limit=20&offset=0`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ keyword, sort: 'match', filter: { type: [2] } }),
      },
    );
    assert.equal(response.status, 200);
    return response.json();
  };

  const cohortA = await search('run95 synthetic cohort a');
  const cohortB = await search('run95 synthetic cohort b');
  assert.equal(cohortA.data[0].id, 990101);
  assert.equal(cohortB.data[0].id, 990102);

  const detailA = await fixture.fetchFn('https://api.bgm.tv/v0/subjects/990101', {
    method: 'GET',
  });
  const detailB = await fixture.fetchFn('https://api.bgm.tv/v0/subjects/990102', {
    method: 'GET',
  });
  assert.equal((await detailA.json()).rating.score, 5);
  assert.equal((await detailB.json()).rating.score, 8);

  const snapshot = fixture.snapshot();
  assert.deepEqual(snapshot, {
    profile: C07_COHORT_RENDER_OFFLINE_FIXTURE_PROFILE,
    requestCount: 4,
    searchRequestCount: 2,
    detailRequestCount: 2,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
  });
  assert.equal(JSON.stringify(snapshot).includes('Synthetic Cohort'), false);
});

test('C07 offline fixture rejects duplicate, unexpected, and authenticated requests', async () => {
  const fixture = createC07CohortRenderOfflineFixtureFetch();
  const first = await fixture.fetchFn('https://api.bgm.tv/v0/search/subjects?limit=20&offset=0', {
    method: 'POST',
    body: JSON.stringify({
      keyword: 'run95 synthetic cohort a',
      sort: 'match',
      filter: { type: [2] },
    }),
  });
  assert.equal(first.status, 200);

  const duplicate = await fixture.fetchFn(
    'https://api.bgm.tv/v0/search/subjects?limit=20&offset=0',
    {
      method: 'POST',
      body: JSON.stringify({
        keyword: 'run95 synthetic cohort a',
        sort: 'match',
        filter: { type: [2] },
      }),
    },
  );
  const unexpected = await fixture.fetchFn('https://api.bgm.tv/v0/me', { method: 'GET' });
  const authenticated = await fixture.fetchFn(
    'https://api.bgm.tv/v0/search/subjects?limit=20&offset=0',
    {
      method: 'POST',
      headers: { authorization: 'Bearer fixture-is-not-a-credential' },
      body: JSON.stringify({
        keyword: 'run95 synthetic cohort b',
        sort: 'match',
        filter: { type: [2] },
      }),
    },
  );

  assert.equal(duplicate.status, 599);
  assert.equal(unexpected.status, 599);
  assert.equal(authenticated.status, 599);
  assert.deepEqual(fixture.snapshot(), {
    profile: C07_COHORT_RENDER_OFFLINE_FIXTURE_PROFILE,
    requestCount: 4,
    searchRequestCount: 1,
    detailRequestCount: 0,
    unexpectedRequestCount: 3,
    authorizationHeaderCount: 1,
    expectedOperationsComplete: false,
  });
});
