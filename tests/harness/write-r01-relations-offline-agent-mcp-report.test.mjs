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
  R01_RELATIONS_OFFLINE_NETWORK_MODE,
  R01_RELATIONS_OFFLINE_PROFILE_ID,
} from '../../scripts/lib/r01-relations-offline-profile.mjs';
import {
  buildR01ProfileReport,
  validateR01ProfileReport,
  validateR01SanitizedReportFile,
} from '../../scripts/acceptance/write-r01-relations-offline-agent-mcp-report.mjs';

const PROFILE = getAgentMcpProfileById(R01_RELATIONS_OFFLINE_PROFILE_ID);
const SOURCE_SHA = 'a'.repeat(40);
const BASE_SHA = 'b'.repeat(40);
const BUNDLE_SHA = 'c'.repeat(64);
const ACK = 'R01_SYNTHETIC_SUBJECT_RELATIONS_READ';
const SUMMARY = {
  state: 'observed',
  sourceDirection: 'source_subject_to_returned_target',
  responseRowsObserved: 1,
  rowsReturned: 1,
  schemaDriftRows: 0,
  truncated: false,
  paginationAvailable: false,
  totalCountAvailable: false,
  completeness: 'not_provided_by_source',
  relationLabels: ['改编'],
};
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

function input(errorCount = 0) {
  const keys = generateKeyPairSync('ed25519');
  const publicKeyDer = keys.publicKey.export({ type: 'spki', format: 'der' });
  const catalogBytes = readFileSync(path.resolve('docs/tool-catalog.json'));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const catalogTool = catalog.find((row) => row.name === PROFILE.toolName);
  const claim = {
    schemaVersion: 1,
    claimId: `profile-run-95-pr-195-${SOURCE_SHA.slice(0, 12)}-1792100000000`,
    state: 'CLAIMED',
    profileId: PROFILE.id,
    frontierId: 'R01',
    epochId: PROFILE.epochId,
    runNumber: 95,
    prNumber: 195,
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
    reviewerId: 'gpt-6-luna-max-run95-pr195-round1',
    bundleSha256: BUNDLE_SHA,
    runnerReceiptPublicKey: publicKeyDer.toString('base64'),
    runnerReceiptPublicKeySha256: sha256(publicKeyDer),
    reportWritten: false,
    retryAllowed: false,
  };
  const serverSummary = {
    serverProfile: 'closed-profile-sequence-anonymous-offline-v1',
    profileId: PROFILE.id,
    argumentProfile: PROFILE.argumentProfile,
    networkMode: R01_RELATIONS_OFFLINE_NETWORK_MODE,
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
    results: [{ sequenceIndex: 0, status: 'SUCCESS', resultSummary: SUMMARY }],
    offlineFixture: {
      profile: R01_RELATIONS_OFFLINE_NETWORK_MODE,
      requestCount: 1,
      relationRequestCount: 1,
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
    codexErrorItemCount: errorCount,
    blockedWebSearchErrorItemCount: errorCount,
    unexpectedCodexErrorItemCount: 0,
    nonMcpToolEventCount: 0,
    nonMcpToolTypes: [],
    shellToolCallCount: 0,
    mcpServerNames: ['bgk_r01_relations'],
    exactCall: true,
    exactToolEvent: true,
    allowedCallCount: 1,
    deniedCallCount: 0,
  };
  return { claim, serverSummary, events, keys };
}

function build(value, root) {
  const reportPath = path.join(root, PROFILE.reportPath);
  mkdirSync(path.dirname(reportPath), { recursive: true });
  return buildR01ProfileReport(
    {
      claim: value.claim,
      serverSummary: value.serverSummary,
      events: value.events,
      answer: ACK,
      codexCliVersion: '0.162.0',
      eventStreamSha256: '1'.repeat(64),
      serverSummarySha256: '2'.repeat(64),
    },
    { privateKey: value.keys.privateKey, root, reportPath },
  );
}

test('R01 report builder signs only sanitized matrix evidence without scenario credit', () => {
  const value = input(2);
  const root = mkdtempSync(path.join(os.tmpdir(), 'r01-report-test-'));
  try {
    const result = build(value, root);
    assert.equal(result.passed, true, result.reason);
    const reportPath = path.join(root, PROFILE.reportPath);
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    assert.equal(report.frontierId, 'R01');
    assert.equal(report.scenarioId, null);
    assert.equal(report.acceptanceScope, 'agent-mcp-matrix-only');
    assert.equal(report.codexErrorItemCount, 2);
    assert.equal(report.blockedWebSearchErrorItemCount, 2);
    assert.deepEqual(report.resultSummary, value.serverSummary.results[0].resultSummary);
    for (const field of ['answer', 'prompt', 'subjectId', 'rawResult'])
      assert.equal(Object.hasOwn(report, field), false);
    assert.equal(JSON.stringify(report).includes('990903'), false);
    assert.equal(JSON.stringify(report).includes('Synthetic relation target'), false);
    const validated = validateR01SanitizedReportFile(value.claim, root, reportPath);
    assert.equal(validated.passed, true, validated.reason);
    assert.equal(validated.reportSha256, result.reportSha256);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R01 report validator rejects modified signatures and local request counters', () => {
  const value = input();
  const root = mkdtempSync(path.join(os.tmpdir(), 'r01-report-tamper-'));
  try {
    assert.equal(build(value, root).passed, true);
    const reportPath = path.join(root, PROFILE.reportPath);
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    report.offlineFixture.requestCount = 2;
    writeFileSync(reportPath, JSON.stringify(report));
    assert.equal(validateR01SanitizedReportFile(value.claim, root, reportPath).passed, false);
    const tampered = { ...report, offlineFixture: value.serverSummary.offlineFixture };
    tampered.resultSummary.rowsReturned = 2;
    assert.equal(validateR01ProfileReport(tampered, value.claim).passed, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R01 report builder rejects unexpected Codex errors and any call outside its allowlist', () => {
  const value = input();
  assert.deepEqual(validateR01ProfileReport({}, value.claim).passed, false);
  const badErrorEvents = {
    ...value.events,
    codexErrorItemCount: 1,
    blockedWebSearchErrorItemCount: 0,
    unexpectedCodexErrorItemCount: 1,
  };
  assert.equal(
    buildR01ProfileReport(
      {
        claim: value.claim,
        serverSummary: value.serverSummary,
        events: badErrorEvents,
        answer: ACK,
        codexCliVersion: '0.162.0',
        eventStreamSha256: '1'.repeat(64),
        serverSummarySha256: '2'.repeat(64),
      },
      { privateKey: value.keys.privateKey },
    ).reason,
    'R01_RUNNER_GATE_INVALID',
  );
  assert.equal(
    buildR01ProfileReport(
      {
        claim: value.claim,
        serverSummary: value.serverSummary,
        events: { ...value.events, exactCall: false },
        answer: ACK,
        codexCliVersion: '0.162.0',
        eventStreamSha256: '1'.repeat(64),
        serverSummarySha256: '2'.repeat(64),
      },
      { privateKey: value.keys.privateKey },
    ).reason,
    'R01_RUNNER_GATE_INVALID',
  );
});
