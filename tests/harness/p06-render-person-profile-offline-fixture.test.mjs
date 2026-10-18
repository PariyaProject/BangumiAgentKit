import assert from 'node:assert/strict';
import test from 'node:test';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  assertP06RenderPersonProfileOfflineProfile,
  createP06RenderPersonProfileAssetGuard,
  createP06RenderPersonProfileOfflineFetch,
  P06_RENDER_PERSON_PROFILE_EXPECTED_ARGUMENTS,
  P06_RENDER_PERSON_PROFILE_OFFLINE_NETWORK_MODE,
  P06_RENDER_PERSON_PROFILE_OFFLINE_PROFILE_ID,
  P06_RENDER_PERSON_PROFILE_OFFLINE_V2_NETWORK_MODE,
  P06_RENDER_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID,
  P06_RENDER_PERSON_PROFILE_V2_EXPECTED_ARGUMENTS,
} from '../../scripts/lib/p06-render-person-profile-offline-fixture.mjs';

const PROFILE = getAgentMcpProfileById(P06_RENDER_PERSON_PROFILE_OFFLINE_PROFILE_ID);

test('P06 offline mode is bound to its exact immutable registered renderer profile', () => {
  assert.equal(assertP06RenderPersonProfileOfflineProfile(PROFILE), true);
  assert.equal(
    assertP06RenderPersonProfileOfflineProfile({ ...PROFILE, id: 'another-profile' }),
    false,
  );
  assert.throws(() =>
    assertP06RenderPersonProfileOfflineProfile({
      ...PROFILE,
      networkMode: 'arbitrary-network-mode',
    }),
  );
  assert.throws(() =>
    assertP06RenderPersonProfileOfflineProfile({
      ...PROFILE,
      calls: [
        {
          ...PROFILE.calls[0],
          arguments: { ...P06_RENDER_PERSON_PROFILE_EXPECTED_ARGUMENTS, includeChronology: true },
        },
      ],
    }),
  );
});

test('P06 fixture serves exactly three fixed local person-profile GET responses', async () => {
  const fixture = createP06RenderPersonProfileOfflineFetch();
  const person = await fixture.fetchFn('https://api.bgm.tv/v0/persons/990601');
  const subjects = await fixture.fetchFn('https://api.bgm.tv/v0/persons/990601/subjects');
  const characters = await fixture.fetchFn('https://api.bgm.tv/v0/persons/990601/characters');

  assert.equal(person.status, 200);
  assert.equal((await person.json()).id, 990601);
  assert.equal(subjects.status, 200);
  assert.equal((await subjects.json())[0].id, 990602);
  assert.equal(characters.status, 200);
  assert.equal((await characters.json())[0].id, 990603);
  const snapshot = fixture.snapshot();
  assert.deepEqual(snapshot, {
    profile: P06_RENDER_PERSON_PROFILE_OFFLINE_NETWORK_MODE,
    requestCount: 3,
    personRequestCount: 1,
    subjectsRequestCount: 1,
    charactersRequestCount: 1,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
  });
  assert.equal(JSON.stringify(snapshot).includes('Synthetic Person'), false);
});

test('P06 fixture rejects duplicate, query, method, authenticated, and wrong-origin requests', async () => {
  const fixture = createP06RenderPersonProfileOfflineFetch();
  const valid = await fixture.fetchFn('https://api.bgm.tv/v0/persons/990601');
  const duplicate = await fixture.fetchFn('https://api.bgm.tv/v0/persons/990601');
  const query = await fixture.fetchFn('https://api.bgm.tv/v0/persons/990601/subjects?limit=1');
  const method = await fixture.fetchFn('https://api.bgm.tv/v0/persons/990601/characters', {
    method: 'POST',
  });
  const authenticated = await fixture.fetchFn('https://api.bgm.tv/v0/persons/990601/characters', {
    headers: { authorization: 'Bearer synthetic-test-only' },
  });
  const wrongOrigin = await fixture.fetchFn('https://example.invalid/v0/persons/990601/subjects');

  assert.equal(valid.status, 200);
  for (const rejected of [duplicate, query, method, authenticated, wrongOrigin]) {
    assert.equal(rejected.status, 599);
  }
  assert.deepEqual(fixture.snapshot(), {
    profile: P06_RENDER_PERSON_PROFILE_OFFLINE_NETWORK_MODE,
    requestCount: 6,
    personRequestCount: 1,
    subjectsRequestCount: 0,
    charactersRequestCount: 0,
    duplicateRequestCount: 1,
    unexpectedRequestCount: 5,
    authorizationHeaderCount: 1,
    expectedOperationsComplete: false,
  });
});

test('P06 v2 fixture uses a distinct synthetic identity and exact offline reads', async () => {
  const config = getAgentMcpProfileById(P06_RENDER_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID);
  assert.equal(assertP06RenderPersonProfileOfflineProfile(config), true);
  assert.deepEqual(config.calls[0].arguments, P06_RENDER_PERSON_PROFILE_V2_EXPECTED_ARGUMENTS);

  const fixture = createP06RenderPersonProfileOfflineFetch(
    P06_RENDER_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID,
  );
  const person = await fixture.fetchFn('https://api.bgm.tv/v0/persons/990602');
  const subjects = await fixture.fetchFn('https://api.bgm.tv/v0/persons/990602/subjects');
  const characters = await fixture.fetchFn('https://api.bgm.tv/v0/persons/990602/characters');

  const personValue = await person.json();
  assert.equal(personValue.id, 990602);
  assert.deepEqual(personValue.infobox, [
    { key: '简体中文名', value: '合成声优人员 990602（长标题换行检查）' },
  ]);
  assert.equal('name_cn' in personValue, false);
  assert.equal((await subjects.json())[0].id, 990604);
  assert.equal((await characters.json())[0].id, 990605);
  assert.deepEqual(fixture.snapshot(), {
    profile: P06_RENDER_PERSON_PROFILE_OFFLINE_V2_NETWORK_MODE,
    requestCount: 3,
    personRequestCount: 1,
    subjectsRequestCount: 1,
    charactersRequestCount: 1,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
  });
});

test('P06 renderer asset boundary refuses every nonempty asset URL without transport', async () => {
  const guard = createP06RenderPersonProfileAssetGuard();
  await assert.rejects(guard.assetResolver.resolveAsset('https://images.example.invalid/a.png'));
  assert.deepEqual(guard.snapshot(), {
    assetResolutionCallCount: 1,
    nonEmptyAssetUrlCount: 1,
    blockedAssetRequestCount: 1,
  });
});
