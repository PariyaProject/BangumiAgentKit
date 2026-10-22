import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createG01QuerySubjectsOfflineFetch,
  assertG01QuerySubjectsOfflineFixtureProfile,
} from '../../scripts/lib/g01-query-subjects-offline-matrix-fixture.mjs';
import {
  assertG01QuerySubjectsOfflineProfile,
  assertG01QuerySubjectsOfflineV2Profile,
  G01_QUERY_SUBJECTS_OFFLINE_EXPECTED_ARGUMENTS,
  G01_QUERY_SUBJECTS_OFFLINE_NETWORK_MODE,
  G01_QUERY_SUBJECTS_OFFLINE_PROFILE_ID,
  G01_QUERY_SUBJECTS_OFFLINE_SYNTHETIC_KEYWORD,
  G01_QUERY_SUBJECTS_OFFLINE_SYNTHETIC_SUBJECT_ID,
  G01_QUERY_SUBJECTS_OFFLINE_V2_EXPECTED_ARGUMENTS,
  G01_QUERY_SUBJECTS_OFFLINE_V2_NETWORK_MODE,
  G01_QUERY_SUBJECTS_OFFLINE_V2_PROFILE_ID,
  G01_QUERY_SUBJECTS_OFFLINE_V2_SYNTHETIC_KEYWORD,
  G01_QUERY_SUBJECTS_OFFLINE_V2_SYNTHETIC_SUBJECT_ID,
} from '../../scripts/lib/g01-query-subjects-offline-matrix-profile.mjs';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';

const PROFILE = getAgentMcpProfileById(G01_QUERY_SUBJECTS_OFFLINE_PROFILE_ID);
const PROFILE_V2 = getAgentMcpProfileById(G01_QUERY_SUBJECTS_OFFLINE_V2_PROFILE_ID);
const SEARCH_URL = 'https://api.bgm.tv/v0/search/subjects?limit=20&offset=0';
const SEARCH_BODY = {
  keyword: G01_QUERY_SUBJECTS_OFFLINE_SYNTHETIC_KEYWORD,
  sort: 'match',
  filter: { type: [2], nsfw: false },
};
const SAFE_HEADERS = {
  accept: 'application/json',
  'content-type': 'application/json',
  'user-agent': 'Kurarion/BangumiAgentKit/0.1.0 (https://github.com/PariyaProject/BangumiAgentKit)',
};
test('profile uses a unique query and subject id', () => {
  assert.equal(assertG01QuerySubjectsOfflineProfile(PROFILE), true);
  assert.equal(assertG01QuerySubjectsOfflineFixtureProfile(PROFILE), true);
  assert.equal(
    G01_QUERY_SUBJECTS_OFFLINE_EXPECTED_ARGUMENTS.keyword,
    G01_QUERY_SUBJECTS_OFFLINE_SYNTHETIC_KEYWORD,
  );
  assert.equal(G01_QUERY_SUBJECTS_OFFLINE_SYNTHETIC_SUBJECT_ID, 990930);
  assert.notEqual(PROFILE.id, 'query-render-title-agent-mcp-v1');
  assert.equal(PROFILE.calls.length, 1);
  assert.equal(PROFILE.calls[0].toolName, 'bangumi.query_subjects');
  assert.throws(() =>
    assertG01QuerySubjectsOfflineFixtureProfile({ ...PROFILE, networkMode: 'public-live' }),
  );
});

test('v2 profile uses a separate fixture input and subject id', () => {
  assert.equal(assertG01QuerySubjectsOfflineV2Profile(PROFILE_V2), true);
  assert.equal(assertG01QuerySubjectsOfflineFixtureProfile(PROFILE_V2), true);
  assert.equal(
    G01_QUERY_SUBJECTS_OFFLINE_V2_EXPECTED_ARGUMENTS.keyword,
    G01_QUERY_SUBJECTS_OFFLINE_V2_SYNTHETIC_KEYWORD,
  );
  assert.equal(G01_QUERY_SUBJECTS_OFFLINE_V2_SYNTHETIC_SUBJECT_ID, 990931);
  assert.notEqual(PROFILE_V2.id, PROFILE.id);
  assert.notEqual(PROFILE_V2.calls[0].arguments.keyword, PROFILE.calls[0].arguments.keyword);
  assert.notEqual(
    PROFILE_V2.calls[0].arguments.keyword,
    G01_QUERY_SUBJECTS_OFFLINE_SYNTHETIC_KEYWORD,
  );
  assert.notEqual(
    G01_QUERY_SUBJECTS_OFFLINE_V2_NETWORK_MODE,
    G01_QUERY_SUBJECTS_OFFLINE_NETWORK_MODE,
  );
  assert.throws(() =>
    assertG01QuerySubjectsOfflineFixtureProfile({
      ...PROFILE_V2,
      argumentProfile: PROFILE.argumentProfile,
    }),
  );
});

test('v2 fixture serves only its exact synthetic search', async () => {
  const fixture = createG01QuerySubjectsOfflineFetch(PROFILE_V2);
  const response = await fixture.fetchFn(SEARCH_URL, {
    method: 'POST',
    headers: SAFE_HEADERS,
    body: JSON.stringify({
      ...SEARCH_BODY,
      keyword: G01_QUERY_SUBJECTS_OFFLINE_V2_EXPECTED_ARGUMENTS.keyword,
    }),
  });
  assert.equal(response.status, 200);
  assert.equal(
    (await response.json()).data[0].id,
    G01_QUERY_SUBJECTS_OFFLINE_V2_SYNTHETIC_SUBJECT_ID,
  );
  assert.deepEqual(fixture.snapshot(), {
    profile: G01_QUERY_SUBJECTS_OFFLINE_V2_NETWORK_MODE,
    requestCount: 1,
    searchRequestCount: 1,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    rejectedHeaderCount: 0,
    expectedOperationsComplete: true,
    rawFixturePayloadStored: false,
  });
});

test('v2 fixture rejects duplicate, credentialed, altered, and alternate-origin requests', async () => {
  const fixture = createG01QuerySubjectsOfflineFetch(PROFILE_V2);
  const body = {
    ...SEARCH_BODY,
    keyword: G01_QUERY_SUBJECTS_OFFLINE_V2_EXPECTED_ARGUMENTS.keyword,
  };
  const exactRequest = {
    method: 'POST',
    headers: SAFE_HEADERS,
    body: JSON.stringify(body),
  };
  assert.equal((await fixture.fetchFn(SEARCH_URL, exactRequest)).status, 200);
  assert.equal((await fixture.fetchFn(SEARCH_URL, exactRequest)).status, 599);
  assert.equal(
    (
      await fixture.fetchFn(SEARCH_URL, {
        ...exactRequest,
        headers: { ...SAFE_HEADERS, authorization: 'Bearer synthetic-test-only' },
      })
    ).status,
    599,
  );
  assert.equal(
    (
      await fixture.fetchFn(SEARCH_URL, {
        ...exactRequest,
        body: JSON.stringify({ ...body, keyword: 'wrong profile input' }),
      })
    ).status,
    599,
  );
  assert.equal(
    (
      await fixture.fetchFn(
        'https://example.invalid/v0/search/subjects?limit=20&offset=0',
        exactRequest,
      )
    ).status,
    599,
  );
  assert.deepEqual(fixture.snapshot(), {
    profile: G01_QUERY_SUBJECTS_OFFLINE_V2_NETWORK_MODE,
    requestCount: 5,
    searchRequestCount: 1,
    duplicateRequestCount: 1,
    unexpectedRequestCount: 4,
    rejectedHeaderCount: 1,
    expectedOperationsComplete: false,
    rawFixturePayloadStored: false,
  });
});

test('fixture serves one exact synthetic search and denies every second request', async () => {
  const fixture = createG01QuerySubjectsOfflineFetch();
  const response = await fixture.fetchFn(SEARCH_URL, {
    method: 'POST',
    headers: SAFE_HEADERS,
    body: JSON.stringify(SEARCH_BODY),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data[0].id, G01_QUERY_SUBJECTS_OFFLINE_SYNTHETIC_SUBJECT_ID);
  const duplicate = await fixture.fetchFn(SEARCH_URL, {
    method: 'POST',
    headers: SAFE_HEADERS,
    body: JSON.stringify(SEARCH_BODY),
  });
  assert.equal(duplicate.status, 599);
  assert.deepEqual(fixture.snapshot(), {
    profile: G01_QUERY_SUBJECTS_OFFLINE_NETWORK_MODE,
    requestCount: 2,
    searchRequestCount: 1,
    duplicateRequestCount: 1,
    unexpectedRequestCount: 1,
    rejectedHeaderCount: 0,
    expectedOperationsComplete: false,
    rawFixturePayloadStored: false,
  });
});

test('fixture rejects credential and unapproved headers, mismatched arguments, details, and other origins', async () => {
  const requests = [
    [
      'https://api.bgm.tv/v0/search/subjects?limit=20&offset=0',
      {
        method: 'POST',
        headers: { ...SAFE_HEADERS, authorization: 'Bearer synthetic-test-only' },
        body: JSON.stringify(SEARCH_BODY),
      },
    ],
    [
      'https://api.bgm.tv/v0/search/subjects?limit=20&offset=0',
      {
        method: 'POST',
        headers: { ...SAFE_HEADERS, cookie: 'session=synthetic-test-only' },
        body: JSON.stringify(SEARCH_BODY),
      },
    ],
    [
      'https://api.bgm.tv/v0/search/subjects?limit=20&offset=0',
      {
        method: 'POST',
        headers: { ...SAFE_HEADERS, 'proxy-authorization': 'Basic synthetic-test-only' },
        body: JSON.stringify(SEARCH_BODY),
      },
    ],
    [
      'https://api.bgm.tv/v0/search/subjects?limit=20&offset=0',
      {
        method: 'POST',
        headers: { ...SAFE_HEADERS, 'x-api-key': 'synthetic-test-only' },
        body: JSON.stringify(SEARCH_BODY),
      },
    ],
    [
      'https://api.bgm.tv/v0/search/subjects?limit=20&offset=0',
      {
        method: 'POST',
        headers: { ...SAFE_HEADERS, 'x-auth-token': 'synthetic-test-only' },
        body: JSON.stringify(SEARCH_BODY),
      },
    ],
    [
      'https://api.bgm.tv/v0/search/subjects?limit=20&offset=0',
      {
        method: 'POST',
        headers: { ...SAFE_HEADERS, accept: 'Bearer synthetic-test-only' },
        body: JSON.stringify(SEARCH_BODY),
      },
    ],
    [
      'https://api.bgm.tv/v0/search/subjects?limit=20&offset=0',
      {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify(SEARCH_BODY),
      },
    ],
    [
      'https://api.bgm.tv/v0/search/subjects?limit=21&offset=0',
      {
        method: 'POST',
        body: JSON.stringify(SEARCH_BODY),
      },
    ],
    ['https://api.bgm.tv/v0/subjects/990930', {}],
    [
      'https://example.invalid/v0/search/subjects?limit=20&offset=0',
      {
        method: 'POST',
        body: JSON.stringify(SEARCH_BODY),
      },
    ],
  ];
  const fixture = createG01QuerySubjectsOfflineFetch();
  for (const [url, init] of requests) {
    assert.equal((await fixture.fetchFn(url, init)).status, 599);
  }
  assert.deepEqual(fixture.snapshot(), {
    profile: G01_QUERY_SUBJECTS_OFFLINE_NETWORK_MODE,
    requestCount: 10,
    searchRequestCount: 0,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 10,
    rejectedHeaderCount: 6,
    expectedOperationsComplete: false,
    rawFixturePayloadStored: false,
  });
});

test('query result projection keeps only bounded metadata and omits synthetic rows', () => {
  const result = {
    state: 'ok',
    items: [{ id: G01_QUERY_SUBJECTS_OFFLINE_SYNTHETIC_SUBJECT_ID, name: 'Synthetic private row' }],
    coverage: {
      state: 'partial',
      requested: 1,
      returned: 1,
      pagesScanned: 1,
      totalKind: 'estimated',
    },
    warnings: [{ code: 'EXPERIMENTAL_SOURCE', message: 'omitted' }],
  };
  const summary = summarizeProfileToolResult(
    result,
    G01_QUERY_SUBJECTS_OFFLINE_EXPECTED_ARGUMENTS,
    G01_QUERY_SUBJECTS_OFFLINE_PROFILE_ID,
    null,
    'bangumi.query_subjects',
  );
  assert.deepEqual(summary, {
    resultState: 'ok',
    returnedItems: 1,
    coverageState: 'partial',
    requested: 1,
    returned: 1,
    pagesScanned: 1,
    totalKind: 'estimated',
    warningCount: 1,
  });
  assert.equal(JSON.stringify(summary).includes('Synthetic private row'), false);
  assert.equal(
    JSON.stringify(summary).includes(String(G01_QUERY_SUBJECTS_OFFLINE_SYNTHETIC_SUBJECT_ID)),
    false,
  );
});
