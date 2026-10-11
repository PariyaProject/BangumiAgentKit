import { describe, expect, it } from 'vitest';
import {
  G05_COVERAGE_FIELDS,
  G05_EXPECTED_QUERY_ARGUMENTS,
  verifyG05PersonActivityComparisonAnswer,
} from '../../scripts/acceptance/g05-person-activity-comparison-answer-check.mjs';

function sixMonthWindow(end: string) {
  const endDate = new Date(`${end}T00:00:00.000Z`);
  const start = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() - 5, 1))
    .toISOString().slice(0, 10);
  const monthKeys = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() - 5 + index, 1));
    return month.toISOString().slice(0, 7);
  });
  return { months: 6, start, end, monthKeys, asOfSemantics: 'calendar_months_ending_on_as_of_date' };
}

function coverage(rows: number, uniqueSubjects: number, uniqueCharacters: number) {
  const value: Record<string, number | boolean> = {
    relationRowsObserved: rows,
    relationRowsSelected: rows,
    relationRowsDroppedAtLimit: 0,
    subjectIdsObserved: rows,
    subjectIdsSelected: rows,
    subjectIdsDroppedAtRelationLimit: 0,
    subjectDetailIdsObserved: rows,
    subjectDetailRequests: rows,
    subjectDetailsSucceeded: rows,
    subjectDetailsFailed: 0,
    subjectDetailIdsDroppedAtLimit: 0,
    rowsEligible: rows,
    rowsReturned: rows,
    outputTruncated: false,
    uniqueSubjects,
    uniqueCharacters,
    missingSubjectIdRows: 0,
    missingDateRows: 0,
    invalidDateRows: 0,
    outsideWindowRows: 0,
    mediaExcludedRows: 0,
    mediaUnknownRows: 0,
    maxRelations: 48,
    maxSubjectDetails: 12,
    maxRows: 20,
    responseLimitBytes: 1_048_576,
    truncated: false,
  };
  return Object.fromEntries(G05_COVERAGE_FIELDS.map((field) => [field, value[field]]));
}

function month(month: string, subjects: number) {
  return {
    month,
    creditRows: subjects,
    uniqueSubjects: subjects,
    uniqueCharacters: subjects,
  };
}

function sixMonthBuckets(window: ReturnType<typeof sixMonthWindow>, activeMonth: string, subjects: number) {
  return window.monthKeys.map((monthKey) => month(monthKey, monthKey === activeMonth ? subjects : 0));
}

function windowSummary(creditRows: number, byMonth: ReturnType<typeof month>[]) {
  return {
    creditRows,
    uniqueSubjects: creditRows,
    uniqueCharacters: creditRows,
    byMonth,
  };
}

function sourceOperations(details: number) {
  return [
    { operation: 'GET /v0/persons/{person_id}', attempted: 1, succeeded: 1, failed: 0 },
    { operation: 'GET /v0/persons/{person_id}/characters', attempted: 1, succeeded: 1, failed: 0 },
    { operation: 'GET /v0/subjects/{subject_id}', attempted: details, succeeded: details, failed: 0 },
  ];
}

function fixture() {
  const recentWindow = sixMonthWindow('2026-10-11');
  const previousWindow = sixMonthWindow('2026-04-30');
  const recentCoverage = coverage(1, 1, 1);
  const previousCoverage = coverage(2, 2, 2);
  const recentSummary = windowSummary(1, sixMonthBuckets(recentWindow, '2026-05', 1));
  const previousSummary = windowSummary(2, sixMonthBuckets(previousWindow, '2026-04', 2));
  const row = {
    subjectId: 123,
    subjectNameCn: '测试动画',
    subjectName: 'Test Anime',
    firstAirDate: '2026-05-01',
    month: '2026-05',
    relationKind: 'voice',
    relationId: 7,
    characterName: '角色甲',
    rawRole: '主役',
    roleFamily: 'main',
  };
  const result = {
    personId: G05_EXPECTED_QUERY_ARGUMENTS.personId,
    kind: 'voice',
    media: 'tv',
    state: 'partial',
    window: recentWindow,
    summary: recentSummary,
    rows: [row],
    coverage: recentCoverage,
    sourceOperations: sourceOperations(1),
    comparison: {
      state: 'partial',
      windowMonths: 6,
      recent: {
        window: recentWindow,
        summary: recentSummary,
        state: 'partial',
        coverage: recentCoverage,
        exclusions: [],
      },
      previous: {
        window: previousWindow,
        summary: previousSummary,
        state: 'partial',
        coverage: previousCoverage,
        exclusions: [],
      },
      delta: { state: 'partial', creditRows: -1, uniqueSubjects: -1, uniqueCharacters: -1 },
      peak: {
        metric: 'uniqueSubjects',
        state: 'partial',
        months: [{ period: 'previous', ...month('2026-04', 2) }],
      },
      sourceOperations: { recent: sourceOperations(1), previous: sourceOperations(2) },
    },
  };
  const coverageProjection = (value: Record<string, unknown>) =>
    Object.fromEntries(G05_COVERAGE_FIELDS.map((field) => [field, value[field]]));
  const answer = {
    personId: result.personId,
    kind: result.kind,
    media: result.media,
    state: result.state,
    window: recentWindow,
    summary: recentSummary,
    coverage: coverageProjection(recentCoverage),
    rows: [{
      subjectId: row.subjectId,
      title: row.subjectNameCn,
      firstAirDate: row.firstAirDate,
      month: row.month,
      relationId: row.relationId,
      characterName: row.characterName,
      rawRole: row.rawRole,
      roleFamily: row.roleFamily,
    }],
    comparison: {
      state: 'partial',
      windowMonths: 6,
      recent: {
        state: 'partial', window: recentWindow, summary: recentSummary,
        coverage: coverageProjection(recentCoverage),
      },
      previous: {
        state: 'partial', window: previousWindow, summary: previousSummary,
        coverage: coverageProjection(previousCoverage),
      },
      delta: result.comparison.delta,
      peak: result.comparison.peak,
    },
    caveat: '本次有界观察根据当前官方关系及作品首播日期，覆盖前后两个六个日历月窗口；差值仅代表本次覆盖，未观察数据不等于零，不代表完整职业生涯，不是实际工作量，也没有历史快照。',
  };
  return { result, answer };
}

function verify(result: unknown, answer: unknown) {
  return verifyG05PersonActivityComparisonAnswer(
    JSON.stringify(answer),
    G05_EXPECTED_QUERY_ARGUMENTS,
    { structuredContent: result },
    [{ name: 'bangumi.get_person_activity', state: 'DONE', arguments: G05_EXPECTED_QUERY_ARGUMENTS }],
    3218,
  );
}

describe('G05 bounded person activity comparison answer checker', () => {
  it('matches one exact current-source result while preserving both partial windows', () => {
    const { result, answer } = fixture();
    const checked = verify(result, answer);
    expect(checked.passed).toBe(true);
    expect(Object.values(checked.answerChecks).every(Boolean)).toBe(true);
    expect(checked.resultSummary).toMatchObject({
      personId: 13684,
      comparisonState: 'partial',
      recent: { state: 'partial', summary: { creditRows: 1, uniqueSubjects: 1 } },
      previous: { state: 'partial', summary: { creditRows: 2, uniqueSubjects: 2 } },
      peak: { state: 'partial', months: [{ period: 'previous', month: '2026-04', uniqueSubjects: 2 }] },
    });
    expect('answer' in checked.resultSummary!).toBe(false);
    expect('rows' in checked.resultSummary!).toBe(false);
  });

  it('rejects an incorrect row, positive workload claim, or extra answer field', () => {
    const { result, answer } = fixture();
    const wrongRow = structuredClone(answer);
    const wrongFirstRow = wrongRow.rows[0];
    if (!wrongFirstRow) throw new Error('Expected the fixture answer row.');
    wrongFirstRow.title = '不匹配标题';
    expect(verify(result, wrongRow).answerChecks.answerRowsMatch).toBe(false);

    const falseClaim = structuredClone(answer);
    falseClaim.caveat = '本次有界观察显示实际工作量增加；这不是实际工作量结论，也没有历史快照。覆盖不代表完整职业生涯。';
    expect(verify(result, falseClaim).answerChecks.noUnsupportedPositiveClaim).toBe(false);

    const extra = { ...answer, answer: 'raw text' };
    expect(verify(result, extra).answerChecks.answerShapeValid).toBe(false);
  });

  it('rejects a discontinuous previous window and a detail count over the fixed cap', () => {
    const { result, answer } = fixture();
    const gap = structuredClone(result);
    gap.comparison.previous.window = sixMonthWindow('2026-04-29');
    expect(verify(gap, answer).answerChecks.comparisonInternallyConsistent).toBe(false);

    const overCap = structuredClone(result);
    overCap.coverage.subjectDetailRequests = 13;
    overCap.coverage.subjectDetailsSucceeded = 13;
    overCap.comparison.recent.coverage = overCap.coverage;
    overCap.comparison.sourceOperations.recent = sourceOperations(13);
    expect(verify(overCap, answer).answerChecks.boundedCoverageConsistent).toBe(false);
  });

  it('rejects incomplete monthly buckets and monthly credit totals that disagree with the period', () => {
    const { result, answer } = fixture();
    const missingMonth = structuredClone(result);
    missingMonth.comparison.recent.summary.byMonth.pop();
    expect(verify(missingMonth, answer).answerChecks.comparisonInternallyConsistent).toBe(false);

    const wrongMonthlyTotal = structuredClone(result);
    const recentBuckets = wrongMonthlyTotal.comparison.recent.summary.byMonth;
    const activeMonth = recentBuckets.find((item) => item.month === '2026-05');
    if (!activeMonth) throw new Error('Expected the fixture activity month.');
    activeMonth.creditRows = 0;
    expect(verify(wrongMonthlyTotal, answer).answerChecks.comparisonInternallyConsistent).toBe(false);
  });

  it('rejects impossible subject, detail-request, and eligible-row coverage counts', () => {
    const { result, answer } = fixture();

    const tooManySubjects = structuredClone(result);
    tooManySubjects.coverage.subjectIdsObserved = 2;
    tooManySubjects.coverage.subjectIdsDroppedAtRelationLimit = 1;
    expect(verify(tooManySubjects, answer).answerChecks.boundedCoverageConsistent).toBe(false);

    const tooManySelectedSubjects = structuredClone(result);
    tooManySelectedSubjects.coverage.relationRowsObserved = 2;
    tooManySelectedSubjects.coverage.relationRowsDroppedAtLimit = 1;
    tooManySelectedSubjects.coverage.subjectIdsObserved = 2;
    tooManySelectedSubjects.coverage.subjectIdsSelected = 2;
    tooManySelectedSubjects.coverage.subjectDetailIdsObserved = 2;
    tooManySelectedSubjects.coverage.subjectDetailRequests = 2;
    tooManySelectedSubjects.coverage.subjectDetailsSucceeded = 2;
    tooManySelectedSubjects.sourceOperations = sourceOperations(2);
    tooManySelectedSubjects.comparison.sourceOperations.recent = sourceOperations(2);
    expect(verify(tooManySelectedSubjects, answer).answerChecks.boundedCoverageConsistent).toBe(false);

    const tooManyDetailRequests = structuredClone(result);
    tooManyDetailRequests.coverage.subjectDetailRequests = 2;
    tooManyDetailRequests.coverage.subjectDetailsSucceeded = 2;
    tooManyDetailRequests.sourceOperations = sourceOperations(2);
    tooManyDetailRequests.comparison.sourceOperations.recent = sourceOperations(2);
    expect(verify(tooManyDetailRequests, answer).answerChecks.boundedCoverageConsistent).toBe(false);

    const tooManyEligibleRows = structuredClone(result);
    tooManyEligibleRows.coverage.rowsEligible = 2;
    tooManyEligibleRows.coverage.outputTruncated = true;
    tooManyEligibleRows.coverage.truncated = true;
    tooManyEligibleRows.summary.creditRows = 2;
    const activeMonth = tooManyEligibleRows.summary.byMonth.find((item) => item.month === '2026-05');
    if (!activeMonth) throw new Error('Expected the fixture activity month.');
    activeMonth.creditRows = 2;
    tooManyEligibleRows.comparison.delta.creditRows = 0;
    expect(verify(tooManyEligibleRows, answer).answerChecks.boundedCoverageConsistent).toBe(false);
  });
});
