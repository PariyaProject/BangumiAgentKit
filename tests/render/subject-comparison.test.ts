import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SubjectComparisonResult } from '@bangumi-agent-kit/bangumi-core';
import {
  buildSubjectComparisonViewModel,
  extractImageUrls,
  RenderService,
  renderHtmlTemplate,
} from '@bangumi-agent-kit/renderer';

const result: SubjectComparisonResult = {
  subjectIds: [123, 456],
  state: 'partial',
  subjects: [
    {
      subjectId: 123,
      state: 'complete',
      subject: {
        id: 123,
        type: 'anime',
        name: 'First Original Title',
        nameCn: '一个用于验证窄宽度换行的超长中文条目标题',
        date: '2017-10-06',
        platform: 'TV',
        episodesReported: 12,
        totalEpisodesReported: 12,
      },
      stats: { state: 'complete', score: 8.6, rank: 42, ratingTotal: 100, collectionTotal: 39 },
      sections: { stats: 'complete', cast: 'partial', staff: 'complete', relations: 'complete' },
      coverage: {
        sourceRequestsAttempted: 5,
        sourceRequestsSucceeded: 5,
        sectionsComplete: 3,
        sectionsPartial: 1,
        sectionsUnavailable: 0,
        sectionsNotComputable: 0,
        truncatedSections: ['cast'],
        limits: { maxCast: 4, maxStaff: 12, maxRelations: 8 },
      },
      source: {
        operations: ['GET /v0/subjects/{subject_id}', 'GET /v0/subjects/{subject_id}/characters'],
        attemptedAt: '2026-08-15T00:00:00.000Z',
        retrievedAt: '2026-08-15T00:00:01.000Z',
      },
      evidence: [],
      warnings: [],
      limitations: ['角色区段达到本次有界上限。'],
    },
    {
      subjectId: 456,
      state: 'partial',
      subject: {
        id: 456,
        type: 'anime',
        name: 'Second Original Title',
        nameCn: '第二个条目',
        date: '2020-01-02',
        platform: 'Web',
        episodesReported: 24,
        totalEpisodesReported: 26,
      },
      stats: { state: 'unavailable' },
      sections: {
        stats: 'unavailable',
        cast: 'complete',
        staff: 'unavailable',
        relations: 'complete',
      },
      coverage: {
        sourceRequestsAttempted: 5,
        sourceRequestsSucceeded: 3,
        sectionsComplete: 2,
        sectionsPartial: 0,
        sectionsUnavailable: 2,
        sectionsNotComputable: 0,
        truncatedSections: [],
        limits: { maxCast: 4, maxStaff: 12, maxRelations: 8 },
      },
      source: {
        operations: ['GET /v0/subjects/{subject_id}', 'GET /v0/subjects/{subject_id}/persons'],
        attemptedAt: '2026-08-15T00:00:00.000Z',
      },
      evidence: [],
      warnings: [
        {
          code: 'UPSTREAM_UNAVAILABLE',
          state: 'unavailable',
          message: '官方统计区段不可用。',
          section: 'stats',
        },
      ],
      limitations: ['统计源不可用时不填充猜测值。'],
    },
  ],
  metrics: [
    {
      key: 'episodesReported',
      label: '条目报告话数',
      values: [12, 24],
      delta: 12,
      state: 'complete',
    },
    {
      key: 'totalEpisodesReported',
      label: '条目报告总话数',
      values: [12, 26],
      delta: 14,
      state: 'complete',
    },
    {
      key: 'score',
      label: '官方评分',
      values: [8.6, 7.5],
      delta: null,
      state: 'conflict',
      conflicts: [{ side: 'B', subjectValue: 7.4, statsValue: 7.5 }],
    },
    { key: 'rank', label: '官方排名', values: [42, null], delta: null, state: 'unknown' },
    { key: 'ratingTotal', label: '评分人数', values: [100, null], delta: null, state: 'unknown' },
    {
      key: 'collectionTotal',
      label: '收藏总数',
      values: [39, null],
      delta: null,
      state: 'unknown',
    },
  ],
  formulaVersion: 'subject-comparison-v1',
  coverage: {
    requestedSubjects: 2,
    returnedSubjects: 2,
    subjectsComplete: 1,
    subjectsPartial: 1,
    subjectsUnavailable: 0,
    subjectsNotFound: 0,
    metricsComplete: 2,
    metricsUnknown: 3,
    metricsConflict: 1,
    limits: { maxSubjects: 2, maxCast: 4, maxStaff: 12, maxRelations: 8 },
  },
  source: {
    class: 'official_v0',
    operations: ['GET /v0/subjects/{subject_id}', 'subject-overview-composition'],
    attemptedAt: '2026-08-15T00:00:00.000Z',
    retrievedAt: '2026-08-15T00:00:01.000Z',
  },
  evidence: [
    {
      source: 'derived-s7',
      operation: 'subject-comparison',
      attemptedAt: '2026-08-15T00:00:00.000Z',
      retrievedAt: '2026-08-15T00:00:01.000Z',
      formulaVersion: 'subject-comparison-v1',
    },
  ],
  warnings: [
    {
      code: 'COMPARISON_VALUES_UNKNOWN',
      state: 'partial',
      message: '3 个比较字段缺少两侧兼容的官方数值。',
    },
    {
      code: 'COMPARISON_VALUES_CONFLICT',
      state: 'partial',
      message: '1 个比较字段在条目详情与统计区段之间出现冲突。',
    },
  ],
  limitations: [
    '比较只覆盖两个条目本次官方 v0 概览读取与有界区段；缺失或截断不代表不存在。',
    '差值按输入顺序计算为第二个条目减第一个条目。',
  ],
};

describe('subject-comparison renderer', () => {
  let renderService: RenderService;

  beforeAll(() => {
    renderService = new RenderService();
  });

  afterAll(async () => {
    await renderService.close();
  });

  it('builds an image-free bounded card with explicit unknowns and no recommendation', async () => {
    const viewModel = buildSubjectComparisonViewModel(result, { maxMetrics: 4 });

    expect(viewModel.template).toBe('subject-comparison');
    expect(viewModel.coverage.renderedMetrics).toBe(4);
    expect(viewModel.coverage.omittedMetrics).toBe(2);
    expect(extractImageUrls(viewModel)).toEqual([]);

    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 640);
    expect(html).toContain('SUBJECT COMPARISON');
    expect(html).toContain('不生成推荐或胜负结论');
    expect(html).toContain('一个用于验证窄宽度换行');
    expect(html).toContain('差值 B−A');
    expect(html).toContain('未知');
    expect(html).toContain('冲突，不计算');
    expect(html).toContain('渲染器省略比较字段：2 条。');
    expect(html).toContain('限制：');
    expect(html).not.toContain('https://');

    const rendered = await renderService.renderCard(viewModel, {
      width: 640,
      deviceScaleFactor: 1,
    });
    expect(rendered.template).toBe('subject-comparison');
    expect(rendered.buffer.length).toBeGreaterThan(1000);
  });
});
