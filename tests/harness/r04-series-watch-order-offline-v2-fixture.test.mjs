import assert from 'node:assert/strict';
import test from 'node:test';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  R04_SERIES_WATCH_ORDER_V2_ARGUMENT_PROFILE,
  R04_SERIES_WATCH_ORDER_V2_EXPECTED_ARGUMENTS,
  R04_SERIES_WATCH_ORDER_V2_NETWORK_MODE,
  R04_SERIES_WATCH_ORDER_V2_PREQUEL_ID,
  R04_SERIES_WATCH_ORDER_V2_PROFILE_ID,
  R04_SERIES_WATCH_ORDER_V2_ROOT_ID,
  assertR04SeriesWatchOrderOfflineV2Profile,
  createR04SeriesWatchOrderOfflineV2Fetch,
} from '../../scripts/lib/r04-series-watch-order-offline-v2-fixture.mjs';
import { parseCodexOneToolMcpArguments } from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';

const REQUIRED = [
  '--summary-file',
  '/tmp/r04-v2-mcp-summary.json',
  '--candidate-sha',
  'a'.repeat(40),
  '--bundle-sha256',
  'b'.repeat(64),
];
const ROOT = `https://api.bgm.tv/v0/subjects/${R04_SERIES_WATCH_ORDER_V2_ROOT_ID}`;
const PREQUEL = `https://api.bgm.tv/v0/subjects/${R04_SERIES_WATCH_ORDER_V2_PREQUEL_ID}`;

test('R04 v2 binds a distinct immutable one-hop synthetic watch-order profile', () => {
  const profile = getAgentMcpProfileById(R04_SERIES_WATCH_ORDER_V2_PROFILE_ID);
  assert.equal(assertR04SeriesWatchOrderOfflineV2Profile(profile), true);
  assert.equal(profile.argumentProfile, R04_SERIES_WATCH_ORDER_V2_ARGUMENT_PROFILE);
  assert.deepEqual(profile.calls[0], {
    toolName: 'bangumi.get_series_watch_order',
    arguments: R04_SERIES_WATCH_ORDER_V2_EXPECTED_ARGUMENTS,
  });
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    R04_SERIES_WATCH_ORDER_V2_PROFILE_ID,
    ...REQUIRED,
  ]);
  assert.equal(config.toolName, 'bangumi.get_series_watch_order');
  assert.equal(config.networkMode, R04_SERIES_WATCH_ORDER_V2_NETWORK_MODE);
  assert.deepEqual(config.expectedArgumentSequence, [R04_SERIES_WATCH_ORDER_V2_EXPECTED_ARGUMENTS]);
  assert.throws(() =>
    assertR04SeriesWatchOrderOfflineV2Profile({
      ...profile,
      calls: [
        { toolName: profile.toolName, arguments: { ...profile.calls[0].arguments, depth: 0 } },
      ],
    }),
  );
});

test('R04 v2 fixture serves a non-empty prequel path through exactly four local GETs', async () => {
  const fixture = createR04SeriesWatchOrderOfflineV2Fetch();
  const rootResponse = await fixture.fetchFn(ROOT);
  const rootRelationsResponse = await fixture.fetchFn(`${ROOT}/subjects`);
  const prequelRelationsResponse = await fixture.fetchFn(`${PREQUEL}/subjects`);
  const prequelResponse = await fixture.fetchFn(PREQUEL);
  const root = await rootResponse.json();
  assert.deepEqual(root, {
    id: R04_SERIES_WATCH_ORDER_V2_ROOT_ID,
    type: 2,
    name: 'Synthetic Watch-Order Root 990817',
    name_cn: '合成观看顺序起点 990817',
    date: '2020-01-01',
    platform: 'TV',
    images: { large: '', common: '', medium: '', small: '', grid: '' },
  });
  const relations = await rootRelationsResponse.json();
  assert.deepEqual(relations, [
    {
      id: R04_SERIES_WATCH_ORDER_V2_PREQUEL_ID,
      type: 2,
      name: 'Synthetic Watch-Order Prequel 990818',
      name_cn: '合成前传 990818',
      relation: '前传',
    },
  ]);
  assert.deepEqual(await prequelRelationsResponse.json(), []);
  assert.equal((await prequelResponse.json()).id, R04_SERIES_WATCH_ORDER_V2_PREQUEL_ID);
  assert.doesNotMatch(JSON.stringify({ root, relations }), /https?:\/\//u);
  assert.deepEqual(fixture.snapshot(), {
    profile: R04_SERIES_WATCH_ORDER_V2_NETWORK_MODE,
    requestCount: 4,
    subjectRequestCount: 2,
    relationsRequestCount: 2,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
  });
});

test('R04 v2 fixture rejects requests outside its exact four routes', async () => {
  const invalidCalls = [
    [`${ROOT}?limit=1`, undefined],
    [`${ROOT}/subjects`, { method: 'POST' }],
    [`${ROOT}/subjects`, { headers: { authorization: 'Bearer synthetic' } }],
    ['https://example.test/v0/subjects/990817', undefined],
    ['https://api.bgm.tv/v0/subjects/990819/subjects', undefined],
  ];
  for (const [url, init] of invalidCalls) {
    const fixture = createR04SeriesWatchOrderOfflineV2Fetch();
    assert.equal((await fixture.fetchFn(url, init)).status, 599);
    assert.equal(fixture.snapshot().unexpectedRequestCount, 1);
  }
  const duplicate = createR04SeriesWatchOrderOfflineV2Fetch();
  await duplicate.fetchFn(ROOT);
  assert.equal((await duplicate.fetchFn(ROOT)).status, 599);
  assert.equal(duplicate.snapshot().duplicateRequestCount, 1);
  const body = createR04SeriesWatchOrderOfflineV2Fetch();
  assert.equal((await body.fetchFn(ROOT, { body: '{}' })).status, 599);
});

test('R04 v2 result summary records only synthetic IDs and bounded ordering facts', () => {
  const summary = summarizeProfileToolResult(
    {
      state: 'complete',
      subjectId: R04_SERIES_WATCH_ORDER_V2_ROOT_ID,
      watchOrder: [
        { id: R04_SERIES_WATCH_ORDER_V2_PREQUEL_ID, isRoot: false, placement: 'before_root' },
        { id: R04_SERIES_WATCH_ORDER_V2_ROOT_ID, isRoot: true, placement: 'root' },
      ],
      related: [{ id: R04_SERIES_WATCH_ORDER_V2_PREQUEL_ID }],
      coverage: { relationRequests: 2, relationRowsObserved: 1, detailsAttempted: 1 },
    },
    R04_SERIES_WATCH_ORDER_V2_EXPECTED_ARGUMENTS,
    R04_SERIES_WATCH_ORDER_V2_PROFILE_ID,
  );
  assert.deepEqual(summary, {
    state: 'complete',
    subjectId: R04_SERIES_WATCH_ORDER_V2_ROOT_ID,
    watchOrderCount: 2,
    watchOrder: [
      { id: R04_SERIES_WATCH_ORDER_V2_PREQUEL_ID, isRoot: false, placement: 'before_root' },
      { id: R04_SERIES_WATCH_ORDER_V2_ROOT_ID, isRoot: true, placement: 'root' },
    ],
    relatedCount: 1,
    relatedIds: [R04_SERIES_WATCH_ORDER_V2_PREQUEL_ID],
    relationRequests: 2,
    relationRowsObserved: 1,
    detailsAttempted: 1,
  });
});
