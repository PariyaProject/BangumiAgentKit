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
  C07_RENDER_COMPARISON_OFFLINE_EXPECTED_ARGUMENTS,
  C07_RENDER_COMPARISON_OFFLINE_NETWORK_MODE,
} from '../../scripts/lib/c07-render-comparison-offline-profile.mjs';
import {
  buildC07RenderComparisonOfflineProfileReport,
  validateC07RenderComparisonOfflineProfileReport,
} from '../../scripts/acceptance/write-c07-render-comparison-offline-agent-mcp-report.mjs';

const PROFILE = getAgentMcpProfileById('c07-render-comparison-offline-agent-mcp-matrix-v1');
const ACKNOWLEDGEMENT = 'C07_SYNTHETIC_COHORT_RENDERED';
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

function fixtureInput() {
  const keyPair = generateKeyPairSync('ed25519');
  const publicKeyBase64 = keyPair.publicKey
    .export({ type: 'spki', format: 'der' })
    .toString('base64');
  const publicKeyDer = Buffer.from(publicKeyBase64, 'base64');
  const claim = {
    schemaVersion: 1,
    claimId: 'profile-run-95-pr-222-0123456789ab-1792100000000',
    state: 'CLAIMED',
    profileId: PROFILE.id,
    frontierId: 'C07',
    epochId: PROFILE.epochId,
    runNumber: 95,
    prNumber: 222,
    toolName: PROFILE.toolName,
    argumentProfile: PROFILE.argumentProfile,
    expectedArguments: [C07_RENDER_COMPARISON_OFFLINE_EXPECTED_ARGUMENTS],
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    registrySha256: agentMcpProfileRegistrySha256(PROFILE.id),
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
    profile: C07_RENDER_COMPARISON_OFFLINE_NETWORK_MODE,
    requestCount: 2,
    searchRequestCount: 1,
    subjectDetailRequestCount: 1,
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
  const catalogBytes = readFileSync(new URL('../../docs/tool-catalog.json', import.meta.url));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const catalogTool = catalog.find((item) => item.name === PROFILE.toolName);
  const serverSummary = {
    profileId: PROFILE.id,
    argumentProfile: PROFILE.argumentProfile,
    networkMode: C07_RENDER_COMPARISON_OFFLINE_NETWORK_MODE,
    serverProfile: 'closed-profile-sequence-anonymous-offline-v1',
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
    codexErrorItemCount: 0,
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
      completedMcpCalls: [
        { tool: PROFILE.toolName, arguments: C07_RENDER_COMPARISON_OFFLINE_EXPECTED_ARGUMENTS },
      ],
      answer: ACKNOWLEDGEMENT,
      codexCliVersion: '1.2.14',
      eventStreamSha256: '7'.repeat(64),
      serverSummarySha256: '8'.repeat(64),
    },
    keyPair,
  };
}

test('C07 report builder signs only sanitized matrix evidence with no scenario claim', () => {
  const { input, keyPair } = fixtureInput();
  const built = buildC07RenderComparisonOfflineProfileReport(input, {
    privateKey: keyPair.privateKey,
  });

  assert.equal(built.passed, true, JSON.stringify(built));
  assert.equal(built.report.frontierId, 'C07');
  assert.equal(built.report.scenarioId, null);
  assert.equal(built.report.toolName, 'bangumi.render_subject_cohort_comparison');
  assert.equal(built.report.networkBoundary.fullCodexHarnessNetworkSandboxed, false);
  assert.equal(built.report.ciRunId, input.claim.ciRunId);
  assert.deepEqual(built.report.ciChecks, input.claim.ciChecks);
  assert.equal(built.report.runnerReceipt.payload.ciRunId, input.claim.ciRunId);
  assert.deepEqual(built.report.runnerReceipt.payload.ciChecks, input.claim.ciChecks);
  assert.deepEqual(built.report.offlineFixture, input.serverSummary.offlineFixture);
  assert.deepEqual(built.report.offlineAssetBoundary, input.serverSummary.offlineAssetBoundary);
  assert.equal(
    validateC07RenderComparisonOfflineProfileReport(built.report, input.claim).passed,
    true,
  );
  const serialized = JSON.stringify(built.report);
  for (const forbidden of [
    'Synthetic Person',
    'Synthetic Work',
    'Synthetic Character',
    'C07_SYNTHETIC_COHORT_RENDERED',
    'artifactId',
    'imageBytes',
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  assert.equal(Object.hasOwn(built.report, 'prompt'), false);
  assert.equal(Object.hasOwn(built.report, 'answer'), false);
  assert.equal(Object.hasOwn(built.report.artifact, 'id'), false);
});

test('C07 report validator rejects changed fixture counters and any modified signed evidence', () => {
  const { input, keyPair } = fixtureInput();
  const built = buildC07RenderComparisonOfflineProfileReport(input, {
    privateKey: keyPair.privateKey,
  });
  assert.equal(built.passed, true, JSON.stringify(built));

  const wrongFixture = structuredClone(built.report);
  wrongFixture.offlineFixture.requestCount = 4;
  assert.equal(
    validateC07RenderComparisonOfflineProfileReport(wrongFixture, input.claim).passed,
    false,
  );

  const tamperedArtifact = structuredClone(built.report);
  tamperedArtifact.artifact.sha256 = '9'.repeat(64);
  assert.equal(
    validateC07RenderComparisonOfflineProfileReport(tamperedArtifact, input.claim).passed,
    false,
  );

  const oversizedArtifact = structuredClone(built.report);
  oversizedArtifact.artifact.width = 3001;
  assert.equal(
    validateC07RenderComparisonOfflineProfileReport(oversizedArtifact, input.claim).passed,
    false,
  );

  const tamperedCatalog = structuredClone(built.report);
  tamperedCatalog.catalogSha256 = '9'.repeat(64);
  assert.equal(
    validateC07RenderComparisonOfflineProfileReport(tamperedCatalog, input.claim).passed,
    false,
  );

  const tamperedNetworkBoundary = structuredClone(built.report);
  tamperedNetworkBoundary.networkBoundary.fullCodexHarnessNetworkSandboxed = true;
  assert.equal(
    validateC07RenderComparisonOfflineProfileReport(tamperedNetworkBoundary, input.claim).passed,
    false,
  );

  const tamperedCiIdentity = structuredClone(built.report);
  tamperedCiIdentity.ciChecks[0].name = 'unexpected-check';
  assert.equal(
    validateC07RenderComparisonOfflineProfileReport(tamperedCiIdentity, input.claim).passed,
    false,
  );
});

test('C07 report builder fails closed for a changed one-tool argument object', () => {
  const { input, keyPair } = fixtureInput();
  input.completedMcpCalls[0].arguments = {
    ...C07_RENDER_COMPARISON_OFFLINE_EXPECTED_ARGUMENTS,
    includeChronology: true,
  };
  const result = buildC07RenderComparisonOfflineProfileReport(input, {
    privateKey: keyPair.privateKey,
  });
  assert.equal(result.passed, false);
  assert.equal(result.reason, 'C07_RENDER_COMPARISON_RUNNER_GATE_INVALID');
});

test('C07 report builder binds catalog hashes to the current Candidate catalog', () => {
  const { input, keyPair } = fixtureInput();
  input.serverSummary.toolDescriptionSha256 = '9'.repeat(64);
  const result = buildC07RenderComparisonOfflineProfileReport(input, {
    privateKey: keyPair.privateKey,
  });
  assert.equal(result.passed, false);
  assert.equal(result.reason, 'C07_RENDER_COMPARISON_REPORT_FIELDS_INVALID');
});

test('C07 report validator accepts only the exact durable REPORT_WRITTEN disposition', () => {
  const { input, keyPair } = fixtureInput();
  const built = buildC07RenderComparisonOfflineProfileReport(input, {
    privateKey: keyPair.privateKey,
  });
  assert.equal(built.passed, true, JSON.stringify(built));

  const reportBytes = Buffer.from(`${JSON.stringify(built.report, null, 2)}\n`, 'utf8');
  const terminalClaim = {
    ...input.claim,
    state: 'REPORT_WRITTEN',
    reportWritten: true,
    reportSha256: sha256(reportBytes),
  };
  assert.equal(
    validateC07RenderComparisonOfflineProfileReport(built.report, terminalClaim, reportBytes)
      .passed,
    true,
  );

  assert.equal(
    validateC07RenderComparisonOfflineProfileReport(
      built.report,
      { ...terminalClaim, reportSha256: 'f'.repeat(64) },
      reportBytes,
    ).passed,
    false,
  );
  assert.equal(
    validateC07RenderComparisonOfflineProfileReport(
      built.report,
      { ...terminalClaim, reportWritten: false },
      reportBytes,
    ).passed,
    false,
  );
});
