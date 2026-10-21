import assert from 'node:assert/strict';
import test from 'node:test';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  allowsRenderSubjectCardOptionalTool,
  createRenderSubjectCardOfflineAssetGuard,
  createRenderSubjectCardOfflineFetch,
  RENDER_SUBJECT_CARD_OFFLINE_PROFILE_ID,
} from '../../scripts/lib/render-subject-card-offline-profile.mjs';

function profile() {
  return getAgentMcpProfileById(RENDER_SUBJECT_CARD_OFFLINE_PROFILE_ID);
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
            arguments: { subjectId: 990901, includeCollection: true },
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

test('render_subject_card offline fixture serves one exact synthetic public Subject response', async () => {
  const fixture = createRenderSubjectCardOfflineFetch(profile());
  const response = await fixture.fetchFn('https://api.bgm.tv/v0/subjects/990901');

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json');
  const result = await response.json();
  assert.equal(result.id, 990901);
  assert.equal(result.name_cn, '合成卡片：星の町与安静的夜');
  assert.deepEqual(fixture.snapshot(), {
    profile: 'run95-render-subject-card-offline-v1',
    expectedOperation: 'GET /v0/subjects/990901',
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
    fixture.fetchFn('https://api.bgm.tv/v0/subjects/990902'),
    /RENDER_SUBJECT_CARD_OFFLINE_UNEXPECTED_REQUEST/u,
  );
  await assert.rejects(
    fixture.fetchFn('https://api.bgm.tv/v0/users/me/collections/990901'),
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
    fixture.fetchFn('https://api.bgm.tv/v0/subjects/990901', {
      headers: { Authorization: 'Bearer synthetic-forbidden' },
    }),
    /RENDER_SUBJECT_CARD_OFFLINE_UNEXPECTED_REQUEST/u,
  );
  await assert.rejects(
    fixture.fetchFn('https://api.bgm.tv/v0/subjects/990901', { method: 'POST' }),
    /RENDER_SUBJECT_CARD_OFFLINE_UNEXPECTED_REQUEST/u,
  );

  const snapshot = fixture.snapshot();
  assert.equal(snapshot.requestCount, 0);
  assert.equal(snapshot.authorizationHeaderCount, 1);
  assert.equal(snapshot.unexpectedRequestCount, 2);
});

test('render_subject_card offline fixture rejects a duplicate allowed read', async () => {
  const fixture = createRenderSubjectCardOfflineFetch(profile());
  await fixture.fetchFn('https://api.bgm.tv/v0/subjects/990901');

  await assert.rejects(
    fixture.fetchFn('https://api.bgm.tv/v0/subjects/990901'),
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
