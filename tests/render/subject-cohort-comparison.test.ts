import { describe, expect, it } from 'vitest';
import type { SubjectCohortComparisonResult } from '@bangumi-agent-kit/discovery';
import {
  buildSubjectCohortComparisonViewModel,
  extractImageUrls,
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
});
