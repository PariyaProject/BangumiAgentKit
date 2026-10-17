import assert from 'node:assert/strict';
import test from 'node:test';
import {
  A01_RATING_DISPERSION_MAX_REQUESTS,
  A01_RATING_DISPERSION_PROFILE_ID,
  assertA01RatingDispersionProfile,
  createA01RatingDispersionPublicFetch,
} from '../../scripts/lib/a01-rating-dispersion-profile.mjs';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { summarizeA01RatingDispersionResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';

test('A01 rating-dispersion profile accepts only its registered one-tool contract', () => {
  const profile = getAgentMcpProfileById(A01_RATING_DISPERSION_PROFILE_ID);
  assert.equal(assertA01RatingDispersionProfile(profile), true);
  assert.equal(
    assertA01RatingDispersionProfile({
      ...profile,
      answerProfile: { ...profile.answerProfile, maxSubjects: 8 },
    }),
    false,
  );
  assert.equal(A01_RATING_DISPERSION_MAX_REQUESTS, 20);
});

test('A01 rating-dispersion fetch permits only canonical anonymous v0 search and detail calls', async () => {
  const observed = [];
  const guard = createA01RatingDispersionPublicFetch({
    fetchImpl: async (input, init) => {
      observed.push({ url: String(input), method: init.method, redirect: init.redirect });
      return new Response('{}', { status: 200 });
    },
  });

  await guard.fetchFn('https://api.bgm.tv/v0/search/subjects?limit=20&offset=0', {
    method: 'POST',
    body: '{}',
  });
  await guard.fetchFn('https://api.bgm.tv/v0/subjects/1940', { method: 'GET' });

  assert.deepEqual(
    observed.map(({ method, redirect }) => ({ method, redirect })),
    [
      { method: 'POST', redirect: 'error' },
      { method: 'GET', redirect: 'error' },
    ],
  );
  assert.deepEqual(guard.snapshot(), {
    requestCount: 2,
    allowedRequestCount: 2,
    deniedRequestCount: 0,
    searchRequestCount: 1,
    detailRequestCount: 1,
    credentialAttemptCount: 0,
    unexpectedRouteCount: 0,
    budgetExceeded: false,
    maxRequests: 20,
    anonymousOnly: true,
    officialV0Only: true,
    searchPagination: 'limit-20-offset-0-only',
    redirectPolicy: 'error',
  });
});

test('A01 rating-dispersion fetch denies credential, query, host, route, and over-budget attempts', async () => {
  assert.throws(
    () => createA01RatingDispersionPublicFetch({ maxRequests: 21 }),
    /cap from 1 to 20/u,
  );
  let nativeFetchCalls = 0;
  const guard = createA01RatingDispersionPublicFetch({
    maxRequests: 1,
    fetchImpl: async () => {
      nativeFetchCalls += 1;
      return new Response('{}', { status: 200 });
    },
  });

  await assert.rejects(
    guard.fetchFn('https://api.bgm.tv/v0/search/subjects?limit=20&offset=20', { method: 'POST' }),
    /denied an unregistered anonymous v0 request/u,
  );
  await assert.rejects(
    guard.fetchFn(
      'https://api.bgm.tv/v0/search/subjects?limit=20&offset=0&access_token=not-retained',
      {
        method: 'POST',
      },
    ),
    /denied an unregistered anonymous v0 request/u,
  );
  await assert.rejects(
    guard.fetchFn('https://api.bgm.tv/v0/search/subjects?limit=20&offset=0', {
      method: 'POST',
      headers: { 'x-session-token': 'not-retained' },
    }),
    /denied an unregistered anonymous v0 request/u,
  );
  await assert.rejects(
    guard.fetchFn('https://example.invalid/v0/subjects/1940', { method: 'GET' }),
    /denied an unregistered anonymous v0 request/u,
  );
  await assert.rejects(
    guard.fetchFn('https://api.bgm.tv/v0/subjects/1940?responseGroup=large', { method: 'GET' }),
    /denied an unregistered anonymous v0 request/u,
  );
  await guard.fetchFn('https://api.bgm.tv/v0/search/subjects?limit=20&offset=0', {
    method: 'POST',
  });
  await assert.rejects(
    guard.fetchFn('https://api.bgm.tv/v0/subjects/1940', { method: 'GET' }),
    /request budget exceeded/u,
  );

  assert.equal(nativeFetchCalls, 1);
  assert.deepEqual(guard.snapshot(), {
    requestCount: 1,
    allowedRequestCount: 1,
    deniedRequestCount: 6,
    searchRequestCount: 1,
    detailRequestCount: 0,
    credentialAttemptCount: 2,
    unexpectedRouteCount: 4,
    budgetExceeded: true,
    maxRequests: 1,
    anonymousOnly: false,
    officialV0Only: false,
    searchPagination: 'limit-20-offset-0-only',
    redirectPolicy: 'error',
  });
});

test('A01 rating-dispersion summary retains bounded numeric evidence without titles or raw rows', () => {
  const summary = summarizeA01RatingDispersionResult({
    state: 'partial',
    cohorts: [
      {
        label: 'sensitive title text is excluded',
        coverage: {
          query: { state: 'partial' },
          detailHydrationsAttempted: 1,
          detailHydrationsSucceeded: 1,
          detailHydrationsFailed: 0,
        },
        subjects: [
          {
            id: 1940,
            name: 'title is excluded',
            metricStates: { ratingStandardDeviation: 'available' },
          },
        ],
      },
      {
        coverage: { query: { state: 'partial' }, detailHydrationsAttempted: 0 },
        subjects: [],
      },
    ],
    metrics: [
      {
        key: 'ratingStandardDeviation',
        state: 'partial',
        formula: { id: 'bangumi.rating.population_sd.v1', version: 1 },
        averages: [null, null],
        partialAverages: [1.25, null],
        validCounts: [1, 0],
        partialCounts: [0, 0],
        missingCounts: [0, 0],
        conflictCounts: [0, 0],
        notComputableCounts: [0, 0],
      },
    ],
    coverage: {
      maxSubjectsPerCohort: 4,
      totalSubjectsReturned: 1,
      cohortsComplete: 0,
      cohortsPartial: 2,
      detailHydrationsAttempted: 1,
      detailHydrationsSucceeded: 1,
      detailHydrationsFailed: 0,
      truncated: true,
      overlap: { subjectIds: [], count: 0 },
    },
  });

  assert.deepEqual(summary.cohorts[0].subjectIds, [1940]);
  assert.equal(summary.ratingStandardDeviation.formulaId, 'bangumi.rating.population_sd.v1');
  assert.equal(summary.ratingStandardDeviation.partialAverages[0], 1.25);
  assert.equal(JSON.stringify(summary).includes('title'), false);
  assert.equal(JSON.stringify(summary).includes('label'), false);
});
