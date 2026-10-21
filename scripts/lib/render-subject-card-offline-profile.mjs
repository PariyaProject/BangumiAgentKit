import { getAgentMcpProfileById } from './agent-mcp-profile-claims.mjs';

export const RENDER_SUBJECT_CARD_OFFLINE_PROFILE_ID = 'render-subject-card-offline-agent-mcp-v1';
export const RENDER_SUBJECT_CARD_OFFLINE_NETWORK_MODE = 'run95-render-subject-card-offline-v1';
export const RENDER_SUBJECT_CARD_OFFLINE_TOOL = 'bangumi.render_subject_card';
export const RENDER_SUBJECT_CARD_OFFLINE_ARGUMENTS = Object.freeze({
  subjectId: 990901,
  includeCollection: false,
});

const EXPECTED_EPOCH_ID = 'run95-render-subject-card-offline-agent-mcp-20261021';
const EXPECTED_ARGUMENT_PROFILE = 'fixed-render-subject-card-offline-990901-no-collection-v1';
const EXPECTED_CLAIM_LABEL = 'harness-r95-render-subject-card-v1-claimed';
const EXPECTED_REPORT_PATH = 'docs/live-probes/render-subject-card-offline-agent-mcp-run95.json';
const EXPECTED_SELECTION_PATH =
  'docs/research/run95-render-subject-card-offline-agent-mcp-contract-2026-10-21.md';

const SUBJECT_FIXTURE = Object.freeze({
  id: RENDER_SUBJECT_CARD_OFFLINE_ARGUMENTS.subjectId,
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
});

function profileMatches(profile) {
  return Boolean(
    profile &&
    profile.id === RENDER_SUBJECT_CARD_OFFLINE_PROFILE_ID &&
    profile.frontierId === 'OP-008' &&
    profile.epochId === EXPECTED_EPOCH_ID &&
    profile.toolName === RENDER_SUBJECT_CARD_OFFLINE_TOOL &&
    profile.argumentProfile === EXPECTED_ARGUMENT_PROFILE &&
    profile.claimLabelName === EXPECTED_CLAIM_LABEL &&
    profile.reportPath === EXPECTED_REPORT_PATH &&
    profile.selectionEvidencePath === EXPECTED_SELECTION_PATH &&
    profile.evidenceKind === 'codex_cli_render_subject_card_offline_agent_mcp' &&
    profile.answerCheckMethod === 'render-subject-card-synthetic-artifact-v1' &&
    profile.networkMode === RENDER_SUBJECT_CARD_OFFLINE_NETWORK_MODE &&
    profile.acceptanceScope === 'agent-mcp-matrix-only' &&
    profile.model === 'gpt-6-luna' &&
    profile.reasoningEffort === 'max' &&
    profile.maxAnswerBytes === 128 &&
    Array.isArray(profile.calls) &&
    profile.calls.length === 1 &&
    profile.calls[0]?.toolName === RENDER_SUBJECT_CARD_OFFLINE_TOOL &&
    profile.calls[0]?.arguments?.subjectId === RENDER_SUBJECT_CARD_OFFLINE_ARGUMENTS.subjectId &&
    profile.calls[0]?.arguments?.includeCollection === false &&
    Object.keys(profile.calls[0]?.arguments ?? {}).length === 2,
  );
}

export function assertRenderSubjectCardOfflineProfile(profile) {
  const registered = getAgentMcpProfileById(RENDER_SUBJECT_CARD_OFFLINE_PROFILE_ID);
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
  let requestCount = 0;
  let unexpectedRequestCount = 0;
  let authorizationHeaderCount = 0;
  let collectionRequestCount = 0;

  const expectedUrl = `https://api.bgm.tv/v0/subjects/${RENDER_SUBJECT_CARD_OFFLINE_ARGUMENTS.subjectId}`;

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
      return new Response(JSON.stringify(SUBJECT_FIXTURE), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
    snapshot: () => ({
      profile: RENDER_SUBJECT_CARD_OFFLINE_NETWORK_MODE,
      expectedOperation: 'GET /v0/subjects/990901',
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
