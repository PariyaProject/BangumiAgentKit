import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SubjectStatsIntelligenceResult } from '@bangumi-agent-kit/bangumi-core';
import {
  buildSubjectStatsViewModel,
  extractImageUrls,
  RenderService,
  renderHtmlTemplate,
} from '@bangumi-agent-kit/renderer';

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

    const narrowHtml = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 640);
    const wideHtml = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 960);
    for (const html of [narrowHtml, wideHtml]) {
      expect(html).toContain('条目统计智能');
      expect(html).toContain('评分分布');
      expect(html).toContain('40.0%');
      expect(html).toContain('完成率');
      expect(html).toContain('bangumi.rating.population_sd.v1 v1');
      expect(html).toContain('zero-network card');
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
        reason: 'derived histogram mean differs materially from upstream score',
        candidates: [
          { source: { class: 'derived-s7', provider: 'bangumi-agent-kit' }, value: 8.6 },
          { source: { class: 'official-v0', provider: 'bangumi' }, value: 6 },
        ],
      },
    ];
    conflict.warnings = [
      { code: 'RATING_MEAN_CONFLICT', state: 'conflict', message: '两个评分来源存在差异。' },
    ];
    const conflictHtml = renderHtmlTemplate(
      buildSubjectStatsViewModel(conflict),
      'bangumi-dark',
      {},
      640,
    );
    expect(conflictHtml).toContain('评分来源冲突');
    expect(conflictHtml).toContain('derived-s7/bangumi-agent-kit = 8.60');
    expect(conflictHtml).toContain('official-v0/bangumi = 6.00');

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
    const unavailableHtml = renderHtmlTemplate(
      buildSubjectStatsViewModel(unavailable),
      'bangumi-dark',
      {},
      640,
    );
    expect(unavailableHtml).toContain('官方统计源暂时不可用');
    expect(unavailableHtml).toContain('不可用');
    expect(unavailableHtml).not.toContain('8.6');
    expect(unavailableHtml).not.toContain('NaN');
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
        code: 'FORMULA_SUPPRESSED',
        state: 'partial',
        message: 'Missing rating and collection buckets; derived metrics are suppressed.',
      },
    ];

    const conflict = structuredClone(result);
    conflict.state = 'conflict';
    conflict.rating.state = 'conflict';
    conflict.rating.conflicts = [
      {
        state: 'conflict',
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

    const states: Array<[string, SubjectStatsIntelligenceResult]> = [
      ['complete', result],
      ['sparse', sparse],
      ['partial', partial],
      ['conflict', conflict],
      ['unavailable', unavailable],
      ['not-computable', notComputable],
    ];
    for (const [label, fixture] of states) {
      const viewModel = buildSubjectStatsViewModel(fixture);
      for (const width of [640, 960]) {
        const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, width);
        expect(html, `${label} HTML at ${width}`).toContain('zero-network card');
        expect(html, `${label} HTML at ${width}`).not.toContain('NaN');
        expect(html, `${label} HTML at ${width}`).not.toContain('Infinity');
        const rendered = await renderService.renderCard(viewModel, {
          width,
          deviceScaleFactor: 1,
          cache: false,
        });
        expect(rendered.buffer.length, `${label} PNG at ${width}`).toBeGreaterThan(1000);
      }
    }
  }, 60_000);
});
