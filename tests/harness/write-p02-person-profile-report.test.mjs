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
  P02_PERSON_PROFILE_OFFLINE_PROFILE_ID,
  P02_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID,
  getP02PersonProfileOfflineSpec,
} from '../../scripts/lib/p02-person-profile-offline-fixture.mjs';
import {
  buildP02ProfileReport,
  validateP02ProfileReport,
} from '../../scripts/acceptance/write-p02-person-profile-agent-mcp-report.mjs';

const PROFILE = getAgentMcpProfileById(P02_PERSON_PROFILE_OFFLINE_PROFILE_ID);
const ACKNOWLEDGEMENT = 'P02_SYNTHETIC_PROFILE_READ';
const CI_RUN_ID = '38812509760';
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

function fixtureInput(profileId = P02_PERSON_PROFILE_OFFLINE_PROFILE_ID) {
  const profile = getAgentMcpProfileById(profileId);
  const spec = getP02PersonProfileOfflineSpec(profileId);
  const expectedArguments = profile.calls[0].arguments;
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
    frontierId: 'P02',
    epochId: profile.epochId,
    runNumber: 95,
    prNumber: 222,
    toolName: profile.toolName,
    argumentProfile: profile.argumentProfile,
    expectedArguments: [expectedArguments],
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
    profile: spec.networkMode,
    requestCount: 3,
    personRequestCount: 1,
    subjectsRequestCount: 1,
    charactersRequestCount: 1,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
  };
  const catalogBytes = readFileSync(new URL('../../docs/tool-catalog.json', import.meta.url));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const catalogTool = catalog.find((item) => item.name === profile.toolName);
  const serverSummary = {
    profileId: profile.id,
    argumentProfile: profile.argumentProfile,
    networkMode: spec.networkMode,
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
        resultSummary: { personId: expectedArguments.personId, state: 'partial' },
      },
    ],
    offlineFixture,
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
    mcpServerNames: [spec.serverId],
    allowedCallCount: 1,
    deniedCallCount: 0,
  };
  return {
    input: {
      claim,
      serverSummary,
      events,
      completedMcpCalls: [{ tool: profile.toolName, arguments: expectedArguments }],
      answer: spec.acknowledgement,
      codexCliVersion: '1.2.14',
      eventStreamSha256: '7'.repeat(64),
      serverSummarySha256: '8'.repeat(64),
    },
    keyPair,
  };
}

test('P02 report builder signs only sanitized matrix evidence with no scenario claim', () => {
  const { input, keyPair } = fixtureInput();
  const built = buildP02ProfileReport(input, { privateKey: keyPair.privateKey });
  assert.equal(built.passed, true, JSON.stringify(built));
  assert.equal(built.report.frontierId, 'P02');
  assert.equal(built.report.scenarioId, null);
  assert.equal(built.report.toolName, 'bangumi.get_person_profile');
  assert.equal(built.report.networkBoundary.fullCodexHarnessNetworkSandboxed, false);
  assert.equal(built.report.ciRunId, input.claim.ciRunId);
  assert.deepEqual(built.report.ciChecks, input.claim.ciChecks);
  assert.deepEqual(built.report.offlineFixture, input.serverSummary.offlineFixture);
  assert.equal(validateP02ProfileReport(built.report, input.claim).passed, true);
  const serialized = JSON.stringify(built.report);
  for (const forbidden of [
    'Synthetic Person',
    'Synthetic Work',
    'Synthetic Character',
    ACKNOWLEDGEMENT,
    'rawAnswer',
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  assert.equal(Object.hasOwn(built.report, 'prompt'), false);
  assert.equal(Object.hasOwn(built.report, 'answer'), false);
});

test('P02 v2 report binds its own profile identity without inheriting v1 evidence', () => {
  const { input, keyPair } = fixtureInput(P02_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID);
  const built = buildP02ProfileReport(input, { privateKey: keyPair.privateKey });
  assert.equal(built.passed, true, JSON.stringify(built));
  assert.equal(built.report.profileId, P02_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID);
  assert.equal(built.report.networkMode, 'run95-p02-person-profile-offline-v2');
  assert.equal(
    built.report.answerCheckMethod,
    'p02-exact-synthetic-person-profile-execution-only-v2',
  );
  assert.equal(built.report.runnerReceipt.kind, 'p02-person-profile-offline-runner-receipt-v2');
  assert.equal(validateP02ProfileReport(built.report, input.claim).passed, true);
  const serialized = JSON.stringify(built.report);
  for (const forbidden of [
    'Synthetic Person',
    'Synthetic Work',
    'Synthetic Character',
    input.answer,
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  const crossVersion = structuredClone(built.report);
  crossVersion.profileId = P02_PERSON_PROFILE_OFFLINE_PROFILE_ID;
  assert.equal(validateP02ProfileReport(crossVersion, input.claim).passed, false);
});

test('P02 report validator rejects changed fixture counters and any modified signed evidence', () => {
  const { input, keyPair } = fixtureInput();
  const built = buildP02ProfileReport(input, { privateKey: keyPair.privateKey });
  assert.equal(built.passed, true, JSON.stringify(built));
  const wrongFixture = structuredClone(built.report);
  wrongFixture.offlineFixture.requestCount = 4;
  assert.equal(validateP02ProfileReport(wrongFixture, input.claim).passed, false);
  const wrongNetwork = structuredClone(built.report);
  wrongNetwork.networkBoundary.liveBangumiApiRequestCount = 1;
  assert.equal(validateP02ProfileReport(wrongNetwork, input.claim).passed, false);
  const wrongCi = structuredClone(built.report);
  wrongCi.ciChecks[0].name = 'unexpected-check';
  assert.equal(validateP02ProfileReport(wrongCi, input.claim).passed, false);
  const extraField = structuredClone(built.report);
  extraField.answer = ACKNOWLEDGEMENT;
  assert.equal(validateP02ProfileReport(extraField, input.claim).passed, false);
});

test('P02 report builder fails closed when the exact registered call or result changes', () => {
  const { input, keyPair } = fixtureInput();
  input.completedMcpCalls[0].arguments = {
    ...PROFILE.calls[0].arguments,
    personId: 4765,
  };
  assert.equal(buildP02ProfileReport(input, { privateKey: keyPair.privateKey }).passed, false);
  const second = fixtureInput();
  second.input.serverSummary.results[0].resultSummary.personId = 4765;
  assert.equal(
    buildP02ProfileReport(second.input, { privateKey: second.keyPair.privateKey }).passed,
    false,
  );
});
