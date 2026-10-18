import assert from 'node:assert/strict';
import test from 'node:test';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  assertR04RenderV2SeriesWatchOrderOfflineV2Profile,
  createR04RenderV2SeriesWatchOrderV2AssetFence,
  createR04RenderV2SeriesWatchOrderOfflineV2Fetch,
  R04_RENDER_SERIES_WATCH_ORDER_V2_EXPECTED_ARGUMENTS,
  R04_RENDER_SERIES_WATCH_ORDER_V2_NETWORK_MODE,
  R04_RENDER_SERIES_WATCH_ORDER_V2_PROFILE_ID,
} from '../../scripts/lib/r04-render-series-watch-order-offline-v2-fixture.mjs';

const PROFILE = getAgentMcpProfileById(R04_RENDER_SERIES_WATCH_ORDER_V2_PROFILE_ID);

test('R04 render profile binds one synthetic renderer call', () => {
  assert.equal(assertR04RenderV2SeriesWatchOrderOfflineV2Profile(PROFILE), true);
  assert.deepEqual(PROFILE.calls[0].arguments, R04_RENDER_SERIES_WATCH_ORDER_V2_EXPECTED_ARGUMENTS);
  assert.equal(PROFILE.toolName, 'bangumi.render_series_watch_order');
  assert.equal(PROFILE.acceptanceScope, 'agent-mcp-matrix-only');
  assert.equal(assertR04RenderV2SeriesWatchOrderOfflineV2Profile({ id: 'other' }), false);
  assert.throws(() =>
    assertR04RenderV2SeriesWatchOrderOfflineV2Profile({
      ...PROFILE,
      calls: [{ ...PROFILE.calls[0], arguments: { ...PROFILE.calls[0].arguments, depth: 1 } }],
    }),
  );
});

test('R04 render fixture accepts exactly the two synthetic GETs', async () => {
  const fixture = createR04RenderV2SeriesWatchOrderOfflineV2Fetch();
  const root = await fixture.fetchFn('https://api.bgm.tv/v0/subjects/990803', { method: 'GET' });
  assert.equal(root.status, 200);
  assert.equal((await root.json()).id, 990803);
  const relations = await fixture.fetchFn('https://api.bgm.tv/v0/subjects/990803/subjects', {
    method: 'GET',
  });
  assert.deepEqual(await relations.json(), []);
  assert.deepEqual(fixture.snapshot(), {
    profile: R04_RENDER_SERIES_WATCH_ORDER_V2_NETWORK_MODE,
    requestCount: 2,
    subjectRequestCount: 1,
    relationsRequestCount: 1,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
  });
});

test('R04 render fixture rejects duplicate or unlisted requests and authorization', async () => {
  const duplicate = createR04RenderV2SeriesWatchOrderOfflineV2Fetch();
  await duplicate.fetchFn('https://api.bgm.tv/v0/subjects/990803');
  assert.equal((await duplicate.fetchFn('https://api.bgm.tv/v0/subjects/990803')).status, 599);
  assert.equal(duplicate.snapshot().duplicateRequestCount, 1);

  const unlisted = createR04RenderV2SeriesWatchOrderOfflineV2Fetch();
  assert.equal((await unlisted.fetchFn('https://api.bgm.tv/v0/subjects/990804')).status, 599);
  assert.equal(unlisted.snapshot().unexpectedRequestCount, 1);

  const authenticated = createR04RenderV2SeriesWatchOrderOfflineV2Fetch();
  assert.equal(
    (
      await authenticated.fetchFn('https://api.bgm.tv/v0/subjects/990803', {
        headers: { authorization: 'Bearer blocked' },
      })
    ).status,
    599,
  );
  assert.equal(authenticated.snapshot().authorizationHeaderCount, 1);
});

test('R04 render fixture denies query strings, bodies, methods, and foreign origins', async () => {
  const deniedRequests = [
    {
      name: 'query string',
      url: 'https://api.bgm.tv/v0/subjects/990803?include=private',
      init: { method: 'GET' },
    },
    {
      name: 'request body',
      url: 'https://api.bgm.tv/v0/subjects/990803',
      init: { method: 'GET', body: '{}' },
    },
    {
      name: 'request object body',
      input: {
        url: 'https://api.bgm.tv/v0/subjects/990803',
        method: 'GET',
        body: '{}',
      },
    },
    {
      name: 'non-GET method',
      url: 'https://api.bgm.tv/v0/subjects/990803',
      init: { method: 'POST' },
    },
    {
      name: 'foreign origin',
      url: 'https://example.invalid/v0/subjects/990803',
      init: { method: 'GET' },
    },
  ];

  for (const request of deniedRequests) {
    const fixture = createR04RenderV2SeriesWatchOrderOfflineV2Fetch();
    assert.equal(
      (await fixture.fetchFn(request.input ?? request.url, request.init)).status,
      599,
      `should deny ${request.name}`,
    );
    assert.equal(fixture.snapshot().unexpectedRequestCount, 1, request.name);
    assert.equal(fixture.snapshot().expectedOperationsComplete, false, request.name);
  }
});

test('R04 render asset fence throws and records every unexpected image request', async () => {
  const fence = createR04RenderV2SeriesWatchOrderV2AssetFence();
  await assert.rejects(fence.assetResolver.resolveAsset('https://example.invalid/image.png'));
  assert.deepEqual(fence.snapshot(), { requestCount: 1 });
});
