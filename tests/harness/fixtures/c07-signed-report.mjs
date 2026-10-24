import { createHash, generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID,
  getC07RenderComparisonOfflineConfig,
} from '../../../scripts/lib/c07-render-comparison-offline-profile.mjs';
import {
  buildC07RenderComparisonOfflineProfileReport,
  configureC07RenderComparisonOfflineReportProfile,
} from '../../../scripts/acceptance/write-c07-render-comparison-offline-agent-mcp-report.mjs';
const PROFILE = getAgentMcpProfileById('c07-render-comparison-offline-agent-mcp-matrix-v1');
const CI_RUN_ID = '38806371672';
const CI_CHECKS = [
  'harness-control',
  'sqlite-default',
  'host-integration',
  'standalone-release-smoke',
  'postgres-compat',
  'provider-foundation',
  'discovery-foundation',
].map((name) => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' }));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function fixtureInput(profile = PROFILE) {
  configureC07RenderComparisonOfflineReportProfile(profile.id);
  const config = getC07RenderComparisonOfflineConfig(profile.id);
  const keyPair = generateKeyPairSync('ed25519');
  const publicKeyBase64 = keyPair.publicKey
    .export({ type: 'spki', format: 'der' })
    .toString('base64');
  const publicKeyDer = Buffer.from(publicKeyBase64, 'base64');
  const claim = {
    schemaVersion: 1,
    claimId: 'profile-run-95-pr-222-000000000000-1792100000000',
    state: 'CLAIMED',
    profileId: profile.id,
    frontierId: 'C07',
    epochId: profile.epochId,
    runNumber: 95,
    prNumber: 222,
    toolName: profile.toolName,
    argumentProfile: profile.argumentProfile,
    expectedArguments: [config.expectedArguments],
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(profile),
    registrySha256: agentMcpProfileRegistrySha256(profile.id),
    sourceCandidateSha: '0'.repeat(40),
    baseSha: '1'.repeat(40),
    ciSha: '0'.repeat(40),
    ciStatus: 'SUCCESS',
    ciRunId: CI_RUN_ID,
    ciChecks: CI_CHECKS,
    reviewerId: 'gpt-6-luna-max-run95-pr222-round1',
    bundleSha256: '2'.repeat(64),
    runnerReceiptPublicKey: publicKeyBase64,
    runnerReceiptPublicKeySha256: sha256(publicKeyDer),
    reportWritten: false,
    retryAllowed: false,
  };
  const offlineFixture = {
    profile: config.networkMode,
    requestCount: config.cohorts.length * 2,
    searchRequestCount: config.cohorts.length,
    subjectDetailRequestCount: config.cohorts.length,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
    rawFixturePayloadStored: false,
  };
  const offlineAssetBoundary = {
    assetResolutionCallCount: 0,
    nonEmptyAssetUrlCount: 0,
    blockedAssetRequestCount: 0,
  };
  const artifact = {
    returned: true,
    persisted: false,
    mimeType: 'image/png',
    width: 480,
    height: 640,
    byteLength: 12000,
    sha256: '3'.repeat(64),
    pngSignatureValid: true,
  };
  const catalogBytes = readFileSync(new URL('../../../docs/tool-catalog.json', import.meta.url));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const catalogTool = catalog.find((item) => item.name === profile.toolName);
  const serverSummary = {
    profileId: profile.id,
    argumentProfile: profile.argumentProfile,
    networkMode: config.networkMode,
    serverProfile: 'closed-profile-sequence-anonymous-offline-v1',
    sourceRevision: claim.sourceCandidateSha,
    bundleSha256: claim.bundleSha256,
    catalogSha256: sha256(catalogBytes),
    toolName: profile.toolName,
    toolDescriptionSha256: sha256(catalogTool.description),
    inputSchemaSha256: sha256(canonicalAgentMcpProfileJson(catalogTool.inputSchema)),
    serverToolNames: [profile.toolName],
    serverToolCount: 1,
    expectedArgumentsSha256: claim.expectedArgumentsSha256,
    expectedCallCount: 1,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    argumentMatch: true,
    results: [
      {
        sequenceIndex: 0,
        status: 'SUCCESS',
        resultSummary: { resultState: 'artifact_returned', artifact },
      },
    ],
    offlineFixture,
    offlineAssetBoundary,
  };
  const events = {
    processExitCode: 0,
    eventStreamParsed: true,
    turnCompleted: true,
    codexMcpToolEventCount: 1,
    mcpToolErrorResultCount: 0,
    codexErrorItemCount: profile.id === C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID ? 3 : 0,
    ...(profile.id === C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID
      ? {
          blockedDisabledWebSearchErrorItemCount: 3,
          unexpectedCodexErrorItemCount: 0,
        }
      : {}),
    nonMcpToolEventCount: 0,
    nonMcpToolTypes: [],
    shellToolCallCount: 0,
    mcpServerNames: ['bgk_c07_render_comparison'],
    allowedCallCount: 1,
    deniedCallCount: 0,
  };
  return {
    input: {
      claim,
      serverSummary,
      events,
      completedMcpCalls: [{ tool: profile.toolName, arguments: config.expectedArguments }],
      answer: config.acknowledgement,
      codexCliVersion: '1.2.14',
      eventStreamSha256: '7'.repeat(64),
      serverSummarySha256: '8'.repeat(64),
    },
    keyPair,
  };
}

// Synthetic signed evidence only: no runner, permanent claim, network, or model invocation.
export function createSignedC07Report(profileId, reviewerId) {
  const { input, keyPair } = fixtureInput(getAgentMcpProfileById(profileId));
  input.claim.reviewerId = reviewerId;
  const result = buildC07RenderComparisonOfflineProfileReport(input, {
    privateKey: keyPair.privateKey,
  });
  if (!result.passed) throw new Error(result.reason);
  return { report: result.report, claim: input.claim };
}
