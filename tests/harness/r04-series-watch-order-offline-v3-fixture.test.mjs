import assert from 'node:assert/strict';
import test from 'node:test';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  R04_SERIES_WATCH_ORDER_V3_ARGUMENT_PROFILE,
  R04_SERIES_WATCH_ORDER_V3_EXPECTED_ARGUMENTS,
  R04_SERIES_WATCH_ORDER_V3_NETWORK_MODE,
  R04_SERIES_WATCH_ORDER_V3_PREQUEL_ID,
  R04_SERIES_WATCH_ORDER_V3_PROFILE_ID,
  R04_SERIES_WATCH_ORDER_V3_ROOT_ID,
  R04_SERIES_WATCH_ORDER_V3_SEQUEL_ID,
  assertR04SeriesWatchOrderOfflineV3Profile,
  createR04SeriesWatchOrderOfflineV3Fetch,
} from '../../scripts/lib/r04-series-watch-order-offline-v3-fixture.mjs';
import { parseCodexOneToolMcpArguments } from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';

const REQUIRED = [
  '--summary-file',
  '/tmp/r04-v3-mcp-summary.json',
  '--candidate-sha',
  'a'.repeat(40),
  '--bundle-sha256',
  'b'.repeat(64),
];
const ROOT = `https://api.bgm.tv/v0/subjects/${R04_SERIES_WATCH_ORDER_V3_ROOT_ID}`;
const PREQUEL = `https://api.bgm.tv/v0/subjects/${R04_SERIES_WATCH_ORDER_V3_PREQUEL_ID}`;
const SEQUEL = `https://api.bgm.tv/v0/subjects/${R04_SERIES_WATCH_ORDER_V3_SEQUEL_ID}`;

test('R04 v3 binds a fresh immutable two-node offline watch-order profile', () => {
  const profile = getAgentMcpProfileById(R04_SERIES_WATCH_ORDER_V3_PROFILE_ID);
  assert.equal(assertR04SeriesWatchOrderOfflineV3Profile(profile), true);
  assert.equal(profile.argumentProfile, R04_SERIES_WATCH_ORDER_V3_ARGUMENT_PROFILE);
  assert.deepEqual(profile.calls[0], {
    toolName: 'bangumi.get_series_watch_order',
    arguments: R04_SERIES_WATCH_ORDER_V3_EXPECTED_ARGUMENTS,
  });
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    R04_SERIES_WATCH_ORDER_V3_PROFILE_ID,
    ...REQUIRED,
  ]);
  assert.equal(config.toolName, 'bangumi.get_series_watch_order');
  assert.equal(config.networkMode, R04_SERIES_WATCH_ORDER_V3_NETWORK_MODE);
  assert.deepEqual(config.expectedArgumentSequence, [R04_SERIES_WATCH_ORDER_V3_EXPECTED_ARGUMENTS]);
  assert.throws(() =>
    assertR04SeriesWatchOrderOfflineV3Profile({
      ...profile,
      calls: [
        { toolName: profile.toolName, arguments: { ...profile.calls[0].arguments, maxNodes: 1 } },
      ],
    }),
  );
});

test('R04 v3 fixture serves two ordered neighbors through exactly six local GETs', async () => {
  const fixture = createR04SeriesWatchOrderOfflineV3Fetch();
  const paths = [
    ROOT,
    `${ROOT}/subjects`,
    `${PREQUEL}/subjects`,
    `${SEQUEL}/subjects`,
    PREQUEL,
    SEQUEL,
  ];
  const responses = await Promise.all(paths.map((url) => fixture.fetchFn(url)));
  assert.ok(responses.every((item) => item.status === 200));
  const root = await responses[0].json();
  assert.equal(root.id, R04_SERIES_WATCH_ORDER_V3_ROOT_ID);
  assert.deepEqual(await responses[1].json(), [
    {
      id: R04_SERIES_WATCH_ORDER_V3_PREQUEL_ID,
      type: 2,
      name: 'Synthetic Watch-Order Prequel 991405',
      name_cn: '合成前传 991405',
      relation: '前传',
    },
    {
      id: R04_SERIES_WATCH_ORDER_V3_SEQUEL_ID,
      type: 2,
      name: 'Synthetic Watch-Order Sequel 991406',
      name_cn: '合成续集 991406',
      relation: '续集',
    },
  ]);
  assert.deepEqual(await responses[2].json(), []);
  assert.deepEqual(await responses[3].json(), []);
  assert.equal((await responses[4].json()).id, R04_SERIES_WATCH_ORDER_V3_PREQUEL_ID);
  assert.equal((await responses[5].json()).id, R04_SERIES_WATCH_ORDER_V3_SEQUEL_ID);
  assert.doesNotMatch(JSON.stringify(root), /https?:\/\//u);
  assert.deepEqual(fixture.snapshot(), {
    profile: R04_SERIES_WATCH_ORDER_V3_NETWORK_MODE,
    requestCount: 6,
    subjectRequestCount: 3,
    relationsRequestCount: 3,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
  });
});

test('R04 v3 fixture rejects routes outside its exact six-operation set', async () => {
  const invalidCalls = [
    [`${ROOT}?limit=2`, undefined],
    [`${ROOT}/subjects`, { method: 'POST' }],
    [`${ROOT}/subjects`, { headers: { authorization: 'Bearer synthetic' } }],
    ['https://example.test/v0/subjects/991404', undefined],
    ['https://api.bgm.tv/v0/subjects/991407/subjects', undefined],
  ];
  for (const [url, init] of invalidCalls) {
    const fixture = createR04SeriesWatchOrderOfflineV3Fetch();
    assert.equal((await fixture.fetchFn(url, init)).status, 599);
    assert.equal(fixture.snapshot().unexpectedRequestCount, 1);
  }
  const duplicate = createR04SeriesWatchOrderOfflineV3Fetch();
  await duplicate.fetchFn(ROOT);
  assert.equal((await duplicate.fetchFn(ROOT)).status, 599);
  assert.equal(duplicate.snapshot().duplicateRequestCount, 1);
  const body = createR04SeriesWatchOrderOfflineV3Fetch();
  assert.equal((await body.fetchFn(ROOT, { body: '{}' })).status, 599);
  const requestBody = createR04SeriesWatchOrderOfflineV3Fetch();
  assert.equal(
    (
      await requestBody.fetchFn({
        url: ROOT,
        method: 'GET',
        headers: {},
        body: '{}',
      })
    ).status,
    599,
  );
});

test('R04 v3 summary preserves only bounded multi-node ordering facts', () => {
  const summary = summarizeProfileToolResult(
    {
      state: 'complete',
      subjectId: R04_SERIES_WATCH_ORDER_V3_ROOT_ID,
      watchOrder: [
        { id: R04_SERIES_WATCH_ORDER_V3_PREQUEL_ID, isRoot: false, placement: 'before_root' },
        { id: R04_SERIES_WATCH_ORDER_V3_ROOT_ID, isRoot: true, placement: 'root' },
        { id: R04_SERIES_WATCH_ORDER_V3_SEQUEL_ID, isRoot: false, placement: 'after_root' },
      ],
      related: [
        { id: R04_SERIES_WATCH_ORDER_V3_PREQUEL_ID },
        { id: R04_SERIES_WATCH_ORDER_V3_SEQUEL_ID },
      ],
      coverage: { relationRequests: 3, relationRowsObserved: 2, detailsAttempted: 2 },
    },
    R04_SERIES_WATCH_ORDER_V3_EXPECTED_ARGUMENTS,
    R04_SERIES_WATCH_ORDER_V3_PROFILE_ID,
  );
  assert.deepEqual(summary, {
    state: 'complete',
    subjectId: R04_SERIES_WATCH_ORDER_V3_ROOT_ID,
    watchOrderCount: 3,
    watchOrder: [
      { id: R04_SERIES_WATCH_ORDER_V3_PREQUEL_ID, isRoot: false, placement: 'before_root' },
      { id: R04_SERIES_WATCH_ORDER_V3_ROOT_ID, isRoot: true, placement: 'root' },
      { id: R04_SERIES_WATCH_ORDER_V3_SEQUEL_ID, isRoot: false, placement: 'after_root' },
    ],
    relatedCount: 2,
    relatedIds: [R04_SERIES_WATCH_ORDER_V3_PREQUEL_ID, R04_SERIES_WATCH_ORDER_V3_SEQUEL_ID],
    relationRequests: 3,
    relationRowsObserved: 2,
    detailsAttempted: 2,
  });
});
