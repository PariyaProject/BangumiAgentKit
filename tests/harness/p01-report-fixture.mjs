import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  P01_COVERAGE_FIELDS,
  P01_EXPECTED_QUERY_ARGUMENTS,
} from '../../scripts/acceptance/p01-person-position-answer-check.mjs';
import {
  buildP01SanitizedReport,
  p01CatalogHashes,
} from '../../scripts/acceptance/write-p01-agent-mcp-report.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const toolName = 'bangumi.get_person_activity';
const answerCheckNames = [
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
];
const answerCounterNames = [
  'sourceRows',
  'answerRows',
  'rowsMatched',
  'sourceRoleLabels',
  'answerRoleLabels',
  'knownRoleRows',
  'unknownRoleRows',
  'coverageFieldsMatched',
  'toolTextUtf8Bytes',
];
const sourceOperations = [
  { operation: 'GET /v0/persons/{person_id}', attempted: 1, succeeded: 1, failed: 0 },
  { operation: 'GET /v0/persons/{person_id}/subjects', attempted: 1, succeeded: 1, failed: 0 },
  { operation: 'GET /v0/subjects/{subject_id}', attempted: 1, succeeded: 1, failed: 0 },
];

export function makeP01Report({
  candidateSha = 'b'.repeat(40),
  baseSha = 'a'.repeat(40),
  bundleSha256 = 'c'.repeat(64),
  claimId,
  prNumber = 42,
  reviewerId = `gpt-6-luna-max-run95-pr${prNumber}-round1`,
} = {}) {
  const resolvedClaimId = claimId ?? `p01-run-95-pr-${prNumber}-${candidateSha.slice(0, 12)}-123`;
  const monthKeys = Array.from({ length: 36 }, (_, index) => {
    const monthIndex = 2023 * 12 + 10 + index;
    const year = Math.floor(monthIndex / 12);
    return `${year}-${String((monthIndex % 12) + 1).padStart(2, '0')}`;
  });
  const coverage = Object.fromEntries(P01_COVERAGE_FIELDS.map((key) => [key, 0]));
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
  const resultSummary = {
    personId: P01_EXPECTED_QUERY_ARGUMENTS.personId,
    kind: 'staff',
    media: 'anime',
    state: 'partial',
    window: {
      months: 36,
      start: '2023-11-01',
      end: '2026-10-11',
      monthKeys,
      asOfSemantics: 'calendar_months_ending_on_as_of_date',
    },
    summary: { creditRows: 1, uniqueSubjects: 1, uniqueCharacters: 0 },
    coverage,
    rowCount: 1,
    roleLabelCount: 1,
    unknownRoleRows: 0,
    sourceRowDigest: 'e'.repeat(64),
    sourceOperations,
  };
  const input = {
    model: 'gpt-6-luna',
    reasoningEffort: 'max',
    sourceRevision: candidateSha,
    baseSha,
    bundleSha256,
    claimId: resolvedClaimId,
    prNumber,
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
  const answerResult = {
    passed: true,
    answerChecks: Object.fromEntries(answerCheckNames.map((name) => [name, true])),
    answerCounters: Object.fromEntries(
      answerCounterNames.map((name, index) => [
        name,
        [1, 1, 1, 1, 1, 1, 0, P01_COVERAGE_FIELDS.length, 1200][index],
      ]),
    ),
    resultSummary,
    resultByteLength: 4096,
    resultSha256: 'd'.repeat(64),
    answerUtf8Bytes: 900,
    answerSha256: 'f'.repeat(64),
  };
  const result = buildP01SanitizedReport(
    input,
    answerResult,
    p01CatalogHashes(ROOT),
    '2026-10-11T08:00:00.000Z',
  );
  if (!result.passed) throw new Error(result.reason);
  return result.report;
}
