import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  buildRenderSubjectCardOfflineProfileReport,
  validateRenderSubjectCardOfflineProfileReport,
} from '../../scripts/acceptance/write-render-subject-card-offline-agent-mcp-report.mjs';
import {
  RENDER_SUBJECT_CARD_OFFLINE_ARGUMENTS,
  RENDER_SUBJECT_CARD_OFFLINE_NETWORK_MODE,
  RENDER_SUBJECT_CARD_OFFLINE_PROFILE_ID,
} from '../../scripts/lib/render-subject-card-offline-profile.mjs';

const PROFILE = getAgentMcpProfileById(RENDER_SUBJECT_CARD_OFFLINE_PROFILE_ID);
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

function fixtureInput() {
  const keyPair = generateKeyPairSync('ed25519');
  const publicKeyBase64 = keyPair.publicKey
    .export({ type: 'spki', format: 'der' })
    .toString('base64');
  const publicKeyDer = Buffer.from(publicKeyBase64, 'base64');
  const catalogBytes = readFileSync(new URL('../../docs/tool-catalog.json', import.meta.url));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const catalogTool = catalog.find((item) => item.name === PROFILE.toolName);
  const claim = {
    schemaVersion: 1,
    claimId: 'profile-run-95-pr-257-000000000000-1792600000000',
    state: 'CLAIMED',
    profileId: PROFILE.id,
    frontierId: PROFILE.frontierId,
    epochId: PROFILE.epochId,
    runNumber: 95,
    prNumber: 257,
    toolName: PROFILE.toolName,
    argumentProfile: PROFILE.argumentProfile,
    expectedArguments: [RENDER_SUBJECT_CARD_OFFLINE_ARGUMENTS],
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    registrySha256: agentMcpProfileRegistrySha256(PROFILE.id),
    sourceCandidateSha: '0'.repeat(40),
    baseSha: '1'.repeat(40),
    ciSha: '0'.repeat(40),
    ciStatus: 'SUCCESS',
    ciRunId: '39577770000',
    ciChecks: CI_CHECKS,
    reviewerId: 'gpt-6-luna-max-run95-pr257-round1',
    bundleSha256: '2'.repeat(64),
    runnerReceiptPublicKey: publicKeyBase64,
    runnerReceiptPublicKeySha256: sha256(publicKeyDer),
    reportWritten: false,
    retryAllowed: false,
  };
  const offlineFixture = {
    profile: RENDER_SUBJECT_CARD_OFFLINE_NETWORK_MODE,
    expectedOperation: 'GET /v0/subjects/990901',
    requestCount: 1,
    expectedRequestCount: 1,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    collectionRequestCount: 0,
    expectedOperationComplete: true,
    rawFixturePayloadStored: false,
  };
  const offlineAssetBoundary = {
    assetResolutionCallCount: 0,
    nonEmptyAssetUrlCount: 0,
    blockedAssetRequestCount: 0,
    localFallbackUsed: true,
  };
  const artifact = {
    returned: true,
    persisted: false,
    mimeType: 'image/png',
    width: 720,
    height: 1576,
    byteLength: 257734,
    sha256: '3'.repeat(64),
    pngSignatureValid: true,
    decoded: true,
    dimensionsMatch: true,
  };
  const serverSummary = {
    serverProfile: 'closed-profile-sequence-anonymous-offline-v1',
    profileId: PROFILE.id,
    argumentProfile: PROFILE.argumentProfile,
    networkMode: RENDER_SUBJECT_CARD_OFFLINE_NETWORK_MODE,
    sourceRevision: claim.sourceCandidateSha,
    bundleSha256: claim.bundleSha256,
    catalogSha256: sha256(catalogBytes),
    toolName: PROFILE.toolName,
    toolDescriptionSha256: sha256(catalogTool.description),
    inputSchemaSha256: sha256(canonicalAgentMcpProfileJson(catalogTool.inputSchema)),
    serverToolNames: [PROFILE.toolName],
    serverToolCount: 1,
    expectedArgumentsSha256: claim.expectedArgumentsSha256,
    expectedCallCount: 1,
    argumentMatch: true,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
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
    codexErrorItemCount: 0,
    nonMcpToolEventCount: 0,
    nonMcpToolTypes: [],
    shellToolCallCount: 0,
    mcpServerNames: ['bgk_render_subject_card_offline'],
  };
  return {
    input: {
      claim,
      serverSummary,
      events,
      completedMcpCalls: [
        { tool: PROFILE.toolName, arguments: RENDER_SUBJECT_CARD_OFFLINE_ARGUMENTS },
      ],
      answer: 'RENDER_SUBJECT_CARD_SYNTHETIC_ARTIFACT_READY',
      codexCliVersion: '1.2.14',
      eventStreamSha256: '4'.repeat(64),
      serverSummarySha256: '5'.repeat(64),
    },
    keyPair,
  };
}

test('subject-card report binds the exact claim, fixed offline call, artifact receipt, and signature', () => {
  const { input, keyPair } = fixtureInput();
  const built = buildRenderSubjectCardOfflineProfileReport(input, {
    privateKey: keyPair.privateKey,
  });
  assert.equal(built.passed, true, JSON.stringify(built));
  assert.equal(built.report.frontierId, 'OP-008');
  assert.equal(built.report.toolName, 'bangumi.render_subject_card');
  assert.equal(built.report.artifact.width, 720);
  assert.equal(built.report.offlineFixture.requestCount, 1);
  assert.equal(built.report.offlineAssetBoundary.assetResolutionCallCount, 0);
  assert.equal(
    validateRenderSubjectCardOfflineProfileReport(built.report, input.claim).passed,
    true,
  );
});

test('subject-card report rejects collection access, artifact mutation, and claim mismatch', () => {
  const { input, keyPair } = fixtureInput();
  const built = buildRenderSubjectCardOfflineProfileReport(input, {
    privateKey: keyPair.privateKey,
  });
  assert.equal(built.passed, true);

  const withCollection = structuredClone(built.report);
  withCollection.offlineFixture.collectionRequestCount = 1;
  assert.equal(
    validateRenderSubjectCardOfflineProfileReport(withCollection, input.claim).passed,
    false,
  );

  const changedArtifact = structuredClone(built.report);
  changedArtifact.artifact.sha256 = 'f'.repeat(64);
  assert.equal(
    validateRenderSubjectCardOfflineProfileReport(changedArtifact, input.claim).passed,
    false,
  );

  const changedClaim = { ...input.claim, baseSha: 'f'.repeat(40) };
  assert.equal(
    validateRenderSubjectCardOfflineProfileReport(built.report, changedClaim).passed,
    false,
  );
});
