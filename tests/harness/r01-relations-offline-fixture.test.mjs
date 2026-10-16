import assert from 'node:assert/strict';
import test from 'node:test';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  R01_RELATIONS_OFFLINE_EXPECTED_ARGUMENTS,
  R01_RELATIONS_OFFLINE_NETWORK_MODE,
  R01_RELATIONS_OFFLINE_PROFILE_ID,
  summarizeR01RelationsOfflineToolResult,
  assertR01RelationsOfflineProfile,
} from '../../scripts/lib/r01-relations-offline-profile.mjs';
import { createR01RelationsOfflineFetch } from '../../scripts/lib/r01-relations-offline-fixture.mjs';
import { parseCodexOneToolMcpArguments } from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';

const PROFILE = getAgentMcpProfileById(R01_RELATIONS_OFFLINE_PROFILE_ID);
const REQUIRED = [
  '--summary-file',
  '/tmp/r01-summary.json',
  '--candidate-sha',
  'a'.repeat(40),
  '--bundle-sha256',
  'b'.repeat(64),
];
const URL = 'https://api.bgm.tv/v0/subjects/990902/subjects';

test('R01 profile binds one exact synthetic offline relations matrix call', () => {
  assert.equal(assertR01RelationsOfflineProfile(PROFILE), true);
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    R01_RELATIONS_OFFLINE_PROFILE_ID,
    ...REQUIRED,
  ]);
  assert.equal(config.toolName, 'bangumi.get_subject_relations');
  assert.equal(config.networkMode, R01_RELATIONS_OFFLINE_NETWORK_MODE);
  assert.deepEqual(config.expectedArgumentSequence, [R01_RELATIONS_OFFLINE_EXPECTED_ARGUMENTS]);
  assert.equal(config.profile.acceptanceScope, 'agent-mcp-matrix-only');
  assert.throws(() =>
    parseCodexOneToolMcpArguments([
      '--profile-id',
      R01_RELATIONS_OFFLINE_PROFILE_ID,
      '--network-mode',
      R01_RELATIONS_OFFLINE_NETWORK_MODE,
      ...REQUIRED,
    ]),
  );
  assert.throws(() =>
    assertR01RelationsOfflineProfile({
      ...PROFILE,
      calls: [{ toolName: PROFILE.toolName, arguments: { subjectId: 1, includeEvidence: true } }],
    }),
  );
});

test('R01 offline fixture returns one anonymous local relation response', async () => {
  const fixture = createR01RelationsOfflineFetch();
  const response = await fixture.fetchFn(URL);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [
    {
      id: 990903,
      type: 2,
      name: 'Synthetic relation target 990903',
      name_cn: '合成关系目标 990903',
      relation: '改编',
    },
  ]);
  assert.deepEqual(fixture.snapshot(), {
    profile: R01_RELATIONS_OFFLINE_NETWORK_MODE,
    requestCount: 1,
    relationRequestCount: 1,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
  });
});

test('R01 offline fixture rejects every route except its exact anonymous relation request', async () => {
  const invalidCalls = [
    [`${URL}?limit=1`, undefined],
    [URL, { method: 'POST' }],
    [URL, { headers: { authorization: 'Bearer synthetic' } }],
    ['https://example.test/v0/subjects/990902/subjects', undefined],
    ['https://api.bgm.tv/v0/subjects/990903/subjects', undefined],
  ];
  for (const [url, init] of invalidCalls) {
    const fixture = createR01RelationsOfflineFetch();
    assert.equal((await fixture.fetchFn(url, init)).status, 599);
    assert.equal(fixture.snapshot().unexpectedRequestCount, 1);
  }
  const duplicate = createR01RelationsOfflineFetch();
  await duplicate.fetchFn(URL);
  assert.equal((await duplicate.fetchFn(URL)).status, 599);
  assert.equal(duplicate.snapshot().duplicateRequestCount, 1);
  const body = createR01RelationsOfflineFetch();
  assert.equal((await body.fetchFn(URL, { body: '{}' })).status, 599);
});

test('R01 relation summary omits synthetic IDs, names and raw fixture rows', () => {
  const result = {
    subjectId: 990902,
    state: 'observed',
    source: { direction: 'source_subject_to_returned_target' },
    coverage: {
      completeness: 'not_provided_by_source',
      paginationAvailable: false,
      totalCountAvailable: false,
      truncated: false,
      responseRowsObserved: 1,
      rowsReturned: 1,
      schemaDriftRows: 0,
    },
    items: [{ id: 990903, name: 'private fixture name', relation: '改编' }],
  };
  const summary = summarizeProfileToolResult(
    result,
    R01_RELATIONS_OFFLINE_EXPECTED_ARGUMENTS,
    R01_RELATIONS_OFFLINE_PROFILE_ID,
  );
  assert.deepEqual(summary, {
    state: 'observed',
    sourceDirection: 'source_subject_to_returned_target',
    responseRowsObserved: 1,
    rowsReturned: 1,
    schemaDriftRows: 0,
    truncated: false,
    paginationAvailable: false,
    totalCountAvailable: false,
    completeness: 'not_provided_by_source',
    relationLabels: ['改编'],
  });
  assert.equal(JSON.stringify(summary).includes('990903'), false);
  assert.equal(JSON.stringify(summary).includes('private fixture name'), false);
  assert.deepEqual(summarizeR01RelationsOfflineToolResult(result, { subjectId: 990901 }), null);
});
