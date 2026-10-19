import assert from 'node:assert/strict';
import test from 'node:test';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  P02_PERSON_PROFILE_EXPECTED_ARGUMENTS,
  P02_PERSON_PROFILE_OFFLINE_V2_EXPECTED_ARGUMENTS,
  P02_PERSON_PROFILE_OFFLINE_V2_NETWORK_MODE,
  P02_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID,
  P02_PERSON_PROFILE_OFFLINE_V2_SYNTHETIC_ID,
  P02_PERSON_PROFILE_OFFLINE_NETWORK_MODE,
  P02_PERSON_PROFILE_OFFLINE_PROFILE_ID,
  P02_PERSON_PROFILE_SYNTHETIC_ID,
  assertP02PersonProfileOfflineProfile,
  createP02PersonProfileOfflineFetch,
} from '../../scripts/lib/p02-person-profile-offline-fixture.mjs';
import { parseCodexOneToolMcpArguments } from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';

const REQUIRED = [
  '--summary-file',
  '/tmp/p02-mcp-summary.json',
  '--candidate-sha',
  'a'.repeat(40),
  '--bundle-sha256',
  'b'.repeat(64),
];

const base = `https://api.bgm.tv/v0/persons/${P02_PERSON_PROFILE_SYNTHETIC_ID}`;

test('P02 profile binds one exact synthetic get_person_profile matrix call', () => {
  const profile = getAgentMcpProfileById(P02_PERSON_PROFILE_OFFLINE_PROFILE_ID);
  assert.equal(assertP02PersonProfileOfflineProfile(profile), true);
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    P02_PERSON_PROFILE_OFFLINE_PROFILE_ID,
    ...REQUIRED,
  ]);
  assert.equal(config.toolName, 'bangumi.get_person_profile');
  assert.equal(config.networkMode, P02_PERSON_PROFILE_OFFLINE_NETWORK_MODE);
  assert.deepEqual(config.expectedArgumentSequence, [P02_PERSON_PROFILE_EXPECTED_ARGUMENTS]);
  assert.equal(config.profile.acceptanceScope, 'agent-mcp-matrix-only');
});

test('P02 v2 profile uses distinct immutable arguments and synthetic identity', async () => {
  const profile = getAgentMcpProfileById(P02_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID);
  assert.equal(assertP02PersonProfileOfflineProfile(profile), true);
  const parsed = parseCodexOneToolMcpArguments([
    '--profile-id',
    P02_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID,
    ...REQUIRED,
  ]);
  assert.equal(parsed.profile.id, P02_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID);
  assert.equal(parsed.networkMode, P02_PERSON_PROFILE_OFFLINE_V2_NETWORK_MODE);
  assert.deepEqual(parsed.expectedArgumentSequence, [
    P02_PERSON_PROFILE_OFFLINE_V2_EXPECTED_ARGUMENTS,
  ]);
  assert.notEqual(profile.id, P02_PERSON_PROFILE_OFFLINE_PROFILE_ID);
  assert.notEqual(profile.networkMode, P02_PERSON_PROFILE_OFFLINE_NETWORK_MODE);
  assert.deepEqual(profile.calls[0].arguments, P02_PERSON_PROFILE_OFFLINE_V2_EXPECTED_ARGUMENTS);
  assert.equal(profile.calls[0].arguments.personId, P02_PERSON_PROFILE_OFFLINE_V2_SYNTHETIC_ID);

  const baseV2 = `https://api.bgm.tv/v0/persons/${P02_PERSON_PROFILE_OFFLINE_V2_SYNTHETIC_ID}`;
  const fixture = createP02PersonProfileOfflineFetch(profile.id);
  const values = [];
  for (const url of [baseV2, `${baseV2}/subjects`, `${baseV2}/characters`]) {
    const response = await fixture.fetchFn(url);
    assert.equal(response.status, 200);
    values.push(await response.json());
  }
  assert.equal(values[0].id, 990711);
  assert.equal(values[1][0].id, 990712);
  assert.equal(values[2][0].id, 990713);
  assert.deepEqual(fixture.snapshot(), {
    profile: P02_PERSON_PROFILE_OFFLINE_V2_NETWORK_MODE,
    requestCount: 3,
    personRequestCount: 1,
    subjectsRequestCount: 1,
    charactersRequestCount: 1,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
  });
  const duplicate = createP02PersonProfileOfflineFetch(profile.id);
  await duplicate.fetchFn(baseV2);
  assert.equal((await duplicate.fetchFn(baseV2)).status, 599);
  assert.equal(duplicate.snapshot().duplicateRequestCount, 1);
  const withAuthorization = createP02PersonProfileOfflineFetch(profile.id);
  assert.equal(
    (
      await withAuthorization.fetchFn(baseV2, {
        headers: { authorization: 'Bearer synthetic' },
      })
    ).status,
    599,
  );
  assert.equal(withAuthorization.snapshot().authorizationHeaderCount, 1);
});

test('P02 offline mode rejects arbitrary tools, arguments, and selected network modes', () => {
  assert.throws(() =>
    parseCodexOneToolMcpArguments([
      '--profile-id',
      P02_PERSON_PROFILE_OFFLINE_PROFILE_ID,
      '--network-mode',
      P02_PERSON_PROFILE_OFFLINE_NETWORK_MODE,
      ...REQUIRED,
    ]),
  );
  assert.throws(() =>
    parseCodexOneToolMcpArguments([
      '--tool',
      'bangumi.get_person_profile',
      '--arguments-json',
      JSON.stringify(P02_PERSON_PROFILE_EXPECTED_ARGUMENTS),
      '--network-mode',
      P02_PERSON_PROFILE_OFFLINE_NETWORK_MODE,
      ...REQUIRED,
    ]),
  );
  const changed = { ...getAgentMcpProfileById(P02_PERSON_PROFILE_OFFLINE_PROFILE_ID) };
  changed.calls = [
    {
      toolName: 'bangumi.get_person_profile',
      arguments: { ...P02_PERSON_PROFILE_EXPECTED_ARGUMENTS, personId: 4765 },
    },
  ];
  assert.throws(() => assertP02PersonProfileOfflineProfile(changed));
});

test('P02 fixture serves exactly three local image-free GET routes once', async () => {
  const fixture = createP02PersonProfileOfflineFetch();
  const paths = [base, `${base}/subjects`, `${base}/characters`];
  const values = [];
  for (const path of paths) {
    const response = await fixture.fetchFn(path);
    assert.equal(response.status, 200);
    values.push(await response.json());
  }
  assert.equal(values[0].id, P02_PERSON_PROFILE_SYNTHETIC_ID);
  assert.equal(values[1][0].id, 990702);
  assert.equal(values[2][0].id, 990703);
  assert.equal(JSON.stringify(values).includes('http'), false);
  assert.deepEqual(fixture.snapshot(), {
    profile: P02_PERSON_PROFILE_OFFLINE_NETWORK_MODE,
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

test('P02 fixture rejects unregistered route, method, query, duplicate, and Authorization', async () => {
  const invalidCalls = [
    ['https://api.bgm.tv/v0/persons/990701?limit=1', undefined],
    [`${base}/subjects`, { method: 'POST' }],
    [`${base}/subjects`, { headers: { authorization: 'Bearer synthetic' } }],
    ['https://api.bgm.tv/v0/subjects/990702', undefined],
  ];
  for (const [url, init] of invalidCalls) {
    const fixture = createP02PersonProfileOfflineFetch();
    const response = await fixture.fetchFn(url, init);
    assert.equal(response.status, 599);
    assert.equal(fixture.snapshot().unexpectedRequestCount, 1);
  }
  const duplicate = createP02PersonProfileOfflineFetch();
  await duplicate.fetchFn(base);
  assert.equal((await duplicate.fetchFn(base)).status, 599);
  assert.equal(duplicate.snapshot().duplicateRequestCount, 1);
  const auth = createP02PersonProfileOfflineFetch();
  assert.equal(
    (await auth.fetchFn(base, { headers: { authorization: 'Bearer synthetic' } })).status,
    599,
  );
  assert.equal(auth.snapshot().authorizationHeaderCount, 1);
});
