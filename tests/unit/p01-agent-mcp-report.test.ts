import { describe, expect, it } from 'vitest';
import {
  P01_COVERAGE_FIELDS,
  P01_EXPECTED_QUERY_ARGUMENTS,
} from '../../scripts/acceptance/p01-person-position-answer-check.mjs';
import {
  buildP01SanitizedReport,
  p01CatalogHashes,
  validateP01SanitizedReport,
} from '../../scripts/acceptance/write-p01-agent-mcp-report.mjs';

const reviewerId = 'gpt-6-luna-max-run95-pr147-round1';
const candidateSha = 'a'.repeat(40);
const baseSha = 'b'.repeat(40);
const bundleSha256 = 'c'.repeat(64);
const toolName = 'bangumi.get_person_activity';
const root = process.cwd();
const sourceOperations = [
  { operation: 'GET /v0/persons/{person_id}', attempted: 1, succeeded: 1, failed: 0 },
  { operation: 'GET /v0/persons/{person_id}/subjects', attempted: 1, succeeded: 1, failed: 0 },
  { operation: 'GET /v0/subjects/{subject_id}', attempted: 1, succeeded: 1, failed: 0 },
];
const window = {
  months: 36,
  start: '2023-11-01',
  end: '2026-10-11',
  monthKeys: Array.from({ length: 36 }, (_, index) => {
    const monthIndex = 2023 * 12 + 10 + index;
    const year = Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    return `${year}-${String(month).padStart(2, '0')}`;
  }),
  asOfSemantics: 'calendar_months_ending_on_as_of_date',
};

function input() {
  return {
    model: 'gpt-6-luna',
    reasoningEffort: 'max',
    sourceRevision: candidateSha,
    baseSha,
    bundleSha256,
    claimId: `p01-run-95-pr-147-${candidateSha.slice(0, 12)}-123`,
    prNumber: 147,
    reviewerId,
    codexCliVersion: '0.162.0',
    toolTextUtf8Bytes: 1200,
    candidateGate: {
      candidateSha,
      baseSha,
      ciSha: candidateSha,
      ciStatus: 'SUCCESS',
      reviewPassSha: candidateSha,
      reviewVerdict: 'PASS',
      reviewerId,
    },
    serverResultSummary: {
      toolName,
      resultState: 'partial',
      sourceOperations,
      resultSha256: 'd'.repeat(64),
      resultByteLength: 4096,
    },
  };
}

function answerResult() {
  const coverage = Object.fromEntries(P01_COVERAGE_FIELDS.map((key) => [key, 0])) as Record<
    string,
    unknown
  >;
  Object.assign(coverage, {
    relationRowsObserved: 1,
    relationRowsSelected: 1,
    relationSelectionStrategy: 'all',
    sampled: false,
    subjectIdsObserved: 1,
    subjectIdsSelected: 1,
    subjectDetailIdsObserved: 1,
    subjectDetailRequests: 1,
    subjectDetailsSucceeded: 1,
    rowsEligible: 1,
    rowsReturned: 1,
    outputTruncated: false,
    uniqueSubjects: 1,
    uniqueCharacters: 0,
    maxRelations: 48,
    maxSubjectDetails: 16,
    maxRows: 8,
    responseLimitBytes: 1_048_576,
    truncated: false,
    retrievedAt: '2026-10-11T08:00:00.000Z',
  });
  return {
    passed: true,
    answerChecks: Object.fromEntries(
      [
        'exactQueryArguments',
        'exactSingleToolCall',
        'completeSourceReadback',
        'targetIdentityAndScope',
        'calendarWindowValid',
        'successfulOfficialSources',
        'boundedCoverageConsistent',
        'sourceRowsValid',
        'sourceRowsDistinct',
        'answerShapeValid',
        'answerIdentityAndStateMatch',
        'answerSummaryMatches',
        'answerRoleFrequencyMatches',
        'answerUnknownRoleRowsMatch',
        'answerCoverageMatches',
        'answerRowsMatch',
        'boundedSampleCaveatPresent',
        'noUnsupportedCareerClaim',
        'plainJsonWithoutMarkdown',
        'boundedAnswerBytes',
        'boundedMcpTextView',
      ].map((key) => [key, true]),
    ),
    answerCounters: {
      sourceRows: 1,
      answerRows: 1,
      rowsMatched: 1,
      sourceRoleLabels: 1,
      answerRoleLabels: 1,
      knownRoleRows: 1,
      unknownRoleRows: 0,
      coverageFieldsMatched: P01_COVERAGE_FIELDS.length,
      toolTextUtf8Bytes: 1200,
    },
    resultSummary: {
      personId: P01_EXPECTED_QUERY_ARGUMENTS.personId,
      kind: 'staff',
      media: 'anime',
      state: 'partial',
      window,
      summary: { creditRows: 1, uniqueSubjects: 1, uniqueCharacters: 0 },
      coverage,
      rowCount: 1,
      roleLabelCount: 1,
      unknownRoleRows: 0,
      sourceRowDigest: 'e'.repeat(64),
      sourceOperations,
    },
    resultByteLength: 4096,
    resultSha256: 'd'.repeat(64),
    answerUtf8Bytes: 900,
    answerSha256: 'f'.repeat(64),
  };
}

const hashes = {
  catalogSha256: '1'.repeat(64),
  toolDescriptionSha256: '2'.repeat(64),
  inputSchemaSha256: '3'.repeat(64),
};

describe('P01 sanitized Agent/MCP report', () => {
  it('builds a counters-and-hashes report bound to one Candidate and reviewer', () => {
    const result = buildP01SanitizedReport(
      input(),
      answerResult(),
      hashes,
      '2026-10-11T08:00:00.000Z',
    );
    expect(result.passed).toBe(true);
    if (!result.passed) return;
    expect(result.report).toMatchObject({
      evidenceKind: 'codex_p01_person_position_agent_mcp',
      sourceRevision: candidateSha,
      baseSha,
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
      reviewerId,
      candidateGate: { candidateSha, baseSha, reviewPassSha: candidateSha, reviewerId },
      answerCounters: {
        sourceRows: 1,
        sourceRoleLabels: 1,
        coverageFieldsMatched: P01_COVERAGE_FIELDS.length,
      },
    });
    expect(JSON.stringify(result.report)).not.toMatch(
      /"(?:rawRole|subjectName|prompt)"\s*:|private answer/u,
    );
  });

  it('rejects model, reviewer-gate, and source-count mismatches', () => {
    const wrongModel = input();
    wrongModel.model = 'gpt-6-sol';
    expect(buildP01SanitizedReport(wrongModel, answerResult(), hashes).passed).toBe(false);

    const wrongReview = input();
    wrongReview.candidateGate.reviewPassSha = baseSha;
    expect(buildP01SanitizedReport(wrongReview, answerResult(), hashes).passed).toBe(false);

    const wrongCount = answerResult();
    wrongCount.answerCounters.sourceRoleLabels = 2;
    expect(buildP01SanitizedReport(input(), wrongCount, hashes).passed).toBe(false);

    const completeWithUnknownRole = answerResult();
    completeWithUnknownRole.resultSummary.state = 'complete';
    completeWithUnknownRole.resultSummary.roleLabelCount = 0;
    completeWithUnknownRole.resultSummary.unknownRoleRows = 1;
    completeWithUnknownRole.answerCounters.sourceRoleLabels = 0;
    completeWithUnknownRole.answerCounters.answerRoleLabels = 0;
    completeWithUnknownRole.answerCounters.knownRoleRows = 0;
    completeWithUnknownRole.answerCounters.unknownRoleRows = 1;
    expect(buildP01SanitizedReport(input(), completeWithUnknownRole, hashes).passed).toBe(false);
  });

  it('validates the complete sanitized report against the active claim and current catalog', () => {
    const reportResult = buildP01SanitizedReport(
      input(),
      answerResult(),
      p01CatalogHashes(root),
      '2026-10-11T08:00:00.000Z',
    );
    expect(reportResult.passed).toBe(true);
    if (!reportResult.passed) return;
    const expected = {
      claimId: input().claimId,
      runNumber: 95,
      frontierId: 'P01',
      epochId: 'run95-p01-person-role-agent-mcp',
      toolName,
      argumentProfile: 'fixed-p01-person-1040-staff-anime-36m-48r-16d-8rows-v1',
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
      sourceCandidateSha: candidateSha,
      baseSha,
      ciSha: candidateSha,
      ciStatus: 'SUCCESS',
      bundleSha256,
      prNumber: 147,
      reviewerId,
      expectedArgumentsSha256: reportResult.report.expectedArgumentsSha256,
    };
    expect(validateP01SanitizedReport(reportResult.report, expected, root).passed).toBe(true);

    expect(
      validateP01SanitizedReport(reportResult.report, { ...expected, baseSha: candidateSha }, root)
        .passed,
    ).toBe(false);
    const failedCheck = structuredClone(reportResult.report);
    (failedCheck.answerChecks as Record<string, boolean>).answerRowsMatch = false;
    expect(validateP01SanitizedReport(failedCheck, expected, root).passed).toBe(false);

    const inconsistentCoverage = structuredClone(reportResult.report);
    const inconsistentSummary = inconsistentCoverage.resultSummary as Record<string, unknown>;
    (inconsistentSummary.coverage as Record<string, unknown>).rowsReturned = 0;
    expect(validateP01SanitizedReport(inconsistentCoverage, expected, root).passed).toBe(false);

    const inconsistentCounters = structuredClone(reportResult.report);
    (inconsistentCounters.answerCounters as Record<string, number>).knownRoleRows = 0;
    expect(validateP01SanitizedReport(inconsistentCounters, expected, root).passed).toBe(false);
  });
});
