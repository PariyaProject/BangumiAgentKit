import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { P06_REQUIRED_CI_CHECKS } from '../../scripts/lib/p06-ci-run-evidence.mjs';
import {
  R02_POSITIVE_DIRECT_RELATIONS_ACKNOWLEDGEMENT,
  R02_POSITIVE_DIRECT_RELATIONS_EXPECTED_RESULT_SUMMARIES,
  R02_POSITIVE_DIRECT_RELATIONS_PROFILE_ID,
  R02_POSITIVE_DIRECT_RELATIONS_SERVER_ID,
  expectedR02PositiveDirectRelationsRequestScope,
} from '../../scripts/lib/r02-positive-direct-relations-profile.mjs';
import {
  buildR02ProfileReport,
  validateR02ProfileReport,
  validateR02SanitizedReportFile,
  writeR02ProfileReport,
} from '../../scripts/acceptance/write-r02-positive-direct-relations-agent-mcp-report.mjs';

const PROFILE = getAgentMcpProfileById(R02_POSITIVE_DIRECT_RELATIONS_PROFILE_ID);
const KEY_PAIR = generateKeyPairSync('ed25519');
const PUBLIC_KEY_BASE64 = KEY_PAIR.publicKey
  .export({ type: 'spki', format: 'der' })
  .toString('base64');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function claim() {
  return {
    claimId: 'profile-run-95-pr-291-aaaaaaaaaaaa-1792100000000',
    runNumber: 95,
    prNumber: 291,
    profileId: PROFILE.id,
    frontierId: 'R02',
    epochId: PROFILE.epochId,
    acceptanceScope: 'agent-mcp-matrix-only',
    sourceCandidateSha: 'a'.repeat(40),
    baseSha: 'b'.repeat(40),
    ciSha: 'a'.repeat(40),
    ciStatus: 'SUCCESS',
    ciRunId: '38812509760',
    ciChecks: P06_REQUIRED_CI_CHECKS.map((name) => ({
      name,
      status: 'COMPLETED',
      conclusion: 'SUCCESS',
    })),
    reviewerId: 'gpt-6-luna-max-run95-pr291-round1',
    bundleSha256: 'c'.repeat(64),
    registrySha256: agentMcpProfileRegistrySha256(PROFILE.id),
    toolName: PROFILE.toolName,
    argumentProfile: PROFILE.argumentProfile,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    runnerReceiptPublicKey: PUBLIC_KEY_BASE64,
  };
}

function serverSummary() {
  return {
    profileId: PROFILE.id,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 3,
    deniedCallCount: 0,
    expectedCallCount: 3,
    results: R02_POSITIVE_DIRECT_RELATIONS_EXPECTED_RESULT_SUMMARIES.map(
      (resultSummary, sequenceIndex) => ({
        sequenceIndex,
        status: 'SUCCESS',
        resultSummary,
      }),
    ),
    publicRequestScope: expectedR02PositiveDirectRelationsRequestScope(),
  };
}

function safeEvents() {
  return {
    processExitCode: 0,
    eventStreamParsed: true,
    turnCompleted: true,
    codexMcpToolEventCount: 3,
    codexErrorItemCount: 2,
    blockedWebSearchErrorItemCount: 2,
    unexpectedCodexErrorItemCount: 0,
    nonMcpToolEventCount: 0,
    nonMcpToolTypes: [],
    shellToolCallCount: 0,
    mcpServerNames: [R02_POSITIVE_DIRECT_RELATIONS_SERVER_ID],
    allowedCallCount: 3,
    deniedCallCount: 0,
  };
}

function build() {
  return buildR02ProfileReport(
    {
      claim: claim(),
      serverSummary: serverSummary(),
      events: safeEvents(),
      answer: R02_POSITIVE_DIRECT_RELATIONS_ACKNOWLEDGEMENT,
      codexCliVersion: '0.163.0',
      eventStreamSha256: 'd'.repeat(64),
      serverSummarySha256: 'e'.repeat(64),
    },
    { privateKey: KEY_PAIR.privateKey, publicKeyBase64: PUBLIC_KEY_BASE64 },
  );
}

test('R02 report signs a bounded matrix observation without raw names, full rows, or answer text', () => {
  const result = build();
  assert.equal(result.passed, true);
  const serialized = JSON.stringify(result.report);
  assert.equal(serialized.includes(R02_POSITIVE_DIRECT_RELATIONS_ACKNOWLEDGEMENT), false);
  assert.equal(serialized.includes('葬送'), false);
  assert.equal(result.report.privacy.rawToolResultStored, false);
  assert.equal(result.report.privacy.answerStored, false);
  assert.deepEqual(
    result.report.resultSummary,
    R02_POSITIVE_DIRECT_RELATIONS_EXPECTED_RESULT_SUMMARIES,
  );
  assert.equal(validateR02ProfileReport(result.report, claim(), result.reportBytes).passed, true);
});

test('R02 report validator rejects a changed row, claim, privacy boundary, or signature', () => {
  const result = build();
  assert.equal(result.passed, true);
  const changedRow = structuredClone(result.report);
  changedRow.resultSummary[0].directRelations[0].relationLabel = '续集';
  assert.equal(validateR02ProfileReport(changedRow, claim()).passed, false);
  const changedClaim = { ...claim(), claimId: 'profile-run-95-pr-291-bbbbbbbbbbbb-1792100000000' };
  assert.equal(validateR02ProfileReport(result.report, changedClaim).passed, false);
  const privacyFailure = structuredClone(result.report);
  privacyFailure.privacy.answerStored = true;
  assert.equal(validateR02ProfileReport(privacyFailure, claim()).passed, false);
  const invalidSignature = structuredClone(result.report);
  invalidSignature.runnerReceipt.signature = Buffer.from('bad').toString('base64');
  assert.equal(validateR02ProfileReport(invalidSignature, claim()).passed, false);
});

test('R02 report file is create-only and must match the permanent report path', () => {
  const result = build();
  assert.equal(result.passed, true);
  const root = mkdtempSync(path.join(os.tmpdir(), 'r02-report-test-'));
  try {
    mkdirSync(path.dirname(path.join(root, PROFILE.reportPath)), { recursive: true });
    const target = writeR02ProfileReport(result.reportBytes, root);
    const checked = validateR02SanitizedReportFile(claim(), root, target);
    assert.equal(checked.passed, true);
    assert.equal(checked.reportSha256, result.reportSha256);
    assert.throws(() => writeR02ProfileReport(result.reportBytes, root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('R02 writer rejects a changed anonymous request scope and does not expose raw relation labels outside the sample', () => {
  const fixture = serverSummary();
  fixture.publicRequestScope.credentialHeaderCount = 1;
  const invalid = buildR02ProfileReport(
    {
      claim: claim(),
      serverSummary: fixture,
      events: safeEvents(),
      answer: R02_POSITIVE_DIRECT_RELATIONS_ACKNOWLEDGEMENT,
      codexCliVersion: '0.163.0',
      eventStreamSha256: sha256('events'),
      serverSummarySha256: sha256('summary'),
    },
    { privateKey: KEY_PAIR.privateKey, publicKeyBase64: PUBLIC_KEY_BASE64 },
  );
  assert.equal(invalid.passed, false);
});
