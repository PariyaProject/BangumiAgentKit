import { describe, expect, it } from 'vitest';
import {
  G04_EXPECTED_QUERY_ARGUMENTS,
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
    summary: result.summary,
    coverage,
    rows: [
      {
        subjectId: 3001,
        title: '示例动画甲',
        firstAirDate: '2026-04-01',
        month: '2026-04',
        relationId: 7001,
        characterName: 'Character A',
        rawRole: '主役',
        roleFamily: 'main',
      },
      {
        subjectId: 3002,
        title: '示例动画乙',
        firstAirDate: '2025-12-01',
        month: '2025-12',
        relationId: 7002,
        characterName: 'Character B',
        rawRole: '配角',
        roleFamily: 'support',
      },
    ],
    caveat:
      '本次有界观察只表示当前官方关系和已成功读取作品详情的样本，不代表全部作品；时间按作品首播日期归入12个日历月，不是滚动365天。未返回作品不等于不存在，也不是实际配音时间或工作量；没有历史快照，不能说明历史趋势。',
  });
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

  it('allows an explicit English negation near an unsupported-scope phrase', () => {
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
    expect(report.passed).toBe(true);
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
    answer.caveat =
      '本次有界观察返回零个可判定作品，不代表全部作品为零；時間按作品首播日期归入12个日历月，不是滚动365天。未返回作品不等于不存在，也不是实际配音时间；没有历史快照。';
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
