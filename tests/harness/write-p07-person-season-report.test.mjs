import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  validateP07SanitizedReportFile,
  writeP07PersonSeasonReport,
} from '../../scripts/acceptance/write-p07-person-season-report.mjs';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  P07_CANONICAL_CAVEAT,
  P07_PROFILE_ID,
  summarizeP07PersonActivityToolResult,
} from '../../scripts/lib/p07-person-season-evidence.mjs';

const profile = getAgentMcpProfileById(P07_PROFILE_ID);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function fixture() {
  const rawResult = {
    personId: 3474,
    kind: 'staff',
    media: 'anime',
    state: 'partial',
    window: {
      months: 36,
      start: '2023-11-01',
      end: '2026-10-15',
      asOfSemantics: 'calendar_months_ending_on_as_of_date',
    },
    rows: [
      { subjectId: 101, firstAirDate: '2024-01-10', subjectName: 'private fixture title' },
      { subjectId: 102, firstAirDate: '2024-03-31', subjectName: 'private fixture title' },
      { subjectId: 103, firstAirDate: '2024-04-01', subjectName: 'private fixture title' },
    ],
    coverage: {
      relationRowsObserved: 24,
      relationRowsSelected: 24,
      relationRowsDroppedAtLimit: 0,
      sampled: false,
      subjectDetailRequests: 8,
      subjectDetailsSucceeded: 8,
      subjectDetailsFailed: 0,
      subjectDetailIdsDroppedAtLimit: 0,
      rowsEligible: 3,
      rowsReturned: 3,
      missingDateRows: 1,
      invalidDateRows: 1,
      outputTruncated: false,
      truncated: false,
      retrievedAt: '2026-10-16T02:00:00.000Z',
    },
  };
  const resultSummary = summarizeP07PersonActivityToolResult(rawResult, profile.calls[0].arguments);
  const answer = JSON.stringify(resultSummary);
  const keyPair = generateKeyPairSync('ed25519');
  const publicKeyDer = keyPair.publicKey.export({ type: 'spki', format: 'der' });
  const claim = {
    claimId: 'profile-run-95-pr-188-aaaaaaaaaaaa-123',
    state: 'CLAIMED',
    profileId: profile.id,
    frontierId: 'P07',
    epochId: profile.epochId,
    runNumber: 95,
    prNumber: 188,
    toolName: profile.toolName,
    argumentProfile: profile.argumentProfile,
    expectedArguments: profile.calls.map((call) => call.arguments),
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(profile),
    registrySha256: agentMcpProfileRegistrySha256(profile.id),
    sourceCandidateSha: 'a'.repeat(40),
    baseSha: 'c'.repeat(40),
    ciSha: 'a'.repeat(40),
    ciStatus: 'SUCCESS',
    reviewerId: 'gpt-6-luna-max-run95-pr188-round1',
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
    mcpServerNames: ['bgk_p07_person_season'],
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

test('P07 report stores only a signed sanitized result summary bound to the one-shot claim', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'p07-report-test-'));
  const { keyPair, claim, input, resultSummary } = fixture();
  mkdirSync(path.join(root, 'docs/live-probes'), { recursive: true });
  try {
    const result = writeP07PersonSeasonReport(
      { ...input, root },
      { privateKey: keyPair.privateKey },
    );
    assert.equal(result.passed, true, result.reason);
    const validation = validateP07SanitizedReportFile(claim, root);
    assert.equal(validation.passed, true, validation.reason);
    assert.equal(validation.reportSha256, result.reportSha256);
    assert.deepEqual(validation.report.resultSummary, resultSummary);
    assert.equal(validation.report.resultSummary.caveat, P07_CANONICAL_CAVEAT);
    assert.equal(Object.hasOwn(validation.report, 'answer'), false);
    assert.equal(JSON.stringify(validation.report).includes('private fixture title'), false);
    assert.equal(JSON.stringify(validation.report).includes('subjectId'), false);

    const reportBytes = readFileSync(result.absoluteReportPath);
    const tampered = JSON.parse(reportBytes.toString('utf8'));
    tampered.resultSummary.quarterDistribution[0].count += 1;
    writeFileSync(result.absoluteReportPath, `${JSON.stringify(tampered, null, 2)}\n`);
    assert.equal(validateP07SanitizedReportFile(claim, root).passed, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('P07 report writer rejects additional tag and full-career answer claims', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'p07-report-invalid-'));
  const { keyPair, input } = fixture();
  mkdirSync(path.join(root, 'docs/live-probes'), { recursive: true });
  const invalidAnswer = JSON.stringify({ ...JSON.parse(input.answer), tags: ['fictional'] });
  try {
    const result = writeP07PersonSeasonReport(
      { ...input, answer: invalidAnswer, root },
      { privateKey: keyPair.privateKey },
    );
    assert.equal(result.passed, false);
    assert.equal(result.reason, 'P07_ANSWER_CHECKS_FAILED');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
