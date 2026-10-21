import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  validateS01SanitizedReportFile,
  writeS01AnnualTvVoiceReport,
} from '../../scripts/acceptance/write-s01-annual-tv-voice-report.mjs';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  S01_CANONICAL_CAVEAT,
  S01_PROFILE_ID,
  summarizeS01AnnualTvVoiceResult,
} from '../../scripts/lib/s01-annual-tv-voice-activity-profile.mjs';

const profile = getAgentMcpProfileById(S01_PROFILE_ID);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function requestScope() {
  return {
    requestCount: 6,
    allowedRequestCount: 6,
    deniedRequestCount: 0,
    personDetailRequestCount: 1,
    characterRelationRequestCount: 1,
    subjectDetailRequestCount: 4,
    duplicateSubjectDetailCount: 0,
    credentialHeaderCount: 0,
    credentialModeCount: 0,
    forbiddenHeaderCount: 0,
    authorizationHeaderCount: 0,
    writeAttemptCount: 0,
    unexpectedRouteCount: 0,
    sequenceMismatchCount: 0,
    responseValidationFailureCount: 0,
    redirectResponseCount: 0,
    maxRequests: 18,
    maxSubjectDetails: 16,
    requestsWithinLimit: true,
    anonymousOnly: true,
    officialV0Only: true,
    redirectPolicy: 'error',
  };
}

function fixture() {
  const rawResult = {
    personId: 5745,
    kind: 'voice',
    media: 'tv',
    state: 'partial',
    window: {
      months: 36,
      start: '2023-11-01',
      end: '2026-10-21',
      asOfSemantics: 'calendar_months_ending_on_as_of_date',
    },
    rows: [{ subjectId: 101, subjectName: 'private fixture title' }, {}, {}, {}],
    summary: {
      creditRows: 4,
      uniqueSubjects: 4,
      uniqueCharacters: 4,
      byYear: [
        { year: 2023, start: '2023-11-01', end: '2023-12-31', creditRows: 1, uniqueSubjects: 1, uniqueCharacters: 1 },
        { year: 2024, start: '2024-01-01', end: '2024-12-31', creditRows: 0, uniqueSubjects: 0, uniqueCharacters: 0 },
        { year: 2025, start: '2025-01-01', end: '2025-12-31', creditRows: 2, uniqueSubjects: 2, uniqueCharacters: 2 },
        { year: 2026, start: '2026-01-01', end: '2026-10-21', creditRows: 1, uniqueSubjects: 1, uniqueCharacters: 1 },
      ],
    },
    coverage: {
      relationRowsObserved: 52,
      relationRowsSelected: 48,
      relationRowsDroppedAtLimit: 4,
      sampled: true,
      subjectIdsObserved: 4,
      subjectIdsSelected: 4,
      subjectIdsDroppedAtRelationLimit: 0,
      subjectDetailIdsObserved: 4,
      subjectDetailRequests: 4,
      subjectDetailsSucceeded: 4,
      subjectDetailsFailed: 0,
      subjectDetailIdsDroppedAtLimit: 0,
      rowsEligible: 4,
      rowsReturned: 4,
      outputTruncated: false,
      uniqueSubjects: 4,
      uniqueCharacters: 4,
      missingSubjectIdRows: 0,
      missingDateRows: 0,
      invalidDateRows: 0,
      maxRelations: 48,
      maxSubjectDetails: 16,
      maxRows: 8,
      truncated: true,
      retrievedAt: '2026-10-21T00:00:00.000Z',
    },
  };
  const resultSummary = summarizeS01AnnualTvVoiceResult(rawResult, profile.calls[0].arguments);
  const answer = JSON.stringify(resultSummary);
  const keyPair = generateKeyPairSync('ed25519');
  const publicKeyDer = keyPair.publicKey.export({ type: 'spki', format: 'der' });
  const claim = {
    claimId: 'profile-run-95-pr-248-aaaaaaaaaaaa-123',
    state: 'CLAIMED',
    profileId: profile.id,
    frontierId: 'S01',
    epochId: profile.epochId,
    runNumber: 95,
    prNumber: 248,
    toolName: profile.toolName,
    argumentProfile: profile.argumentProfile,
    expectedArguments: profile.calls.map((call) => call.arguments),
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(profile),
    registrySha256: agentMcpProfileRegistrySha256(profile.id),
    sourceCandidateSha: 'a'.repeat(40),
    baseSha: 'c'.repeat(40),
    ciSha: 'a'.repeat(40),
    ciStatus: 'SUCCESS',
    reviewerId: 'gpt-6-luna-max-run95-pr248-round1',
    bundleSha256: 'b'.repeat(64),
    runnerReceiptPublicKey: publicKeyDer.toString('base64'),
    runnerReceiptPublicKeySha256: sha256(publicKeyDer),
    retryAllowed: false,
  };
  const catalogBytes = readFileSync(new URL('../../docs/tool-catalog.json', import.meta.url));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const tool = catalog.find((entry) => entry.name === profile.toolName);
  const serverSummary = {
    profileId: profile.id,
    argumentProfile: profile.argumentProfile,
    expectedArgumentsSha256: claim.expectedArgumentsSha256,
    serverProfile: 'closed-profile-sequence-anonymous-public-v1',
    sourceRevision: claim.sourceCandidateSha,
    bundleSha256: claim.bundleSha256,
    serverToolNames: [profile.toolName],
    serverToolCount: 1,
    expectedCallCount: 1,
    toolName: profile.toolName,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    catalogSha256: sha256(catalogBytes),
    toolDescriptionSha256: sha256(tool.description),
    inputSchemaSha256: sha256(canonicalAgentMcpProfileJson(tool.inputSchema)),
    publicRequestScope: requestScope(),
    results: [{ sequenceIndex: 0, status: 'SUCCESS', resultSummary }],
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
    mcpTextProjectionValid: true,
    mcpServerNames: ['bgk_s01_annual_tv_voice'],
    allowedCallCount: 1,
    deniedCallCount: 0,
  };
  const input = {
    claim,
    serverSummary,
    completedMcpCalls: [
      {
        tool: profile.toolName,
        arguments: profile.calls[0].arguments,
        result: {
          structuredContent: resultSummary,
          content: [{ type: 'text', text: JSON.stringify(resultSummary) }],
        },
      },
    ],
    answer,
    codexCliVersion: '1.2.3',
    events,
    eventStreamSha256: 'd'.repeat(64),
    serverSummarySha256: 'e'.repeat(64),
  };
  return { keyPair, claim, input, resultSummary };
}

test('S01 report stores only signed annual aggregates, safe request counters, and claim bindings', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 's01-report-test-'));
  const { keyPair, claim, input, resultSummary } = fixture();
  mkdirSync(path.join(root, 'docs/live-probes'), { recursive: true });
  try {
    const result = writeS01AnnualTvVoiceReport(
      { ...input, root },
      { privateKey: keyPair.privateKey },
    );
    assert.equal(result.passed, true, result.reason);
    const validation = validateS01SanitizedReportFile(claim, root);
    assert.equal(validation.passed, true, validation.reason);
    assert.equal(validation.reportSha256, result.reportSha256);
    assert.deepEqual(validation.report.resultSummary, resultSummary);
    assert.deepEqual(validation.report.publicRequestScope, input.serverSummary.publicRequestScope);
    assert.equal(validation.report.resultSummary.caveat, S01_CANONICAL_CAVEAT);
    assert.equal(Object.hasOwn(validation.report, 'answer'), false);
    assert.equal(JSON.stringify(validation.report).includes('private fixture title'), false);
    assert.equal(JSON.stringify(validation.report).includes('subjectId'), false);
    assert.equal(JSON.stringify(validation.report).includes('5745'), false);

    const reportBytes = readFileSync(result.absoluteReportPath);
    const tampered = JSON.parse(reportBytes.toString('utf8'));
    tampered.resultSummary.annualObservedCounts[2].uniqueSubjects += 1;
    writeFileSync(result.absoluteReportPath, `${JSON.stringify(tampered, null, 2)}\n`);
    assert.equal(validateS01SanitizedReportFile(claim, root).passed, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('S01 report refuses an answer that adds identity fields or broad career claims', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 's01-report-invalid-'));
  const { keyPair, input } = fixture();
  mkdirSync(path.join(root, 'docs/live-probes'), { recursive: true });
  try {
    const invalidAnswer = JSON.stringify({
      ...JSON.parse(input.answer),
      personId: 5745,
      conclusion: '完整职业生涯统计',
    });
    const result = writeS01AnnualTvVoiceReport(
      { ...input, answer: invalidAnswer, root },
      { privateKey: keyPair.privateKey },
    );
    assert.equal(result.passed, false);
    assert.equal(result.reason, 'S01_ANSWER_CHECKS_FAILED');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('S01 report rejects scope data that is not signed or contains an extra identifier field', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 's01-report-scope-invalid-'));
  const { keyPair, input } = fixture();
  mkdirSync(path.join(root, 'docs/live-probes'), { recursive: true });
  try {
    const altered = structuredClone(input);
    altered.serverSummary.publicRequestScope.subjectIds = [12];
    const result = writeS01AnnualTvVoiceReport(
      { ...altered, root },
      { privateKey: keyPair.privateKey },
    );
    assert.equal(result.passed, false);
    assert.equal(result.reason, 'S01_RUNNER_GATE_INVALID');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
