import assert from 'node:assert/strict';
import test from 'node:test';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  createC07RenderComparisonOfflineAssetGuard,
  createC07RenderComparisonOfflineFetch,
  assertC07RenderComparisonOfflineFixtureProfile,
} from '../../scripts/lib/c07-render-comparison-offline-fixture.mjs';
import {
  C07_RENDER_COMPARISON_OFFLINE_ARGUMENT_PROFILE,
  C07_RENDER_COMPARISON_OFFLINE_EXPECTED_ARGUMENTS,
  C07_RENDER_COMPARISON_OFFLINE_NETWORK_MODE,
  C07_RENDER_COMPARISON_OFFLINE_PROFILE_ID,
  assertC07RenderComparisonOfflineProfile,
} from '../../scripts/lib/c07-render-comparison-offline-profile.mjs';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';

const PROFILE = getAgentMcpProfileById(C07_RENDER_COMPARISON_OFFLINE_PROFILE_ID);
const SEARCH_URL = 'https://api.bgm.tv/v0/search/subjects?limit=20&offset=0';
const DETAIL_URL = 'https://api.bgm.tv/v0/subjects/990301';
const SEARCH_BODY = {
  keyword: 'run95 c07 synthetic cohort c offline 20261017',
  sort: 'match',
  filter: { type: [2] },
};

test('C07 offline profile is fixed to the registered cohort C renderer matrix call', () => {
  assert.equal(assertC07RenderComparisonOfflineProfile(PROFILE), true);
  assert.equal(assertC07RenderComparisonOfflineProfile({ id: 'different-profile' }), false);
  assert.equal(assertC07RenderComparisonOfflineFixtureProfile(PROFILE), true);
  assert.equal(PROFILE.argumentProfile, C07_RENDER_COMPARISON_OFFLINE_ARGUMENT_PROFILE);
  assert.throws(() => assertC07RenderComparisonOfflineProfile({ ...PROFILE, networkMode: 'live' }));
  assert.throws(() =>
    assertC07RenderComparisonOfflineProfile({
      ...PROFILE,
      calls: [
        {
          ...PROFILE.calls[0],
          arguments: { ...C07_RENDER_COMPARISON_OFFLINE_EXPECTED_ARGUMENTS, maxSubjects: 2 },
        },
      ],
    }),
  );
});

test('C07 fixture serves exactly one synthetic search and one subject detail response', async () => {
  const fixture = createC07RenderComparisonOfflineFetch();
  const search = await fixture.fetchFn(SEARCH_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(SEARCH_BODY),
  });
  const detail = await fixture.fetchFn(DETAIL_URL);

  assert.equal(search.status, 200);
  assert.equal((await search.json()).data[0].id, 990301);
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).id, 990301);
  const snapshot = fixture.snapshot();
  assert.deepEqual(snapshot, {
    profile: C07_RENDER_COMPARISON_OFFLINE_NETWORK_MODE,
    requestCount: 2,
    searchRequestCount: 1,
    subjectDetailRequestCount: 1,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
    rawFixturePayloadStored: false,
  });
  assert.equal(JSON.stringify(snapshot).includes('Synthetic Cohort C'), false);
});

test('C07 fixture rejects duplicate, query-drift, method, auth, and wrong-origin requests', async () => {
  const fixture = createC07RenderComparisonOfflineFetch();
  const valid = await fixture.fetchFn(SEARCH_URL, {
    method: 'POST',
    body: JSON.stringify(SEARCH_BODY),
  });
  const duplicate = await fixture.fetchFn(SEARCH_URL, {
    method: 'POST',
    body: JSON.stringify(SEARCH_BODY),
  });
  const queryDrift = await fixture.fetchFn(
    'https://api.bgm.tv/v0/search/subjects?limit=21&offset=0',
    { method: 'POST', body: JSON.stringify(SEARCH_BODY) },
  );
  const methodDrift = await fixture.fetchFn(DETAIL_URL, { method: 'POST' });
  const authenticated = await fixture.fetchFn(DETAIL_URL, {
    headers: { authorization: 'Bearer synthetic-test-only' },
  });
  const wrongOrigin = await fixture.fetchFn('https://example.invalid/v0/subjects/990301');

  assert.equal(valid.status, 200);
  for (const rejected of [duplicate, queryDrift, methodDrift, authenticated, wrongOrigin]) {
    assert.equal(rejected.status, 599);
  }
  assert.deepEqual(fixture.snapshot(), {
    profile: C07_RENDER_COMPARISON_OFFLINE_NETWORK_MODE,
    requestCount: 6,
    searchRequestCount: 1,
    subjectDetailRequestCount: 0,
    duplicateRequestCount: 1,
    unexpectedRequestCount: 5,
    authorizationHeaderCount: 1,
    expectedOperationsComplete: false,
    rawFixturePayloadStored: false,
  });
});

test('C07 renderer asset guard blocks all remote asset resolution', async () => {
  const guard = createC07RenderComparisonOfflineAssetGuard();
  await assert.rejects(guard.assetResolver.resolveAsset('https://images.example.invalid/a.png'));
  assert.deepEqual(guard.snapshot(), {
    assetResolutionCallCount: 1,
    nonEmptyAssetUrlCount: 1,
    blockedAssetRequestCount: 1,
  });
});

test('C07 renderer result projection retains only bounded PNG metadata', () => {
  const summary = summarizeProfileToolResult(
    { artifact: { id: 'ephemeral-artifact-id' }, sourceOperations: [{ rows: ['private row'] }] },
    C07_RENDER_COMPARISON_OFFLINE_EXPECTED_ARGUMENTS,
    C07_RENDER_COMPARISON_OFFLINE_PROFILE_ID,
    {
      returned: true,
      persisted: false,
      mimeType: 'image/png',
      width: 640,
      height: 480,
      byteLength: 1234,
      sha256: 'a'.repeat(64),
      pngSignatureValid: true,
    },
    'bangumi.render_subject_cohort_comparison',
  );
  assert.deepEqual(summary, {
    resultState: 'artifact_returned',
    artifact: {
      returned: true,
      persisted: false,
      mimeType: 'image/png',
      width: 640,
      height: 480,
      byteLength: 1234,
      sha256: 'a'.repeat(64),
      pngSignatureValid: true,
    },
  });
  assert.equal(JSON.stringify(summary).includes('private row'), false);
  assert.equal(JSON.stringify(summary).includes('ephemeral-artifact-id'), false);
});
