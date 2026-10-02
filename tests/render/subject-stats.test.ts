import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SubjectStatsIntelligenceResult } from '@bangumi-agent-kit/bangumi-core';
import {
  buildSubjectStatsViewModel,
  extractImageUrls,
  RenderService,
  renderHtmlTemplate,
} from '@bangumi-agent-kit/renderer';

function captureVisualQa(name: string, buffer: Buffer): void {
  const directory = process.env.BANGUMI_STATS_RENDER_QA_DIR;
  if (!directory) return;
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, name), buffer);
}

const result: SubjectStatsIntelligenceResult = {
  subjectId: 123,
  state: 'complete',
  raw: {
    score: 8.6,
    rank: 12,
    ratingTotal: 100,
    ratingHistogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 40, 9: 60, 10: 0 },
    collection: { wish: 2, collect: 4, doing: 2, onHold: 1, dropped: 1 },
  },
  rating: {
    state: 'complete',
    population: 100,
    mean: 8.6,
    standardDeviation: 0.49,
    distribution: Array.from({ length: 10 }, (_, index) => ({
      score: index + 1,
      count: index === 7 ? 40 : index === 8 ? 60 : 0,
      percentage: index === 7 ? 40 : index === 8 ? 60 : 0,
    })),
    formulas: {
      percentages: {
        id: 'bangumi.rating.percentages.v1',
        version: 1,
        inputs: ['rating.count.1', 'rating.count.10'],
        evidenceStatus: 'derived',
        description: 'rating bucket count / population × 100',
      },
      histogramMean: {
        id: 'bangumi.rating.histogram_mean.v1',
        version: 1,
        inputs: ['rating.count.1', 'rating.count.10'],
        evidenceStatus: 'derived',
        description: 'sum(rating score × bucket count) / rating histogram population',
      },
      populationStandardDeviation: {
        id: 'bangumi.rating.population_sd.v1',
        version: 1,
        inputs: ['rating.count.1', 'rating.count.10'],
        evidenceStatus: 'derived',
        description: 'population standard deviation over the rating histogram',
      },
    },
  },
  collection: {
    state: 'complete',
    total: 10,
    distribution: [
      { status: 'wish', count: 2, percentage: 20 },
      { status: 'collect', count: 4, percentage: 40 },
      { status: 'doing', count: 2, percentage: 20 },
      { status: 'on_hold', count: 1, percentage: 10 },
      { status: 'dropped', count: 1, percentage: 10 },
    ],
    completionRate: 0.4,
    completionState: 'complete',
    formulas: {
      percentages: {
        id: 'bangumi.collection.percentages.v1',
        version: 1,
        inputs: ['collection.wish', 'collection.dropped'],
        evidenceStatus: 'derived',
        description: 'collection bucket count / population × 100',
      },
      completion: {
        id: 'bangumi.subject.completion.v1',
        version: 1,
        inputs: ['collection.wish', 'collection.dropped'],
        evidenceStatus: 'empirically_verified',
        description: 'collect / collection population',
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
    collectionPopulation: 10,
    formulasAttempted: 5,
    formulasComplete: 5,
    formulasPartial: 0,
    formulasNotComputable: 0,
    formulasConflict: 0,
  },
  source: {
    official: {
      class: 'official-v0',
      operations: ['getSubjectStats'],
      retrievedAt: '2026-08-15T00:00:00.000Z',
    },
    derived: {
      class: 'derived-s7',
      operations: [
        'bangumi.rating.percentages.v1',
        'bangumi.rating.population_sd.v1',
        'bangumi.collection.percentages.v1',
        'bangumi.subject.completion.v1',
      ],
      retrievedAt: '2026-08-15T00:00:00.000Z',
    },
  },
  evidence: [
    { source: 'official-v0', provider: 'bangumi', operation: 'getSubjectStats' },
    {
      source: 'derived-s7',
      provider: 'bangumi-agent-kit',
      formula: 'bangumi.rating.percentages.v1',
    },
  ],
  warnings: [],
  limitations: ['当前快照不是历史趋势。'],
  retrievedAt: '2026-08-15T00:00:00.000Z',
};

describe('subject-stats renderer', () => {
  let renderService: RenderService;

  beforeAll(() => {
    renderService = new RenderService();
  });

  afterAll(async () => {
    await renderService.close();
  });

  it('renders bounded complete statistics without image or network assets', async () => {
    const viewModel = buildSubjectStatsViewModel(result);

    expect(viewModel.template).toBe('subject-stats');
    expect(extractImageUrls(viewModel)).toEqual([]);

    const narrowHtml = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 480);
    const wideHtml = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 960);
    for (const html of [narrowHtml, wideHtml]) {
      expect(html).toContain('条目统计');
      expect(html).toContain('评分分布');
      expect(html).toContain('40.0%');
      expect(html).toContain('完成率');
      expect(html).toContain('完成率＝看过人数 ÷ 五类收藏状态总人数');
      expect(html).toContain('样本验证，并非官方 API 契约');
      expect(html).toContain('评分离散度');
      expect(html).toContain('Bangumi 条目统计 · 当前快照');
      expect(html).not.toContain('bangumi.rating.population_sd.v1');
      expect(html).not.toContain('getSubjectStats');
      expect(html).not.toContain('derived-s7');
      expect(html).not.toContain('rating.count');
      expect(html).not.toContain('RATING_MEAN_CONFLICT');
      expect(html).not.toContain('当前快照不是历史趋势。');
      expect(html).not.toContain('https://');
      expect(html).not.toContain('NaN');
      expect(html).not.toContain('Infinity');
    }

    const rendered = await renderService.renderCard(viewModel, {
      width: 640,
      deviceScaleFactor: 1,
    });
    expect(rendered.template).toBe('subject-stats');
    expect(rendered.buffer.length).toBeGreaterThan(1000);
  });

  it('keeps conflict and unavailable states visible without inventing metrics', () => {
    const conflict = structuredClone(result);
    conflict.state = 'conflict';
    conflict.rating.state = 'conflict';
    conflict.rating.conflicts = [
      {
        state: 'conflict',
        scope: 'rating',
        fieldPaths: ['rating.histogramMean'],
        reason: 'derived histogram mean differs materially from upstream score',
        candidates: [
          { source: { class: 'derived-s7', provider: 'bangumi-agent-kit' }, value: 8.6 },
          { source: { class: 'official-v0', provider: 'bangumi' }, value: 6 },
        ],
      },
    ];
    conflict.collection.conflicts = [
      {
        state: 'conflict',
        scope: 'collection',
        fieldPaths: ['collection.total'],
        reason: 'collection total differs between accepted sources',
        candidates: [
          { source: { class: 'official-v0', provider: 'bangumi' }, value: 10 },
          { source: { class: 'derived-s7', provider: 'bangumi-agent-kit' }, value: 11 },
        ],
      },
    ];
    conflict.conflicts = [
      structuredClone(conflict.collection.conflicts[0]!),
      {
        state: 'conflict',
        scope: 'collection',
        fieldPaths: ['collection.distribution'],
        reason: 'collection distribution differs between accepted sources',
        candidates: [
          {
            source: { class: 'official-v0', provider: 'bangumi' },
            value: { internalCollectionBucket: 3 },
          },
        ],
      },
    ];
    conflict.warnings = [
      { code: 'RATING_MEAN_CONFLICT', state: 'conflict', message: '两个评分来源存在差异。' },
      {
        code: 'MISSING_FIELD',
        state: 'partial',
        message:
          'bangumi.rating.percentages.v1: Rating histogram contains missing buckets; percentages are suppressed.',
      },
    ];
    const conflictViewModel = buildSubjectStatsViewModel(conflict);
    expect(conflictViewModel.conflicts).toEqual(conflict.conflicts);
    const conflictHtml = renderHtmlTemplate(conflictViewModel, 'bangumi-dark', {}, 640);
    expect(conflictHtml).toContain('统计来源给出的结果不一致');
    expect(conflictHtml).toContain('评分分布均值');
    expect(conflictHtml).toContain('收藏人数');
    expect(conflictHtml).toContain('收藏状态分布');
    expect(conflictHtml).toContain('按分布推算：8.60');
    expect(conflictHtml).toContain('官方条目数据：6.00');
    expect(conflictHtml).toContain('官方条目数据：10.00');
    expect(conflictHtml).toContain('按分布推算：11.00');
    expect(conflictHtml).toContain('复杂数据；完整内容见详细结果');
    expect(conflictHtml).not.toContain('internalCollectionBucket');
    expect(conflictHtml.match(/官方条目数据：10\.00/g)).toHaveLength(1);
    expect(conflictHtml).not.toContain('derived-s7');
    expect(conflictHtml).not.toContain('RATING_MEAN_CONFLICT');
    expect(conflictHtml).not.toContain('MISSING_FIELD');
    expect(conflictHtml).not.toContain('bangumi.rating.percentages.v1');
    expect(conflictHtml).not.toContain('两个评分来源存在差异。');

    const unavailable: SubjectStatsIntelligenceResult = {
      ...result,
      state: 'unavailable',
      raw: undefined,
      rating: { ...result.rating, state: 'unavailable', distribution: [], population: undefined },
      collection: {
        ...result.collection,
        state: 'unavailable',
        distribution: [],
        total: undefined,
        completionRate: undefined,
        completionState: 'unavailable',
      },
      coverage: { ...result.coverage, sourceRequestsSucceeded: 0, formulasComplete: 0 },
      evidence: [],
      warnings: [
        { code: 'UPSTREAM_UNAVAILABLE', state: 'unavailable', message: '官方统计源不可用。' },
      ],
    };
    const notFound: SubjectStatsIntelligenceResult = {
      ...unavailable,
      state: 'not_found',
      warnings: [],
    };
    const unavailableHtml = renderHtmlTemplate(
      buildSubjectStatsViewModel(unavailable),
      'bangumi-dark',
      {},
      640,
    );
    expect(unavailableHtml).toContain('官方统计源暂时不可用');
    expect(unavailableHtml).toContain('不可用');
    expect(unavailableHtml).toContain('不把“暂时不可用”误当作零');
    expect(unavailableHtml).not.toContain('UPSTREAM_UNAVAILABLE');
    expect(unavailableHtml).not.toContain('8.6');
    expect(unavailableHtml).not.toContain('NaN');

    const notFoundHtml = renderHtmlTemplate(
      buildSubjectStatsViewModel(notFound),
      'bangumi-dark',
      {},
      640,
    );
    expect(notFoundHtml).toContain('未找到');
    expect(notFoundHtml).toContain('官方统计源没有找到该条目');
    expect(notFoundHtml).toContain('不把“未找到”误当作零');
    expect(notFoundHtml).not.toContain('官方统计源暂时不可用');
    expect(notFoundHtml).not.toContain('8.6');
    expect(notFoundHtml).not.toContain('not_found');
  });

  it('renders complete, sparse, partial, conflict, unavailable, and not-computable states at both widths', async () => {
    const sparse = structuredClone(result);
    sparse.raw = {
      ...sparse.raw!,
      ratingTotal: 1,
      ratingHistogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1, 9: 0, 10: 0 },
      collection: { wish: 0, collect: 1, doing: 0, onHold: 0, dropped: 0 },
    };
    sparse.rating.population = 1;
    sparse.rating.mean = 8;
    sparse.rating.standardDeviation = 0;
    sparse.rating.distribution = sparse.rating.distribution.map((item) => ({
      ...item,
      count: item.score === 8 ? 1 : 0,
      percentage: item.score === 8 ? 100 : 0,
    }));
    sparse.collection.total = 1;
    sparse.collection.completionRate = 1;
    sparse.collection.distribution = sparse.collection.distribution.map((item) => ({
      ...item,
      count: item.status === 'collect' ? 1 : 0,
      percentage: item.status === 'collect' ? 100 : 0,
    }));
    sparse.coverage = {
      ...sparse.coverage,
      ratingPopulation: 1,
      collectionPopulation: 1,
    };

    const partial = structuredClone(result);
    partial.state = 'partial';
    partial.raw = {
      ...partial.raw!,
      ratingHistogramPresence: {
        1: true,
        2: true,
        3: true,
        4: true,
        5: true,
        6: true,
        7: true,
        8: true,
        9: true,
        10: false,
      },
      collectionPresence: { wish: true, collect: true, doing: true, onHold: false, dropped: true },
    };
    partial.rating.state = 'partial';
    partial.rating.population = 90;
    partial.rating.distribution = partial.rating.distribution.map((item) =>
      item.score === 10 ? { score: item.score } : item,
    );
    partial.collection.state = 'partial';
    partial.collection.total = 9;
    partial.collection.completionRate = undefined;
    partial.collection.completionState = 'partial';
    partial.collection.distribution = partial.collection.distribution.map((item) =>
      item.status === 'on_hold' ? { status: item.status } : item,
    );
    partial.coverage = {
      ...partial.coverage,
      ratingBucketsObserved: 9,
      collectionBucketsObserved: 4,
      ratingPopulation: 90,
      collectionPopulation: 9,
      formulasComplete: 0,
      formulasPartial: 5,
    };
    partial.warnings = [
      {
        code: 'MISSING_FIELD',
        state: 'partial',
        message:
          'bangumi.rating.percentages.v1: Rating histogram contains missing or invalid buckets; rating percentages are suppressed.',
      },
    ];

    const conflict = structuredClone(result);
    conflict.state = 'conflict';
    conflict.rating.state = 'conflict';
    conflict.rating.conflicts = [
      {
        state: 'conflict',
        scope: 'rating',
        fieldPaths: ['rating.histogramMean'],
        reason: 'derived histogram mean differs materially from upstream score',
        candidates: [
          {
            source: {
              class: 'derived-s7',
              provider: 'bangumi-agent-kit-with-a-long-derived-provider-label',
            },
            value: 8.6,
          },
          {
            source: {
              class: 'official-v0',
              provider: 'bangumi-official-provider-with-a-long-source-label',
            },
            value: 6,
          },
        ],
      },
    ];
    conflict.conflicts = [
      {
        state: 'conflict',
        scope: 'collection',
        fieldPaths: ['collection.distribution'],
        reason: 'collection distribution differs between accepted sources',
        candidates: [
          {
            source: { class: 'official-v0', provider: 'bangumi' },
            value: { internalCollectionBucket: 3 },
          },
        ],
      },
    ];
    conflict.warnings = [
      { code: 'RATING_MEAN_CONFLICT', state: 'conflict', message: '两个评分来源存在差异。' },
    ];

    const unavailable: SubjectStatsIntelligenceResult = {
      ...result,
      state: 'unavailable',
      raw: undefined,
      rating: { ...result.rating, state: 'unavailable', distribution: [], population: undefined },
      collection: {
        ...result.collection,
        state: 'unavailable',
        distribution: [],
        total: undefined,
        completionRate: undefined,
        completionState: 'unavailable',
      },
      coverage: { ...result.coverage, sourceRequestsSucceeded: 0, formulasComplete: 0 },
      evidence: [],
      warnings: [
        { code: 'UPSTREAM_UNAVAILABLE', state: 'unavailable', message: '官方统计源不可用。' },
      ],
    };

    const notComputable = structuredClone(result);
    notComputable.state = 'not_computable';
    notComputable.rating.state = 'not_computable';
    notComputable.rating.population = 0;
    notComputable.rating.mean = undefined;
    notComputable.rating.standardDeviation = undefined;
    notComputable.rating.distribution = notComputable.rating.distribution.map((item) => ({
      score: item.score,
      count: 0,
    }));
    notComputable.collection.state = 'not_computable';
    notComputable.collection.total = 0;
    notComputable.collection.completionRate = undefined;
    notComputable.collection.completionState = 'not_computable';
    notComputable.collection.distribution = notComputable.collection.distribution.map((item) => ({
      status: item.status,
      count: 0,
    }));
    notComputable.coverage = {
      ...notComputable.coverage,
      ratingPopulation: 0,
      collectionPopulation: 0,
      formulasComplete: 0,
      formulasNotComputable: 5,
    };
    notComputable.warnings = [
      { code: 'ZERO_POPULATION', state: 'not_computable', message: '评分与收藏样本量为零。' },
    ];

    const notFoundState = structuredClone(unavailable);
    notFoundState.state = 'not_found';
    notFoundState.warnings = [];

    const partialHtml = renderHtmlTemplate(
      buildSubjectStatsViewModel(partial),
      'bangumi-dark',
      {},
      480,
    );
    expect(partialHtml).toContain('已收到 9/10 档');
    expect(partialHtml).toContain('未知 · 未知');
    expect(partialHtml).toContain('部分统计字段未返回，相关指标保持未知。');
    expect(partialHtml).not.toContain('MISSING_FIELD');
    expect(partialHtml).not.toContain('bangumi.rating.percentages.v1');

    const states: Array<[string, SubjectStatsIntelligenceResult]> = [
      ['complete', result],
      ['sparse', sparse],
      ['partial', partial],
      ['conflict', conflict],
      ['unavailable', unavailable],
      ['not-found', notFoundState],
      ['not-computable', notComputable],
    ];
    for (const [label, fixture] of states) {
      const viewModel = buildSubjectStatsViewModel(fixture);
      for (const width of [480, 640, 960]) {
        const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, width);
        expect(html, `${label} HTML at ${width}`).toContain('Bangumi 条目统计 · 当前快照');
        expect(html, `${label} HTML at ${width}`).not.toContain('bangumi.rating.population_sd.v1');
        expect(html, `${label} HTML at ${width}`).not.toContain('UPSTREAM_UNAVAILABLE');
        expect(html, `${label} HTML at ${width}`).not.toContain('NaN');
        expect(html, `${label} HTML at ${width}`).not.toContain('Infinity');
        if (width < 640) continue;
        const rendered = await renderService.renderCard(viewModel, {
          width,
          deviceScaleFactor: 1,
          cache: false,
        });
        expect(rendered.buffer.length, `${label} PNG at ${width}`).toBeGreaterThan(1000);
        if (width === 640) captureVisualQa('single-' + label + '.png', rendered.buffer);
      }
    }
  }, 60_000);
});
