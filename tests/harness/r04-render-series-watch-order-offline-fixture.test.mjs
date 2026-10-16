import assert from 'node:assert/strict';
import test from 'node:test';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  assertR04RenderSeriesWatchOrderOfflineProfile,
  createR04RenderSeriesWatchOrderAssetFence,
  createR04RenderSeriesWatchOrderOfflineFetch,
  R04_RENDER_SERIES_WATCH_ORDER_EXPECTED_ARGUMENTS,
  R04_RENDER_SERIES_WATCH_ORDER_NETWORK_MODE,
  R04_RENDER_SERIES_WATCH_ORDER_PROFILE_ID,
} from '../../scripts/lib/r04-render-series-watch-order-offline-fixture.mjs';

const PROFILE = getAgentMcpProfileById(R04_RENDER_SERIES_WATCH_ORDER_PROFILE_ID);

test('R04 render profile binds one synthetic renderer call', () => {
  assert.equal(assertR04RenderSeriesWatchOrderOfflineProfile(PROFILE), true);
  assert.deepEqual(PROFILE.calls[0].arguments, R04_RENDER_SERIES_WATCH_ORDER_EXPECTED_ARGUMENTS);
  assert.equal(PROFILE.toolName, 'bangumi.render_series_watch_order');
  assert.equal(PROFILE.acceptanceScope, 'agent-mcp-matrix-only');
  assert.equal(assertR04RenderSeriesWatchOrderOfflineProfile({ id: 'other' }), false);
  assert.throws(() =>
    assertR04RenderSeriesWatchOrderOfflineProfile({
      ...PROFILE,
      calls: [{ ...PROFILE.calls[0], arguments: { ...PROFILE.calls[0].arguments, depth: 1 } }],
    }),
  );
});

test('R04 render fixture accepts exactly the two synthetic GETs', async () => {
  const fixture = createR04RenderSeriesWatchOrderOfflineFetch();
  const root = await fixture.fetchFn('https://api.bgm.tv/v0/subjects/990802', { method: 'GET' });
  assert.equal(root.status, 200);
  assert.equal((await root.json()).id, 990802);
  const relations = await fixture.fetchFn('https://api.bgm.tv/v0/subjects/990802/subjects', {
    method: 'GET',
  });
  assert.deepEqual(await relations.json(), []);
  assert.deepEqual(fixture.snapshot(), {
    profile: R04_RENDER_SERIES_WATCH_ORDER_NETWORK_MODE,
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
  const duplicate = createR04RenderSeriesWatchOrderOfflineFetch();
  await duplicate.fetchFn('https://api.bgm.tv/v0/subjects/990802');
  assert.equal((await duplicate.fetchFn('https://api.bgm.tv/v0/subjects/990802')).status, 599);
  assert.equal(duplicate.snapshot().duplicateRequestCount, 1);

  const unlisted = createR04RenderSeriesWatchOrderOfflineFetch();
  assert.equal((await unlisted.fetchFn('https://api.bgm.tv/v0/subjects/990803')).status, 599);
  assert.equal(unlisted.snapshot().unexpectedRequestCount, 1);

  const authenticated = createR04RenderSeriesWatchOrderOfflineFetch();
  assert.equal(
    (
      await authenticated.fetchFn('https://api.bgm.tv/v0/subjects/990802', {
        headers: { authorization: 'Bearer blocked' },
      })
    ).status,
    599,
  );
  assert.equal(authenticated.snapshot().authorizationHeaderCount, 1);
});

test('R04 render asset fence throws and records every unexpected image request', async () => {
  const fence = createR04RenderSeriesWatchOrderAssetFence();
  await assert.rejects(fence.assetResolver.resolveAsset('https://example.invalid/image.png'));
  assert.deepEqual(fence.snapshot(), { requestCount: 1 });
});
