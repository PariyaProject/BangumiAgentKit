import { getAgentMcpProfileById } from './agent-mcp-profile-claims.mjs';

export const RENDER_SUBJECT_CARD_OFFLINE_V1_PROFILE_ID = 'render-subject-card-offline-agent-mcp-v1';
export const RENDER_SUBJECT_CARD_OFFLINE_V1_NETWORK_MODE = 'run95-render-subject-card-offline-v1';
export const RENDER_SUBJECT_CARD_COMPACT_TYPE_V2_PROFILE_ID =
  'render-subject-card-compact-typography-agent-mcp-v2';
export const RENDER_SUBJECT_CARD_COMPACT_TYPE_V2_NETWORK_MODE =
  'run95-render-subject-card-compact-typography-v2';
export const RENDER_SUBJECT_CARD_OFFLINE_PROFILE_ID = RENDER_SUBJECT_CARD_COMPACT_TYPE_V2_PROFILE_ID;
export const RENDER_SUBJECT_CARD_OFFLINE_NETWORK_MODE = RENDER_SUBJECT_CARD_COMPACT_TYPE_V2_NETWORK_MODE;
export const RENDER_SUBJECT_CARD_OFFLINE_TOOL = 'bangumi.render_subject_card';
export const RENDER_SUBJECT_CARD_OFFLINE_V1_ARGUMENTS = Object.freeze({
  subjectId: 990901,
  includeCollection: false,
});
export const RENDER_SUBJECT_CARD_COMPACT_TYPE_V2_ARGUMENTS = Object.freeze({
  subjectId: 991902,
  includeCollection: false,
});
export const RENDER_SUBJECT_CARD_OFFLINE_ARGUMENTS = RENDER_SUBJECT_CARD_COMPACT_TYPE_V2_ARGUMENTS;

const PROFILE_CONFIGS = new Map([
  [
    RENDER_SUBJECT_CARD_OFFLINE_V1_PROFILE_ID,
    Object.freeze({
      id: RENDER_SUBJECT_CARD_OFFLINE_V1_PROFILE_ID,
      networkMode: RENDER_SUBJECT_CARD_OFFLINE_V1_NETWORK_MODE,
      epochId: 'run95-render-subject-card-offline-agent-mcp-20261021',
      argumentProfile: 'fixed-render-subject-card-offline-990901-no-collection-v1',
      claimLabelName: 'harness-r95-render-subject-card-v1-claimed',
      reportPath: 'docs/live-probes/render-subject-card-offline-agent-mcp-run95.json',
      selectionEvidencePath:
        'docs/research/run95-render-subject-card-offline-agent-mcp-contract-2026-10-21.md',
      evidenceKind: 'codex_cli_render_subject_card_offline_agent_mcp',
      answerCheckMethod: 'render-subject-card-synthetic-artifact-v1',
      arguments: RENDER_SUBJECT_CARD_OFFLINE_V1_ARGUMENTS,
      fixture: Object.freeze({
        id: RENDER_SUBJECT_CARD_OFFLINE_V1_ARGUMENTS.subjectId,
        type: 2,
        name: 'Render Subject Card Offline Fixture',
        name_cn: '合成卡片：星の町与安静的夜',
        date: '2026-10-21',
        platform: 'TV',
        summary: 'Fixed local fixture for the current-source subject-card renderer profile.',
        images: { common: '', large: '', medium: '', small: '' },
        tags: [
          { name: '合成标签', count: 3 },
          { name: '混合文字', count: 1 },
        ],
        rating: {
          score: 8.4,
          rank: 42,
          total: 12,
          count: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 2, 8: 5, 9: 4, 10: 1 },
        },
        collection: { wish: 4, collect: 5, doing: 2, on_hold: 1, dropped: 0 },
        total_episodes: 12,
      }),
    }),
  ],
  [
    RENDER_SUBJECT_CARD_COMPACT_TYPE_V2_PROFILE_ID,
    Object.freeze({
      id: RENDER_SUBJECT_CARD_COMPACT_TYPE_V2_PROFILE_ID,
      networkMode: RENDER_SUBJECT_CARD_COMPACT_TYPE_V2_NETWORK_MODE,
      epochId: 'run95-ux002-compact-typography-default-075-20261022',
      argumentProfile: 'fixed-ux002-subject-card-991902-no-collection-default-scale-075-v2',
      claimLabelName: 'harness-r95-render-card-type-v2-claimed',
      reportPath:
        'docs/live-probes/render-subject-card-compact-typography-v2-agent-mcp-run95.json',
      selectionEvidencePath:
        'docs/research/run95-ux002-render-subject-card-compact-typography-v2-source-contract-2026-10-22.md',
      evidenceKind: 'codex_cli_render_subject_card_compact_typography_v2_agent_mcp',
      answerCheckMethod: 'render-subject-card-compact-typography-v2-artifact',
      arguments: RENDER_SUBJECT_CARD_COMPACT_TYPE_V2_ARGUMENTS,
      fixture: Object.freeze({
        id: RENDER_SUBJECT_CARD_COMPACT_TYPE_V2_ARGUMENTS.subjectId,
        type: 2,
        name: 'Compact Typography Subject Fixture',
        name_cn: '默认字阶测试：星海与微光',
        date: '2026-10-22',
        platform: 'TV',
        summary:
          '合成条目用于确认默认紧凑字号；固定中文、日文与简短英文标题，不包含外部图片。',
        images: { common: '', large: '', medium: '', small: '' },
        tags: [
          { name: '合成演示', count: 3 },
          { name: '默认字号', count: 1 },
        ],
        rating: {
          score: 8.2,
          rank: 73,
          total: 16,
          count: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1, 6: 1, 7: 4, 8: 6, 9: 3, 10: 1 },
        },
        collection: { wish: 3, collect: 7, doing: 2, on_hold: 1, dropped: 0 },
        total_episodes: 12,
      }),
    }),
  ],
]);

function profileMatches(profile) {
  const config = PROFILE_CONFIGS.get(profile?.id);
  return Boolean(
    config &&
    profile &&
    profile.frontierId === 'OP-008' &&
    profile.epochId === config.epochId &&
    profile.toolName === RENDER_SUBJECT_CARD_OFFLINE_TOOL &&
    profile.argumentProfile === config.argumentProfile &&
    profile.claimLabelName === config.claimLabelName &&
    profile.reportPath === config.reportPath &&
    profile.selectionEvidencePath === config.selectionEvidencePath &&
    profile.evidenceKind === config.evidenceKind &&
    profile.answerCheckMethod === config.answerCheckMethod &&
    profile.networkMode === config.networkMode &&
    profile.acceptanceScope === 'agent-mcp-matrix-only' &&
    profile.model === 'gpt-6-luna' &&
    profile.reasoningEffort === 'max' &&
    profile.maxAnswerBytes === 128 &&
    Array.isArray(profile.calls) &&
    profile.calls.length === 1 &&
    profile.calls[0]?.toolName === RENDER_SUBJECT_CARD_OFFLINE_TOOL &&
    Object.keys(profile.calls[0]?.arguments ?? {}).sort().join(',') ===
      Object.keys(config.arguments).sort().join(',') &&
    Object.entries(config.arguments).every(
      ([key, value]) => profile.calls[0]?.arguments?.[key] === value,
    ),
  );
}

export function getRenderSubjectCardOfflineConfig(profileId) {
  return PROFILE_CONFIGS.get(profileId) ?? null;
}

export function isRenderSubjectCardOfflineProfileId(profileId) {
  return PROFILE_CONFIGS.has(profileId);
}

export function isRenderSubjectCardOfflineNetworkMode(networkMode) {
  return [...PROFILE_CONFIGS.values()].some((config) => config.networkMode === networkMode);
}

export function assertRenderSubjectCardOfflineProfile(profile) {
  const registered = getAgentMcpProfileById(profile?.id);
  if (!profileMatches(profile) || !registered || !profileMatches(registered)) {
    throw new Error('The registered render_subject_card offline profile is invalid.');
  }
  return true;
}

export function isRenderSubjectCardOfflineProfile(profile) {
  return profileMatches(profile);
}

export function allowsRenderSubjectCardOptionalTool(profile, catalogTool) {
  return Boolean(
    profileMatches(profile) &&
    catalogTool?.name === RENDER_SUBJECT_CARD_OFFLINE_TOOL &&
    catalogTool?.auth === 'optional' &&
    catalogTool?.risk === 'read',
  );
}

export function createRenderSubjectCardOfflineFetch(profile) {
  assertRenderSubjectCardOfflineProfile(profile);
  const config = getRenderSubjectCardOfflineConfig(profile.id);
  let requestCount = 0;
  let unexpectedRequestCount = 0;
  let authorizationHeaderCount = 0;
  let collectionRequestCount = 0;

  const expectedUrl = `https://api.bgm.tv/v0/subjects/${config.arguments.subjectId}`;

  return {
    fetchFn: async (input, init = {}) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = String(
        init.method ?? (input instanceof Request ? input.method : 'GET'),
      ).toUpperCase();
      const headers = new Headers(input instanceof Request ? input.headers : undefined);
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));

      if (headers.has('authorization')) authorizationHeaderCount += 1;
      if (/\/collections(?:\/|\?|$)/iu.test(url)) collectionRequestCount += 1;

      const allowed =
        url === expectedUrl &&
        method === 'GET' &&
        !headers.has('authorization') &&
        requestCount === 0;
      if (!allowed) {
        unexpectedRequestCount += 1;
        throw new Error('RENDER_SUBJECT_CARD_OFFLINE_UNEXPECTED_REQUEST');
      }

      requestCount += 1;
      return new Response(JSON.stringify(config.fixture), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
    snapshot: () => ({
      profile: config.networkMode,
      expectedOperation: `GET /v0/subjects/${config.arguments.subjectId}`,
      requestCount,
      expectedRequestCount: 1,
      unexpectedRequestCount,
      authorizationHeaderCount,
      collectionRequestCount,
      expectedOperationComplete: requestCount === 1 && unexpectedRequestCount === 0,
      rawFixturePayloadStored: false,
    }),
  };
}

export function createRenderSubjectCardOfflineAssetGuard() {
  let resolutionCallCount = 0;
  let nonEmptyAssetUrlCount = 0;
  let blockedRequestCount = 0;
  return {
    assetResolver: {
      async resolveAsset(url) {
        resolutionCallCount += 1;
        if (typeof url === 'string' && url.length > 0) nonEmptyAssetUrlCount += 1;
        blockedRequestCount += 1;
        throw new Error('RENDER_SUBJECT_CARD_OFFLINE_EXTERNAL_ASSET_BLOCKED');
      },
    },
    snapshot: () => ({
      assetResolutionCallCount: resolutionCallCount,
      nonEmptyAssetUrlCount,
      blockedAssetRequestCount: blockedRequestCount,
      localFallbackUsed: resolutionCallCount === 0,
    }),
  };
}
