import assert from 'node:assert/strict';
import test from 'node:test';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  R04_SERIES_WATCH_ORDER_EXPECTED_ARGUMENTS,
  R04_SERIES_WATCH_ORDER_OFFLINE_NETWORK_MODE,
  R04_SERIES_WATCH_ORDER_OFFLINE_PROFILE_ID,
  R04_SERIES_WATCH_ORDER_SYNTHETIC_ID,
  assertR04SeriesWatchOrderOfflineProfile,
  createR04SeriesWatchOrderOfflineFetch,
} from '../../scripts/lib/r04-series-watch-order-offline-fixture.mjs';
import { parseCodexOneToolMcpArguments } from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';

const REQUIRED = [
  '--summary-file',
  '/tmp/r04-mcp-summary.json',
  '--candidate-sha',
  'a'.repeat(40),
  '--bundle-sha256',
  'b'.repeat(64),
];
const ROOT = `https://api.bgm.tv/v0/subjects/${R04_SERIES_WATCH_ORDER_SYNTHETIC_ID}`;

test('R04 profile binds one exact synthetic offline watch-order matrix call', () => {
  const profile = getAgentMcpProfileById(R04_SERIES_WATCH_ORDER_OFFLINE_PROFILE_ID);
  assert.equal(assertR04SeriesWatchOrderOfflineProfile(profile), true);
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    R04_SERIES_WATCH_ORDER_OFFLINE_PROFILE_ID,
    ...REQUIRED,
  ]);
  assert.equal(config.toolName, 'bangumi.get_series_watch_order');
  assert.equal(config.networkMode, R04_SERIES_WATCH_ORDER_OFFLINE_NETWORK_MODE);
  assert.deepEqual(config.expectedArgumentSequence, [R04_SERIES_WATCH_ORDER_EXPECTED_ARGUMENTS]);
  assert.equal(config.profile.acceptanceScope, 'agent-mcp-matrix-only');
  assert.throws(() =>
    parseCodexOneToolMcpArguments([
      '--profile-id',
      R04_SERIES_WATCH_ORDER_OFFLINE_PROFILE_ID,
      '--network-mode',
      R04_SERIES_WATCH_ORDER_OFFLINE_NETWORK_MODE,
      ...REQUIRED,
    ]),
  );
  const altered = {
    ...profile,
    calls: [
      {
        toolName: profile.toolName,
        arguments: { ...R04_SERIES_WATCH_ORDER_EXPECTED_ARGUMENTS, subjectId: 1 },
      },
    ],
  };
  assert.throws(() => assertR04SeriesWatchOrderOfflineProfile(altered));
});

test('R04 offline fixture returns exactly two local GET responses without asset URLs', async () => {
  const fixture = createR04SeriesWatchOrderOfflineFetch();
  const rootResponse = await fixture.fetchFn(ROOT);
  const relationsResponse = await fixture.fetchFn(`${ROOT}/subjects`);
  assert.equal(rootResponse.status, 200);
  assert.equal(relationsResponse.status, 200);
  const root = await rootResponse.json();
  const relations = await relationsResponse.json();
  assert.equal(root.id, R04_SERIES_WATCH_ORDER_SYNTHETIC_ID);
  assert.equal(root.type, 2);
  assert.deepEqual(relations, []);
  assert.doesNotMatch(JSON.stringify({ root, relations }), /https?:\/\//u);
  assert.deepEqual(fixture.snapshot(), {
    profile: R04_SERIES_WATCH_ORDER_OFFLINE_NETWORK_MODE,
    requestCount: 2,
    subjectRequestCount: 1,
    relationsRequestCount: 1,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
  });
});

test('R04 offline fixture rejects every route except its two fixed GETs', async () => {
  const invalidCalls = [
    [`${ROOT}?limit=1`, undefined],
    [`${ROOT}/subjects`, { method: 'POST' }],
    [`${ROOT}/subjects`, { headers: { authorization: 'Bearer synthetic' } }],
    ['https://example.test/v0/subjects/990801', undefined],
    ['https://api.bgm.tv/v0/subjects/990802/subjects', undefined],
  ];
  for (const [url, init] of invalidCalls) {
    const fixture = createR04SeriesWatchOrderOfflineFetch();
    assert.equal((await fixture.fetchFn(url, init)).status, 599);
    assert.equal(fixture.snapshot().unexpectedRequestCount, 1);
  }
  const duplicate = createR04SeriesWatchOrderOfflineFetch();
  await duplicate.fetchFn(ROOT);
  assert.equal((await duplicate.fetchFn(ROOT)).status, 599);
  assert.equal(duplicate.snapshot().duplicateRequestCount, 1);
  const body = createR04SeriesWatchOrderOfflineFetch();
  assert.equal((await body.fetchFn(ROOT, { body: '{}' })).status, 599);
});

test('R04 profile summary retains only synthetic identity and bounded counters', () => {
  const summary = summarizeProfileToolResult(
    {
      state: 'complete',
      subjectId: R04_SERIES_WATCH_ORDER_SYNTHETIC_ID,
      root: { id: R04_SERIES_WATCH_ORDER_SYNTHETIC_ID, name: 'Synthetic Root' },
      watchOrder: [{ id: R04_SERIES_WATCH_ORDER_SYNTHETIC_ID }],
      related: [],
      coverage: {
        relationRequests: 1,
        relationRowsObserved: 0,
        detailsAttempted: 0,
      },
    },
    R04_SERIES_WATCH_ORDER_EXPECTED_ARGUMENTS,
    R04_SERIES_WATCH_ORDER_OFFLINE_PROFILE_ID,
  );
  assert.deepEqual(summary, {
    state: 'complete',
    subjectId: R04_SERIES_WATCH_ORDER_SYNTHETIC_ID,
    watchOrderCount: 1,
    relatedCount: 0,
    relationRequests: 1,
    relationRowsObserved: 0,
    detailsAttempted: 0,
  });
});
