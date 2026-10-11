import { describe, expect, it } from 'vitest';
import {
  G19_APPROVED_CAVEAT,
  G19_EXPECTED_QUERY_ARGUMENTS,
  summarizeG19PersonActivityResult,
  verifyG19PersonOriginAnswer,
} from '../../scripts/acceptance/g19-person-origin-answer-check.mjs';

const window = {
  months: 3,
  start: '2026-08-01',
  end: '2026-10-11',
  monthKeys: ['2026-08', '2026-09', '2026-10'],
  asOfSemantics: 'calendar_months_ending_on_as_of_date',
};
const tagCoverage = (observed: number) => ({
  state: 'complete', observed, valid: observed, returned: observed, omitted: 0,
  malformed: 0, textTruncated: 0, truncated: false,
});

function makeResult() {
  return {
    personId: 3474,
    kind: 'all',
    media: 'anime',
    state: 'complete',
    window: structuredClone(window),
    summary: {
      creditRows: 2,
      uniqueSubjects: 2,
      uniqueCharacters: 1,
      origin: { explicitOriginalSubjects: 1, notObservedSubjects: 1, unknownSubjects: 0 },
    },
    coverage: {
      relationRowsObserved: 2,
      relationRowsSelected: 2,
      relationRowsDroppedAtLimit: 0,
      relationSelectionStrategy: 'all',
      sampled: false,
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
      uniqueSubjects: 2,
      uniqueCharacters: 1,
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
      retrievedAt: '2026-10-11T00:00:00.000Z',
      origin: {
        explicitOriginalSubjects: 1,
        notObservedSubjects: 1,
        unknownSubjects: 0,
        subjectsObserved: 2,
        subjectsWithMetaTags: 2,
        subjectsPartial: 0,
        subjectsUnknown: 0,
        tagsObserved: 3,
        tagsValid: 3,
        tagsReturned: 3,
        tagsOmitted: 0,
        malformedTagValues: 0,
        textTruncatedTags: 0,
        truncatedSubjects: 0,
        truncated: false,
        maxTagsPerSubject: 32,
        maxTagCharacters: 96,
        responseLimitBytes: 1_048_576,
      },
    },
    rows: [
      {
        subjectId: 101,
        subjectName: 'Example A',
        subjectNameCn: '示例作品甲',
        subjectType: 'anime',
        firstAirDate: '2026-09-01',
        month: '2026-09',
        relationKind: 'voice',
        relationId: 601,
        characterName: '角色甲',
        rawRole: '主角',
        roleFamily: 'main',
        origin: { state: 'explicit_original', metaTags: ['原创', '奇幻'], metaTagsCoverage: tagCoverage(2) },
      },
      {
        subjectId: 102,
        subjectName: 'Example B',
        subjectNameCn: '示例作品乙',
        subjectType: 'anime',
        firstAirDate: '2026-08-01',
        month: '2026-08',
        relationKind: 'staff',
        relationId: 102,
        rawRole: '脚本',
        roleFamily: 'staff',
        origin: { state: 'not_observed', metaTags: ['漫画'], metaTagsCoverage: tagCoverage(1) },
      },
    ],
    sourceOperations: [
      { operation: 'GET /v0/persons/{person_id}', attempted: 1, succeeded: 1, failed: 0 },
      { operation: 'GET /v0/persons/{person_id}/subjects', attempted: 1, succeeded: 1, failed: 0 },
      { operation: 'GET /v0/persons/{person_id}/characters', attempted: 1, succeeded: 1, failed: 0 },
      { operation: 'GET /v0/subjects/{subject_id}', attempted: 2, succeeded: 2, failed: 0 },
    ],
  };
}

function answerFor(result: ReturnType<typeof makeResult>) {
  const summary = summarizeG19PersonActivityResult(result)!;
  const statesBySubject = new Map<number, string>();
  for (const row of result.rows) {
    const prior = statesBySubject.get(row.subjectId);
    statesBySubject.set(row.subjectId, prior && prior !== row.origin.state ? 'unknown' : row.origin.state);
  }
  return JSON.stringify({
    personId: result.personId,
    kind: result.kind,
    media: result.media,
    window: summary.window,
    state: result.state,
    summary: summary.summary,
    coverage: summary.coverage,
    rows: result.rows.map((row) => ({
      subjectId: row.subjectId,
      title: row.subjectNameCn || row.subjectName,
      firstAirDate: row.firstAirDate,
      month: row.month,
      relationKind: row.relationKind,
      relationId: row.relationId,
      rawRole: row.rawRole,
      roleFamily: row.roleFamily,
      origin: {
        state: row.origin.state,
        metaTags: row.origin.metaTags,
        metaTagsCoverage: row.origin.metaTagsCoverage,
      },
    })),
    groupsScope: 'returned_rows_only',
    explicitOriginalSubjectIds: [...statesBySubject.entries()].filter(([, state]) => state === 'explicit_original').map(([id]) => id).sort((a, b) => a - b),
    notObservedSubjectIds: [...statesBySubject.entries()].filter(([, state]) => state === 'not_observed').map(([id]) => id).sort((a, b) => a - b),
    unknownSubjectIds: [...statesBySubject.entries()].filter(([, state]) => state === 'unknown').map(([id]) => id).sort((a, b) => a - b),
    adaptationStatus: 'not_supported_by_observed_source',
    caveat: G19_APPROVED_CAVEAT,
  });
}

function calls() {
  return [{ name: 'bangumi.get_person_activity', state: 'DONE', arguments: G19_EXPECTED_QUERY_ARGUMENTS }];
}

describe('G19 bounded person-origin Agent/MCP answer checker', () => {
  it('matches the exact bounded source rows, tag states, coverage, and no-adaptation caveat', () => {
    const result = makeResult();
    const checked = verifyG19PersonOriginAnswer(
      answerFor(result), G19_EXPECTED_QUERY_ARGUMENTS,
      { structuredContent: result }, calls(), 2800,
    );

    expect(checked.passed).toBe(true);
    expect(Object.values(checked.answerChecks).every(Boolean)).toBe(true);
    expect(checked.answerCounters).toMatchObject({
      sourceRows: 2,
      answerRows: 2,
      rowsMatched: 2,
      missingRows: 0,
      extraRows: 0,
    });
    expect(checked.resultSummary).toMatchObject({
      personId: 3474,
      state: 'complete',
      summary: { uniqueSubjects: 2, origin: { explicitOriginalSubjects: 1, notObservedSubjects: 1 } },
      rowCount: 2,
    });
    expect(JSON.stringify(checked)).not.toContain('示例作品');
    expect(JSON.stringify(checked)).not.toContain('漫画');
  });

  it('rejects adaptation grouping, raw-origin mismatch, extra rows, widened arguments, and caveat removal', () => {
    const result = makeResult();
    const answer = JSON.parse(answerFor(result));
    answer.adaptationSubjectIds = [102];
    answer.rows[0].origin.metaTags = ['改编'];
    answer.rows.push({ ...answer.rows[1], subjectId: 999, relationId: 999 });
    answer.caveat = '这些作品都是改编。';
    const checked = verifyG19PersonOriginAnswer(
      JSON.stringify(answer), { ...G19_EXPECTED_QUERY_ARGUMENTS, maxRows: 7 },
      { structuredContent: result }, calls(), 2800,
    );

    expect(checked.passed).toBe(false);
    expect(checked.answerChecks.exactQueryArguments).toBe(false);
    expect(checked.answerChecks.answerShapeValid).toBe(false);
    expect(checked.answerChecks.answerRowsMatch).toBe(false);
    expect(checked.answerChecks.adaptationNotInferred).toBe(true);
    expect(checked.answerChecks.caveatDisclosurePresent).toBe(false);
  });

  it('rejects unsupported not-observed mappings, impossible origin totals, wrong tools, and long MCP text', () => {
    const result = makeResult();
    const answer = JSON.parse(answerFor(result));
    answer.notObservedSubjectIds = [];
    answer.unknownSubjectIds = [102];
    const call = calls()[0]!;
    const wrongTool = [{ ...call, name: 'bangumi.render_person_activity' }];
    const brokenResult = structuredClone(result);
    brokenResult.coverage.origin.unknownSubjects = 1;
    const checked = verifyG19PersonOriginAnswer(
      JSON.stringify(answer), G19_EXPECTED_QUERY_ARGUMENTS,
      { structuredContent: brokenResult }, wrongTool, 3601,
    );

    expect(checked.passed).toBe(false);
    expect(checked.answerChecks.exactSingleToolCall).toBe(false);
    expect(checked.answerChecks.boundedCoverageConsistent).toBe(false);
    expect(checked.answerChecks.answerGroupsMatch).toBe(false);
    expect(checked.answerChecks.boundedMcpTextView).toBe(false);
  });

  it('keeps a partial meta_tags read without the exact 原创 tag in unknown, not adaptation', () => {
    const result = makeResult();
    result.state = 'partial';
    result.rows[1]!.origin = {
      state: 'unknown',
      metaTags: ['漫画'],
      metaTagsCoverage: {
        state: 'partial', observed: 2, valid: 1, returned: 1, omitted: 0,
        malformed: 1, textTruncated: 0, truncated: false,
      },
    };
    result.summary.origin = { explicitOriginalSubjects: 1, notObservedSubjects: 0, unknownSubjects: 1 };
    result.coverage.origin.explicitOriginalSubjects = 1;
    result.coverage.origin.notObservedSubjects = 0;
    result.coverage.origin.unknownSubjects = 1;
    result.coverage.origin.subjectsPartial = 1;
    result.coverage.origin.subjectsWithMetaTags = 2;
    result.coverage.origin.subjectsUnknown = 0;
    result.coverage.origin.tagsObserved = 4;
    result.coverage.origin.tagsValid = 3;
    result.coverage.origin.tagsReturned = 3;
    result.coverage.origin.malformedTagValues = 1;
    const checked = verifyG19PersonOriginAnswer(
      answerFor(result), G19_EXPECTED_QUERY_ARGUMENTS,
      { structuredContent: result }, calls(), 2800,
    );

    expect(checked.passed).toBe(true);
    expect(checked.answerChecks.answerGroupsMatch).toBe(true);
    expect(checked.answerChecks.adaptationNotInferred).toBe(true);

    const contradictory = structuredClone(result);
    contradictory.state = 'complete';
    const rejected = verifyG19PersonOriginAnswer(
      answerFor(contradictory), G19_EXPECTED_QUERY_ARGUMENTS,
      { structuredContent: contradictory }, calls(), 2800,
    );

    expect(rejected.passed).toBe(false);
    expect(rejected.answerChecks.boundedCoverageConsistent).toBe(false);
  });

  it('keeps distinct voice and staff rows when their numeric relation ids collide', () => {
    const result = makeResult();
    const voice = result.rows[0]!;
    voice.relationId = voice.subjectId;
    result.rows[1] = {
      ...voice,
      relationKind: 'staff',
      roleFamily: 'staff',
      rawRole: '脚本',
    };
    result.summary.uniqueSubjects = 1;
    result.summary.origin = { explicitOriginalSubjects: 1, notObservedSubjects: 0, unknownSubjects: 0 };
    result.coverage.subjectIdsObserved = 1;
    result.coverage.subjectIdsSelected = 1;
    result.coverage.subjectDetailIdsObserved = 1;
    result.coverage.subjectDetailRequests = 1;
    result.coverage.subjectDetailsSucceeded = 1;
    result.coverage.uniqueSubjects = 1;
    result.coverage.origin.explicitOriginalSubjects = 1;
    result.coverage.origin.notObservedSubjects = 0;
    result.coverage.origin.unknownSubjects = 0;
    result.coverage.origin.subjectsObserved = 1;
    result.coverage.origin.subjectsWithMetaTags = 1;
    result.coverage.origin.tagsObserved = 2;
    result.coverage.origin.tagsValid = 2;
    result.coverage.origin.tagsReturned = 2;
    result.coverage.origin.tagsOmitted = 0;
    result.coverage.origin.malformedTagValues = 0;
    result.sourceOperations[3]!.attempted = 1;
    result.sourceOperations[3]!.succeeded = 1;

    const checked = verifyG19PersonOriginAnswer(
      answerFor(result), G19_EXPECTED_QUERY_ARGUMENTS,
      { structuredContent: result }, calls(), 2800,
    );

    expect(checked.passed).toBe(true);
    expect(checked.answerChecks.sourceRowsDistinct).toBe(true);
    expect(checked.answerChecks.answerRowsMatch).toBe(true);
  });
});
