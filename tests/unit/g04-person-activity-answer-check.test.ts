import { describe, expect, it } from 'vitest';
import {
  G04_EXPECTED_QUERY_ARGUMENTS,
  G04_REQUIRED_CAVEAT,
  verifyG04PersonActivityAnswer,
} from '../../scripts/acceptance/g04-person-activity-answer-check.mjs';

const toolName = 'bangumi.get_person_activity';
const window = {
  months: 12,
  start: '2025-11-01',
  end: '2026-10-11',
  monthKeys: [
    '2025-11',
    '2025-12',
    '2026-01',
    '2026-02',
    '2026-03',
    '2026-04',
    '2026-05',
    '2026-06',
    '2026-07',
    '2026-08',
    '2026-09',
    '2026-10',
  ],
  asOfSemantics: 'calendar_months_ending_on_as_of_date',
};
const coverage = {
  relationRowsObserved: 62,
  relationRowsSelected: 48,
  relationRowsDroppedAtLimit: 14,
  subjectIdsObserved: 56,
  subjectIdsSelected: 40,
  subjectIdsDroppedAtRelationLimit: 16,
  subjectDetailIdsObserved: 40,
  subjectDetailRequests: 16,
  subjectDetailsSucceeded: 16,
  subjectDetailsFailed: 0,
  subjectDetailIdsDroppedAtLimit: 24,
  rowsEligible: 2,
  rowsReturned: 2,
  outputTruncated: false,
  uniqueSubjects: 2,
  uniqueCharacters: 2,
  missingSubjectIdRows: 0,
  missingDateRows: 0,
  invalidDateRows: 0,
  outsideWindowRows: 0,
  mediaExcludedRows: 0,
  mediaUnknownRows: 0,
  maxRelations: 48,
  maxSubjectDetails: 16,
  maxRows: 8,
  responseLimitBytes: 1_048_576,
  truncated: true,
};

function makeResult() {
  return {
    personId: 13684,
    state: 'partial',
    kind: 'voice',
    media: 'tv',
    window,
    rows: [
      {
        subjectId: 3001,
        subjectName: 'Example TV A',
        subjectNameCn: '示例动画甲',
        subjectType: 'anime',
        platform: 'TV',
        firstAirDate: '2026-04-01',
        month: '2026-04',
        relationKind: 'voice',
        relationId: 7001,
        characterName: 'Character A',
        rawRole: '主役',
        roleFamily: 'main',
      },
      {
        subjectId: 3002,
        subjectName: 'Example TV B',
        subjectNameCn: '示例动画乙',
        subjectType: 'anime',
        platform: 'TV',
        firstAirDate: '2025-12-01',
        month: '2025-12',
        relationKind: 'voice',
        relationId: 7002,
        characterName: 'Character B',
        rawRole: '配角',
        roleFamily: 'support',
      },
    ],
    summary: { creditRows: 2, uniqueSubjects: 2, uniqueCharacters: 2 },
    coverage,
    sourceOperations: [
      { operation: 'GET /v0/persons/{person_id}', attempted: 1, succeeded: 1, failed: 0 },
      {
        operation: 'GET /v0/persons/{person_id}/characters',
        attempted: 1,
        succeeded: 1,
        failed: 0,
      },
      {
        operation: 'GET /v0/subjects/{subject_id}',
        attempted: 16,
        succeeded: 16,
        failed: 0,
      },
    ],
    warnings: [] as Array<{ code: string; state: string; message: string }>,
  };
}

function answerFor(result: ReturnType<typeof makeResult>) {
  return JSON.stringify({
    personId: result.personId,
    kind: result.kind,
    media: result.media,
    window,
    state: result.state,
    observedUniqueWorks: result.summary.uniqueSubjects,
    summary: {
      creditRows: result.summary.creditRows,
      uniqueSubjects: result.summary.uniqueSubjects,
      uniqueCharacters: result.summary.uniqueCharacters,
    },
    coverage: Object.fromEntries(
      Object.keys(coverage).map((key) => [key, result.coverage[key as keyof typeof coverage]]),
    ),
    rows: result.rows.map((row) => ({
      subjectId: row.subjectId,
      title: row.subjectNameCn || row.subjectName,
      firstAirDate: row.firstAirDate,
      month: row.month,
      relationId: row.relationId ?? null,
      characterName: row.characterName ?? null,
      rawRole: row.rawRole ?? null,
      roleFamily: row.roleFamily,
    })),
    caveat: G04_REQUIRED_CAVEAT,
  });
}

function makeCompleteResult() {
  const result = makeResult();
  result.state = 'complete';
  const summaryOrigin = {
    explicitOriginalSubjects: 1,
    notObservedSubjects: 1,
    unknownSubjects: 0,
  };
  const completeCoverage = {
    ...coverage,
    relationRowsObserved: 2,
    relationRowsSelected: 2,
    relationRowsDroppedAtLimit: 0,
    subjectIdsObserved: 2,
    subjectIdsSelected: 2,
    subjectIdsDroppedAtRelationLimit: 0,
    subjectDetailIdsObserved: 2,
    subjectDetailRequests: 2,
    subjectDetailsSucceeded: 2,
    subjectDetailsFailed: 0,
    subjectDetailIdsDroppedAtLimit: 0,
    rowsEligible: 2,
    rowsReturned: 2,
    outputTruncated: false,
    missingSubjectIdRows: 0,
    missingDateRows: 0,
    invalidDateRows: 0,
    mediaUnknownRows: 0,
    truncated: false,
    origin: {
      explicitOriginalSubjects: 1,
      notObservedSubjects: 1,
      unknownSubjects: 0,
      subjectsObserved: 2,
      subjectsWithMetaTags: 2,
      subjectsPartial: 0,
      subjectsUnknown: 0,
      tagsObserved: 2,
      tagsValid: 2,
      tagsReturned: 2,
      tagsOmitted: 0,
      malformedTagValues: 0,
      textTruncatedTags: 0,
      truncatedSubjects: 0,
      truncated: false,
      maxTagsPerSubject: 32,
      maxTagCharacters: 96,
      responseLimitBytes: 1_048_576,
    },
  };
  const firstRow = result.rows[0];
  const secondRow = result.rows[1];
  if (!firstRow || !secondRow) throw new Error('Expected complete source rows.');
  Object.assign(firstRow, {
    origin: { state: 'explicit_original', metaTags: ['原创', '奇幻'] },
  });
  Object.assign(secondRow, { origin: { state: 'not_observed', metaTags: [] } });
  const detailOperation = result.sourceOperations[2];
  if (!detailOperation) throw new Error('Expected the subject detail source operation.');
  detailOperation.attempted = 2;
  detailOperation.succeeded = 2;
  detailOperation.failed = 0;
  return {
    ...result,
    summary: { ...result.summary, origin: summaryOrigin },
    coverage: completeCoverage,
  };
}

function calls(arguments_ = G04_EXPECTED_QUERY_ARGUMENTS) {
  return [{ name: toolName, state: 'DONE', arguments: arguments_ }];
}

describe('G04 bounded person-activity Agent/MCP answer checker', () => {
  it('matches a bounded observed count, returned rows, and all coverage counters', () => {
    const result = makeResult();
    const report = verifyG04PersonActivityAnswer(
      answerFor(result),
      G04_EXPECTED_QUERY_ARGUMENTS,
      { structuredContent: result },
      calls(),
      3000,
    );

    expect(report.passed).toBe(true);
    expect(Object.values(report.answerChecks).every(Boolean)).toBe(true);
    expect(report.answerCounters).toMatchObject({
      sourceRows: 2,
      answerRows: 2,
      rowsMatched: 2,
      missingRows: 0,
      extraRows: 0,
      coverageFieldsMatched: 27,
    });
    expect((report.resultSummary?.coverage as { truncated: boolean }).truncated).toBe(true);
    expect(JSON.stringify(report)).not.toMatch(/示例动画|Character A|主役|不是滚动365天/u);
  });

  it('requires a complete result to have complete, untruncated coverage', () => {
    const complete = makeCompleteResult();
    const accepted = verifyG04PersonActivityAnswer(
      answerFor(complete),
      G04_EXPECTED_QUERY_ARGUMENTS,
      { structuredContent: complete },
      calls(),
      3000,
    );
    expect(accepted.passed).toBe(true);

    const incompleteCases: Array<
      [string, (result: ReturnType<typeof makeCompleteResult>) => void]
    > = [
      [
        'relation rows were dropped',
        (result) => {
          result.coverage.relationRowsObserved = 3;
          result.coverage.relationRowsDroppedAtLimit = 1;
          result.coverage.truncated = true;
        },
      ],
      [
        'subject IDs were dropped',
        (result) => {
          result.coverage.subjectIdsObserved = 3;
          result.coverage.subjectIdsDroppedAtRelationLimit = 1;
        },
      ],
      [
        'subject details were skipped by the cap',
        (result) => {
          result.coverage.subjectIdsObserved = 3;
          result.coverage.subjectIdsSelected = 3;
          result.coverage.subjectDetailIdsObserved = 3;
          result.coverage.subjectDetailIdsDroppedAtLimit = 1;
          result.coverage.truncated = true;
        },
      ],
      [
        'a subject detail request failed',
        (result) => {
          result.coverage.subjectDetailsSucceeded = 1;
          result.coverage.subjectDetailsFailed = 1;
          const operation = result.sourceOperations[2];
          if (!operation) throw new Error('Expected the subject detail source operation.');
          operation.succeeded = 1;
          operation.failed = 1;
        },
      ],
      [
        'the result rows were output-truncated',
        (result) => {
          result.coverage.rowsEligible = 3;
          result.coverage.outputTruncated = true;
          result.coverage.truncated = true;
          result.summary.creditRows = 3;
        },
      ],
      [
        'a source row has no subject ID',
        (result) => {
          result.coverage.missingSubjectIdRows = 1;
        },
      ],
      [
        'a source row has no date',
        (result) => {
          result.coverage.missingDateRows = 1;
        },
      ],
      [
        'a source date is invalid',
        (result) => {
          result.coverage.invalidDateRows = 1;
        },
      ],
      [
        'the source media is unknown',
        (result) => {
          result.coverage.mediaUnknownRows = 1;
        },
      ],
      [
        'a returned role is unknown',
        (result) => {
          const row = result.rows[0];
          if (!row) throw new Error('Expected a person activity row.');
          row.roleFamily = 'unknown';
        },
      ],
      [
        'the source reports a partial warning',
        (result) => {
          result.warnings = [{ code: 'DETAILS_PARTIAL', state: 'partial', message: 'partial' }];
        },
      ],
      [
        'origin metadata coverage is partial',
        (result) => {
          result.coverage.origin.subjectsPartial = 1;
        },
      ],
      [
        'origin coverage is missing',
        (result) => {
          Reflect.deleteProperty(result.coverage, 'origin');
        },
      ],
      [
        'origin coverage has malformed counters',
        (result) => {
          Reflect.set(result.coverage.origin, 'tagsObserved', '2');
        },
      ],
      [
        'a complete row is missing its origin observation',
        (result) => {
          const row = result.rows[0];
          if (!row) throw new Error('Expected a person activity row.');
          Reflect.deleteProperty(row, 'origin');
        },
      ],
      [
        'a row origin observation contradicts its tags',
        (result) => {
          const row = result.rows[0] as Record<string, unknown> | undefined;
          if (!row || typeof row.origin !== 'object' || row.origin === null) {
            throw new Error('Expected a row origin observation.');
          }
          Reflect.set(row.origin, 'state', 'not_observed');
        },
      ],
      [
        'row-derived origin counts contradict both aggregates',
        (result) => {
          const row = result.rows[0] as Record<string, unknown> | undefined;
          if (!row || typeof row.origin !== 'object' || row.origin === null) {
            throw new Error('Expected a row origin observation.');
          }
          Reflect.set(row.origin, 'metaTags', ['奇幻']);
          Reflect.set(row.origin, 'state', 'not_observed');
        },
      ],
      [
        'the summary origin aggregate is missing',
        (result) => {
          Reflect.deleteProperty(result.summary, 'origin');
        },
      ],
      [
        'the summary origin aggregate is malformed',
        (result) => {
          Reflect.set(result.summary, 'origin', { explicitOriginalSubjects: '1' });
        },
      ],
      [
        'warnings are missing',
        (result) => {
          Reflect.deleteProperty(result, 'warnings');
        },
      ],
      [
        'warnings are not an array',
        (result) => {
          Reflect.set(result, 'warnings', 'none');
        },
      ],
      [
        'a warning is malformed',
        (result) => {
          Reflect.set(result, 'warnings', [{ code: 'BROKEN', message: 'missing state' }]);
        },
      ],
    ];

    for (const [label, makeIncomplete] of incompleteCases) {
      const result = makeCompleteResult();
      makeIncomplete(result);
      const report = verifyG04PersonActivityAnswer(
        answerFor(result),
        G04_EXPECTED_QUERY_ARGUMENTS,
        { structuredContent: result },
        calls(),
        3000,
      );
      expect(report.answerChecks.boundedCoverageConsistent, label).toBe(false);
    }
  });

  it('derives complete origin totals by unique subject rather than credit row', () => {
    const result = makeCompleteResult();
    const sourceRow = result.rows[0];
    if (!sourceRow) throw new Error('Expected a person activity row.');
    const duplicateSubjectRow = {
      ...sourceRow,
      relationId: 7003,
      characterName: 'Character C',
      origin: { state: 'explicit_original', metaTags: ['原创', '奇幻'] },
    };
    result.rows.push(duplicateSubjectRow);
    result.coverage.rowsEligible = 3;
    result.coverage.rowsReturned = 3;
    result.coverage.uniqueCharacters = 3;
    result.summary.creditRows = 3;
    result.summary.uniqueCharacters = 3;

    const report = verifyG04PersonActivityAnswer(
      answerFor(result),
      G04_EXPECTED_QUERY_ARGUMENTS,
      { structuredContent: result },
      calls(),
      3000,
    );
    expect(report.passed).toBe(true);
  });

  it('rejects changed arguments, duplicate/wrong rows, and omitted limits', () => {
    const result = makeResult();
    const answer = JSON.parse(answerFor(result));
    answer.rows[1].subjectId = answer.rows[0].subjectId;
    answer.coverage.subjectDetailRequests = 48;
    answer.caveat = '水濑祈过去12个月有完整作品总数，代表全部作品。';
    const report = verifyG04PersonActivityAnswer(
      JSON.stringify(answer),
      { ...G04_EXPECTED_QUERY_ARGUMENTS, maxRows: 10 },
      { structuredContent: result },
      calls({ ...G04_EXPECTED_QUERY_ARGUMENTS, maxRows: 10 }),
      3000,
    );

    expect(report.passed).toBe(false);
    expect(report.answerChecks.exactQueryArguments).toBe(false);
    expect(report.answerChecks.answerRowsMatch).toBe(false);
    expect(report.answerChecks.boundedCoverageConsistent).toBe(true);
    expect(report.answerChecks.caveatDisclosurePresent).toBe(false);
    expect(report.answerChecks.noUnsupportedPositiveClaim).toBe(false);
  });

  it('rejects unsupported English scope claims alongside the required Chinese caveats', () => {
    for (const claim of [
      'This is a complete career history.',
      'This is the lifetime total.',
      'The result proves actual workload.',
      'This is a rolling 365-day total.',
      'No other voice roles are present.',
      'All roles in her career are represented.',
      '没有其他配音作品。',
      '所有职业作品都已收录。',
    ]) {
      const result = makeResult();
      const answer = JSON.parse(answerFor(result));
      answer.caveat += ` ${claim}`;
      const report = verifyG04PersonActivityAnswer(
        JSON.stringify(answer),
        G04_EXPECTED_QUERY_ARGUMENTS,
        { structuredContent: result },
        calls(),
        2400,
      );
      expect(report.passed, claim).toBe(false);
    }
  });

  it('rejects any free-form caveat addition, including a locally negated phrase', () => {
    const result = makeResult();
    const answer = JSON.parse(answerFor(result));
    answer.caveat += ' This is not a complete career history.';
    const report = verifyG04PersonActivityAnswer(
      JSON.stringify(answer),
      G04_EXPECTED_QUERY_ARGUMENTS,
      { structuredContent: result },
      calls(),
      2400,
    );
    expect(report.passed).toBe(false);
    expect(report.answerChecks.caveatDisclosurePresent).toBe(false);
  });

  it('rejects English double negation that still asserts an unsupported claim', () => {
    const result = makeResult();
    const answer = JSON.parse(answerFor(result));
    answer.caveat += " It isn't not a complete career history.";
    const report = verifyG04PersonActivityAnswer(
      JSON.stringify(answer),
      G04_EXPECTED_QUERY_ARGUMENTS,
      { structuredContent: result },
      calls(),
      2400,
    );
    expect(report.passed).toBe(false);
    expect(report.answerChecks.noUnsupportedPositiveClaim).toBe(false);
  });

  it('rejects absent structured readback, an incorrect calendar window, and text over the cap', () => {
    const result = makeResult();
    const wrongWindow = { ...result, window: { ...window, start: '2025-10-01' } };
    const report = verifyG04PersonActivityAnswer(
      answerFor(result),
      G04_EXPECTED_QUERY_ARGUMENTS,
      { content: [{ type: 'text', text: JSON.stringify(wrongWindow) }] },
      calls(),
      3601,
    );

    expect(report.passed).toBe(false);
    expect(report.answerChecks.structuredResultReadback).toBe(false);
    expect(report.answerChecks.calendarWindowValid).toBe(false);
    expect(report.answerChecks.boundedMcpTextView).toBe(false);
  });

  it('rejects an unexpected source operation in the structured result', () => {
    const result = makeResult();
    result.sourceOperations.push({
      operation: 'GET /v0/private-or-unexpected-route',
      attempted: 1,
      succeeded: 1,
      failed: 0,
    });
    const report = verifyG04PersonActivityAnswer(
      answerFor(makeResult()),
      G04_EXPECTED_QUERY_ARGUMENTS,
      { structuredContent: result },
      calls(),
      3000,
    );

    expect(report.passed).toBe(false);
    expect(report.answerChecks.successfulOfficialSources).toBe(false);
  });

  it('rejects an oversized plain-text answer', () => {
    const result = makeResult();
    const answer = JSON.parse(answerFor(result));
    answer.caveat = `${answer.caveat}${'。'.repeat(5000)}`;
    const report = verifyG04PersonActivityAnswer(
      JSON.stringify(answer),
      G04_EXPECTED_QUERY_ARGUMENTS,
      { structuredContent: result },
      calls(),
      3000,
    );

    expect(report.passed).toBe(false);
    expect(report.answerChecks.boundedAnswerBytes).toBe(false);
  });

  it('supports an empty partial observation without treating it as proof of no activity', () => {
    const result = makeResult();
    result.rows = [];
    result.summary = { creditRows: 0, uniqueSubjects: 0, uniqueCharacters: 0 };
    result.coverage = {
      ...coverage,
      rowsEligible: 0,
      rowsReturned: 0,
      uniqueSubjects: 0,
      uniqueCharacters: 0,
    };
    const answer = JSON.parse(answerFor(makeResult()));
    answer.observedUniqueWorks = 0;
    answer.summary = result.summary;
    answer.coverage = result.coverage;
    answer.rows = [];
    answer.caveat = G04_REQUIRED_CAVEAT;
    const report = verifyG04PersonActivityAnswer(
      JSON.stringify(answer),
      G04_EXPECTED_QUERY_ARGUMENTS,
      { structuredContent: result },
      calls(),
      2400,
    );

    expect(report.passed).toBe(true);
    expect(report.resultSummary?.rowCount).toBe(0);
  });
});
