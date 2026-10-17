import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  validateS05SanitizedReportFile,
  writeS05PersonActivityReport,
} from '../../scripts/acceptance/write-s05-person-activity-report.mjs';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  S05_CANONICAL_CAVEAT,
  S05_PROFILE_ID,
  summarizeS05PersonActivityToolResult,
} from '../../scripts/lib/s05-person-activity-evidence.mjs';

const profile = getAgentMcpProfileById(S05_PROFILE_ID);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function fixture() {
  const rawResult = {
    personId: 3474,
    kind: 'voice',
    media: 'anime',
    state: 'partial',
    window: {
      months: 6,
      start: '2026-05-01',
      end: '2026-10-17',
      asOfSemantics: 'calendar_months_ending_on_as_of_date',
    },
    rows: [
      {
        subjectId: 101,
        subjectType: 'anime',
        relationKind: 'voice',
        firstAirDate: '2026-06-10',
        platform: 'OVA',
        subjectName: 'private fixture title',
      },
      {
        subjectId: 102,
        subjectType: 'anime',
        relationKind: 'voice',
        firstAirDate: '2026-07-12',
        platform: 'TV',
        subjectName: 'private fixture title',
      },
      {
        subjectId: 103,
        subjectType: 'anime',
        relationKind: 'voice',
        firstAirDate: '2026-09-05',
        platform: 'unclassified platform',
        subjectName: 'private fixture title',
      },
    ],
    coverage: {
      relationRowsObserved: 60,
      relationRowsSelected: 48,
      relationRowsDroppedAtLimit: 12,
      sampled: true,
      subjectDetailRequests: 16,
      subjectDetailsSucceeded: 16,
      subjectDetailsFailed: 0,
      subjectDetailIdsDroppedAtLimit: 0,
      rowsEligible: 3,
      rowsReturned: 3,
      missingDateRows: 1,
      invalidDateRows: 0,
      outputTruncated: false,
      truncated: true,
      retrievedAt: '2026-10-16T02:00:00.000Z',
    },
  };
  const resultSummary = summarizeS05PersonActivityToolResult(rawResult, profile.calls[0].arguments);
  const answer = JSON.stringify(resultSummary);
  const keyPair = generateKeyPairSync('ed25519');
  const publicKeyDer = keyPair.publicKey.export({ type: 'spki', format: 'der' });
  const claim = {
    claimId: 'profile-run-95-pr-188-aaaaaaaaaaaa-123',
    state: 'CLAIMED',
    profileId: profile.id,
    frontierId: 'S05',
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
    mcpServerNames: ['bgk_s05_non_tv_voice'],
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

test('S05 report stores only a signed sanitized result summary bound to the one-shot claim', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 's05-report-test-'));
  const { keyPair, claim, input, resultSummary } = fixture();
  mkdirSync(path.join(root, 'docs/live-probes'), { recursive: true });
  try {
    const result = writeS05PersonActivityReport(
      { ...input, root },
      { privateKey: keyPair.privateKey },
    );
    assert.equal(result.passed, true, result.reason);
    const validation = validateS05SanitizedReportFile(claim, root);
    assert.equal(validation.passed, true, validation.reason);
    assert.equal(validation.reportSha256, result.reportSha256);
    assert.deepEqual(validation.report.resultSummary, resultSummary);
    assert.equal(validation.report.resultSummary.caveat, S05_CANONICAL_CAVEAT);
    assert.equal(Object.hasOwn(validation.report, 'answer'), false);
    assert.equal(JSON.stringify(validation.report).includes('private fixture title'), false);
    assert.equal(JSON.stringify(validation.report).includes('subjectId'), false);

    const reportBytes = readFileSync(result.absoluteReportPath);
    const tampered = JSON.parse(reportBytes.toString('utf8'));
    tampered.resultSummary.platformCounts.nonTv += 1;
    writeFileSync(result.absoluteReportPath, `${JSON.stringify(tampered, null, 2)}\n`);
    assert.equal(validateS05SanitizedReportFile(claim, root).passed, false);

    const inconsistent = JSON.parse(reportBytes.toString('utf8'));
    inconsistent.resultSummary.state = 'complete';
    Object.assign(inconsistent.resultSummary.coverage, {
      relationRowsObserved: 28,
      relationRowsDroppedAtLimit: 4,
      sampled: true,
      rowsEligible: 4,
      outputTruncated: true,
      truncated: true,
    });
    writeFileSync(result.absoluteReportPath, `${JSON.stringify(inconsistent, null, 2)}\n`);
    const inconsistentValidation = validateS05SanitizedReportFile(claim, root);
    assert.equal(inconsistentValidation.passed, false);
    assert.equal(inconsistentValidation.reason, 'S05_REPORT_RESULT_SUMMARY_INVALID');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('S05 report writer rejects a universal non-TV exclusivity claim', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 's05-report-invalid-'));
  const { keyPair, input } = fixture();
  mkdirSync(path.join(root, 'docs/live-probes'), { recursive: true });
  const invalidAnswer = JSON.stringify({
    ...JSON.parse(input.answer),
    exclusivityConclusion: 'only_non_tv',
  });
  try {
    const result = writeS05PersonActivityReport(
      { ...input, answer: invalidAnswer, root },
      { privateKey: keyPair.privateKey },
    );
    assert.equal(result.passed, false);
    assert.equal(result.reason, 'S05_ANSWER_CHECKS_FAILED');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
