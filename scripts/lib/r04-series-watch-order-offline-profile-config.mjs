import {
  R04_SERIES_WATCH_ORDER_V2_EXPECTED_ARGUMENTS,
  R04_SERIES_WATCH_ORDER_V2_NETWORK_MODE,
  R04_SERIES_WATCH_ORDER_V2_PROFILE_ID,
  assertR04SeriesWatchOrderOfflineV2Profile,
} from './r04-series-watch-order-offline-v2-fixture.mjs';
import {
  R04_SERIES_WATCH_ORDER_V3_EXPECTED_ARGUMENTS,
  R04_SERIES_WATCH_ORDER_V3_NETWORK_MODE,
  R04_SERIES_WATCH_ORDER_V3_PREQUEL_ID,
  R04_SERIES_WATCH_ORDER_V3_PROFILE_ID,
  R04_SERIES_WATCH_ORDER_V3_ROOT_ID,
  R04_SERIES_WATCH_ORDER_V3_SEQUEL_ID,
  assertR04SeriesWatchOrderOfflineV3Profile,
} from './r04-series-watch-order-offline-v3-fixture.mjs';

const V2_CONFIG = Object.freeze({
  profileId: R04_SERIES_WATCH_ORDER_V2_PROFILE_ID,
  networkMode: R04_SERIES_WATCH_ORDER_V2_NETWORK_MODE,
  expectedArguments: R04_SERIES_WATCH_ORDER_V2_EXPECTED_ARGUMENTS,
  serverId: 'bgk_r04_watch_order_v2',
  acknowledgement: 'R04_SYNTHETIC_WATCH_ORDER_PREQUEL_CHAIN_READ',
  reportProfile: 'codex-luna-max-offline-agent-mcp-matrix-v2',
  receiptKind: 'r04-series-watch-order-offline-v2-runner-receipt-v1',
  expectedAnswerChecks: Object.freeze({
    exactRegisteredProfile: true,
    oneAllowedMcpTool: true,
    fixedArguments: true,
    exactCandidateBundle: true,
    offlineFixtureOnly: true,
    fourExpectedLocalResponses: true,
    noAssetRequests: true,
    exactAcknowledgement: true,
    privacyPreserved: true,
  }),
  expectedFixture: Object.freeze({
    profile: R04_SERIES_WATCH_ORDER_V2_NETWORK_MODE,
    requestCount: 4,
    subjectRequestCount: 2,
    relationsRequestCount: 2,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
  }),
  expectedResultSummary: Object.freeze({
    state: 'complete',
    subjectId: 990817,
    watchOrderCount: 2,
    watchOrder: [
      { id: 990818, isRoot: false, placement: 'before_root' },
      { id: 990817, isRoot: true, placement: 'root' },
    ],
    relatedCount: 1,
    relatedIds: [990818],
    relationRequests: 2,
    relationRowsObserved: 1,
    detailsAttempted: 1,
  }),
  assertProfile: assertR04SeriesWatchOrderOfflineV2Profile,
});

const V3_CONFIG = Object.freeze({
  profileId: R04_SERIES_WATCH_ORDER_V3_PROFILE_ID,
  networkMode: R04_SERIES_WATCH_ORDER_V3_NETWORK_MODE,
  expectedArguments: R04_SERIES_WATCH_ORDER_V3_EXPECTED_ARGUMENTS,
  serverId: 'bgk_r04_watch_order_v3',
  acknowledgement: 'R04_SYNTHETIC_WATCH_ORDER_TWO_DIRECT_NODES_READ',
  reportProfile: 'codex-luna-max-offline-agent-mcp-matrix-v3',
  receiptKind: 'r04-series-watch-order-offline-v3-runner-receipt-v1',
  expectedAnswerChecks: Object.freeze({
    exactRegisteredProfile: true,
    oneAllowedMcpTool: true,
    fixedArguments: true,
    exactCandidateBundle: true,
    offlineFixtureOnly: true,
    sixExpectedLocalOperations: true,
    noAssetRequests: true,
    exactAcknowledgement: true,
    privacyPreserved: true,
  }),
  expectedFixture: Object.freeze({
    profile: R04_SERIES_WATCH_ORDER_V3_NETWORK_MODE,
    requestCount: 6,
    subjectRequestCount: 3,
    relationsRequestCount: 3,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
  }),
  expectedResultSummary: Object.freeze({
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
  }),
  assertProfile: assertR04SeriesWatchOrderOfflineV3Profile,
});

const CONFIGS = new Map([
  [V2_CONFIG.profileId, V2_CONFIG],
  [V3_CONFIG.profileId, V3_CONFIG],
]);

export function getR04SeriesWatchOrderOfflineProfileConfig(profileId) {
  return CONFIGS.get(profileId) ?? null;
}

export function assertR04SeriesWatchOrderOfflineProfile(profile) {
  const config = getR04SeriesWatchOrderOfflineProfileConfig(profile?.id);
  if (!config) return false;
  return config.assertProfile(profile);
}
