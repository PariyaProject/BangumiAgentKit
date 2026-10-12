import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildG16SanitizedReport,
  validateG16SanitizedReportFile,
} from '../../scripts/acceptance/write-g16-agent-mcp-report.mjs';
import {
  G16_ANSWER_CHECK_METHOD,
  G16_ARGUMENT_PROFILE,
  G16_COVERAGE_FIELDS,
  G16_EXPECTED_QUERY_ARGUMENTS,
} from '../../scripts/acceptance/g16-person-activity-answer-check.mjs';
import {
  buildG16RunnerReceiptPayload,
  createG16RunnerReceipt,
  generateG16RunnerReceiptKeyPair,
  g16RunnerReceiptPayloadFromReport,
  verifyG16RunnerReceipt,
} from '../../scripts/acceptance/g16-agent-mcp-runner-receipt.mjs';

const receiptKeys = generateG16RunnerReceiptKeyPair();
const temporaryRoots: string[] = [];
afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const input: Record<string, unknown> = {
  model: 'gpt-6-luna',
  reasoningEffort: 'max',
  codexCliVersion: '0.162.0',
  reviewerId: 'gpt-6-luna-max-run95-pr141-round1',
  sourceRevision: 'a'.repeat(40),
  baseSha: 'b'.repeat(40),
  prNumber: 141,
  claimId: `g16-run-95-pr-141-${'a'.repeat(12)}-123`,
  bundleSha256: 'c'.repeat(64),
  runnerEventStreamSha256: '9'.repeat(64),
  runnerServerSummarySha256: '8'.repeat(64),
  runnerReceiptPublicKey: receiptKeys.publicKeyBase64,
  runnerReceipt: null,
  codexErrorItemCount: 0,
  toolTextUtf8Bytes: 2400,
};
const answerChecks = [
  'exactQueryArguments',
  'exactSingleToolCall',
  'structuredResultReadback',
  'targetIdentityAndScope',
  'calendarWindowValid',
  'successfulOfficialSources',
  'boundedCoverageConsistent',
  'sourceRowsValid',
  'sourceRowsDistinct',
  'answerShapeValid',
  'answerIdentityAndStateMatch',
  'observedCountMatches',
  'answerSummaryMatches',
  'answerCoverageMatches',
  'answerRowsMatch',
  'caveatDisclosurePresent',
  'noUnsupportedPositiveClaim',
  'plainJsonWithoutMarkdown',
  'boundedAnswerBytes',
  'boundedMcpTextView',
].reduce<Record<string, boolean>>((result, key) => ({ ...result, [key]: true }), {});
const summaryMonthKeys = Array.from({ length: 36 }, (_, index) => {
  const month = new Date(Date.UTC(2023, 10 + index, 1));
  return month.toISOString().slice(0, 7);
});
const coverage = Object.fromEntries(
  G16_COVERAGE_FIELDS.map((key) => [
    key,
    key === 'truncated' ? true : key === 'outputTruncated' ? false : 0,
  ]),
);
Object.assign(coverage, {
  relationRowsObserved: 4,
  relationRowsSelected: 2,
  staffRoleExcludedRows: 2,
  staffRoleUnknownRows: 1,
  subjectIdsObserved: 2,
  subjectIdsSelected: 2,
  subjectDetailIdsObserved: 2,
  subjectDetailRequests: 2,
  subjectDetailsSucceeded: 2,
  rowsEligible: 2,
  rowsReturned: 2,
  uniqueSubjects: 2,
  uniqueCharacters: 0,
  maxRelations: 48,
  maxSubjectDetails: 16,
  maxRows: 20,
  responseLimitBytes: 1_048_576,
});
const resultSummary = {
  personId: 6154,
  kind: 'staff',
  staffRole: 'director',
  media: 'tv',
  state: 'partial',
  window: {
    months: 36,
    start: '2023-11-01',
    end: '2026-10-11',
    monthKeys: summaryMonthKeys,
    asOfSemantics: 'calendar_months_ending_on_as_of_date',
  },
  summary: { creditRows: 2, uniqueSubjects: 2, uniqueCharacters: 0 },
  coverage,
  rowCount: 2,
  rowDigest: 'd'.repeat(64),
  sourceOperations: [
    { operation: 'GET /v0/persons/{person_id}', attempted: 1, succeeded: 1, failed: 0 },
    { operation: 'GET /v0/persons/{person_id}/subjects', attempted: 1, succeeded: 1, failed: 0 },
    { operation: 'GET /v0/subjects/{subject_id}', attempted: 16, succeeded: 16, failed: 0 },
  ],
};
const answerResult = {
  passed: true,
  answerChecks,
  answerCounters: {
    sourceRows: 2,
    answerRows: 2,
    rowsMatched: 2,
    missingRows: 0,
    extraRows: 0,
    coverageFieldsMatched: 29,
    toolTextUtf8Bytes: 2400,
  },
  resultSummary,
  resultByteLength: 1000,
  resultSha256: 'e'.repeat(64),
  answerUtf8Bytes: 900,
  answerSha256: 'f'.repeat(64),
};
const receiptInput = {
  ...input,
  processExitCode: 0,
  resultStatus: 'SUCCESS',
  eventStreamParsed: true,
  serverToolNames: ['bangumi.get_person_activity'],
  serverToolCount: 1,
  mcpServerNames: ['bgk_g16_one_tool'],
  codexMcpToolEventCount: 1,
  nonMcpToolEventCount: 0,
  nonMcpToolTypes: [],
  shellToolCallCount: 0,
  allowedCallCount: 1,
  deniedCallCount: 0,
  queryArguments: G16_EXPECTED_QUERY_ARGUMENTS,
  candidateGate: {
    candidateSha: input.sourceRevision,
    baseSha: input.baseSha,
    ciSha: input.sourceRevision,
    ciStatus: 'SUCCESS',
    reviewPassSha: input.sourceRevision,
    reviewVerdict: 'PASS',
    reviewerId: input.reviewerId,
  },
};
input.runnerReceipt = createG16RunnerReceipt(
  buildG16RunnerReceiptPayload(receiptInput, answerResult),
  receiptKeys,
);
const hashes = {
  catalogSha256: '1'.repeat(64),
  toolDescriptionSha256: '2'.repeat(64),
  inputSchemaSha256: '3'.repeat(64),
};

describe('G16 sanitized current-source Agent/MCP report', () => {
  it('binds only safe counts and hashes to the Luna Max Candidate without raw titles or rows', () => {
    const report = buildG16SanitizedReport(input, answerResult, hashes, '2026-10-11T09:30:00.000Z');
    expect(
      verifyG16RunnerReceipt(
        report.runnerReceipt,
        receiptKeys.publicKeyBase64,
        g16RunnerReceiptPayloadFromReport(report),
      ),
    ).toBe(true);
    const forgedReceipt = structuredClone(report.runnerReceipt) as {
      payload: Record<string, unknown>;
    };
    forgedReceipt.payload.claimId = 'forged';
    expect(
      verifyG16RunnerReceipt(
        forgedReceipt,
        receiptKeys.publicKeyBase64,
        g16RunnerReceiptPayloadFromReport(report),
      ),
    ).toBe(false);
    expect(report).toMatchObject({
      evidenceKind: 'codex_cli_g16_director_person_activity_agent_mcp',
      runNumber: 95,
      frontierId: 'G16',
      scenarioId: 'G16',
      epochId: 'run95-g16-director-person-activity-agent-mcp',
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
      reviewerId: input.reviewerId,
      sourceRevision: input.sourceRevision,
      baseSha: input.baseSha,
      prNumber: input.prNumber,
      argumentProfile: G16_ARGUMENT_PROFILE,
      answerCheckMethod: G16_ANSWER_CHECK_METHOD,
      nonMcpToolEventCount: 0,
      shellToolCallCount: 0,
      answerChecks,
      resultSummary,
    });
    const json = JSON.stringify(report);
    expect(json).not.toContain('Example Director');
    expect(json).not.toContain('示例动画');
    expect(json).not.toContain('rawRole');
    expect(report.resultSummary).not.toHaveProperty('subjectId');
    expect(report.privacy).toMatchObject({
      authProfile: 'anonymous',
      oauthAttempted: false,
      accountDataRead: false,
      communityRead: false,
      qqPipelineTested: false,
      timClientTested: false,
      answerStored: false,
      rawResultStored: false,
      credentialsStored: false,
    });
  });

  it('rebuilds the closed report schema and receipt before Harness result acknowledgement', () => {
    const report = buildG16SanitizedReport(input, answerResult, hashes, '2026-10-11T09:30:00.000Z');
    const root = mkdtempSync(path.join(os.tmpdir(), 'bgk-g16-report-validation-'));
    temporaryRoots.push(root);
    const reportPath = path.join(root, 'docs/live-probes/g16-report.json');
    mkdirSync(path.dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    const disposition = {
      state: 'CLAIMED',
      retryAllowed: false,
      claimId: report.claimId,
      prNumber: report.prNumber,
      sourceCandidateSha: report.sourceRevision,
      baseSha: report.baseSha,
      reviewerId: report.reviewerId,
      bundleSha256: report.mcpBundleSha256,
      runnerReceiptPublicKey: receiptKeys.publicKeyBase64,
      runnerReceiptPublicKeySha256: (report.runnerReceipt as { publicKeySha256: string })
        .publicKeySha256,
    };
    expect(validateG16SanitizedReportFile(disposition, root, reportPath)).toMatchObject({
      passed: true,
      reportPath: 'docs/live-probes/g16-report.json',
    });
    const altered = { ...report, model: 'gpt-6-sol' };
    writeFileSync(reportPath, `${JSON.stringify(altered, null, 2)}\n`);
    expect(validateG16SanitizedReportFile(disposition, root, reportPath).passed).toBe(false);
  });

  it('rejects any nonpassing checker result or unexpected raw row data in the summary', () => {
    expect(() =>
      buildG16SanitizedReport(
        input,
        {
          ...answerResult,
          answerChecks: { ...answerChecks, answerRowsMatch: false },
        },
        hashes,
      ),
    ).toThrow();
    expect(() =>
      buildG16SanitizedReport(
        input,
        {
          ...answerResult,
          resultSummary: { ...resultSummary, subjectId: 3001 },
        },
        hashes,
      ),
    ).toThrow();
  });
});
