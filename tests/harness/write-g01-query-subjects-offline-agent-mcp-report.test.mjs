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
  G01_QUERY_SUBJECTS_OFFLINE_SERVER_ID,
  G01_QUERY_SUBJECTS_OFFLINE_V2_ACKNOWLEDGEMENT,
  G01_QUERY_SUBJECTS_OFFLINE_V2_PROFILE_ID,
  G01_QUERY_SUBJECTS_OFFLINE_V2_SERVER_ID,
  getG01QuerySubjectsOfflineProfileSpec,
} from '../../scripts/lib/g01-query-subjects-offline-matrix-profile.mjs';
import {
  buildG01QuerySubjectsOfflineProfileReport,
  validateG01QuerySubjectsOfflineProfileReport,
  validateG01QuerySubjectsOfflineServerSummary,
} from '../../scripts/acceptance/write-g01-query-subjects-offline-agent-mcp-report.mjs';

const PROFILE = getAgentMcpProfileById('g01-query-subjects-offline-agent-mcp-matrix-v1');
const PROFILE_V2 = getAgentMcpProfileById(G01_QUERY_SUBJECTS_OFFLINE_V2_PROFILE_ID);
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

function claimFixture(keyPair, profile = PROFILE) {
  const publicKeyBase64 = keyPair.publicKey
    .export({ type: 'spki', format: 'der' })
    .toString('base64');
  return {
    state: 'CLAIMED',
    reportWritten: false,
    retryAllowed: false,
    claimId: `profile-run-95-pr-${PR_NUMBER}-${SOURCE_SHA.slice(0, 12)}-1792200000000`,
    profileId: profile.id,
    frontierId: 'G01',
    epochId: profile.epochId,
    runNumber: 95,
    prNumber: PR_NUMBER,
    toolName: profile.toolName,
    argumentProfile: profile.argumentProfile,
    expectedArguments: profile.calls.map((call) => call.arguments),
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(profile),
    registrySha256: agentMcpProfileRegistrySha256(profile.id),
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

function serverSummaryFixture(profile = PROFILE) {
  const spec = getG01QuerySubjectsOfflineProfileSpec(profile.id);
  const catalogBytes = readFileSync(new URL('../../docs/tool-catalog.json', import.meta.url));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const tool = catalog.find((item) => item.name === profile.toolName);
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
    profileId: profile.id,
    argumentProfile: profile.argumentProfile,
    networkMode: spec.networkMode,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(profile),
    sourceRevision: SOURCE_SHA,
    bundleSha256: BUNDLE_SHA,
    catalogSha256: sha256(catalogBytes),
    toolName: profile.toolName,
    toolDescriptionSha256: sha256(tool.description ?? ''),
    inputSchemaSha256: sha256(canonicalAgentMcpProfileJson(tool.inputSchema)),
    serverToolNames: [profile.toolName],
    serverToolCount: 1,
    expectedCallCount: 1,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    results: [{ sequenceIndex: 0, status: 'SUCCESS', resultSummary }],
    offlineFixture: {
      profile: spec.networkMode,
      requestCount: 1,
      searchRequestCount: 1,
      duplicateRequestCount: 0,
      unexpectedRequestCount: 0,
      rejectedHeaderCount: 0,
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

test('G01 v2 query-subjects report accepts only aggregate blocked-search counters', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'g01-query-subjects-v2-report-test-'));
  try {
    const keyPair = generateKeyPairSync('ed25519');
    const claim = claimFixture(keyPair, PROFILE_V2);
    const serverSummary = serverSummaryFixture(PROFILE_V2);
    assert.equal(
      validateG01QuerySubjectsOfflineServerSummary(
        serverSummary,
        SOURCE_SHA,
        BUNDLE_SHA,
        PROFILE_V2.id,
      ),
      true,
    );
    const events = {
      processExitCode: 0,
      eventStreamParsed: true,
      turnCompleted: true,
      codexMcpToolEventCount: 1,
      codexErrorItemCount: 3,
      blockedWebSearchErrorItemCount: 3,
      unexpectedCodexErrorItemCount: 0,
      nonMcpToolEventCount: 0,
      nonMcpToolTypes: [],
      shellToolCallCount: 0,
      mcpServerNames: [G01_QUERY_SUBJECTS_OFFLINE_V2_SERVER_ID],
      exactCall: true,
      exactToolEvent: true,
    };
    const reportPath = path.join(directory, 'report.json');
    const input = {
      claim,
      serverSummary,
      events,
      answer: G01_QUERY_SUBJECTS_OFFLINE_V2_ACKNOWLEDGEMENT,
      codexCliVersion: '0.163.0',
      eventStreamSha256: 'd'.repeat(64),
      serverSummarySha256: 'e'.repeat(64),
    };
    const result = buildG01QuerySubjectsOfflineProfileReport(input, {
      privateKey: keyPair.privateKey,
      reportPath,
    });
    assert.equal(result.passed, true, result.reason);
    const bytes = readFileSync(reportPath);
    const report = JSON.parse(bytes.toString('utf8'));
    assert.equal(validateG01QuerySubjectsOfflineProfileReport(report, claim, bytes).passed, true);
    assert.equal(report.codexErrorItemCount, 3);
    assert.equal(report.blockedWebSearchErrorItemCount, 3);
    assert.equal(report.unexpectedCodexErrorItemCount, 0);
    assert.equal(report.runnerReceipt.kind, 'g01-query-subjects-offline-matrix-runner-receipt-v2');
    const serialized = JSON.stringify(report);
    assert.equal(serialized.includes(PROFILE_V2.calls[0].arguments.keyword), false);
    assert.equal(serialized.includes('990931'), false);
    assert.equal(serialized.includes('disabled for this Codex invocation'), false);

    const invalid = {
      ...input,
      events: { ...events, unexpectedCodexErrorItemCount: 1 },
    };
    assert.equal(
      buildG01QuerySubjectsOfflineProfileReport(invalid, { privateKey: keyPair.privateKey }).passed,
      false,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
