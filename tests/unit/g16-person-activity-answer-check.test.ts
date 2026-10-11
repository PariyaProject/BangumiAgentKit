import { describe, expect, it } from 'vitest';
import {
  G16_EXPECTED_QUERY_ARGUMENTS,
  verifyG16PersonActivityAnswer,
} from '../../scripts/acceptance/g16-person-activity-answer-check.mjs';

const toolName = 'bangumi.get_person_activity';
const window = {
  months: 36,
  start: '2023-11-01',
  end: '2026-10-11',
  monthKeys: Array.from({ length: 36 }, (_, index) => {
    const month = new Date(Date.UTC(2023, 10 + index, 1));
    return month.toISOString().slice(0, 7);
  }),
  asOfSemantics: 'calendar_months_ending_on_as_of_date',
};
const coverage = {
  relationRowsObserved: 60,
  relationRowsSelected: 48,
  relationRowsDroppedAtLimit: 4,
  subjectIdsObserved: 52,
  subjectIdsSelected: 48,
  subjectIdsDroppedAtRelationLimit: 4,
  subjectDetailIdsObserved: 48,
  subjectDetailRequests: 16,
  subjectDetailsSucceeded: 16,
  subjectDetailsFailed: 0,
  subjectDetailIdsDroppedAtLimit: 32,
  rowsEligible: 2,
  rowsReturned: 2,
  outputTruncated: false,
  uniqueSubjects: 2,
  uniqueCharacters: 0,
  missingSubjectIdRows: 0,
  missingDateRows: 1,
  invalidDateRows: 0,
  outsideWindowRows: 32,
  mediaExcludedRows: 7,
  mediaUnknownRows: 1,
  staffRoleExcludedRows: 8,
  staffRoleUnknownRows: 2,
  maxRelations: 48,
  maxSubjectDetails: 16,
  maxRows: 20,
  responseLimitBytes: 1_048_576,
  truncated: true,
  retrievedAt: '2026-10-11T09:00:00.000Z',
};

function makeResult() {
  return {
    personId: 6154,
    state: 'partial',
    kind: 'staff',
    staffRole: 'director',
    media: 'tv',
    window: structuredClone(window),
    rows: [
      {
        subjectId: 3001,
        relationId: 3001,
        subjectName: 'Example TV A',
        subjectNameCn: '示例动画甲',
        subjectType: 'anime',
        platform: 'TV',
        firstAirDate: '2026-04-01',
        month: '2026-04',
        relationKind: 'staff',
        rawRole: '导演',
        roleFamily: 'staff',
      },
      {
        subjectId: 3002,
        relationId: 3002,
        subjectName: 'Example TV B',
        subjectNameCn: '示例动画乙',
        subjectType: 'anime',
        platform: 'Television',
        firstAirDate: '2025-12-01',
        month: '2025-12',
        relationKind: 'staff',
        rawRole: '監督',
        roleFamily: 'staff',
      },
    ],
    summary: { creditRows: 2, uniqueSubjects: 2, uniqueCharacters: 0 },
    coverage: structuredClone(coverage),
    sourceOperations: [
      { operation: 'GET /v0/persons/{person_id}', attempted: 1, succeeded: 1, failed: 0 },
      { operation: 'GET /v0/persons/{person_id}/subjects', attempted: 1, succeeded: 1, failed: 0 },
      { operation: 'GET /v0/subjects/{subject_id}', attempted: 16, succeeded: 16, failed: 0 },
    ],
  };
}

function answerFor(result: ReturnType<typeof makeResult>) {
  const answerCoverage = { ...result.coverage };
  delete (answerCoverage as Partial<typeof answerCoverage>).retrievedAt;
  return JSON.stringify({
    personId: result.personId,
    kind: result.kind,
    staffRole: result.staffRole,
    media: result.media,
    window: result.window,
    state: result.state,
    observedUniqueWorks: result.summary.uniqueSubjects,
    summary: result.summary,
    coverage: answerCoverage,
    rows: result.rows.map((row) => ({
      subjectId: row.subjectId,
      title: row.subjectNameCn || row.subjectName,
      firstAirDate: row.firstAirDate,
      month: row.month,
      relationId: row.relationId,
      rawRole: row.rawRole,
      roleFamily: row.roleFamily,
    })),
    caveat: '本次有界观察只表示当前官方关系和已成功读取作品详情的样本，不代表全部作品；按作品首播日期归入36个日历月，不是滚动三年。未返回作品不等于不存在；未知职位标签会保留为未知，不匹配职位不是不存在，也不是完整导演履历。没有历史快照。',
  });
}

const ENGLISH_G16_CAVEAT = 'This is a bounded current-response observation; the window uses first_air_date and 36 calendar months, not a rolling three years; unreturned works do not prove absence; missing or nonmatching role labels do not prove there are no director works; this is not a complete director filmography; no historical snapshot exists.';

function calls(arguments_ = G16_EXPECTED_QUERY_ARGUMENTS) {
  return [{ name: toolName, state: 'DONE', arguments: arguments_ }];
}

describe('G16 bounded director person-activity Agent/MCP answer checker', () => {
  it('matches exact current-source director rows and the complete bounded coverage projection', () => {
    const result = makeResult();
    const checked = verifyG16PersonActivityAnswer(
      answerFor(result), G16_EXPECTED_QUERY_ARGUMENTS,
      { structuredContent: result }, calls(), 3000,
    );

    expect(checked.passed).toBe(true);
    expect(Object.values(checked.answerChecks).every(Boolean)).toBe(true);
    expect(checked.answerCounters).toMatchObject({
      sourceRows: 2,
      answerRows: 2,
      rowsMatched: 2,
      missingRows: 0,
      extraRows: 0,
      coverageFieldsMatched: 29,
    });
    expect(checked.resultSummary?.coverage).toMatchObject({
      staffRoleExcludedRows: 8,
      staffRoleUnknownRows: 2,
      truncated: true,
    });
    expect(JSON.stringify(checked)).not.toContain('示例动画');
    expect(JSON.stringify(checked)).not.toContain('导演');
  });

  it('rejects altered query arguments, an extra row, and a role label outside the exact allow-list', () => {
    const result = makeResult();
    const answer = JSON.parse(answerFor(result));
    answer.rows[0].rawRole = '副导演';
    answer.rows.push({ ...answer.rows[0], subjectId: 9999, relationId: 9999 });
    const checked = verifyG16PersonActivityAnswer(
      JSON.stringify(answer), { ...G16_EXPECTED_QUERY_ARGUMENTS, maxRows: 19 },
      { structuredContent: result }, calls({ ...G16_EXPECTED_QUERY_ARGUMENTS, maxRows: 19 }), 3000,
    );

    expect(checked.passed).toBe(false);
    expect(checked.answerChecks.exactQueryArguments).toBe(false);
    expect(checked.answerChecks.sourceRowsValid).toBe(true);
    expect(checked.answerChecks.answerRowsMatch).toBe(false);
    expect(checked.answerChecks.caveatDisclosurePresent).toBe(true);
  });

  it('rejects impossible exclusion, unknown-role, relation-cap, and character-count relationships', () => {
    const result = makeResult();
    result.coverage.staffRoleUnknownRows = result.coverage.staffRoleExcludedRows + 1;
    result.coverage.relationRowsObserved += 1;
    result.summary.uniqueCharacters = 1;
    result.coverage.uniqueCharacters = 1;
    const answer = JSON.parse(answerFor(result));
    answer.coverage = result.coverage;
    answer.summary = result.summary;
    const checked = verifyG16PersonActivityAnswer(
      JSON.stringify(answer), G16_EXPECTED_QUERY_ARGUMENTS,
      { structuredContent: result }, calls(), 3000,
    );

    expect(checked.passed).toBe(false);
    expect(checked.answerChecks.boundedCoverageConsistent).toBe(false);
  });

  it('rejects incomplete windows, failed official source operations, unsupported total claims, and unbounded text', () => {
    const result = makeResult();
    const answer = JSON.parse(answerFor(result));
    answer.caveat += ' This is the complete director filmography.';
    const invalidWindow = { ...result, window: { ...window, start: '2023-10-01' } };
    const invalidSources = makeResult();
    invalidSources.sourceOperations[1]!.failed = 1;
    const checked = verifyG16PersonActivityAnswer(
      JSON.stringify(answer).padEnd(16_385, ' '), G16_EXPECTED_QUERY_ARGUMENTS,
      { structuredContent: invalidWindow }, calls(), 3601,
    );
    const sourceChecked = verifyG16PersonActivityAnswer(
      answerFor(result), G16_EXPECTED_QUERY_ARGUMENTS,
      { structuredContent: invalidSources }, calls(), 3000,
    );

    expect(checked.passed).toBe(false);
    expect(checked.answerChecks.calendarWindowValid).toBe(false);
    expect(checked.answerChecks.noUnsupportedPositiveClaim).toBe(false);
    expect(checked.answerChecks.boundedAnswerBytes).toBe(false);
    expect(checked.answerChecks.boundedMcpTextView).toBe(false);
    expect(sourceChecked.answerChecks.successfulOfficialSources).toBe(false);
  });

  it('rejects missing structured readback and markdown wrappers', () => {
    const result = makeResult();
    const checked = verifyG16PersonActivityAnswer(
      `\`\`\`json\n${answerFor(result)}\n\`\`\``, G16_EXPECTED_QUERY_ARGUMENTS,
      { content: [{ type: 'text', text: JSON.stringify(result) }] }, calls(), 2400,
    );

    expect(checked.passed).toBe(false);
    expect(checked.answerChecks.structuredResultReadback).toBe(false);
    expect(checked.answerChecks.plainJsonWithoutMarkdown).toBe(false);
  });

  it('accepts the complete bounded caveat in English as well as Chinese', () => {
    const result = makeResult();
    const answer = JSON.parse(answerFor(result));
    answer.caveat = ENGLISH_G16_CAVEAT;
    const checked = verifyG16PersonActivityAnswer(
      JSON.stringify(answer), G16_EXPECTED_QUERY_ARGUMENTS,
      { structuredContent: result }, calls(), 3000,
    );

    expect(checked.passed).toBe(true);
    expect(checked.answerChecks.caveatDisclosurePresent).toBe(true);
  });

  it('still rejects an English caveat that omits any required uncertainty boundary', () => {
    const result = makeResult();
    const answer = JSON.parse(answerFor(result));
    answer.caveat = ENGLISH_G16_CAVEAT.replace('unreturned works do not prove absence; ', '');
    const checked = verifyG16PersonActivityAnswer(
      JSON.stringify(answer), G16_EXPECTED_QUERY_ARGUMENTS,
      { structuredContent: result }, calls(), 3000,
    );

    expect(checked.passed).toBe(false);
    expect(checked.answerChecks.caveatDisclosurePresent).toBe(false);
  });
});
