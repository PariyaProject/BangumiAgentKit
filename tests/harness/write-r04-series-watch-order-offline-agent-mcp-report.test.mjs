import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  R04_SERIES_WATCH_ORDER_OFFLINE_PROFILE_ID,
  R04_SERIES_WATCH_ORDER_OFFLINE_NETWORK_MODE,
  R04_SERIES_WATCH_ORDER_SYNTHETIC_ID,
} from '../../scripts/lib/r04-series-watch-order-offline-fixture.mjs';
import {
  buildR04ProfileReport,
  validateR04ProfileReport,
  validateR04SanitizedReportFile,
} from '../../scripts/acceptance/write-r04-series-watch-order-offline-agent-mcp-report.mjs';

const PROFILE = getAgentMcpProfileById(R04_SERIES_WATCH_ORDER_OFFLINE_PROFILE_ID);
const SOURCE_SHA = 'a'.repeat(40);
const BASE_SHA = 'b'.repeat(40);
const BUNDLE_SHA = 'c'.repeat(64);
const ACK = 'R04_SYNTHETIC_WATCH_ORDER_READ';
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

function input() {
  const keys = generateKeyPairSync('ed25519');
  const publicKeyDer = keys.publicKey.export({ type: 'spki', format: 'der' });
  const publicKeyBase64 = publicKeyDer.toString('base64');
  const catalogBytes = readFileSync(path.resolve('docs/tool-catalog.json'));
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
    networkMode: R04_SERIES_WATCH_ORDER_OFFLINE_NETWORK_MODE,
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
          subjectId: R04_SERIES_WATCH_ORDER_SYNTHETIC_ID,
          watchOrderCount: 1,
          relatedCount: 0,
          relationRequests: 1,
          relationRowsObserved: 0,
          detailsAttempted: 0,
        },
      },
    ],
    offlineFixture: {
      profile: R04_SERIES_WATCH_ORDER_OFFLINE_NETWORK_MODE,
      requestCount: 2,
      subjectRequestCount: 1,
      relationsRequestCount: 1,
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
    mcpServerNames: ['bgk_r04_watch_order'],
    exactCall: true,
    exactToolEvent: true,
    allowedCallCount: 1,
    deniedCallCount: 0,
  };
  return { claim, serverSummary, events, keys };
}

test('R04 report builder signs only sanitized matrix evidence without scenario credit', () => {
  const value = input();
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'r04-report-test-'));
  const reportPath = path.join(tempRoot, PROFILE.reportPath);
  mkdirSync(path.dirname(reportPath), { recursive: true });
  try {
    const result = buildR04ProfileReport(
      {
        claim: value.claim,
        serverSummary: value.serverSummary,
        events: value.events,
        answer: ACK,
        codexCliVersion: '0.1.0',
        eventStreamSha256: '1'.repeat(64),
        serverSummarySha256: '2'.repeat(64),
      },
      { privateKey: value.keys.privateKey, root: tempRoot, reportPath },
    );
    assert.equal(result.passed, true, result.reason);
    assert.equal(result.reportPath, PROFILE.reportPath);
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    assert.equal(report.frontierId, 'R04');
    assert.equal(report.scenarioId, null);
    assert.deepEqual(report.resultSummary, value.serverSummary.results[0].resultSummary);
    assert.equal(Object.hasOwn(report, 'answer'), false);
    assert.equal(Object.hasOwn(report, 'prompt'), false);
    const validated = validateR04SanitizedReportFile(value.claim, tempRoot, reportPath);
    assert.equal(validated.passed, true, validated.reason);
    assert.equal(validated.reportSha256, result.reportSha256);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('R04 report validator rejects modified signatures and local request counters', () => {
  const value = input();
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'r04-report-tamper-'));
  const reportPath = path.join(tempRoot, PROFILE.reportPath);
  mkdirSync(path.dirname(reportPath), { recursive: true });
  try {
    const result = buildR04ProfileReport(
      {
        claim: value.claim,
        serverSummary: value.serverSummary,
        events: value.events,
        answer: ACK,
        codexCliVersion: '0.1.0',
        eventStreamSha256: '1'.repeat(64),
        serverSummarySha256: '2'.repeat(64),
      },
      { privateKey: value.keys.privateKey, root: tempRoot, reportPath },
    );
    assert.equal(result.passed, true, result.reason);
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    report.offlineFixture.requestCount = 3;
    writeFileSync(reportPath, JSON.stringify(report));
    assert.equal(validateR04SanitizedReportFile(value.claim, tempRoot, reportPath).passed, false);
    const tampered = { ...report, offlineFixture: value.serverSummary.offlineFixture };
    tampered.resultSummary.subjectId = 12;
    assert.equal(validateR04ProfileReport(tampered, value.claim).passed, false);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('R04 report builder refuses a non-exact tool call', () => {
  const value = input();
  const result = buildR04ProfileReport(
    {
      claim: value.claim,
      serverSummary: value.serverSummary,
      events: { ...value.events, exactCall: false },
      answer: ACK,
      codexCliVersion: '0.1.0',
      eventStreamSha256: '1'.repeat(64),
      serverSummarySha256: '2'.repeat(64),
    },
    { privateKey: value.keys.privateKey },
  );
  assert.equal(result.passed, false);
  assert.equal(result.reason, 'R04_RUNNER_GATE_INVALID');
});
