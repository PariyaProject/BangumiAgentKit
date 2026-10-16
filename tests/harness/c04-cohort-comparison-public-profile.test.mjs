import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertC04CohortComparisonPublicProfile,
  createC04CohortComparisonPublicFetch,
  C04_COHORT_COMPARISON_MAX_REQUESTS_PER_RUN,
  C04_COHORT_COMPARISON_PROFILE_ID,
} from '../../scripts/lib/c04-cohort-comparison-public-profile.mjs';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';

test('C04 public profile accepts only anonymous official v0 search and subject detail routes', async () => {
  const profile = getAgentMcpProfileById(C04_COHORT_COMPARISON_PROFILE_ID);
  assert.equal(assertC04CohortComparisonPublicProfile(profile), true);
  assert.equal(
    assertC04CohortComparisonPublicProfile({ ...profile, toolNames: ['bangumi.auth_status'] }),
    false,
  );

  const observed = [];
  const guard = createC04CohortComparisonPublicFetch({
    fetchImpl: async (input, init) => {
      observed.push({ url: String(input), method: init.method, redirect: init.redirect });
      return new Response('{}', { status: 200 });
    },
  });
  await guard.fetchFn('https://api.bgm.tv/v0/search/subjects', {
    method: 'POST',
    body: '{}',
  });
  await guard.fetchFn('https://api.bgm.tv/v0/subjects/41529', { method: 'GET' });
  assert.deepEqual(observed.map(({ method, redirect }) => ({ method, redirect })), [
    { method: 'POST', redirect: 'error' },
    { method: 'GET', redirect: 'error' },
  ]);
  assert.deepEqual(guard.snapshot(), {
    requestCount: 2,
    allowedRequestCount: 2,
    deniedRequestCount: 0,
    credentialAttemptCount: 0,
    unexpectedRouteCount: 0,
    budgetExceeded: false,
    maxRequests: 16,
    anonymousOnly: true,
    officialV0Only: true,
    redirectPolicy: 'error',
  });
});

test('C04 public profile denies private, off-host, credential-bearing, redirected, and over-budget requests', async () => {
  assert.equal(C04_COHORT_COMPARISON_MAX_REQUESTS_PER_RUN, 16);
  assert.throws(() => createC04CohortComparisonPublicFetch({ maxRequests: 17 }), /cap from 1 to 16/u);
  let nativeFetchCalls = 0;
  const guard = createC04CohortComparisonPublicFetch({
    maxRequests: 1,
    fetchImpl: async () => {
      nativeFetchCalls += 1;
      return new Response('{}', { status: 200 });
    },
  });
  await assert.rejects(
    guard.fetchFn('https://api.bgm.tv/p1/subjects'),
    /denied an unregistered anonymous v0 request/u,
  );
  await assert.rejects(
    guard.fetchFn('https://example.invalid/v0/search/subjects', { method: 'POST' }),
    /denied an unregistered anonymous v0 request/u,
  );
  await assert.rejects(
    guard.fetchFn('https://api.bgm.tv/v0/search/subjects?access_token=not-retained', {
      method: 'POST',
    }),
    /denied an unregistered anonymous v0 request/u,
  );
  await assert.rejects(
    guard.fetchFn('https://api.bgm.tv/v0/search/subjects', {
      method: 'POST',
      headers: { authorization: 'Bearer never-use-a-token' },
    }),
    /denied an unregistered anonymous v0 request/u,
  );
  await assert.rejects(
    guard.fetchFn('https://user:pass@api.bgm.tv/v0/subjects/41529', { method: 'GET' }),
    /denied an unregistered anonymous v0 request/u,
  );
  await guard.fetchFn('https://api.bgm.tv/v0/search/subjects', { method: 'POST' });
  await assert.rejects(
    guard.fetchFn('https://api.bgm.tv/v0/subjects/41529', { method: 'GET' }),
    /request budget exceeded/u,
  );
  assert.equal(nativeFetchCalls, 1);
  assert.deepEqual(guard.snapshot(), {
    requestCount: 1,
    allowedRequestCount: 1,
    deniedRequestCount: 6,
    credentialAttemptCount: 2,
    unexpectedRouteCount: 3,
    budgetExceeded: true,
    maxRequests: 1,
    anonymousOnly: false,
    officialV0Only: false,
    redirectPolicy: 'error',
  });
});
