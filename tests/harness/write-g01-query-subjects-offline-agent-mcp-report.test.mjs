import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
  G01_QUERY_SUBJECTS_OFFLINE_ACKNOWLEDGEMENT,
  G01_QUERY_SUBJECTS_OFFLINE_EXPECTED_ARGUMENTS,
  G01_QUERY_SUBJECTS_OFFLINE_NETWORK_MODE,
  G01_QUERY_SUBJECTS_OFFLINE_SERVER_ID,
} from '../../scripts/lib/g01-query-subjects-offline-matrix-profile.mjs';
import {
  buildG01QuerySubjectsOfflineProfileReport,
  validateG01QuerySubjectsOfflineProfileReport,
  validateG01QuerySubjectsOfflineServerSummary,
} from '../../scripts/acceptance/write-g01-query-subjects-offline-agent-mcp-report.mjs';

const PROFILE = getAgentMcpProfileById('g01-query-subjects-offline-agent-mcp-matrix-v1');
const SOURCE_SHA = 'a'.repeat(40);
const BASE_SHA = 'b'.repeat(40);
const BUNDLE_SHA = 'c'.repeat(64);
const CI_RUN_ID = '39033314210';
const PR_NUMBER = 230;
const REVIEWER_ID = `gpt-6-luna-max-run95-pr${PR_NUMBER}-round1`;
const REQUIRED_CHECKS = [
  'harness-control',
  'sqlite-default',
  'host-integration',
  'standalone-release-smoke',
  'postgres-compat',
  'provider-foundation',
  'discovery-foundation',
];
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function claimFixture(keyPair) {
  const publicKeyBase64 = keyPair.publicKey
    .export({ type: 'spki', format: 'der' })
    .toString('base64');
  return {
    state: 'CLAIMED',
    reportWritten: false,
    retryAllowed: false,
    claimId: `profile-run-95-pr-${PR_NUMBER}-${SOURCE_SHA.slice(0, 12)}-1792200000000`,
    profileId: PROFILE.id,
    frontierId: 'G01',
    epochId: PROFILE.epochId,
    runNumber: 95,
    prNumber: PR_NUMBER,
    toolName: PROFILE.toolName,
    argumentProfile: PROFILE.argumentProfile,
    expectedArguments: PROFILE.calls.map((call) => call.arguments),
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    registrySha256: agentMcpProfileRegistrySha256(PROFILE.id),
    sourceCandidateSha: SOURCE_SHA,
    baseSha: BASE_SHA,
    ciSha: SOURCE_SHA,
    ciStatus: 'SUCCESS',
    ciRunId: CI_RUN_ID,
    ciChecks: REQUIRED_CHECKS.map((name) => ({
      name,
      status: 'COMPLETED',
      conclusion: 'SUCCESS',
    })),
    reviewerId: REVIEWER_ID,
    bundleSha256: BUNDLE_SHA,
    runnerReceiptPublicKey: publicKeyBase64,
    runnerReceiptPublicKeySha256: sha256(Buffer.from(publicKeyBase64, 'base64')),
  };
}

function serverSummaryFixture() {
  const catalogBytes = readFileSync(new URL('../../docs/tool-catalog.json', import.meta.url));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const tool = catalog.find((item) => item.name === PROFILE.toolName);
  const resultSummary = {
    resultState: 'ok',
    returnedItems: 1,
    coverageState: 'partial',
    requested: 1,
    returned: 1,
    pagesScanned: 1,
    totalKind: 'estimated',
    warningCount: 1,
  };
  return {
    serverProfile: 'closed-profile-sequence-anonymous-offline-v1',
    profileId: PROFILE.id,
    argumentProfile: PROFILE.argumentProfile,
    networkMode: G01_QUERY_SUBJECTS_OFFLINE_NETWORK_MODE,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    sourceRevision: SOURCE_SHA,
    bundleSha256: BUNDLE_SHA,
    catalogSha256: sha256(catalogBytes),
    toolName: PROFILE.toolName,
    toolDescriptionSha256: sha256(tool.description ?? ''),
    inputSchemaSha256: sha256(canonicalAgentMcpProfileJson(tool.inputSchema)),
    serverToolNames: [PROFILE.toolName],
    serverToolCount: 1,
    expectedCallCount: 1,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    results: [{ sequenceIndex: 0, status: 'SUCCESS', resultSummary }],
    offlineFixture: {
      profile: G01_QUERY_SUBJECTS_OFFLINE_NETWORK_MODE,
      requestCount: 1,
      searchRequestCount: 1,
      duplicateRequestCount: 0,
      unexpectedRequestCount: 0,
      authorizationHeaderCount: 0,
      expectedOperationsComplete: true,
      rawFixturePayloadStored: false,
    },
  };
}

test('G01 query-subjects report is signed, sanitized, and matrix-only', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'g01-query-subjects-report-test-'));
  try {
    const keyPair = generateKeyPairSync('ed25519');
    const claim = claimFixture(keyPair);
    const serverSummary = serverSummaryFixture();
    assert.equal(
      validateG01QuerySubjectsOfflineServerSummary(serverSummary, SOURCE_SHA, BUNDLE_SHA),
      true,
    );
    const events = {
      processExitCode: 0,
      eventStreamParsed: true,
      turnCompleted: true,
      codexMcpToolEventCount: 1,
      codexErrorItemCount: 0,
      nonMcpToolEventCount: 0,
      nonMcpToolTypes: [],
      shellToolCallCount: 0,
      mcpServerNames: [G01_QUERY_SUBJECTS_OFFLINE_SERVER_ID],
      exactCall: true,
      exactToolEvent: true,
    };
    const reportPath = path.join(directory, 'report.json');
    const result = buildG01QuerySubjectsOfflineProfileReport(
      {
        claim,
        serverSummary,
        events,
        answer: G01_QUERY_SUBJECTS_OFFLINE_ACKNOWLEDGEMENT,
        codexCliVersion: '0.163.0',
        eventStreamSha256: 'd'.repeat(64),
        serverSummarySha256: 'e'.repeat(64),
      },
      { privateKey: keyPair.privateKey, reportPath },
    );
    assert.equal(result.passed, true, result.reason);
    const bytes = readFileSync(reportPath);
    const report = JSON.parse(bytes.toString('utf8'));
    assert.equal(validateG01QuerySubjectsOfflineProfileReport(report, claim, bytes).passed, true);
    const serialized = JSON.stringify(report);
    assert.equal(serialized.includes(G01_QUERY_SUBJECTS_OFFLINE_EXPECTED_ARGUMENTS.keyword), false);
    assert.equal(serialized.includes('990930'), false);
    assert.equal(serialized.includes('Run95 Synthetic Query Subject'), false);
    assert.equal(report.scenarioId, null);
    assert.deepEqual(report.serverToolNames, ['bangumi.query_subjects']);
    assert.equal(report.networkBoundary.liveBangumiApiRequestCount, 0);

    const invalid = {
      ...report,
      resultSummary: { ...report.resultSummary, returnedItems: 2 },
    };
    assert.equal(validateG01QuerySubjectsOfflineProfileReport(invalid, claim).passed, false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
