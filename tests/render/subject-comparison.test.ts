import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  SubjectComparisonResult,
  SubjectStatsIntelligenceResult,
} from '@bangumi-agent-kit/bangumi-core';
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
        official: {
          class: 'official-v0',
          operations: ['GET /v0/subjects/{subject_id}', 'GET /v0/subjects/{subject_id}/characters'],
          attemptedAt: '2026-08-15T00:00:00.000Z',
          retrievedAt: '2026-08-15T00:00:01.000Z',
        },
        derived: {
          class: 'derived-s7',
          operations: ['subject-overview-composition'],
          attemptedAt: '2026-08-15T00:00:00.000Z',
          retrievedAt: '2026-08-15T00:00:01.000Z',
        },
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
        official: {
          class: 'official-v0',
          operations: ['GET /v0/subjects/{subject_id}', 'GET /v0/subjects/{subject_id}/persons'],
          attemptedAt: '2026-08-15T00:00:00.000Z',
        },
        derived: {
          class: 'derived-s7',
          operations: ['subject-overview-composition'],
          attemptedAt: '2026-08-15T00:00:00.000Z',
        },
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
      deltaPrecision: 0,
      state: 'complete',
    },
    {
      key: 'totalEpisodesReported',
      label: '条目报告总话数',
      values: [12, 26],
      delta: 14,
      deltaPrecision: 0,
      state: 'complete',
    },
    {
      key: 'score',
      label: '官方评分',
      values: [8.6, 7.5],
      delta: null,
      deltaPrecision: 1,
      state: 'conflict',
      conflicts: [
        {
          side: 'B',
          subjectValue: 7.4,
          statsValue: 7.5,
          candidates: [
            {
              source: { class: 'official_v0', provider: 'bangumi' },
              value: 7.5,
              metricValue: 7.5,
            },
            {
              source: { class: 'derived', provider: 'fixture-derived' },
              value: 7.6,
              metricValue: 7.6,
            },
          ],
        },
      ],
    },
    {
      key: 'rank',
      label: '官方排名',
      values: [42, null],
      delta: null,
      deltaPrecision: 0,
      state: 'unknown',
    },
    {
      key: 'ratingTotal',
      label: '评分人数',
      values: [100, null],
      delta: null,
      deltaPrecision: 0,
      state: 'unknown',
    },
    {
      key: 'collectionTotal',
      label: '收藏总数',
      values: [39, null],
      delta: null,
      deltaPrecision: 0,
      state: 'unknown',
    },
  ],
  formulaVersion: 'subject-comparison-v2',
  overlapFormulaVersion: 'subject-comparison-overlap-v1',
  overlaps: {
    cast: {
      state: 'partial',
      items: [
        {
          personId: 900,
          name: '共同声优：非常长的中文姓名用于换行',
          career: ['seiyu'],
          credits: [
            {
              side: 'A',
              subjectId: 123,
              characters: [{ characterId: 1, name: '甲角色', relation: '主角' }],
            },
            {
              side: 'B',
              subjectId: 456,
              characters: [{ characterId: 2, name: '乙角色', relation: '配角' }],
            },
          ],
        },
      ],
      coverage: {
        state: 'partial',
        left: {
          state: 'partial',
          rowsObserved: 5,
          rowsReturned: 4,
          uniqueIdsReturned: 3,
          missingIdRows: 0,
          truncated: true,
        },
        right: {
          state: 'complete',
          rowsObserved: 3,
          rowsReturned: 3,
          uniqueIdsReturned: 2,
          missingIdRows: 0,
          truncated: false,
        },
        candidateIds: 5,
        matchedIds: 1,
        returned: 1,
        omitted: 0,
        truncated: true,
      },
    },
    staff: {
      state: 'unavailable',
      items: [],
      coverage: {
        state: 'unavailable',
        left: {
          state: 'complete',
          rowsObserved: 2,
          rowsReturned: 2,
          uniqueIdsReturned: 2,
          missingIdRows: 0,
          truncated: false,
        },
        right: {
          state: 'unavailable',
          rowsObserved: 0,
          rowsReturned: 0,
          uniqueIdsReturned: 0,
          missingIdRows: 0,
          truncated: false,
        },
        returned: 0,
        omitted: 0,
        truncated: false,
      },
    },
  },
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
    limits: { maxSubjects: 2, maxCast: 4, maxStaff: 12, maxRelations: 8, maxOverlapItems: 24 },
  },
  source: {
    official: {
      class: 'official-v0',
      operations: ['GET /v0/subjects/{subject_id}'],
      attemptedAt: '2026-08-15T00:00:00.000Z',
      retrievedAt: '2026-08-15T00:00:01.000Z',
    },
    derived: {
      class: 'derived-s7',
      operations: ['subject-overview-composition', 'subject-comparison'],
      attemptedAt: '2026-08-15T00:00:00.000Z',
      retrievedAt: '2026-08-15T00:00:01.000Z',
    },
  },
  evidence: [
    {
      source: 'derived-s7',
      operation: 'subject-comparison',
      attemptedAt: '2026-08-15T00:00:00.000Z',
      retrievedAt: '2026-08-15T00:00:01.000Z',
      formulaVersion: 'subject-comparison-v2',
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

const renderStatistics: SubjectStatsIntelligenceResult = {
  subjectId: 123,
  state: 'complete',
  raw: {
    score: 8.6,
    rank: 42,
    ratingTotal: 100,
    ratingHistogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 40, 9: 60, 10: 0 },
    collection: { wish: 10, collect: 20, doing: 3, onHold: 4, dropped: 2 },
  },
  rating: {
    state: 'complete',
    population: 100,
    mean: 8.6,
    standardDeviation: 0.49,
    distribution: [
      { score: 8, count: 40, percentage: 40 },
      { score: 9, count: 60, percentage: 60 },
    ],
    formulas: {
      percentages: {
        id: 'bangumi.rating.percentages.v1',
        version: 1,
        inputs: ['rating.count.1'],
        evidenceStatus: 'derived',
        description: 'count / population',
      },
      histogramMean: {
        id: 'bangumi.rating.histogram_mean.v1',
        version: 1,
        inputs: ['rating.count.1'],
        evidenceStatus: 'derived',
        description: 'weighted mean',
      },
      populationStandardDeviation: {
        id: 'bangumi.rating.population_sd.v1',
        version: 1,
        inputs: ['rating.count.1'],
        evidenceStatus: 'derived',
        description: 'population standard deviation',
      },
    },
  },
  collection: {
    state: 'complete',
    total: 39,
    distribution: [
      { status: 'wish', count: 10, percentage: 25.64 },
      { status: 'collect', count: 20, percentage: 51.28 },
    ],
    completionRate: 20 / 39,
    completionState: 'complete',
    formulas: {
      percentages: {
        id: 'bangumi.collection.percentages.v1',
        version: 1,
        inputs: ['collection.wish'],
        evidenceStatus: 'derived',
        description: 'count / population',
      },
      completion: {
        id: 'bangumi.subject.completion.v1',
        version: 1,
        inputs: ['collection.collect'],
        evidenceStatus: 'empirically_verified',
        description: 'collect / population',
      },
    },
  },
  coverage: {
    sourceRequestsAttempted: 1,
    sourceRequestsSucceeded: 1,
    ratingBucketsExpected: 10,
    ratingBucketsObserved: 10,
    collectionBucketsExpected: 5,
    collectionBucketsObserved: 5,
    ratingPopulation: 100,
    collectionPopulation: 39,
    formulasAttempted: 5,
    formulasComplete: 5,
    formulasPartial: 0,
    formulasNotComputable: 0,
    formulasConflict: 0,
  },
  source: {
    official: { class: 'official-v0', operations: ['getSubjectById'] },
    derived: { class: 'derived-s7', operations: ['bangumi.rating.percentages.v1'] },
  },
  evidence: [],
  warnings: [],
  limitations: ['当前快照不代表历史趋势。'],
  retrievedAt: '2026-08-15T00:00:00.000Z',
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
    expect(html).toContain('统计 7.5 / 详情 7.4');
    expect(html).toContain('候选 official_v0/bangumi=7.5；derived/fixture-derived=7.6');
    expect(html).toContain('条目身份已读取');
    expect(html).toContain('区段上限：角色 4');
    expect(html).toContain('截断 cast');
    expect(html).toContain('official-v0');
    expect(html).toContain('derived-s7');
    expect(html).toContain('共同声优');
    expect(html).toContain('共同声优：非常长的中文姓名');
    expect(html).toContain('共同制作人员 · 不可用');
    expect(html).toContain('subject-comparison-overlap-v1');
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

  it('keeps both unavailable subjects and bounded diagnostics visible', () => {
    const unavailable = structuredClone(result);
    unavailable.state = 'unavailable';
    unavailable.subjects = unavailable.subjects.map((subject) => ({
      ...subject,
      state: 'unavailable',
      subject: undefined,
      sections: {
        stats: 'unavailable',
        cast: 'unavailable',
        staff: 'unavailable',
        relations: 'unavailable',
      },
      warnings: [
        {
          code: 'UPSTREAM_UNAVAILABLE',
          state: 'unavailable',
          message: '官方区段暂时不可用。',
        },
      ],
      limitations: ['当前请求未取得条目身份，比较不填充猜测值。'],
    })) as typeof result.subjects;
    unavailable.coverage = {
      ...unavailable.coverage,
      returnedSubjects: 0,
      subjectsComplete: 0,
      subjectsPartial: 0,
      subjectsUnavailable: 2,
      metricsComplete: 0,
      metricsUnknown: 6,
    };
    unavailable.metrics = unavailable.metrics.map((metric) => ({
      ...metric,
      values: [null, null],
      delta: null,
      state: 'unknown' as const,
    }));

    const html = renderHtmlTemplate(
      buildSubjectComparisonViewModel(unavailable),
      'bangumi-dark',
      {},
      480,
    );
    expect(html).toContain('来源不可用');
    expect(html).toContain('UPSTREAM_UNAVAILABLE');
    expect(html).toContain('条目身份已读取 0/2');
    expect(html).toContain('当前请求未取得条目身份');
  });

  it('renders nested statistics distributions and the composition formula without images', () => {
    const withStatistics = structuredClone(result);
    withStatistics.statisticsFormulaVersion = 'subject-comparison-statistics-v1';
    withStatistics.subjects[0] = { ...withStatistics.subjects[0], statistics: renderStatistics };
    const html = renderHtmlTemplate(
      buildSubjectComparisonViewModel(withStatistics),
      'bangumi-dark',
      {},
      640,
    );

    expect(html).toContain('评分与收藏统计智能');
    expect(html).toContain('评分样本 100');
    expect(html).toContain('直方图均值 8.6');
    expect(html).toContain('完成率 51.3%');
    expect(html).toContain('8 分 · 40 · 40%');
    expect(html).toContain('统计组合公式：subject-comparison-statistics-v1');
    expect(extractImageUrls(buildSubjectComparisonViewModel(withStatistics))).toEqual([]);
  });
});
