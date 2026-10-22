import assert from 'node:assert/strict';
import test from 'node:test';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  allowsRenderSubjectCardOptionalTool,
  createRenderSubjectCardOfflineAssetGuard,
  createRenderSubjectCardOfflineFetch,
  RENDER_SUBJECT_CARD_OFFLINE_PROFILE_ID,
  RENDER_SUBJECT_CARD_COMPACT_TYPOGRAPHY_V4_PROFILE_ID,
} from '../../scripts/lib/render-subject-card-offline-profile.mjs';

function profile(profileId = RENDER_SUBJECT_CARD_OFFLINE_PROFILE_ID) {
  return getAgentMcpProfileById(profileId);
}

test('optional-auth allowlist is limited to the exact read-only profile and catalog tool', () => {
  const registered = profile();
  assert.equal(
    allowsRenderSubjectCardOptionalTool(registered, {
      name: 'bangumi.render_subject_card',
      auth: 'optional',
      risk: 'read',
    }),
    true,
  );
  assert.equal(
    allowsRenderSubjectCardOptionalTool(registered, {
      name: 'bangumi.manage_index',
      auth: 'required',
      risk: 'write',
    }),
    false,
  );
  assert.equal(
    allowsRenderSubjectCardOptionalTool(registered, {
      name: 'bangumi.render_cast_card',
      auth: 'optional',
      risk: 'read',
    }),
    false,
  );
  assert.equal(
    allowsRenderSubjectCardOptionalTool(
      {
        ...registered,
        calls: [
          {
            toolName: 'bangumi.render_subject_card',
            arguments: { subjectId: 991903, includeCollection: true },
          },
        ],
      },
      {
        name: 'bangumi.render_subject_card',
        auth: 'optional',
        risk: 'read',
      },
    ),
    false,
  );
});

test('render_subject_card v3 offline fixture serves one exact synthetic public Subject response', async () => {
  const fixture = createRenderSubjectCardOfflineFetch(profile());
  const response = await fixture.fetchFn('https://api.bgm.tv/v0/subjects/991903');

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json');
  const result = await response.json();
  assert.equal(result.id, 991903);
  assert.equal(result.name, '夜明けの記録 / Daybreak Notes');
  assert.equal(result.name_cn, '紧凑字阶复核：晨光与远岸');
  assert.deepEqual(fixture.snapshot(), {
    profile: 'run95-render-subject-card-compact-typography-v3',
    expectedOperation: 'GET /v0/subjects/991903',
    requestCount: 1,
    expectedRequestCount: 1,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    collectionRequestCount: 0,
    expectedOperationComplete: true,
    rawFixturePayloadStored: false,
  });
});

test('render_subject_card v4 fixture has a distinct mixed-script subject and one exact read', async () => {
  const fixture = createRenderSubjectCardOfflineFetch(
    profile(RENDER_SUBJECT_CARD_COMPACT_TYPOGRAPHY_V4_PROFILE_ID),
  );
  const response = await fixture.fetchFn('https://api.bgm.tv/v0/subjects/991904');

  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.id, 991904);
  assert.equal(result.name, '星降る海辺のアトリエ / Atelier of Falling Stars');
  assert.equal(result.name_cn, '星海手记：一段关于旅途、夏夜、旧书店与远方灯火的故事');
  assert.deepEqual(fixture.snapshot(), {
    profile: 'run95-render-subject-card-compact-typography-v4',
    expectedOperation: 'GET /v0/subjects/991904',
    requestCount: 1,
    expectedRequestCount: 1,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    collectionRequestCount: 0,
    expectedOperationComplete: true,
    rawFixturePayloadStored: false,
  });
});

test('render_subject_card offline fixture rejects every route beyond the fixed subject read', async () => {
  const fixture = createRenderSubjectCardOfflineFetch(profile());

  await assert.rejects(
    fixture.fetchFn('https://api.bgm.tv/v0/subjects/991902'),
    /RENDER_SUBJECT_CARD_OFFLINE_UNEXPECTED_REQUEST/u,
  );
  await assert.rejects(
    fixture.fetchFn('https://api.bgm.tv/v0/users/me/collections/991903'),
    /RENDER_SUBJECT_CARD_OFFLINE_UNEXPECTED_REQUEST/u,
  );
  await assert.rejects(
    fixture.fetchFn('https://images.example.invalid/cover.jpg'),
    /RENDER_SUBJECT_CARD_OFFLINE_UNEXPECTED_REQUEST/u,
  );

  const snapshot = fixture.snapshot();
  assert.equal(snapshot.requestCount, 0);
  assert.equal(snapshot.unexpectedRequestCount, 3);
  assert.equal(snapshot.collectionRequestCount, 1);
  assert.equal(snapshot.expectedOperationComplete, false);
});

test('render_subject_card offline fixture rejects Authorization and non-GET requests', async () => {
  const fixture = createRenderSubjectCardOfflineFetch(profile());

  await assert.rejects(
    fixture.fetchFn('https://api.bgm.tv/v0/subjects/991903', {
      headers: { Authorization: 'Bearer synthetic-forbidden' },
    }),
    /RENDER_SUBJECT_CARD_OFFLINE_UNEXPECTED_REQUEST/u,
  );
  await assert.rejects(
    fixture.fetchFn('https://api.bgm.tv/v0/subjects/991903', { method: 'POST' }),
    /RENDER_SUBJECT_CARD_OFFLINE_UNEXPECTED_REQUEST/u,
  );

  const snapshot = fixture.snapshot();
  assert.equal(snapshot.requestCount, 0);
  assert.equal(snapshot.authorizationHeaderCount, 1);
  assert.equal(snapshot.unexpectedRequestCount, 2);
});

test('render_subject_card offline fixture rejects a duplicate allowed read', async () => {
  const fixture = createRenderSubjectCardOfflineFetch(profile());
  await fixture.fetchFn('https://api.bgm.tv/v0/subjects/991903');

  await assert.rejects(
    fixture.fetchFn('https://api.bgm.tv/v0/subjects/991903'),
    /RENDER_SUBJECT_CARD_OFFLINE_UNEXPECTED_REQUEST/u,
  );

  const snapshot = fixture.snapshot();
  assert.equal(snapshot.requestCount, 1);
  assert.equal(snapshot.unexpectedRequestCount, 1);
  assert.equal(snapshot.expectedOperationComplete, false);
});

test('render_subject_card offline asset guard rejects asset resolution rather than fetching', async () => {
  const guard = createRenderSubjectCardOfflineAssetGuard();

  await assert.rejects(
    guard.assetResolver.resolveAsset('https://images.example.invalid/cover.jpg'),
    /RENDER_SUBJECT_CARD_OFFLINE_EXTERNAL_ASSET_BLOCKED/u,
  );
  assert.deepEqual(guard.snapshot(), {
    assetResolutionCallCount: 1,
    nonEmptyAssetUrlCount: 1,
    blockedAssetRequestCount: 1,
    localFallbackUsed: false,
  });
});
