import { describe, expect, it } from 'vitest';
import { formatHuman } from '../../apps/standalone/src/presenter.js';

describe('Standalone person activity presenter', () => {
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
    expect(comparisonOutput).toContain('作品 7');
    expect(comparisonOutput).toContain('上限: 关系 12');
    expect(comparisonOutput).toContain('未计入：作品详情预算上限 2');
    expect(comparisonOutput).toContain(
      '差值（最近 − 之前）：状态 部分 · 作品 +4 · 关系 +4 · 角色 +2',
    );
    expect(comparisonOutput).toContain('发布月份峰值');
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
