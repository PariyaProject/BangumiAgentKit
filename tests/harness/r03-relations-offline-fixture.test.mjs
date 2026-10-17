import assert from 'node:assert/strict';
import test from 'node:test';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  R03_RELATIONS_OFFLINE_EXPECTED_CALLS,
  R03_RELATIONS_OFFLINE_NETWORK_MODE,
  R03_RELATIONS_OFFLINE_PROFILE_ID,
  summarizeR03RelationsOfflineToolResult,
  assertR03RelationsOfflineProfile,
} from '../../scripts/lib/r03-relations-offline-profile.mjs';
import { createR03RelationsOfflineFetch } from '../../scripts/lib/r03-relations-offline-fixture.mjs';
import { parseCodexOneToolMcpArguments } from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';

const PROFILE = getAgentMcpProfileById(R03_RELATIONS_OFFLINE_PROFILE_ID);
const REQUIRED = [
  '--summary-file',
  '/tmp/r03-summary.json',
  '--candidate-sha',
  'a'.repeat(40),
  '--bundle-sha256',
  'b'.repeat(64),
];
const DIRECT_URL = 'https://api.bgm.tv/v0/subjects/991020/subjects';
const HTTP_HEADERS = {
  accept: 'application/json',
  'user-agent': 'Kurarion/BangumiAgentKit/0.1.0 (https://github.com/PariyaProject/BangumiAgentKit)',
};

const result = (subjectId, items) => ({
  subjectId,
  state: 'observed',
  source: { direction: 'source_subject_to_returned_target' },
  coverage: {
    completeness: 'not_provided_by_source',
    paginationAvailable: false,
    totalCountAvailable: false,
    truncated: false,
    responseRowsObserved: items.length,
    rowsReturned: items.length,
    schemaDriftRows: 0,
  },
  items,
});

test('R03 profile v2 binds exactly one synthetic direct-relation read', () => {
  assert.equal(assertR03RelationsOfflineProfile(PROFILE), true);
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    R03_RELATIONS_OFFLINE_PROFILE_ID,
    ...REQUIRED,
  ]);
  assert.equal(config.toolName, 'bangumi.get_subject_relations');
  assert.equal(config.networkMode, R03_RELATIONS_OFFLINE_NETWORK_MODE);
  assert.deepEqual(
    config.expectedArgumentSequence,
    R03_RELATIONS_OFFLINE_EXPECTED_CALLS.map((call) => call.arguments),
  );
  assert.equal(config.profile.acceptanceScope, 'agent-mcp-matrix-only');
  assert.equal(
    assertR03RelationsOfflineProfile(
      getAgentMcpProfileById('r03-two-hop-relations-offline-agent-mcp-v1'),
    ),
    false,
  );
  assert.throws(() =>
    assertR03RelationsOfflineProfile({
      ...PROFILE,
      calls: [
        { toolName: PROFILE.toolName, arguments: { subjectId: 991022, includeEvidence: true } },
      ],
    }),
  );
  assert.throws(() =>
    parseCodexOneToolMcpArguments([
      '--profile-id',
      R03_RELATIONS_OFFLINE_PROFILE_ID,
      '--network-mode',
      R03_RELATIONS_OFFLINE_NETWORK_MODE,
      ...REQUIRED,
    ]),
  );
});

test('R03 fixture returns one bounded synthetic direct-relation response', async () => {
  const fixture = createR03RelationsOfflineFetch();
  const direct = await fixture.fetchFn(DIRECT_URL, { headers: HTTP_HEADERS });
  assert.equal(direct.status, 200);
  assert.deepEqual(await direct.json(), [
    {
      id: 991021,
      type: 2,
      name: 'Synthetic R03 matrix target 991021',
      name_cn: '合成 R03 矩阵目标 991021',
      relation: '续篇',
    },
  ]);
  assert.deepEqual(fixture.snapshot(), {
    profile: R03_RELATIONS_OFFLINE_NETWORK_MODE,
    requestCount: 1,
    relationRequestCount: 1,
    rootRequestCount: 1,
    intermediateRequestCount: 0,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
  });
});

test('R03 fixture rejects unregistered routes, requests, authorization, and duplicates', async () => {
  const invalidCalls = [
    [`${DIRECT_URL}?limit=1`, { headers: HTTP_HEADERS }],
    [DIRECT_URL, undefined],
    [DIRECT_URL, { headers: { ...HTTP_HEADERS, 'x-unexpected': 'value' } }],
    [DIRECT_URL, { headers: { ...HTTP_HEADERS, 'user-agent': 'unexpected' } }],
    [DIRECT_URL, { method: 'POST', headers: HTTP_HEADERS }],
    [DIRECT_URL, { headers: { ...HTTP_HEADERS, authorization: 'Bearer synthetic' } }],
    ['https://example.test/v0/subjects/991020/subjects', { headers: HTTP_HEADERS }],
    ['https://api.bgm.tv/v0/subjects/991022/subjects', { headers: HTTP_HEADERS }],
  ];
  for (const [url, init] of invalidCalls) {
    const fixture = createR03RelationsOfflineFetch();
    assert.equal((await fixture.fetchFn(url, init)).status, 599);
    assert.equal(fixture.snapshot().unexpectedRequestCount, 1);
  }
  const duplicate = createR03RelationsOfflineFetch();
  await duplicate.fetchFn(DIRECT_URL, { headers: HTTP_HEADERS });
  assert.equal((await duplicate.fetchFn(DIRECT_URL, { headers: HTTP_HEADERS })).status, 599);
  assert.equal(duplicate.snapshot().duplicateRequestCount, 1);
  const body = createR03RelationsOfflineFetch();
  assert.equal((await body.fetchFn(DIRECT_URL, { ...HTTP_HEADERS, body: '{}' })).status, 599);
});

test('R03 summaries omit synthetic IDs, names, and raw relation rows', () => {
  const directResult = result(991020, [
    { id: 991021, name: 'private fixture name', relation: '续篇' },
  ]);
  const directSummary = summarizeProfileToolResult(
    directResult,
    R03_RELATIONS_OFFLINE_EXPECTED_CALLS[0].arguments,
    R03_RELATIONS_OFFLINE_PROFILE_ID,
  );
  assert.equal(directSummary.responseRowsObserved, 1);
  assert.deepEqual(directSummary.relationLabels, ['续篇']);
  const encoded = JSON.stringify(directSummary);
  assert.equal(encoded.includes('9910'), false);
  assert.equal(encoded.includes('private'), false);
  assert.equal(
    summarizeR03RelationsOfflineToolResult(directResult, {
      subjectId: 991099,
      includeEvidence: true,
    }),
    null,
  );
  assert.equal(
    summarizeR03RelationsOfflineToolResult(
      { ...directResult, items: [{ ...directResult.items[0], id: 991099 }] },
      R03_RELATIONS_OFFLINE_EXPECTED_CALLS[0].arguments,
    ),
    null,
  );
});
