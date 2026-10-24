import { createHash, generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  R04_SERIES_WATCH_ORDER_V2_PROFILE_ID,
  R04_SERIES_WATCH_ORDER_V2_NETWORK_MODE,
  R04_SERIES_WATCH_ORDER_V2_ROOT_ID,
} from '../../../scripts/lib/r04-series-watch-order-offline-v2-fixture.mjs';
const PROFILE = getAgentMcpProfileById(R04_SERIES_WATCH_ORDER_V2_PROFILE_ID);
const SOURCE_SHA = 'a'.repeat(40);
const BASE_SHA = 'b'.repeat(40);
const BUNDLE_SHA = 'c'.repeat(64);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const CI_CHECKS = [
  'harness-control',
  'sqlite-default',
  'host-integration',
  'standalone-release-smoke',
  'postgres-compat',
  'provider-foundation',
  'discovery-foundation',
].map((name) => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' }));

export function r04SignedReportInput() {
  const keys = generateKeyPairSync('ed25519');
  const publicKeyDer = keys.publicKey.export({ type: 'spki', format: 'der' });
  const publicKeyBase64 = publicKeyDer.toString('base64');
  const catalogBytes = readFileSync(new URL('../../../docs/tool-catalog.json', import.meta.url));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const catalogTool = catalog.find((row) => row.name === PROFILE.toolName);
  const claim = {
    schemaVersion: 1,
    claimId: `profile-run-95-pr-186-${SOURCE_SHA.slice(0, 12)}-1792100000000`,
    state: 'CLAIMED',
    profileId: PROFILE.id,
    frontierId: 'R04',
    epochId: PROFILE.epochId,
    runNumber: 95,
    prNumber: 186,
    toolName: PROFILE.toolName,
    argumentProfile: PROFILE.argumentProfile,
    expectedArguments: PROFILE.calls.map((call) => call.arguments),
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    registrySha256: agentMcpProfileRegistrySha256(PROFILE.id),
    sourceCandidateSha: SOURCE_SHA,
    baseSha: BASE_SHA,
    ciSha: SOURCE_SHA,
    ciStatus: 'SUCCESS',
    ciRunId: '38819999125',
    ciChecks: CI_CHECKS,
    reviewerId: 'gpt-6-luna-max-run95-pr186-round1',
    bundleSha256: BUNDLE_SHA,
    runnerReceiptPublicKey: publicKeyBase64,
    runnerReceiptPublicKeySha256: sha256(publicKeyDer),
    reportWritten: false,
    retryAllowed: false,
  };
  const serverSummary = {
    serverProfile: 'closed-profile-sequence-anonymous-offline-v1',
    profileId: PROFILE.id,
    argumentProfile: PROFILE.argumentProfile,
    networkMode: R04_SERIES_WATCH_ORDER_V2_NETWORK_MODE,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    sourceRevision: SOURCE_SHA,
    bundleSha256: BUNDLE_SHA,
    catalogSha256: sha256(catalogBytes),
    toolName: PROFILE.toolName,
    toolDescriptionSha256: sha256(catalogTool.description ?? ''),
    inputSchemaSha256: sha256(canonicalAgentMcpProfileJson(catalogTool.inputSchema)),
    serverToolNames: [PROFILE.toolName],
    serverToolCount: 1,
    expectedCallCount: 1,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    results: [
      {
        sequenceIndex: 0,
        status: 'SUCCESS',
        resultSummary: {
          state: 'complete',
          subjectId: R04_SERIES_WATCH_ORDER_V2_ROOT_ID,
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
        },
      },
    ],
    offlineFixture: {
      profile: R04_SERIES_WATCH_ORDER_V2_NETWORK_MODE,
      requestCount: 4,
      subjectRequestCount: 2,
      relationsRequestCount: 2,
      duplicateRequestCount: 0,
      unexpectedRequestCount: 0,
      authorizationHeaderCount: 0,
      expectedOperationsComplete: true,
    },
  };
  const events = {
    processExitCode: 0,
    eventStreamParsed: true,
    turnCompleted: true,
    codexMcpToolEventCount: 1,
    codexErrorItemCount: 0,
    nonMcpToolEventCount: 0,
    nonMcpToolTypes: [],
    shellToolCallCount: 0,
    mcpServerNames: ['bgk_r04_watch_order_v2'],
    exactCall: true,
    exactToolEvent: true,
    allowedCallCount: 1,
    deniedCallCount: 0,
  };
  return { claim, serverSummary, events, keys };
}
