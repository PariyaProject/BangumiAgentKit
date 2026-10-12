import { describe, expect, it } from 'vitest';
import {
  P01_COVERAGE_FIELDS,
  P01_EXPECTED_QUERY_ARGUMENTS,
  verifyP01PersonPositionAnswer,
} from '../../scripts/acceptance/p01-person-position-answer-check.mjs';

const CAVEAT =
  '本次只统计当前官方人物关系和已成功读取的动画作品样本，时间窗为36个日历月，不代表完整生涯。频次只按本次返回行中的完全相同官方职位标签计算；缺失或未知标签单列，关系、详情或输出上限会使观察保持部分。未返回的作品或职位不等于不存在，也没有历史快照。';
const toolName = 'bangumi.get_person_activity';

function makeWindow(end = '2026-10-11') {
  const year = Number(end.slice(0, 4));
  const month = Number(end.slice(5, 7));
  const finalMonth = year * 12 + month - 1;
  const startMonth = finalMonth - 35;
  const startYear = Math.floor(startMonth / 12);
  const firstMonth = (((startMonth % 12) + 12) % 12) + 1;
  const start = `${startYear}-${String(firstMonth).padStart(2, '0')}-01`;
  const monthKeys = Array.from({ length: 36 }, (_, offset) => {
    const index = startMonth + offset;
    const itemYear = Math.floor(index / 12);
    const itemMonth = (((index % 12) + 12) % 12) + 1;
    return `${itemYear}-${String(itemMonth).padStart(2, '0')}`;
  });
  return {
    months: 36,
    start,
    end,
    monthKeys,
    asOfSemantics: 'calendar_months_ending_on_as_of_date',
  };
}

function makeRow(subjectId: number, rawRole: string | null, firstAirDate = '2025-06-01') {
  return {
    subjectId,
    relationId: subjectId,
    subjectName: `Example ${subjectId}`,
    subjectNameCn: `示例作品${subjectId}`,
    subjectType: 'anime',
    platform: 'TV',
    firstAirDate,
    month: firstAirDate.slice(0, 7),
    relationKind: 'staff',
    ...(rawRole === null ? {} : { rawRole }),
    roleFamily: rawRole === null ? 'unknown' : 'staff',
  };
}

function makeResult() {
  const rows = [
    makeRow(3001, '演出'),
    makeRow(3002, '演出'),
    makeRow(3003, '脚本'),
    makeRow(3004, null),
  ];
  const coverage = {
    relationRowsObserved: 4,
    relationRowsSelected: 4,
    relationRowsDroppedAtLimit: 0,
    relationSelectionStrategy: 'all',
    sampled: false,
    subjectIdsObserved: 4,
    subjectIdsSelected: 4,
    subjectIdsDroppedAtRelationLimit: 0,
    subjectDetailIdsObserved: 4,
    subjectDetailRequests: 4,
    subjectDetailsSucceeded: 4,
    subjectDetailsFailed: 0,
    subjectDetailIdsDroppedAtLimit: 0,
    rowsEligible: 4,
    rowsReturned: 4,
    outputTruncated: false,
    uniqueSubjects: 4,
    uniqueCharacters: 0,
    missingSubjectIdRows: 0,
    missingDateRows: 0,
    invalidDateRows: 0,
    outsideWindowRows: 0,
    mediaExcludedRows: 0,
    mediaUnknownRows: 0,
    staffRoleExcludedRows: 0,
    staffRoleUnknownRows: 0,
    maxRelations: 48,
    maxSubjectDetails: 16,
    maxRows: 8,
    detailConcurrency: 4,
    responseLimitBytes: 1_048_576,
    truncated: false,
    retrievedAt: '2026-10-11T10:00:00.000Z',
  };
  return {
    personId: P01_EXPECTED_QUERY_ARGUMENTS.personId,
    state: 'partial',
    person: { id: P01_EXPECTED_QUERY_ARGUMENTS.personId, name: 'Public Example' },
    kind: 'staff',
    media: 'anime',
    window: makeWindow(),
    rows,
    summary: { creditRows: 4, uniqueSubjects: 4, uniqueCharacters: 0 },
    coverage,
    sourceOperations: [
      { operation: 'GET /v0/persons/{person_id}', attempted: 1, succeeded: 1, failed: 0 },
      { operation: 'GET /v0/persons/{person_id}/subjects', attempted: 1, succeeded: 1, failed: 0 },
      { operation: 'GET /v0/subjects/{subject_id}', attempted: 4, succeeded: 4, failed: 0 },
    ],
  };
}

function projectRow(row: ReturnType<typeof makeRow>) {
  return {
    subjectId: row.subjectId,
    title: row.subjectNameCn || row.subjectName,
    firstAirDate: row.firstAirDate,
    month: row.month,
    relationId: row.relationId,
    rawRole: row.rawRole ?? null,
    roleFamily: row.roleFamily,
  };
}

function projectCoverage(coverage: ReturnType<typeof makeResult>['coverage']) {
  return Object.fromEntries(
    P01_COVERAGE_FIELDS.map((key) => [key, coverage[key as keyof typeof coverage]]),
  );
}

function answerFor(result: ReturnType<typeof makeResult>) {
  const labels = new Map<string, number>();
  let unknownRoleRows = 0;
  for (const row of result.rows) {
    if (!row.rawRole?.trim()) unknownRoleRows += 1;
    else labels.set(row.rawRole, (labels.get(row.rawRole) ?? 0) + 1);
  }
  const roleFrequency = [...labels.entries()]
    .map(([rawRole, count]) => ({ rawRole, count }))
    .sort((left, right) => right.count - left.count || (left.rawRole < right.rawRole ? -1 : 1));
  return {
    personId: result.personId,
    kind: result.kind,
    media: result.media,
    state: result.state,
    window: result.window,
    summary: result.summary,
    roleFrequency,
    unknownRoleRows,
    coverage: projectCoverage(result.coverage),
    rows: result.rows.map(projectRow),
    caveat: CAVEAT,
  };
}

function verify(
  result = makeResult(),
  answer = answerFor(result),
  options: {
    queryArguments?: unknown;
    toolOutput?: unknown;
    toolCalls?: unknown;
    toolTextUtf8Bytes?: number;
  } = {},
) {
  return verifyP01PersonPositionAnswer(
    JSON.stringify(answer),
    options.queryArguments ?? P01_EXPECTED_QUERY_ARGUMENTS,
    options.toolOutput ?? { structuredContent: result },
    options.toolCalls ?? [
      {
        name: toolName,
        state: 'DONE',
        arguments: P01_EXPECTED_QUERY_ARGUMENTS,
      },
    ],
    options.toolTextUtf8Bytes ?? 1400,
  );
}

describe('P01 person-position answer checker', () => {
  it('accepts exact role frequencies and rows from the same bounded source result', () => {
    const result = makeResult();
    const verification = verify(result);
    expect(verification.passed, JSON.stringify(verification.answerChecks)).toBe(true);
    expect(verification.answerCounters).toMatchObject({
      sourceRows: 4,
      answerRows: 4,
      sourceRoleLabels: 2,
      knownRoleRows: 3,
      unknownRoleRows: 1,
    });
    expect(verification.resultSummary?.sourceRowDigest).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('keeps tied raw role labels separate and lexically ordered', () => {
    const result = makeResult();
    result.rows[0]!.rawRole = '演出';
    result.rows[1]!.rawRole = '脚本';
    result.rows[2]!.rawRole = '原案';
    const answer = answerFor(result);

    expect(answer.roleFrequency).toEqual([
      { rawRole: '原案', count: 1 },
      { rawRole: '演出', count: 1 },
      { rawRole: '脚本', count: 1 },
    ]);
    expect(verify(result, answer).answerChecks.answerRoleFrequencyMatches).toBe(true);

    answer.roleFrequency.reverse();
    expect(verify(result, answer).answerChecks.answerRoleFrequencyMatches).toBe(false);
  });

  it('rejects a role frequency that is not computed from the returned rows', () => {
    const result = makeResult();
    const answer = answerFor(result);
    answer.roleFrequency[0]!.count = 3;
    expect(verify(result, answer).answerChecks.answerRoleFrequencyMatches).toBe(false);
  });

  it('keeps missing or blank raw role labels in the unknown count', () => {
    const result = makeResult();
    const answer = answerFor(result);
    answer.unknownRoleRows = 0;
    expect(verify(result, answer).answerChecks.answerUnknownRoleRowsMatch).toBe(false);
  });

  it('fails closed on a malformed raw role without throwing', () => {
    const result = makeResult();
    const answer = answerFor(result);
    Object.assign(result.rows[0]!, { rawRole: 42, roleFamily: 'unknown' });
    result.state = 'partial';
    const verification = verify(result, answer);
    expect(verification.passed).toBe(false);
    expect(verification.answerChecks.sourceRowsValid).toBe(false);
  });

  it('rejects a row, label, or count that does not match the source result', () => {
    const result = makeResult();
    const answer = answerFor(result);
    answer.rows[0]!.rawRole = '監督';
    expect(verify(result, answer).answerChecks.answerRowsMatch).toBe(false);
  });

  it('accepts a capped partial sample only with internally consistent coverage', () => {
    const result = makeResult();
    result.state = 'partial';
    result.coverage = {
      ...result.coverage,
      relationRowsObserved: 60,
      relationRowsSelected: 48,
      relationRowsDroppedAtLimit: 12,
      relationSelectionStrategy: 'deterministic_even_spread',
      sampled: true,
      subjectIdsObserved: 52,
      subjectIdsSelected: 48,
      subjectIdsDroppedAtRelationLimit: 4,
      subjectDetailIdsObserved: 48,
      subjectDetailRequests: 16,
      subjectDetailsSucceeded: 15,
      subjectDetailsFailed: 1,
      subjectDetailIdsDroppedAtLimit: 32,
      rowsEligible: 6,
      rowsReturned: 4,
      outputTruncated: true,
      uniqueSubjects: 4,
      truncated: true,
      retrievedAt: '2026-10-11T10:00:00.000Z',
    };
    result.summary = { creditRows: 6, uniqueSubjects: 4, uniqueCharacters: 0 };
    result.sourceOperations[2] = {
      operation: 'GET /v0/subjects/{subject_id}',
      attempted: 16,
      succeeded: 15,
      failed: 1,
    };
    const verification = verify(result);
    expect(verification.passed, JSON.stringify(verification.answerChecks)).toBe(true);
  });

  it('rejects complete state when returned role coverage is unknown', () => {
    const result = makeResult();
    result.state = 'complete';
    const verification = verify(result);
    expect(verification.answerChecks.boundedCoverageConsistent).toBe(false);
    expect(verification.passed).toBe(false);
  });

  it('allows a detail fetch to finish just after UTC midnight', () => {
    const result = makeResult();
    result.window = makeWindow('2026-10-10');
    result.coverage.retrievedAt = '2026-10-11T00:30:00.000Z';
    for (const row of result.rows) row.firstAirDate = '2025-06-01';
    for (const row of result.rows) row.month = '2025-06';
    expect(verify(result).answerChecks.calendarWindowValid).toBe(true);
  });

  it('rejects a claim that these rows describe the complete career', () => {
    const result = makeResult();
    const answer = answerFor(result);
    answer.caveat = 'These are all roles in the complete career.';
    expect(verify(result, answer).answerChecks.boundedSampleCaveatPresent).toBe(false);
    expect(verify(result, answer).answerChecks.noUnsupportedCareerClaim).toBe(false);
  });

  it('accepts one exact full JSON text result when structuredContent is absent', () => {
    const result = makeResult();
    const text = JSON.stringify(result);
    const output = { content: [{ type: 'text', text }] };
    const verification = verify(result, answerFor(result), {
      toolOutput: output,
      toolTextUtf8Bytes: Buffer.byteLength(text, 'utf8'),
    });
    expect(verification.passed, JSON.stringify(verification.answerChecks)).toBe(true);
  });

  it('rejects ambiguous or oversized text-only readback', () => {
    const result = makeResult();
    const text = JSON.stringify(result);
    const ambiguous = {
      content: [
        { type: 'text', text },
        { type: 'text', text },
      ],
    };
    expect(
      verify(result, answerFor(result), {
        toolOutput: ambiguous,
        toolTextUtf8Bytes: Buffer.byteLength(text, 'utf8') * 2,
      }).answerChecks.completeSourceReadback,
    ).toBe(false);
    expect(
      verify(result, answerFor(result), {
        toolOutput: { content: [{ type: 'text', text }] },
        toolTextUtf8Bytes: 3601,
      }).answerChecks.completeSourceReadback,
    ).toBe(false);
  });

  it('rejects an extra MCP tool call or a mismatched fixed argument profile', () => {
    const result = makeResult();
    const verification = verify(result, answerFor(result), {
      queryArguments: { ...P01_EXPECTED_QUERY_ARGUMENTS, windowMonths: 12 },
      toolCalls: [
        { name: toolName, state: 'DONE', arguments: P01_EXPECTED_QUERY_ARGUMENTS },
        { name: 'bangumi.search_persons', state: 'DONE', arguments: { keyword: 'x' } },
      ],
    });
    expect(verification.answerChecks.exactQueryArguments).toBe(false);
    expect(verification.answerChecks.exactSingleToolCall).toBe(false);
  });
});
