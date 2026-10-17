import assert from 'node:assert/strict';
import test from 'node:test';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  createG01RenderQueryOfflineAssetResolver,
  createG01RenderQueryOfflineFetch,
  assertG01RenderQueryOfflineFixtureProfile,
} from '../../scripts/lib/g01-render-query-subjects-offline-fixture.mjs';
import {
  G01_RENDER_QUERY_OFFLINE_ARGUMENT_PROFILE,
  G01_RENDER_QUERY_OFFLINE_EXPECTED_ARGUMENTS,
  G01_RENDER_QUERY_OFFLINE_NETWORK_MODE,
  G01_RENDER_QUERY_OFFLINE_PROFILE_ID,
  assertG01RenderQueryOfflineProfile,
} from '../../scripts/lib/g01-render-query-subjects-offline-profile.mjs';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';

const PROFILE = getAgentMcpProfileById(G01_RENDER_QUERY_OFFLINE_PROFILE_ID);
const SEARCH_URL = 'https://api.bgm.tv/v0/search/subjects?limit=20&offset=0';
const DETAIL_URL = 'https://api.bgm.tv/v0/subjects/990920';
const SEARCH_BODY = {
  keyword: 'run95 g01 synthetic render query offline 20261017',
  sort: 'match',
  filter: { type: [2] },
};

test('G01 offline profile is fixed to the registered synthetic render-query matrix call', () => {
  assert.equal(assertG01RenderQueryOfflineProfile(PROFILE), true);
  assert.equal(assertG01RenderQueryOfflineProfile({ id: 'different-profile' }), false);
  assert.equal(assertG01RenderQueryOfflineFixtureProfile(PROFILE), true);
  assert.equal(PROFILE.argumentProfile, G01_RENDER_QUERY_OFFLINE_ARGUMENT_PROFILE);
  assert.throws(() => assertG01RenderQueryOfflineProfile({ ...PROFILE, networkMode: 'live' }));
  assert.throws(() =>
    assertG01RenderQueryOfflineProfile({
      ...PROFILE,
      calls: [
        {
          ...PROFILE.calls[0],
          arguments: { ...G01_RENDER_QUERY_OFFLINE_EXPECTED_ARGUMENTS, maxSubjects: 2 },
        },
      ],
    }),
  );
});

test('G01 fixture serves exactly one synthetic search and one subject detail response', async () => {
  const fixture = createG01RenderQueryOfflineFetch();
  const search = await fixture.fetchFn(SEARCH_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(SEARCH_BODY),
  });
  const detail = await fixture.fetchFn(DETAIL_URL);

  assert.equal(search.status, 200);
  assert.equal((await search.json()).data[0].id, 990920);
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).id, 990920);
  const snapshot = fixture.snapshot();
  assert.deepEqual(snapshot, {
    profile: G01_RENDER_QUERY_OFFLINE_NETWORK_MODE,
    requestCount: 2,
    searchRequestCount: 1,
    subjectDetailRequestCount: 1,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
    rawFixturePayloadStored: false,
  });
  assert.equal(JSON.stringify(snapshot).includes('G01 Synthetic Render Query'), false);
});

test('G01 fixture rejects duplicate, query-drift, method, auth, and wrong-origin requests', async () => {
  const fixture = createG01RenderQueryOfflineFetch();
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
  const wrongOrigin = await fixture.fetchFn('https://example.invalid/v0/subjects/990920');

  assert.equal(valid.status, 200);
  for (const rejected of [duplicate, queryDrift, methodDrift, authenticated, wrongOrigin]) {
    assert.equal(rejected.status, 599);
  }
  assert.deepEqual(fixture.snapshot(), {
    profile: G01_RENDER_QUERY_OFFLINE_NETWORK_MODE,
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

test('G01 render-query asset guard blocks all remote asset resolution', async () => {
  const guard = createG01RenderQueryOfflineAssetResolver();
  await assert.rejects(guard.assetResolver.resolveAsset('https://images.example.invalid/a.png'));
  assert.deepEqual(guard.snapshot(), {
    assetResolutionCallCount: 1,
    nonEmptyAssetUrlCount: 1,
    blockedAssetRequestCount: 1,
  });
});

test('G01 render-query result projection retains only bounded PNG metadata', () => {
  const summary = summarizeProfileToolResult(
    { artifact: { id: 'ephemeral-artifact-id' }, sourceOperations: [{ rows: ['private row'] }] },
    G01_RENDER_QUERY_OFFLINE_EXPECTED_ARGUMENTS,
    G01_RENDER_QUERY_OFFLINE_PROFILE_ID,
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
    'bangumi.render_query_subjects',
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
