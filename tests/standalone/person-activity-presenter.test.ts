import { describe, expect, it } from 'vitest';
import { formatHuman } from '../../apps/standalone/src/presenter.js';

function summaryActivity(
  state: string,
  rowsEligible: number,
  count: number,
): Record<string, unknown> {
  return {
    personId: 20,
    state,
    person: { id: 20, name: 'Person', nameCn: '人物' },
    kind: 'voice',
    media: 'tv',
    window: { start: '2025-11-01', end: '2026-10-03' },
    rows: [],
    summary: {
      creditRows: count,
      uniqueSubjects: count,
      uniqueCharacters: count,
      byYear: [
        {
          year: 2025,
          start: '2025-11-01',
          end: '2025-12-31',
          uniqueSubjects: count,
        },
        {
          year: 2026,
          start: '2026-01-01',
          end: '2026-10-03',
          uniqueSubjects: count,
        },
      ],
    },
    coverage: {
      relationRowsObserved: rowsEligible,
      relationRowsSelected: rowsEligible,
      subjectIdsObserved: rowsEligible,
      subjectIdsSelected: rowsEligible,
      subjectDetailsSucceeded: rowsEligible,
      subjectDetailRequests: rowsEligible,
      rowsReturned: rowsEligible,
      rowsEligible,
      truncated: false,
      sampled: false,
    },
    sourceOperations: [],
    evidence: [],
    warnings: [],
    limitations: [],
  };
}

describe('Standalone person activity presenter', () => {
  it('prints score-ranked main voice works with their independent partial scope', () => {
    const value = summaryActivity('partial', 3, 3);
    value.ranking = {
      mode: 'top_rated_main_voice',
      scope: 'current_official_person_character_response',
      media: 'all',
      state: 'partial',
      limit: 5,
      items: [
        {
          subjectId: 701,
          subjectName: 'High scored title',
          subjectNameCn: '高分作品',
          subjectType: 'anime',
          firstAirDate: '2001-04-01',
          ratingScore: 9.1,
          ratingTotal: 2048,
          characterCount: 2,
          rawRoles: ['主役', '主角'],
        },
      ],
      coverage: {
        relationRowsObserved: 80,
        relationRowsSelected: 40,
        relationRowsDroppedAtLimit: 40,
        subjectIdsObserved: 60,
        subjectIdsSelected: 40,
        subjectDetailRequests: 40,
        subjectDetailsSucceeded: 40,
        subjectDetailsFailed: 0,
        subjectDetailIdsDroppedAtLimit: 0,
        mainRoleSubjectsSelected: 1,
        scoreableMainRoleSubjects: 1,
        missingRatingScoreSubjects: 0,
        zeroRatingScoreSubjects: 0,
        missingRatingTotalSubjects: 0,
        mediaUnknownSubjects: 0,
        unknownRoleRows: 4,
        missingSubjectIdRows: 0,
        mainRoleSubjectsMissingDetail: 0,
        rowsReturned: 1,
        retrievedAt: '2026-08-30T00:00:00.000Z',
        truncated: true,
      },
    };

    const output = formatHuman(value);

    expect(output).toContain('主役作品评分排序 · 部分 · 媒介 全部媒介');
    expect(output).toContain('高分作品 #701 · 9.1 分 · 评分人数 2048');
    expect(output).toContain('未知角色 4 行');
    expect(output).toContain('本次观察样本中的高分主役作品，不代表完整生涯排名');
  });

  it('exposes origin groups, source coverage, and the positive-only limitation', () => {
    const output = formatHuman({
      personId: 20,
      state: 'partial',
      person: { id: 20, name: 'Person', nameCn: '人物' },
      kind: 'staff',
      media: 'tv',
      staffRole: 'director',
      window: { start: '2026-03-01', end: '2026-08-15' },
      rows: [
        {
          subjectId: 1,
          subjectName: 'Subject',
          subjectNameCn: '作品一',
          firstAirDate: '2026-05-10',
          relationKind: 'staff',
          rawRole: '監督',
          roleFamily: '制作人员',
          origin: { state: 'explicit_original', metaTags: ['原创', '奇幻'] },
        },
        {
          subjectId: 2,
          subjectName: 'Subject 2',
          subjectNameCn: '作品二',
          firstAirDate: '2026-06-10',
          relationKind: 'staff',
          roleFamily: '制作人员',
          origin: { state: 'not_observed', metaTags: ['漫画'] },
        },
      ],
      summary: {
        creditRows: 2,
        uniqueSubjects: 2,
        uniqueCharacters: 2,
        byYear: [
          {
            year: 2026,
            start: '2026-03-01',
            end: '2026-08-15',
            uniqueSubjects: 2,
          },
        ],
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
        subjectDetailsSucceeded: 2,
        subjectDetailRequests: 2,
        subjectDetailsFailed: 0,
        subjectDetailIdsDroppedAtLimit: 0,
        rowsReturned: 2,
        rowsEligible: 2,
        outputTruncated: false,
        uniqueSubjects: 2,
        uniqueCharacters: 0,
        missingSubjectIdRows: 0,
        missingDateRows: 0,
        invalidDateRows: 0,
        outsideWindowRows: 0,
        mediaExcludedRows: 0,
        mediaUnknownRows: 0,
        staffRoleExcludedRows: 1,
        staffRoleUnknownRows: 0,
        maxRelations: 120,
        maxSubjectDetails: 48,
        maxRows: 60,
        detailConcurrency: 4,
        responseLimitBytes: 1048576,
        truncated: false,
        origin: {
          subjectsObserved: 2,
          explicitOriginalSubjects: 1,
          notObservedSubjects: 1,
          unknownSubjects: 0,
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
          responseLimitBytes: 1048576,
        },
        retrievedAt: '2026-08-30T00:00:00.000Z',
      },
      sourceOperations: [
        {
          operation: 'GET /v0/subjects/{subject_id}',
          attempted: 2,
          succeeded: 2,
          failed: 0,
        },
      ],
      evidence: [
        {
          source: 'derived-s7',
          operation: 'person-activity-origin-observation',
          formulaVersion: 'person-activity-origin-v1',
        },
      ],
      limitations: ['未观察到原创标签不等于改编。'],
      warnings: [],
    });

    expect(output).toContain('人物 activity · 状态: 部分');
    expect(output).toContain(
      '窗口摘要：观察到的去重作品 2 部 · 观察到的关系行 2 行 · 观察到的去重角色 2 个',
    );
    expect(output).toContain('按年观察（首尾年份按窗口日期截断；按唯一 subject ID 去重）');
    expect(output).toContain('2026（2026-03-01 至 2026-08-15） 观察到的去重作品 2 部');
    expect(output).toContain('某年观察值为 0 不证明该年没有作品');
    expect(output).toContain('不代表整个时间窗的总数');
    expect(output).toContain('本次观察到的窗口内作品：');
    expect(output).toContain('职位筛选: 导演');
    expect(output).toContain('职位筛选覆盖: 排除 1 · 未知 0');
    expect(output).toContain('原始职位/角色：監督');
    expect(output).toContain('原始职位/角色：未知（来源未提供）');
    expect(output).toContain('响应 1048576 bytes');
    expect(output).toContain('作品来源观察（官方 v0 subject.meta_tags）');
    expect(output).toContain('明确原创 1');
    expect(output).toContain('未观察到原创标签 1');
    expect(output).toContain('未观察到“原创”标签不等于“改编”');
    expect(output).toContain('来源与检索：official-v0 · 2026-08-30');
    expect(output).toContain('官方 meta_tags：原创、奇幻');
    expect(output).toContain('标签覆盖：观察 3 · 合法 3 · 返回 3 · 省略 0');
    expect(output).toContain('person-activity-origin-v1');
    expect(output).not.toContain('[object Object]');
  });

  it('shows complete summary counts and hides partial-empty or unavailable zeros', () => {
    const completeOutput = formatHuman(summaryActivity('complete', 3, 3));
    expect(completeOutput).toContain('窗口摘要：去重作品 3 部 · 关系行 3 行 · 去重角色 3 个');
    expect(completeOutput).toContain('2025（2025-11-01 至 2025-12-31） 去重作品 3 部');
    expect(completeOutput).toContain('窗口内作品：');

    const partialEmptyOutput = formatHuman(summaryActivity('partial', 0, 0));
    expect(partialEmptyOutput).toContain(
      '窗口摘要：观察到的去重作品 不可用 · 观察到的关系行 不可用 · 观察到的去重角色 不可用',
    );
    expect(partialEmptyOutput).not.toContain('观察到的去重作品 0 部');
    expect(partialEmptyOutput).toContain('作品数不可用');
    expect(partialEmptyOutput).toContain('不代表整个时间窗的总数');

    const unavailableOutput = formatHuman(summaryActivity('unavailable', 0, 0));
    expect(unavailableOutput).toContain(
      '窗口摘要：去重作品 不可用 · 关系行 不可用 · 去重角色 不可用',
    );
    expect(unavailableOutput).not.toContain('去重作品 0 部');
    expect(unavailableOutput).toContain('作品数不可用');
  });

  it('prints bounded window comparisons, operations, exclusions, and unavailable states', () => {
    const periodCoverage = {
      relationRowsObserved: 9,
      relationRowsSelected: 7,
      subjectDetailsSucceeded: 6,
      subjectDetailRequests: 7,
      rowsReturned: 7,
      rowsEligible: 7,
      subjectDetailIdsDroppedAtLimit: 2,
      maxRelations: 12,
      maxSubjectDetails: 8,
      maxRows: 6,
      detailConcurrency: 4,
      responseLimitBytes: 1048576,
      sampled: true,
      truncated: true,
    };
    const comparisonOutput = formatHuman({
      personId: 20,
      state: 'partial',
      person: { id: 20, name: 'Person', nameCn: '人物' },
      kind: 'all',
      media: 'all',
      window: { start: '2026-03-01', end: '2026-08-15' },
      rows: [],
      summary: {
        origin: { explicitOriginalSubjects: 0, notObservedSubjects: 0, unknownSubjects: 0 },
      },
      coverage: {
        ...periodCoverage,
        origin: {
          subjectsObserved: 0,
          explicitOriginalSubjects: 0,
          notObservedSubjects: 0,
          unknownSubjects: 0,
          subjectsWithMetaTags: 0,
          subjectsPartial: 0,
          subjectsUnknown: 0,
          tagsObserved: 0,
          tagsValid: 0,
          tagsReturned: 0,
          tagsOmitted: 0,
          malformedTagValues: 0,
          textTruncatedTags: 0,
          truncatedSubjects: 0,
          truncated: false,
          maxTagsPerSubject: 32,
          maxTagCharacters: 96,
          responseLimitBytes: 1048576,
        },
        retrievedAt: '2026-08-30T00:00:00.000Z',
      },
      exclusions: [{ reason: 'subject_detail_cap', count: 2, sampleSubjectIds: [9] }],
      sourceOperations: [
        { operation: 'GET /v0/persons/{person_id}', attempted: 1, succeeded: 1, failed: 0 },
      ],
      evidence: [],
      limitations: [],
      warnings: [],
      comparison: {
        state: 'partial',
        windowMonths: 6,
        recent: {
          window: { start: '2026-03-01', end: '2026-08-15' },
          summary: { creditRows: 7, uniqueSubjects: 7, uniqueCharacters: 5 },
          state: 'partial',
          coverage: periodCoverage,
          exclusions: [{ reason: 'subject_detail_cap', count: 2, sampleSubjectIds: [9] }],
        },
        previous: {
          window: { start: '2025-09-01', end: '2026-02-28' },
          summary: { creditRows: 3, uniqueSubjects: 3, uniqueCharacters: 3 },
          state: 'complete',
          coverage: { ...periodCoverage, sampled: false, truncated: false },
          exclusions: [],
        },
        delta: { state: 'partial', creditRows: 4, uniqueSubjects: 4, uniqueCharacters: 2 },
        peak: {
          metric: 'uniqueSubjects',
          state: 'partial',
          months: [
            {
              period: 'recent',
              month: '2026-07',
              creditRows: 3,
              uniqueSubjects: 3,
              uniqueCharacters: 2,
            },
          ],
        },
        sourceOperations: {
          recent: [{ operation: 'GET /recent', attempted: 2, succeeded: 1, failed: 1 }],
          previous: [{ operation: 'GET /previous', attempted: 1, succeeded: 1, failed: 0 }],
        },
      },
    });

    expect(comparisonOutput).toContain('前后窗口对比');
    expect(comparisonOutput).toContain('最近窗口');
    expect(comparisonOutput).toContain('观察到的作品 7 部 · 观察到的关系 7 行 · 观察到的角色 5 个');
    expect(comparisonOutput).toContain('作品 7');
    expect(comparisonOutput).toContain('上限: 关系 12');
    expect(comparisonOutput).toContain('未计入：作品详情预算上限 2');
    expect(comparisonOutput).toContain(
      '观察差值（最近 − 之前）：状态 部分 · 作品 +4 · 关系 +4 · 角色 +2',
    );
    expect(comparisonOutput).toContain('部分覆盖下观察到的发布月份峰值');
    expect(comparisonOutput).toContain('最近窗口来源操作');

    const unavailableOutput = formatHuman({
      personId: 20,
      state: 'unavailable',
      person: { id: 20, name: 'Person', nameCn: '人物' },
      kind: 'voice',
      media: 'all',
      window: { start: '2026-03-01', end: '2026-08-15' },
      rows: [],
      summary: {
        origin: { explicitOriginalSubjects: 0, notObservedSubjects: 0, unknownSubjects: 0 },
      },
      coverage: { rowsEligible: 0, origin: { subjectsObserved: 0 } },
      exclusions: [],
      sourceOperations: [],
      evidence: [],
      limitations: [],
      warnings: [],
      comparison: {
        state: 'unavailable',
        windowMonths: 6,
        recent: {
          window: { start: '2026-03-01', end: '2026-08-15' },
          summary: { creditRows: 0, uniqueSubjects: 0, uniqueCharacters: 0 },
          state: 'unavailable',
          coverage: { rowsEligible: 0 },
          exclusions: [],
        },
        previous: {
          window: { start: '2025-09-01', end: '2026-02-28' },
          summary: { creditRows: 0, uniqueSubjects: 0, uniqueCharacters: 0 },
          state: 'unavailable',
          coverage: { rowsEligible: 0 },
          exclusions: [],
        },
        delta: { state: 'unavailable', creditRows: 0, uniqueSubjects: 0, uniqueCharacters: 0 },
        peak: { metric: 'uniqueSubjects', state: 'unavailable', months: [] },
        sourceOperations: { recent: [], previous: [] },
      },
    });

    expect(unavailableOutput).toContain('最近窗口');
    expect(unavailableOutput).toContain('状态 不可用 · 作品 不可用');
    expect(unavailableOutput).not.toContain('状态 不可用 · 作品 0');
    expect(unavailableOutput).not.toContain('差值（最近 − 之前）：状态 不可用 · 作品 0');
  });
});
