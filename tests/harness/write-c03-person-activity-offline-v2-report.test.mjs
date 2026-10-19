import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
  C03_PERSON_ACTIVITY_OFFLINE_V2_NETWORK_MODE,
  C03_PERSON_ACTIVITY_OFFLINE_V2_PROFILE_ID,
} from '../../scripts/lib/c03-person-activity-offline-matrix-v2-profile.mjs';
import {
  validateC03PersonActivityOfflineV2Report,
  validateC03PersonActivityOfflineV2ServerSummary,
  validateC03PersonActivityOfflineV2SanitizedReportFile,
  writeC03PersonActivityOfflineV2Report,
} from '../../scripts/acceptance/write-c03-person-activity-offline-v2-report.mjs';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const PROFILE = getAgentMcpProfileById(C03_PERSON_ACTIVITY_OFFLINE_V2_PROFILE_ID);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function projection() {
  return {
    resultState: 'partial',
    windowMonths: 12,
    uniqueSubjects: 1,
    roleCounts: { main: 1, support: 0, unknown: 0 },
    coverage: {
      relationRowsObserved: 1,
      relationRowsSelected: 1,
      relationRowsDroppedAtLimit: 0,
      subjectDetailsSucceeded: 1,
      subjectDetailsFailed: 0,
      rowsEligible: 1,
      rowsReturned: 1,
      unknownRoleRows: 0,
      outputTruncated: false,
      truncated: false,
    },
  };
}

function offlineFixture() {
  return {
    profile: C03_PERSON_ACTIVITY_OFFLINE_V2_NETWORK_MODE,
    requestCount: 3,
    personRequestCount: 1,
    characterRequestCount: 1,
    subjectDetailRequestCount: 1,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
    operations: ['person', 'characters', 'subject_detail'],
  };
}

function claimAndKey() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
  const sourceCandidateSha = 'a'.repeat(40);
  const claim = {
    state: 'CLAIMED',
    reportWritten: false,
    retryAllowed: false,
    profileId: PROFILE.id,
    claimId: `profile-run-95-pr-42-${sourceCandidateSha.slice(0, 12)}-1`,
    runNumber: 95,
    prNumber: 42,
    epochId: PROFILE.epochId,
    frontierId: 'C03',
    sourceCandidateSha,
    baseSha: 'c'.repeat(40),
    ciSha: sourceCandidateSha,
    ciStatus: 'SUCCESS',
    ciRunId: '39200000001',
    ciChecks: [
      'harness-control',
      'sqlite-default',
      'host-integration',
      'standalone-release-smoke',
      'postgres-compat',
      'provider-foundation',
      'discovery-foundation',
    ].map((name) => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' })),
    reviewerId: 'gpt-6-luna-max-run95-pr42-round1',
    bundleSha256: 'b'.repeat(64),
    registrySha256: agentMcpProfileRegistrySha256(PROFILE.id),
    toolName: PROFILE.toolName,
    argumentProfile: PROFILE.argumentProfile,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    runnerReceiptPublicKey: publicKeyDer.toString('base64'),
    runnerReceiptPublicKeySha256: sha256(publicKeyDer),
  };
  return { claim, privateKey };
}

function serverSummary(root = ROOT) {
  const projectionResult = projection();
  const bytes = readFileSync(path.join(root, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(bytes.toString('utf8'));
  const tool = catalog.find((item) => item?.name === PROFILE.toolName);
  return {
    serverProfile: 'closed-profile-sequence-anonymous-offline-v1',
    profileId: PROFILE.id,
    argumentProfile: PROFILE.argumentProfile,
    networkMode: PROFILE.networkMode,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    sourceRevision: 'a'.repeat(40),
    bundleSha256: 'b'.repeat(64),
    toolName: PROFILE.toolName,
    serverToolCount: 1,
    serverToolNames: [PROFILE.toolName],
    expectedCallCount: 1,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    results: [{ sequenceIndex: 0, status: 'SUCCESS', resultSummary: projectionResult }],
    offlineFixture: offlineFixture(),
    catalogSha256: sha256(bytes),
    toolDescriptionSha256: sha256(tool.description),
    inputSchemaSha256: sha256(canonicalAgentMcpProfileJson(tool.inputSchema)),
  };
}

function passingEvents() {
  return {
    processExitCode: 0,
    eventStreamParsed: true,
    turnCompleted: true,
    codexMcpToolEventCount: 1,
    codexErrorItemCount: 0,
    nonMcpToolEventCount: 0,
    shellToolCallCount: 0,
    allowedCallCount: 1,
    deniedCallCount: 0,
    exactCall: true,
    exactToolEvent: true,
    resultReadbackMatched: true,
    answerEchoedToolResult: true,
    outputSchemaApplied: true,
    mcpServerNames: ['bgk_c03_person_activity_offline_v2'],
  };
}

function makeTempRoot() {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'c03-activity-v2-report-test-'));
  mkdirSync(path.join(temp, 'docs/research'), { recursive: true });
  mkdirSync(path.join(temp, 'docs/live-probes'), { recursive: true });
  copyFileSync(
    path.join(ROOT, 'docs/tool-catalog.json'),
    path.join(temp, 'docs/tool-catalog.json'),
  );
  copyFileSync(
    path.join(ROOT, PROFILE.selectionEvidencePath),
    path.join(temp, PROFILE.selectionEvidencePath),
  );
  return temp;
}

test('C03 v2 server summary binds exact offline fixture, tool catalog, and bounded projection', () => {
  assert.equal(
    validateC03PersonActivityOfflineV2ServerSummary(
      serverSummary(),
      'a'.repeat(40),
      'b'.repeat(64),
      ROOT,
    ),
    true,
  );
  const tampered = serverSummary();
  tampered.offlineFixture.requestCount = 4;
  assert.equal(
    validateC03PersonActivityOfflineV2ServerSummary(tampered, 'a'.repeat(40), 'b'.repeat(64), ROOT),
    false,
  );
});

test('C03 v2 writes and verifies a sanitized signed matrix-only report', () => {
  const temp = makeTempRoot();
  const { claim, privateKey } = claimAndKey();
  try {
    const expected = projection();
    const answer = JSON.stringify(expected);
    const result = writeC03PersonActivityOfflineV2Report(
      {
        claim,
        serverSummary: serverSummary(temp),
        events: passingEvents(),
        answer,
        codexCliVersion: '0.54.0',
        eventStreamSha256: 'd'.repeat(64),
        serverSummarySha256: 'e'.repeat(64),
      },
      { privateKey, root: temp },
    );
    assert.equal(result.passed, true, result.reason);
    const reportPath = path.join(temp, PROFILE.reportPath);
    assert.equal(existsSync(reportPath), true);
    const text = readFileSync(reportPath, 'utf8');
    assert.equal(text.includes('Synthetic Person Activity Fixture'), false);
    assert.equal(text.includes('Synthetic Activity Work'), false);
    assert.equal(text.includes('主角'), false);
    const writtenClaim = {
      ...claim,
      state: 'REPORT_WRITTEN',
      reportWritten: true,
      reportSha256: result.reportSha256,
    };
    const validation = validateC03PersonActivityOfflineV2SanitizedReportFile(
      writtenClaim,
      temp,
      reportPath,
    );
    assert.equal(validation.passed, true, validation.reason);
    assert.equal(validation.report.scenarioId, null);
    assert.equal(validation.report.privacy.oauthAttempted, false);
    assert.equal(validation.report.privacy.qqPipelineTested, false);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('C03 v2 report validator rejects changed fixture receipts and result rows', () => {
  const temp = makeTempRoot();
  const { claim, privateKey } = claimAndKey();
  try {
    const answer = JSON.stringify(projection());
    const result = writeC03PersonActivityOfflineV2Report(
      {
        claim,
        serverSummary: serverSummary(temp),
        events: passingEvents(),
        answer,
        codexCliVersion: '0.54.0',
        eventStreamSha256: 'd'.repeat(64),
        serverSummarySha256: 'e'.repeat(64),
      },
      { privateKey, root: temp },
    );
    assert.equal(result.passed, true, result.reason);
    const pathToReport = path.join(temp, PROFILE.reportPath);
    const report = JSON.parse(readFileSync(pathToReport, 'utf8'));
    report.offlineFixture.unexpectedRequestCount = 1;
    const bytes = Buffer.from(`${JSON.stringify(report)}\n`);
    assert.equal(
      validateC03PersonActivityOfflineV2Report(report, claim, bytes, temp).passed,
      false,
    );
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
