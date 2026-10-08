import { describe, expect, it } from 'vitest';
import {
  S02_EXPECTED_QUERY_ARGUMENTS,
  verifyS02RankingAnswer,
} from '../../scripts/acceptance/s02-agent-answer-check.mjs';

const targetTool = 'bangumi.get_person_activity';

function makeResult(state: 'complete' | 'partial' = 'partial') {
  return {
    structuredContent: {
      personId: 3474,
      ranking: {
        mode: 'top_rated_main_voice',
        scope: 'current_official_person_character_response',
        media: 'all',
        state,
        limit: 5,
        items: [
          {
            subjectId: 1001,
            subjectName: 'Work A',
            subjectNameCn: '作品甲',
            ratingScore: 8.9,
            ratingTotal: 8123,
            characterCount: 2,
            rawRoles: ['主役'],
          },
          {
            subjectId: 1002,
            subjectName: 'Work B',
            subjectNameCn: '作品乙',
            ratingScore: 8.7,
            ratingTotal: 3421,
            characterCount: 1,
            rawRoles: ['主角'],
          },
        ],
        coverage: {
          relationRowsObserved: 42,
          relationRowsSelected: 42,
          relationRowsDroppedAtLimit: 0,
          subjectIdsObserved: 21,
          subjectIdsSelected: 21,
          subjectDetailRequests: 21,
          subjectDetailsSucceeded: 21,
          subjectDetailsFailed: 0,
          subjectDetailIdsDroppedAtLimit: 0,
          mainRoleSubjectsSelected: 7,
          scoreableMainRoleSubjects: 7,
          missingRatingScoreSubjects: 0,
          zeroRatingScoreSubjects: 0,
          missingRatingTotalSubjects: 0,
          mediaUnknownSubjects: 0,
          unknownRoleRows: 0,
          missingSubjectIdRows: 0,
          mainRoleSubjectsMissingDetail: 0,
          rowsReturned: 2,
          retrievedAt: '2026-10-08T05:00:00.000Z',
          truncated: false,
        },
      },
    },
  };
}

function expectedCoverage() {
  return {
    relationRowsObserved: 42,
    relationRowsSelected: 42,
    relationRowsDroppedAtLimit: 0,
    subjectDetailRequests: 21,
    subjectDetailsSucceeded: 21,
    subjectDetailsFailed: 0,
    subjectDetailIdsDroppedAtLimit: 0,
    mainRoleSubjectsSelected: 7,
    scoreableMainRoleSubjects: 7,
    zeroRatingScoreSubjects: 0,
    unknownRoleRows: 0,
    missingRatingScoreSubjects: 0,
    missingRatingTotalSubjects: 0,
    mediaUnknownSubjects: 0,
    missingSubjectIdRows: 0,
    mainRoleSubjectsMissingDetail: 0,
    rowsReturned: 2,
  };
}

function makeAnswer(state: 'complete' | 'partial' = 'partial') {
  const caveat =
    state === 'partial'
      ? '这是本次观察样本中的评分排序，不代表完整生涯排名，也不是历史评分快照。'
      : '这是当前官方响应中已分类作品的评分排序，不代表完整生涯排名，也不是历史评分快照。';
  return JSON.stringify({
    personId: 3474,
    rankingMode: 'top_rated_main_voice',
    scope: 'current_official_person_character_response',
    state,
    items: [
      {
        subjectId: 1001,
        title: '作品甲',
        ratingScore: 8.9,
        ratingTotal: 8123,
        rawRoles: ['主役'],
      },
      {
        subjectId: 1002,
        title: '作品乙',
        ratingScore: 8.7,
        ratingTotal: 3421,
        rawRoles: ['主角'],
      },
    ],
    coverage: expectedCoverage(),
    caveat,
  });
}

function makeCalls(arguments_ = S02_EXPECTED_QUERY_ARGUMENTS) {
  return [
    {
      name: targetTool,
      state: 'DONE',
      arguments: arguments_,
    },
  ];
}

describe('S02 Agent/MCP answer checker', () => {
  it('matches returned subject IDs, scores, roles, coverage, and partial wording', () => {
    const report = verifyS02RankingAnswer(
      makeAnswer(),
      S02_EXPECTED_QUERY_ARGUMENTS,
      makeResult(),
      makeCalls(),
    );

    expect(report.passed).toBe(true);
    expect(Object.values(report.answerChecks).every(Boolean)).toBe(true);
    expect(report.answerCounters).toMatchObject({
      sourceRows: 2,
      answerRows: 2,
      rowsMatched: 2,
      missingRowsCount: 0,
      extraRowsCount: 0,
    });
    expect(report.resultSummary).not.toBeNull();
    expect(report.resultSummary?.rows).toEqual([
      { subjectId: 1001, ratingScore: 8.9, ratingTotal: 8123 },
      { subjectId: 1002, ratingScore: 8.7, ratingTotal: 3421 },
    ]);
    expect(JSON.stringify(report)).not.toMatch(/作品甲|主役|不代表完整生涯/);
  });

  it('accepts current-response wording only for a complete ranking state', () => {
    const report = verifyS02RankingAnswer(
      makeAnswer('complete'),
      S02_EXPECTED_QUERY_ARGUMENTS,
      makeResult('complete'),
      makeCalls(),
    );

    expect(report.passed).toBe(true);
    expect(report.answerChecks.boundedScopeDisclosurePresent).toBe(true);
  });

  it('rejects mismatched order, duplicate rows, stale arguments, and unsupported scope claims', () => {
    const answer = JSON.parse(makeAnswer());
    answer.items.reverse();
    answer.items[1] = { ...answer.items[1], subjectId: answer.items[0].subjectId };
    answer.caveat = '这是完整生涯排名，评分来自历史最高分。';
    const report = verifyS02RankingAnswer(
      JSON.stringify(answer),
      { ...S02_EXPECTED_QUERY_ARGUMENTS, media: 'anime' },
      makeResult(),
      makeCalls(),
    );

    expect(report.passed).toBe(false);
    expect(report.answerChecks.queryArgumentsMatch).toBe(false);
    expect(report.answerChecks.answerRowsMatch).toBe(false);
    expect(report.answerChecks.noUnsupportedCareerOrHistoryClaim).toBe(false);
  });

  it('rejects missing rows, changed coverage, and Markdown answers', () => {
    const answer = JSON.parse(makeAnswer());
    answer.items.pop();
    answer.coverage.relationRowsSelected = 40;
    const report = verifyS02RankingAnswer(
      `**${JSON.stringify(answer)}**`,
      S02_EXPECTED_QUERY_ARGUMENTS,
      makeResult(),
      makeCalls(),
    );

    expect(report.passed).toBe(false);
    expect(report.answerChecks.answerRowsMatch).toBe(false);
    expect(report.answerChecks.coverageMatches).toBe(false);
    expect(report.answerChecks.noMarkdownFormatting).toBe(false);
  });

  it('rejects a ranking that is not sorted by score, rating total, then subject ID', () => {
    const result = makeResult() as any;
    result.structuredContent.ranking.items.reverse();
    const report = verifyS02RankingAnswer(
      makeAnswer(),
      S02_EXPECTED_QUERY_ARGUMENTS,
      result,
      makeCalls(),
    );

    expect(report.passed).toBe(false);
    expect(report.answerChecks.deterministicScoreOrder).toBe(false);
  });
});
