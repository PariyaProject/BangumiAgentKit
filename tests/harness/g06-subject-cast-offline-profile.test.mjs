import test from 'node:test';
import assert from 'node:assert/strict';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  assertG06SubjectCastOfflineProfile,
  createG06SubjectCastOfflineFetch,
  G06_CAST_OFFLINE_EXPECTED_ARGUMENTS,
  G06_CAST_OFFLINE_NETWORK_MODE,
  G06_CAST_OFFLINE_PROFILE_ID,
  G06_CAST_OFFLINE_V2_EXPECTED_ARGUMENTS,
  G06_CAST_OFFLINE_V2_NETWORK_MODE,
  G06_CAST_OFFLINE_V2_PROFILE_ID,
} from '../../scripts/lib/g06-subject-cast-offline-profile.mjs';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';

const profile = getAgentMcpProfileById(G06_CAST_OFFLINE_PROFILE_ID);
const v2Profile = getAgentMcpProfileById(G06_CAST_OFFLINE_V2_PROFILE_ID);
const expectedUrl = 'https://api.bgm.tv/v0/subjects/990804/characters';
const expectedV2Url = 'https://api.bgm.tv/v0/subjects/990805/characters';

test('G06 offline profile is immutable and matrix-only', () => {
  assert.equal(assertG06SubjectCastOfflineProfile(profile), true);
  assert.equal(profile.acceptanceScope, 'agent-mcp-matrix-only');
  assert.equal(profile.frontierId, 'G06');
  assert.equal(profile.calls.length, 1);
  assert.equal(profile.calls[0].toolName, 'bangumi.get_subject_cast');
  assert.deepEqual(profile.calls[0].arguments, G06_CAST_OFFLINE_EXPECTED_ARGUMENTS);

  const changed = structuredClone(profile);
  changed.calls[0].arguments.subjectId = 218707;
  assert.throws(
    () => assertG06SubjectCastOfflineProfile(changed),
    /immutable registered synthetic matrix profile/u,
  );
});

test('G06 v2 is a distinct immutable matrix-only profile with a different synthetic input', () => {
  assert.equal(assertG06SubjectCastOfflineProfile(v2Profile), true);
  assert.equal(v2Profile.id, G06_CAST_OFFLINE_V2_PROFILE_ID);
  assert.equal(v2Profile.acceptanceScope, 'agent-mcp-matrix-only');
  assert.equal(v2Profile.frontierId, 'G06');
  assert.equal(v2Profile.calls.length, 1);
  assert.deepEqual(v2Profile.calls[0].arguments, G06_CAST_OFFLINE_V2_EXPECTED_ARGUMENTS);
  assert.notDeepEqual(v2Profile.calls[0].arguments, profile.calls[0].arguments);
  assert.notEqual(v2Profile.reportPath, profile.reportPath);
  assert.notEqual(v2Profile.claimLabelName, profile.claimLabelName);
});

test('G06 offline fixture allows exactly one anonymous synthetic GET', async () => {
  const fixture = createG06SubjectCastOfflineFetch();
  const response = await fixture.fetchFn(expectedUrl, { method: 'GET' });
  assert.equal(response.status, 200);
  const rows = await response.json();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].actors[0].id, rows[1].actors[0].id);
  assert.deepEqual(fixture.snapshot(), {
    profile: G06_CAST_OFFLINE_NETWORK_MODE,
    requestCount: 1,
    allowedRequestCount: 1,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    queryParameterCount: 0,
    requestBodyCount: 0,
    rowsReturned: 2,
    expectedOperationComplete: true,
  });

  const repeated = await fixture.fetchFn(expectedUrl, { method: 'GET' });
  assert.equal(repeated.status, 599);
  assert.equal(fixture.snapshot().duplicateRequestCount, 1);
  assert.equal(fixture.snapshot().unexpectedRequestCount, 1);
});

test('G06 v2 fixture allows only its distinct synthetic GET', async () => {
  const fixture = createG06SubjectCastOfflineFetch(v2Profile);
  const response = await fixture.fetchFn(expectedV2Url, { method: 'GET' });
  assert.equal(response.status, 200);
  const rows = await response.json();
  assert.equal(rows.length, 2);
  assert.deepEqual(fixture.snapshot(), {
    profile: G06_CAST_OFFLINE_V2_NETWORK_MODE,
    requestCount: 1,
    allowedRequestCount: 1,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    queryParameterCount: 0,
    requestBodyCount: 0,
    rowsReturned: 2,
    expectedOperationComplete: true,
  });
  assert.equal((await fixture.fetchFn(expectedUrl, { method: 'GET' })).status, 599);
  assert.equal(fixture.snapshot().unexpectedRequestCount, 1);
});

test('G06 offline fixture denies auth, queries, wrong methods/routes, and request bodies', async () => {
  const cases = [
    [expectedUrl, { method: 'GET', headers: { authorization: 'Bearer synthetic' } }],
    [`${expectedUrl}?limit=2`, { method: 'GET' }],
    [expectedUrl, { method: 'POST' }],
    ['https://api.bgm.tv/v0/subjects/990805/characters', { method: 'GET' }],
    [expectedUrl, { method: 'GET', body: 'unexpected' }],
  ];
  for (const [url, init] of cases) {
    const fixture = createG06SubjectCastOfflineFetch();
    const response = await fixture.fetchFn(url, init);
    assert.equal(response.status, 599);
    assert.equal(fixture.snapshot().allowedRequestCount, 0);
    assert.equal(fixture.snapshot().unexpectedRequestCount, 1);
  }
  const authFixture = createG06SubjectCastOfflineFetch();
  await authFixture.fetchFn(expectedUrl, { method: 'GET', headers: { authorization: 'Bearer x' } });
  assert.equal(authFixture.snapshot().authorizationHeaderCount, 1);
});

test('G06 result summary retains only bounded synthetic execution metadata', () => {
  const toolResult = {
    status: 'ok',
    subjectId: 990804,
    cast: [
      {
        character: { id: 990805, name: 'Synthetic Character 990805' },
        actors: [{ id: 990807, name: 'Synthetic Person 990807' }],
      },
      {
        character: { id: 990806, name: 'Synthetic Character 990806' },
        actors: [{ id: 990807, name: 'Synthetic Person 990807' }],
      },
    ],
    observed: 2,
    returned: 2,
    truncated: false,
    schemaDriftRows: 0,
    invalidActorIdRows: 0,
    multiRoleVoiceActors: [{}],
    source: {
      status: 'observed',
      paginationAvailable: false,
      totalCountAvailable: false,
    },
  };
  const summary = summarizeProfileToolResult(
    toolResult,
    G06_CAST_OFFLINE_EXPECTED_ARGUMENTS,
    G06_CAST_OFFLINE_PROFILE_ID,
    null,
    'bangumi.get_subject_cast',
  );
  assert.deepEqual(summary, {
    status: 'ok',
    subjectIdMatches: true,
    rowsObserved: 2,
    rowsReturned: 2,
    multiRoleVoiceActorCount: 1,
    truncated: false,
    schemaDriftRows: 0,
    invalidActorIdRows: 0,
    sourceStatus: 'observed',
    paginationAvailable: false,
    totalCountAvailable: false,
  });
  const unknownCoverage = summarizeProfileToolResult(
    { ...toolResult, source: { status: 'observed' } },
    G06_CAST_OFFLINE_EXPECTED_ARGUMENTS,
    G06_CAST_OFFLINE_PROFILE_ID,
    null,
    'bangumi.get_subject_cast',
  );
  assert.equal(unknownCoverage.paginationAvailable, null);
  assert.equal(unknownCoverage.totalCountAvailable, null);
  assert.equal(JSON.stringify(summary).includes('Synthetic Person'), false);
  assert.equal(JSON.stringify(summary).includes('990804'), false);
});
