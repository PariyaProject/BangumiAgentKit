import { describe, expect, it } from 'vitest';
import { buildG19SanitizedReport } from '../../scripts/acceptance/write-g19-agent-mcp-report.mjs';
import {
  G19_ANSWER_CHECK_METHOD,
  G19_ARGUMENT_PROFILE,
  G19_COVERAGE_FIELDS,
  G19_ORIGIN_COVERAGE_FIELDS,
} from '../../scripts/acceptance/g19-person-origin-answer-check.mjs';

const sourceOperations = [
  { operation: 'GET /v0/persons/{person_id}', attempted: 1, succeeded: 1, failed: 0 },
  { operation: 'GET /v0/persons/{person_id}/subjects', attempted: 1, succeeded: 1, failed: 0 },
  { operation: 'GET /v0/persons/{person_id}/characters', attempted: 1, succeeded: 1, failed: 0 },
  { operation: 'GET /v0/subjects/{subject_id}', attempted: 1, succeeded: 1, failed: 0 },
];
const originCoverage = Object.fromEntries(G19_ORIGIN_COVERAGE_FIELDS.map((key) => [
  key,
  key === 'truncated' ? false : 0,
]));
Object.assign(originCoverage, {
  explicitOriginalSubjects: 1,
  subjectsObserved: 1,
  subjectsWithMetaTags: 1,
  tagsObserved: 1,
  tagsValid: 1,
  tagsReturned: 1,
  maxTagsPerSubject: 32,
  maxTagCharacters: 96,
  responseLimitBytes: 1_048_576,
});
const coverage = Object.fromEntries(G19_COVERAGE_FIELDS.map((key) => [
  key,
  key === 'relationSelectionStrategy' ? 'all' :
    key === 'origin' ? originCoverage :
      ['sampled', 'outputTruncated', 'truncated'].includes(key) ? false : 0,
]));
Object.assign(coverage, {
  relationRowsObserved: 1,
  relationRowsSelected: 1,
  subjectIdsObserved: 1,
  subjectIdsSelected: 1,
  subjectDetailIdsObserved: 1,
  subjectDetailRequests: 1,
  subjectDetailsSucceeded: 1,
  rowsEligible: 1,
  rowsReturned: 1,
  uniqueSubjects: 1,
  uniqueCharacters: 1,
  maxRelations: 48,
  maxSubjectDetails: 16,
  maxRows: 8,
  detailConcurrency: 4,
  responseLimitBytes: 1_048_576,
});
const resultSummary = {
  personId: 3474,
  kind: 'all',
  media: 'anime',
  state: 'complete',
  window: {
    months: 3,
    start: '2026-08-01',
    end: '2026-10-11',
    monthKeys: ['2026-08', '2026-09', '2026-10'],
    asOfSemantics: 'calendar_months_ending_on_as_of_date',
  },
  summary: {
    creditRows: 1,
    uniqueSubjects: 1,
    uniqueCharacters: 1,
    origin: { explicitOriginalSubjects: 1, notObservedSubjects: 0, unknownSubjects: 0 },
  },
  coverage,
  rowCount: 1,
  rowDigest: 'd'.repeat(64),
  sourceOperations: [...sourceOperations].sort((left, right) => left.operation.localeCompare(right.operation)),
};
const answerChecks = [
  'exactQueryArguments', 'exactSingleToolCall', 'structuredResultReadback', 'targetIdentityAndScope',
  'calendarWindowValid', 'successfulOfficialSources', 'boundedCoverageConsistent', 'sourceRowsValid',
  'sourceRowsDistinct', 'answerShapeValid', 'answerIdentityAndStateMatch', 'answerWindowMatches',
  'answerSummaryMatches', 'answerCoverageMatches', 'answerRowsMatch', 'answerGroupsMatch',
  'adaptationNotInferred', 'caveatDisclosurePresent', 'plainJsonWithoutMarkdown',
  'boundedAnswerBytes', 'boundedMcpTextView',
].reduce<Record<string, boolean>>((result, key) => ({ ...result, [key]: true }), {});
const answerResult = {
  passed: true,
  answerChecks,
  answerCounters: {
    sourceRows: 1,
    answerRows: 1,
    rowsMatched: 1,
    missingRows: 0,
    extraRows: 0,
    coverageFieldsMatched: G19_COVERAGE_FIELDS.length + G19_ORIGIN_COVERAGE_FIELDS.length,
    toolTextUtf8Bytes: 2400,
  },
  resultSummary,
  resultByteLength: 1100,
  resultSha256: 'e'.repeat(64),
  answerUtf8Bytes: 800,
  answerSha256: 'f'.repeat(64),
};
const sourceSummary = {
  toolName: 'bangumi.get_person_activity',
  resultState: resultSummary.state,
  resultByteLength: answerResult.resultByteLength,
  resultSha256: answerResult.resultSha256,
  sourceOperations,
};
const input = {
  model: 'gpt-6-luna',
  reasoningEffort: 'max',
  codexCliVersion: '0.162.0',
  processExitCode: 0,
  resultStatus: 'SUCCESS',
  eventStreamParsed: true,
  serverToolNames: ['bangumi.get_person_activity'],
  serverToolCount: 1,
  codexMcpToolEventCount: 1,
  mcpServerNames: ['bgk_g19_one_tool'],
  nonMcpToolEventCount: 0,
  nonMcpToolTypes: [],
  shellToolCallCount: 0,
  allowedCallCount: 1,
  deniedCallCount: 0,
  privacy: {
    authProfile: 'anonymous', oauthAttempted: false, accountDataRead: false, writesAttempted: false,
    qqPipelineTested: false, timClientTested: false, promptStored: false, answerStored: false,
    rawResultStored: false, artifactImageBytesStored: false, credentialsStored: false,
  },
  toolCalls: [{ name: 'bangumi.get_person_activity', state: 'DONE', arguments: {
    personId: 3474, kind: 'all', media: 'anime', windowMonths: 3,
    maxRelations: 48, maxSubjectDetails: 16, maxRows: 8,
  } }],
  queryArguments: {
    personId: 3474, kind: 'all', media: 'anime', windowMonths: 3,
    maxRelations: 48, maxSubjectDetails: 16, maxRows: 8,
  },
  toolTextUtf8Bytes: 2400,
  serverResultSummary: sourceSummary,
  sourceRevision: 'a'.repeat(40),
  baseSha: 'b'.repeat(40),
  bundleSha256: 'c'.repeat(64),
  prNumber: 141,
  reviewerId: 'gpt-6-luna-max-run95-pr141-round1',
};
const hashes = {
  catalogSha256: '1'.repeat(64),
  toolDescriptionSha256: '2'.repeat(64),
  inputSchemaSha256: '3'.repeat(64),
};

describe('G19 sanitized current-source Agent/MCP report', () => {
  it('binds one Luna Max public call to the reviewed Candidate and stores counters without answer rows or tags', () => {
    const result = buildG19SanitizedReport(input, answerResult, hashes, '2026-10-11T09:30:00.000Z');
    expect(result.passed).toBe(true);
    expect(result.report).toMatchObject({
      evidenceKind: 'codex_g19_person_origin_agent_mcp',
      runNumber: 95,
      frontierId: 'G19',
      scenarioId: 'G19',
      epochId: 'run95-g19-person-origin-agent-mcp-evidence',
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
      reviewerId: input.reviewerId,
      sourceRevision: input.sourceRevision,
      baseSha: input.baseSha,
      prNumber: input.prNumber,
      argumentProfile: G19_ARGUMENT_PROFILE,
      answerCheckMethod: G19_ANSWER_CHECK_METHOD,
      nonMcpToolEventCount: 0,
      shellToolCallCount: 0,
      answerChecks,
      resultSummary,
    });
    const json = JSON.stringify(result.report);
    expect(json).not.toContain('Example Person');
    expect(json).not.toContain('rawRole');
    expect(json).not.toContain('metaTags');
    expect(result.report?.privacy).toMatchObject({
      authProfile: 'anonymous', oauthAttempted: false, accountDataRead: false,
      communityRead: false, qqPipelineTested: false, timClientTested: false,
      answerStored: false, rawResultStored: false, credentialsStored: false,
    });
  });

  it('rejects a failing checker, raw output in summary, and mismatch with the MCP source digest', () => {
    expect(buildG19SanitizedReport(input, {
      ...answerResult,
      answerChecks: { ...answerChecks, answerRowsMatch: false },
    }, hashes).passed).toBe(false);
    expect(buildG19SanitizedReport(input, {
      ...answerResult,
      resultSummary: { ...resultSummary, subjectNameCn: 'Raw public title' },
    }, hashes).passed).toBe(false);
    expect(buildG19SanitizedReport({
      ...input,
      serverResultSummary: { ...sourceSummary, resultSha256: '0'.repeat(64) },
    }, answerResult, hashes).passed).toBe(false);
  });
});
