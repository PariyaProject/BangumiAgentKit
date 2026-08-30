import { describe, expect, it } from 'vitest';
import type { SubjectCohortComparisonResult } from '@bangumi-agent-kit/discovery';
import {
  buildSubjectCohortComparisonViewModel,
  extractImageUrls,
  RenderService,
  renderHtmlTemplate,
} from '@bangumi-agent-kit/renderer';

const coverage = {
  state: 'complete' as const,
  requested: 2,
  scanned: 2,
  matched: 2,
  returned: 2,
  pagesRequested: 1,
  pagesScanned: 1,
  upstreamExhausted: true,
  budgetExceeded: false,
  postFilterCount: 0,
  totalKind: 'estimated' as const,
  hydrationsAttempted: 0,
  hydrationsSucceeded: 0,
  hydrationsFailed: 0,
  hydrationsUnresolved: 0,
  hydrationBudgetExceeded: false,
};

const plan = {
  source: 'official_v0' as const,
  operation: 'searchSubjects' as const,
  totalKind: 'estimated' as const,
  pushdown: [],
  postFilters: [],
  derivedFilters: [],
  unsupported: [],
  hydrationRequired: false,
  hydrationRequirements: [],
  requestedTopN: 2,
  resultMode: 'all' as const,
  quality: 'partial_possible' as const,
  budget: {
    maxPages: 6,
    maxCandidates: 300,
    maxHydrations: 60,
    concurrency: 6,
    maxConceptProbes: 8,
    maxReturnedItems: 2,
  },
  steps: [],
  limitations: ['fixture is bounded'],
};

const result = {
  state: 'complete' as const,
  cohorts: [
    {
      label: '2026 春季',
      query: { season: '2026-spring', media: 'anime' as const },
      querySummary: '2026 春季 · 媒介=anime',
      subjects: [
        {
          id: 1,
          name: 'Spring One',
          displayName: '春季一',
          score: 8,
          collectionTotal: 100,
          episodesReported: 12,
          totalEpisodesReported: 12,
          metricStates: { score: 'available', heat: 'available', episodesReported: 'available' },
        },
      ],
      coverage: {
        query: { state: 'ok' as const, coverage, plan },
        detailHydrationsAttempted: 1,
        detailHydrationsSucceeded: 1,
        detailHydrationsFailed: 0,
        metrics: {
          score: { valid: 1, missing: 0, conflicts: 0, state: 'complete' as const },
          heat: { valid: 1, missing: 0, conflicts: 0, state: 'complete' as const },
          episodesReported: { valid: 1, missing: 0, conflicts: 0, state: 'complete' as const },
        },
      },
    },
    {
      label: '2026 夏季',
      query: { season: '2026-summer', media: 'anime' as const },
      querySummary: '2026 夏季 · 媒介=anime',
      subjects: [
        {
          id: 2,
          name: 'Summer One',
          displayName: '夏季一',
          score: 7,
          collectionTotal: 80,
          episodesReported: 13,
          totalEpisodesReported: 13,
          metricStates: { score: 'available', heat: 'available', episodesReported: 'available' },
        },
      ],
      coverage: {
        query: { state: 'ok' as const, coverage, plan },
        detailHydrationsAttempted: 1,
        detailHydrationsSucceeded: 1,
        detailHydrationsFailed: 0,
        metrics: {
          score: { valid: 1, missing: 0, conflicts: 0, state: 'complete' as const },
          heat: { valid: 1, missing: 0, conflicts: 0, state: 'complete' as const },
          episodesReported: { valid: 1, missing: 0, conflicts: 0, state: 'complete' as const },
        },
      },
    },
  ],
  metrics: [
    {
      key: 'score' as const,
      label: '平均评分',
      sourceField: 'subject.rating.score',
      averages: [8, 7] as [number, number],
      validCounts: [1, 1] as [number, number],
      missingCounts: [0, 0] as [number, number],
      conflictCounts: [0, 0] as [number, number],
      delta: -1,
      state: 'complete' as const,
    },
    {
      key: 'heat' as const,
      label: '平均热度（收藏总数）',
      sourceField: 'subject.collection.total',
      averages: [100, 80] as [number, number],
      validCounts: [1, 1] as [number, number],
      missingCounts: [0, 0] as [number, number],
      conflictCounts: [0, 0] as [number, number],
      delta: -20,
      state: 'complete' as const,
    },
    {
      key: 'episodesReported' as const,
      label: '平均报告话数',
      sourceField: 'subject.eps',
      averages: [12, 13] as [number, number],
      validCounts: [1, 1] as [number, number],
      missingCounts: [0, 0] as [number, number],
      conflictCounts: [0, 0] as [number, number],
      delta: 1,
      state: 'complete' as const,
    },
  ],
  formulaVersion: 'subject-cohort-comparison-v1' as const,
  coverage: {
    maxSubjectsPerCohort: 40,
    totalSubjectsReturned: 2,
    cohortsComplete: 2,
    cohortsPartial: 0,
    detailHydrationsAttempted: 2,
    detailHydrationsSucceeded: 2,
    detailHydrationsFailed: 0,
    truncated: false,
    evidence: {
      retained: 0,
      omitted: 0,
      deduplicated: 0,
      omittedByBound: 0,
      bytes: 0,
      maxRefs: 256,
      maxBytes: 96000,
      truncated: false,
    },
    warnings: { retained: 0, omitted: 0, max: 12, truncated: false },
  },
  source: {
    official: {
      class: 'official-v0' as const,
      operations: ['searchSubjects', 'getSubjectById'],
      attemptedAt: '2026-08-30T00:00:00.000Z',
      retrievedAt: '2026-08-30T00:00:01.000Z',
    },
    derived: {
      class: 'derived-s7' as const,
      operations: ['subject-cohort-comparison'],
      attemptedAt: '2026-08-30T00:00:00.000Z',
      retrievedAt: '2026-08-30T00:00:01.000Z',
    },
  },
  evidence: [],
  warnings: [],
  limitations: ['fixture is bounded'],
  retrievedAt: '2026-08-30T00:00:01.000Z',
} satisfies SubjectCohortComparisonResult;

describe('subject cohort comparison renderer', () => {
  it('builds a bounded first-class card without image/network dependencies', () => {
    const viewModel = buildSubjectCohortComparisonViewModel(result, { maxSubjectsPerCohort: 1 });
    expect(viewModel.template).toBe('subject-cohort-comparison');
    expect(viewModel.coverage.omittedSubjectsPerCohort).toEqual([0, 0]);
    expect(extractImageUrls(viewModel)).toEqual([]);

    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 720);
    expect(html).toContain('条目群体比较');
    expect(html).toContain('2026 春季');
    expect(html).toContain('B − A');
  });

  it('labels partial observations separately from accepted averages', () => {
    const partial = buildSubjectCohortComparisonViewModel({
      ...result,
      state: 'partial',
      metrics: [
        {
          ...result.metrics[0]!,
          averages: [undefined, undefined],
          partialAverages: [8, 7],
          delta: undefined,
          state: 'partial',
        },
        ...result.metrics.slice(1),
      ],
    });
    const html = renderHtmlTemplate(partial, 'bangumi-dark', {}, 720);
    expect(html).toContain('partial observation');
  });

  it('renders a bounded long cohort card at both supported widths', async () => {
    const longResult: SubjectCohortComparisonResult = {
      ...result,
      cohorts: result.cohorts.map((cohort, cohortIndex) => ({
        ...cohort,
        label: `${cohort.label} ${'非常长的标题'.repeat(20)}`,
        querySummary: `${cohort.querySummary} ${'很长的查询摘要'.repeat(40)}`,
        subjects: Array.from({ length: 60 }, (_, index) => ({
          ...cohort.subjects[0]!,
          id: cohortIndex * 1000 + index + 1,
          name: `${'原始条目名称'.repeat(30)} ${index}`,
          displayName: `${'超长中文条目名称'.repeat(30)} ${index}`,
        })),
      })),
      warnings: Array.from({ length: 12 }, (_, index) => ({
        code: `LONG_WARNING_${index}`,
        state: 'partial' as const,
        message: '有界渲染告警'.repeat(40),
      })),
      limitations: Array.from({ length: 8 }, (_, index) => `限制 ${index} ${'说明'.repeat(80)}`),
    };
    const viewModel = buildSubjectCohortComparisonViewModel(longResult, {
      maxSubjectsPerCohort: 12,
    });
    const service = new RenderService();
    try {
      for (const width of [640, 960]) {
        const rendered = await service.renderCard(viewModel, { width, cache: false });
        expect(rendered.buffer.subarray(0, 8)).toEqual(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        );
        expect(rendered.height).toBeLessThan(6000);
      }
    } finally {
      await service.close();
    }
  });

  it('renders one cohort without inventing a B-minus-A column', () => {
    const oneCohort = buildSubjectCohortComparisonViewModel({
      ...result,
      cohorts: [result.cohorts[0]!],
      metrics: result.metrics.map((metric) => ({
        ...metric,
        averages: [metric.averages[0]],
        delta: undefined,
      })),
    });
    const html = renderHtmlTemplate(oneCohort, 'bangumi-dark', {}, 720);
    expect(html).toContain('条目群体聚合');
    expect(html).toContain('单 cohort 观察');
    expect(html).not.toContain('B − A');
  });
});
