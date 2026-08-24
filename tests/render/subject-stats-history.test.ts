import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  SubjectStatsHistoryResult,
  SubjectStatsIntelligenceResult,
} from '@bangumi-agent-kit/bangumi-core';
import {
  buildSubjectStatsHistoryViewModel,
  extractImageUrls,
  RenderService,
  renderHtmlTemplate,
} from '@bangumi-agent-kit/renderer';

function snapshot(score: number, ratingTotal: number): SubjectStatsIntelligenceResult {
  return {
    subjectId: 123,
    state: 'complete',
    raw: {
      score,
      rank: 12,
      ratingTotal,
      ratingHistogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 40, 9: 60, 10: 0 },
      collection: { wish: 2, collect: 4, doing: 2, onHold: 1, dropped: 1 },
    },
    rating: {
      state: 'complete',
      population: ratingTotal,
      mean: score,
      standardDeviation: 0.49,
      distribution: [],
      formulas: {
        percentages: {
          id: 'bangumi.rating.percentages.v1',
          version: 1,
          inputs: [],
          evidenceStatus: 'derived',
          description: 'bounded fixture',
        },
        histogramMean: {
          id: 'bangumi.rating.histogram_mean.v1',
          version: 1,
          inputs: [],
          evidenceStatus: 'derived',
          description: 'bounded fixture',
        },
        populationStandardDeviation: {
          id: 'bangumi.rating.population_sd.v1',
          version: 1,
          inputs: [],
          evidenceStatus: 'derived',
          description: 'bounded fixture',
        },
      },
    },
    collection: {
      state: 'complete',
      total: 10,
      distribution: [],
      completionRate: 0.4,
      completionState: 'complete',
      formulas: {
        percentages: {
          id: 'bangumi.collection.percentages.v1',
          version: 1,
          inputs: [],
          evidenceStatus: 'derived',
          description: 'bounded fixture',
        },
        completion: {
          id: 'bangumi.subject.completion.v1',
          version: 1,
          inputs: [],
          evidenceStatus: 'derived',
          description: 'bounded fixture',
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
      ratingPopulation: ratingTotal,
      collectionPopulation: 10,
      formulasAttempted: 5,
      formulasComplete: 5,
      formulasPartial: 0,
      formulasNotComputable: 0,
      formulasConflict: 0,
    },
    source: {
      official: { class: 'official-v0', operations: ['getSubjectStats'] },
      derived: { class: 'derived-s7', operations: ['bangumi.rating.histogram_mean.v1'] },
    },
    evidence: [],
    warnings: [],
    limitations: ['仅展示有限本地观察样本。'],
  };
}

const result: SubjectStatsHistoryResult = {
  subjectId: 123,
  state: 'complete',
  collection: {
    startedAt: '2026-08-24T00:00:00.000Z',
    retentionDays: 365,
    maxObservations: 24,
    recordedObservations: 2,
    retainedObservations: 2,
    observationsObserved: 2,
    observationsReturned: 2,
    completeObservations: 2,
    changePairs: 1,
    truncated: false,
    expiredObservations: 0,
    prunedObservations: 0,
    resourceBounds: {
      maxActiveSubjects: 8,
      hostConcurrency: 1,
      maxSubjectId: 1000000000,
      maxCleanupRows: 120,
    },
    recordCurrent: false,
  },
  observations: [
    {
      id: 'obs-1',
      observedAt: '2026-08-24T00:00:00.000Z',
      retentionUntil: '2027-08-24T00:00:00.000Z',
      state: 'complete',
      methodologyVersion: 'bangumi.subject.stats.observation-history.v1',
      compatibility: { state: 'compatible' },
      snapshot: snapshot(8.6, 100),
    },
    {
      id: 'obs-2',
      observedAt: '2026-08-25T00:00:00.000Z',
      retentionUntil: '2027-08-25T00:00:00.000Z',
      state: 'complete',
      methodologyVersion: 'bangumi.subject.stats.observation-history.v1',
      compatibility: { state: 'compatible' },
      snapshot: snapshot(8.8, 110),
    },
  ],
  changes: [
    {
      fromObservationId: 'obs-1',
      toObservationId: 'obs-2',
      fromObservedAt: '2026-08-24T00:00:00.000Z',
      toObservedAt: '2026-08-25T00:00:00.000Z',
      state: 'complete',
      compatibility: { state: 'compatible' },
      metrics: [
        { key: 'score', state: 'complete', from: 8.6, to: 8.8, delta: 0.2 },
        { key: 'ratingTotal', state: 'complete', from: 100, to: 110, delta: 10 },
      ],
    },
  ],
  methodology: {
    id: 'bangumi.subject.stats.observation-history',
    version: 1,
    metrics: [
      'score',
      'ratingTotal',
      'histogramMean',
      'populationStandardDeviation',
      'collectionTotal',
      'completionRate',
    ],
    description: '相邻 complete 观察差值。',
  },
  source: {
    official: { class: 'official-v0', operations: ['getSubjectStats'], observationCount: 2 },
    derived: {
      class: 'derived-s7',
      operations: ['bangumi.rating.histogram_mean.v1'],
      observationCount: 2,
    },
  },
  warnings: [],
  limitations: ['从显式启用后开始；不会回填。'],
};

describe('subject-stats-history renderer', () => {
  let renderService: RenderService;

  beforeAll(() => {
    renderService = new RenderService();
  });

  afterAll(async () => {
    await renderService.close();
  });

  it('renders bounded observations and deltas without images or network assets', async () => {
    const viewModel = buildSubjectStatsHistoryViewModel(result);
    expect(viewModel.template).toBe('subject-stats-history');
    expect(extractImageUrls(viewModel)).toEqual([]);

    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 640);
    expect(html).toContain('条目统计观察历史');
    expect(html).toContain('相邻变化');
    expect(html).toContain('2026-08-25T00:00:00.000Z');
    expect(html).toContain('评分 +0.20');
    expect(html).toContain('recordCurrent');
    expect(html).not.toContain('https://');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');

    const rendered = await renderService.renderCard(viewModel, {
      width: 640,
      deviceScaleFactor: 1,
    });
    expect(rendered.template).toBe('subject-stats-history');
    expect(rendered.buffer.length).toBeGreaterThan(1000);
  });

  it('renders sparse and incompatible observations truthfully at a narrow width', () => {
    const sparseSnapshot = snapshot(8.6, 100);
    sparseSnapshot.state = 'partial';
    sparseSnapshot.rating.state = 'partial';
    sparseSnapshot.collection.state = 'partial';
    sparseSnapshot.raw!.ratingHistogramPresence = {
      1: false,
      2: true,
      3: true,
      4: true,
      5: true,
      6: true,
      7: true,
      8: true,
      9: true,
      10: true,
    };
    const sparse: SubjectStatsHistoryResult = {
      ...result,
      state: 'partial',
      collection: {
        ...result.collection,
        recordedObservations: 3,
        retainedObservations: 3,
        observationsObserved: 3,
        observationsReturned: 1,
        truncated: true,
      },
      observations: [
        {
          ...result.observations[0]!,
          compatibility: { state: 'unsupported', reason: 'fixture version changed' },
          methodologyVersion: 'bangumi.subject.stats.observation-history.v999',
          snapshot: sparseSnapshot,
        },
      ],
      changes: [],
      warnings: [{ code: 'OBSERVATION_OUTPUT_TRUNCATED', message: 'bounded fixture' }],
    };
    const html = renderHtmlTemplate(
      buildSubjectStatsHistoryViewModel(sparse),
      'bangumi-dark',
      {},
      320,
    );
    expect(html).toContain('部分覆盖');
    expect(html).toContain('分布：评分');
    expect(html).toContain('未知');
    expect(html).toContain('输出有界');
    expect(html).not.toContain('NaN');
  });
});
