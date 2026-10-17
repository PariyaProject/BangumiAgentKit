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
const ROOT_URL = 'https://api.bgm.tv/v0/subjects/990910/subjects';
const INTERMEDIATE_URL = 'https://api.bgm.tv/v0/subjects/990911/subjects';
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

test('R03 profile binds exactly two ordered synthetic relation reads', () => {
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
  assert.throws(() =>
    parseCodexOneToolMcpArguments([
      '--profile-id',
      R03_RELATIONS_OFFLINE_PROFILE_ID,
      '--network-mode',
      R03_RELATIONS_OFFLINE_NETWORK_MODE,
      ...REQUIRED,
    ]),
  );
  assert.throws(() =>
    assertR03RelationsOfflineProfile({
      ...PROFILE,
      calls: [
        { toolName: PROFILE.toolName, arguments: { subjectId: 990910, includeEvidence: true } },
      ],
    }),
  );
});

test('R03 fixture returns the bounded synthetic root and first-hop responses once each', async () => {
  const fixture = createR03RelationsOfflineFetch();
  const root = await fixture.fetchFn(ROOT_URL, { headers: HTTP_HEADERS });
  assert.equal(root.status, 200);
  assert.deepEqual(await root.json(), [
    {
      id: 990911,
      type: 2,
      name: 'Synthetic R03 intermediate node',
      name_cn: '合成 R03 中间节点',
      relation: '续篇',
    },
  ]);
  const intermediate = await fixture.fetchFn(INTERMEDIATE_URL, { headers: HTTP_HEADERS });
  assert.equal(intermediate.status, 200);
  assert.deepEqual(await intermediate.json(), [
    {
      id: 990912,
      type: 2,
      name: 'Synthetic R03 candidate one',
      name_cn: '合成 R03 候选一',
      relation: '前传',
    },
    {
      id: 990913,
      type: 2,
      name: 'Synthetic R03 candidate two',
      name_cn: '合成 R03 候选二',
      relation: '外传',
    },
  ]);
  assert.deepEqual(fixture.snapshot(), {
    profile: R03_RELATIONS_OFFLINE_NETWORK_MODE,
    requestCount: 2,
    relationRequestCount: 2,
    rootRequestCount: 1,
    intermediateRequestCount: 1,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
  });
});

test('R03 fixture rejects unregistered routes, requests, authorization, and duplicates', async () => {
  const invalidCalls = [
    [`${ROOT_URL}?limit=1`, undefined],
    [ROOT_URL, undefined],
    [ROOT_URL, { headers: { ...HTTP_HEADERS, 'x-unexpected': 'value' } }],
    [ROOT_URL, { headers: { ...HTTP_HEADERS, 'user-agent': 'unexpected' } }],
    [ROOT_URL, { method: 'POST' }],
    [ROOT_URL, { headers: { authorization: 'Bearer synthetic' } }],
    ['https://example.test/v0/subjects/990910/subjects', undefined],
    ['https://api.bgm.tv/v0/subjects/990912/subjects', undefined],
  ];
  for (const [url, init] of invalidCalls) {
    const fixture = createR03RelationsOfflineFetch();
    assert.equal((await fixture.fetchFn(url, init)).status, 599);
    assert.equal(fixture.snapshot().unexpectedRequestCount, 1);
  }
  const duplicate = createR03RelationsOfflineFetch();
  await duplicate.fetchFn(ROOT_URL, { headers: HTTP_HEADERS });
  assert.equal((await duplicate.fetchFn(ROOT_URL, { headers: HTTP_HEADERS })).status, 599);
  assert.equal(duplicate.snapshot().duplicateRequestCount, 1);
  const body = createR03RelationsOfflineFetch();
  assert.equal((await body.fetchFn(INTERMEDIATE_URL, { body: '{}' })).status, 599);
});

test('R03 summaries omit synthetic IDs, names, and raw relation rows', () => {
  const rootResult = result(990910, [
    { id: 990911, name: 'private fixture name', relation: '续篇' },
  ]);
  const intermediateResult = result(990911, [
    { id: 990912, name: 'private candidate one', relation: '前传' },
    { id: 990913, name: 'private candidate two', relation: '外传' },
  ]);
  const rootSummary = summarizeProfileToolResult(
    rootResult,
    R03_RELATIONS_OFFLINE_EXPECTED_CALLS[0].arguments,
    R03_RELATIONS_OFFLINE_PROFILE_ID,
  );
  const intermediateSummary = summarizeProfileToolResult(
    intermediateResult,
    R03_RELATIONS_OFFLINE_EXPECTED_CALLS[1].arguments,
    R03_RELATIONS_OFFLINE_PROFILE_ID,
  );
  assert.equal(rootSummary.responseRowsObserved, 1);
  assert.deepEqual(rootSummary.relationLabels, ['续篇']);
  assert.equal(intermediateSummary.responseRowsObserved, 2);
  assert.deepEqual(intermediateSummary.relationLabels, ['前传', '外传']);
  for (const summary of [rootSummary, intermediateSummary]) {
    const encoded = JSON.stringify(summary);
    assert.equal(encoded.includes('99091'), false);
    assert.equal(encoded.includes('private'), false);
  }
  assert.equal(
    summarizeR03RelationsOfflineToolResult(rootResult, {
      subjectId: 990901,
      includeEvidence: true,
    }),
    null,
  );
  assert.equal(
    summarizeR03RelationsOfflineToolResult(
      { ...rootResult, items: [{ ...rootResult.items[0], id: 990999 }] },
      R03_RELATIONS_OFFLINE_EXPECTED_CALLS[0].arguments,
    ),
    null,
  );
});
