import { describe, expect, it } from 'vitest';
import { compareSubjectCohorts } from '@bangumi-agent-kit/discovery';
import type {
  CapabilityResult,
  EvidenceRef,
  ProviderRequestContext,
  ProviderSubjectData,
  SubjectDiscoveryBrowseRequest,
  SubjectDiscoveryCandidate,
  SubjectDiscoveryPage,
  SubjectDiscoveryProvider,
  SubjectDiscoverySearchRequest,
  SubjectStatsData,
} from '@bangumi-agent-kit/provider-core';

interface FixtureSubject {
  id: number;
  name: string;
  score: number;
  heat: number;
  episodes: number;
  ratingHistogram?: SubjectStatsData['ratingHistogram'];
  ratingHistogramPresence?: SubjectStatsData['ratingHistogramPresence'];
  ratingTotal?: number;
}

function stats(subject: FixtureSubject): SubjectStatsData {
  const ratingHistogram = subject.ratingHistogram || {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
    8: 0,
    9: 0,
    10: 0,
    [Math.round(subject.score)]: 100,
  };
  const ratingTotal =
    subject.ratingTotal ?? Object.values(ratingHistogram).reduce((sum, count) => sum + count, 0);
  return {
    score: subject.score,
    rank: 1,
    ratingTotal,
    ratingHistogram,
    ...(subject.ratingHistogramPresence
      ? { ratingHistogramPresence: subject.ratingHistogramPresence }
      : {}),
    collection: { wish: 0, collect: subject.heat, doing: 0, onHold: 0, dropped: 0 },
  };
}

function histogram(counts: Partial<SubjectStatsData['ratingHistogram']> = {}) {
  return {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
    8: 0,
    9: 0,
    10: 0,
    ...counts,
  };
}

class CohortProvider implements SubjectDiscoveryProvider {
  readonly searchCalls: string[] = [];
  readonly searchRequests: SubjectDiscoverySearchRequest[] = [];
  readonly detailCalls: number[] = [];

  constructor(
    private readonly groups: Record<string, FixtureSubject[]>,
    private readonly unavailableIds = new Set<number>(),
    private readonly missingIds = new Set<number>(),
    private readonly evidenceCount = 0,
    private readonly warningCount = 0,
  ) {}

  async getSubject(
    id: number,
    _context?: ProviderRequestContext,
  ): Promise<CapabilityResult<ProviderSubjectData>> {
    this.detailCalls.push(id);
    if (this.unavailableIds.has(id)) {
      return {
        state: 'unavailable',
        error: { code: 'upstream_unavailable', retryable: true },
        warnings: [{ code: 'UPSTREAM_ERROR', message: 'fixture detail unavailable' }],
      };
    }
    if (this.missingIds.has(id)) return { state: 'not_found' };
    const subject = Object.values(this.groups)
      .flat()
      .find((candidate) => candidate.id === id);
    if (!subject) return { state: 'not_found' };
    return {
      state: 'ok',
      data: {
        id: subject.id,
        type: 2,
        name: subject.name,
        nameCn: subject.name,
        summary: '',
        nsfw: false,
        locked: false,
        date: '2026-01-01',
        platform: 'TV',
        images: {},
        eps: subject.episodes,
        totalEpisodes: subject.episodes,
        stats: stats(subject),
      },
      evidence: {},
    };
  }

  async getSubjectStats(
    id: number,
    context?: ProviderRequestContext,
  ): Promise<CapabilityResult<SubjectStatsData>> {
    const result = await this.getSubject(id, context);
    return result.data
      ? { ...result, data: result.data.stats }
      : (result as unknown as CapabilityResult<SubjectStatsData>);
  }

  async searchSubjects(
    request: SubjectDiscoverySearchRequest,
  ): Promise<CapabilityResult<SubjectDiscoveryPage>> {
    this.searchCalls.push(request.keyword);
    this.searchRequests.push(request);
    const subjects = this.groups[request.keyword] || [];
    const items: SubjectDiscoveryCandidate[] = subjects.map((subject) => ({
      id: subject.id,
      type: 2,
      name: subject.name,
      nameCn: subject.name,
      date: '2026-01-01',
      platform: 'TV',
      ...(this.missingIds.has(subject.id) ? {} : { score: subject.score }),
      ratingCount:
        subject.ratingTotal ??
        (subject.ratingHistogram
          ? Object.values(subject.ratingHistogram).reduce((sum, count) => sum + count, 0)
          : 100),
      ...(this.missingIds.has(subject.id) ? {} : { collection: { collect: subject.heat } }),
      tags: [],
      metaTags: [],
    }));
    return {
      state: 'ok',
      data: {
        items: items.slice(request.offset, request.offset + request.limit),
        total: items.length,
        totalKind: 'estimated',
        limit: request.limit,
        offset: request.offset,
      },
      evidence: {
        items: Array.from({ length: this.evidenceCount }, (_, index): EvidenceRef => ({
          source: {
            class: 'official_v0',
            provider: 'fixture',
            operation: 'searchSubjects',
            version: 'v0',
          },
          retrievedAt: '2026-08-30T00:00:00.000Z',
          fieldPath: `items[${index}]`,
          freshness: { state: 'unknown' },
          authScope: 'public',
          confidence: 'high',
        })),
      },
      warnings: Array.from({ length: this.warningCount }, (_, index) => ({
        code: 'UPSTREAM_ERROR' as const,
        message: `fixture warning ${index}`,
      })),
    };
  }

  async browseSubjects(
    _request: SubjectDiscoveryBrowseRequest,
  ): Promise<CapabilityResult<SubjectDiscoveryPage>> {
    return {
      state: 'ok',
      data: { items: [], total: 0, totalKind: 'exact', limit: 20, offset: 0 },
      evidence: {},
    };
  }
}

const definitions = [
  { label: 'A cohort', query: { keyword: 'A', media: 'anime' as const } },
  { label: 'B cohort', query: { keyword: 'B', media: 'anime' as const } },
] as const;

describe('subject cohort comparison', () => {
  it('aggregates two bounded official discovery cohorts with deterministic B-minus-A deltas', async () => {
    const provider = new CohortProvider({
      A: [
        { id: 1, name: 'A one', score: 8, heat: 10, episodes: 12 },
        { id: 2, name: 'A two', score: 10, heat: 30, episodes: 8 },
      ],
      B: [
        { id: 3, name: 'B one', score: 6, heat: 20, episodes: 4 },
        { id: 4, name: 'B two', score: 8, heat: 40, episodes: 12 },
      ],
    });

    const result = await compareSubjectCohorts(definitions, { maxSubjects: 4 }, provider, {
      authScope: 'public',
    });

    expect(result.state).toBe('complete');
    expect(result.metrics.map((metric) => metric.averages)).toEqual([
      [9, 7],
      [20, 30],
      [10, 8],
      [0, 0],
    ]);
    expect(result.metrics.map((metric) => metric.delta)).toEqual([-2, 10, -2, 0]);
    expect(result.metrics.every((metric) => metric.state === 'complete')).toBe(true);
    expect(result.coverage.totalSubjectsReturned).toBe(4);
    expect(result.coverage.detailHydrationsSucceeded).toBe(4);
    expect(result.formulaVersion).toBe('subject-cohort-comparison-v1');
    expect(result.evidence.at(-1)?.source.class).toBe('derived');
  });

  it('computes per-subject population standard deviation, bounded cohort means, and overlap', async () => {
    const spread = histogram({ 6: 50, 10: 50 });
    const provider = new CohortProvider({
      A: [{ id: 10, name: 'Target', score: 8, heat: 10, episodes: 12, ratingHistogram: spread }],
      B: [
        { id: 10, name: 'Target', score: 8, heat: 10, episodes: 12, ratingHistogram: spread },
        {
          id: 11,
          name: 'Peer',
          score: 8,
          heat: 20,
          episodes: 12,
          ratingHistogram: histogram({ 8: 100 }),
        },
      ],
    });

    const result = await compareSubjectCohorts(definitions, { maxSubjects: 4 }, provider);
    const metric = result.metrics.find((item) => item.key === 'ratingStandardDeviation');

    expect(metric).toMatchObject({
      averages: [2, 1],
      validCounts: [1, 2],
      partialCounts: [0, 0],
      missingCounts: [0, 0],
      conflictCounts: [0, 0],
      notComputableCounts: [0, 0],
      delta: -1,
      formula: { id: 'bangumi.rating.population_sd.v1', version: 1 },
      state: 'complete',
    });
    expect(result.cohorts[0]?.subjects[0]).toMatchObject({
      ratingCount: 100,
      ratingHistogramPopulation: 100,
      ratingStandardDeviation: 2,
    });
    expect(result.coverage.overlap).toEqual({ subjectIds: [10], count: 1 });
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: 'COHORT_OVERLAP', state: 'partial' }),
    );
    const ratingFormulaEvidence = result.evidence.find(
      (item) => item.source.operation === 'bangumi.rating.population_sd.v1',
    );
    expect(ratingFormulaEvidence?.entity).toEqual({ type: 'subject', id: 10 });
  });

  it('does not compute a standard deviation from missing histogram buckets', async () => {
    const presence = Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => [index + 1, index !== 4]),
    ) as NonNullable<SubjectStatsData['ratingHistogramPresence']>;
    const provider = new CohortProvider({
      A: [
        {
          id: 20,
          name: 'Incomplete',
          score: 8,
          heat: 10,
          episodes: 12,
          ratingHistogram: histogram({ 6: 50, 10: 50 }),
          ratingHistogramPresence: presence,
        },
      ],
      B: [
        {
          id: 21,
          name: 'Complete',
          score: 8,
          heat: 20,
          episodes: 12,
          ratingHistogram: histogram({ 8: 100 }),
        },
      ],
    });

    const result = await compareSubjectCohorts(definitions, { maxSubjects: 4 }, provider);
    const metric = result.metrics.find((item) => item.key === 'ratingStandardDeviation');

    expect(result.state).toBe('partial');
    expect(metric).toMatchObject({
      averages: [undefined, undefined],
      partialAverages: [undefined, 0],
      validCounts: [0, 1],
      partialCounts: [1, 0],
      missingCounts: [0, 0],
      state: 'partial',
    });
    expect(result.cohorts[0]?.subjects[0]?.ratingStandardDeviation).toBeUndefined();
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: 'COHORT_RATING_HISTOGRAM_INCOMPLETE' }),
    );
  });

  it('does not compute a standard deviation from invalid histogram counts without presence metadata', async () => {
    const provider = new CohortProvider({
      A: [
        {
          id: 22,
          name: 'Invalid histogram',
          score: 8,
          heat: 10,
          episodes: 12,
          ratingHistogram: histogram({ 6: 50, 10: -1 }),
        },
      ],
    });

    const result = await compareSubjectCohorts(
      [{ label: 'A', query: { keyword: 'A', media: 'anime' } }],
      {},
      provider,
    );
    const metric = result.metrics.find((item) => item.key === 'ratingStandardDeviation');

    expect(result.state).toBe('partial');
    expect(metric).toMatchObject({
      averages: [undefined],
      partialCounts: [1],
      missingCounts: [0],
      state: 'partial',
    });
    expect(result.cohorts[0]?.subjects[0]?.ratingStandardDeviation).toBeUndefined();
  });

  it('keeps empty histograms not-computable and total mismatches partial', async () => {
    const empty = histogram();
    const emptyProvider = new CohortProvider({
      A: [{ id: 30, name: 'No ratings', score: 0, heat: 0, episodes: 0, ratingHistogram: empty }],
    });
    const emptyResult = await compareSubjectCohorts(
      [{ label: 'A', query: { keyword: 'A', media: 'anime' } }],
      {},
      emptyProvider,
    );
    expect(
      emptyResult.metrics.find((item) => item.key === 'ratingStandardDeviation'),
    ).toMatchObject({
      averages: [undefined],
      notComputableCounts: [1],
      state: 'not_computable',
    });

    const mismatchProvider = new CohortProvider({
      A: [
        {
          id: 31,
          name: 'Mismatched total',
          score: 8,
          heat: 0,
          episodes: 0,
          ratingHistogram: histogram({ 6: 50, 10: 50 }),
          ratingTotal: 99,
        },
      ],
    });
    const mismatchResult = await compareSubjectCohorts(
      [{ label: 'A', query: { keyword: 'A', media: 'anime' } }],
      {},
      mismatchProvider,
    );
    expect(
      mismatchResult.metrics.find((item) => item.key === 'ratingStandardDeviation'),
    ).toMatchObject({
      averages: [undefined],
      partialAverages: [2],
      partialCounts: [1],
      state: 'partial',
    });
    expect(mismatchResult.warnings).toContainEqual(
      expect.objectContaining({ code: 'RATING_TOTAL_MISMATCH', state: 'partial' }),
    );
  });

  it('excludes rating-score conflicts from the cohort standard-deviation mean', async () => {
    const provider = new CohortProvider({
      A: [
        {
          id: 40,
          name: 'Conflicting score',
          score: 9,
          heat: 0,
          episodes: 0,
          ratingHistogram: histogram({ 6: 50, 10: 50 }),
        },
      ],
    });

    const result = await compareSubjectCohorts(
      [{ label: 'A', query: { keyword: 'A', media: 'anime' } }],
      {},
      provider,
    );
    const metric = result.metrics.find((item) => item.key === 'ratingStandardDeviation');

    expect(metric).toMatchObject({
      averages: [undefined],
      conflictCounts: [1],
      state: 'conflict',
    });
    expect(result.cohorts[0]?.subjects[0]?.ratingStandardDeviation).toBe(2);
    expect(result.state).toBe('conflict');
  });

  it('keeps missing detail metrics partial and never substitutes zero', async () => {
    const provider = new CohortProvider(
      {
        A: [
          { id: 1, name: 'A one', score: 8, heat: 10, episodes: 12 },
          { id: 2, name: 'A two', score: 10, heat: 30, episodes: 8 },
        ],
        B: [{ id: 3, name: 'B one', score: 6, heat: 20, episodes: 4 }],
      },
      new Set([2]),
    );

    const result = await compareSubjectCohorts(definitions, { maxSubjects: 4 }, provider);
    const episodes = result.metrics.find((metric) => metric.key === 'episodesReported');

    expect(result.state).toBe('partial');
    expect(episodes).toMatchObject({
      averages: [undefined, undefined],
      partialAverages: [12, 4],
      validCounts: [1, 1],
      missingCounts: [1, 0],
      state: 'partial',
    });
    expect(episodes?.delta).toBeUndefined();
    expect(result.cohorts[0]?.subjects[1]?.episodesReported).toBeUndefined();
  });

  it('supports a natural one-cohort aggregate and preserves effective query limits', async () => {
    const provider = new CohortProvider({
      '': [{ id: 1, name: 'A one', score: 8, heat: 10, episodes: 12 }],
    });
    const result = await compareSubjectCohorts(
      [
        {
          label: 'Spring originals',
          query: { season: '2026-spring', media: 'anime', metaTags: ['原创'], limit: 1 },
        },
      ],
      { maxSubjects: 4 },
      provider,
    );

    expect(result.state).toBe('complete');
    expect(result.cohorts).toHaveLength(1);
    expect(result.cohorts[0]?.query).toMatchObject({
      season: '2026-spring',
      media: 'anime',
      metaTags: ['原创'],
      resultMode: 'all',
      limit: 1,
    });
    expect(result.metrics.every((metric) => metric.averages.length === 1)).toBe(true);
    expect(result.metrics.map((metric) => metric.averages)).toEqual([[8], [10], [12], [0]]);
    expect(result.metrics.every((metric) => metric.delta === undefined)).toBe(true);
    expect(provider.searchRequests[0]).toMatchObject({
      filter: {
        type: [2],
        metaTags: ['原创'],
        airDate: ['>=2026-04-01', '<2026-07-01'],
      },
    });
  });

  it('pushes the defining anime, season, and original-tag constraints into both cohorts', async () => {
    const provider = new CohortProvider({ A: [], B: [] });
    await compareSubjectCohorts(
      [
        {
          label: 'Spring originals',
          query: {
            keyword: 'A',
            season: '2026-spring',
            media: 'anime',
            metaTags: ['原创'],
          },
        },
        {
          label: 'Summer originals',
          query: {
            keyword: 'B',
            season: '2026-summer',
            media: 'anime',
            metaTags: ['原创'],
          },
        },
      ],
      { maxSubjects: 1 },
      provider,
    );

    expect(provider.searchRequests).toHaveLength(2);
    expect(provider.searchRequests.map(({ keyword, filter }) => ({ keyword, filter }))).toEqual([
      {
        keyword: 'A',
        filter: {
          type: [2],
          airDate: ['>=2026-04-01', '<2026-07-01'],
          metaTags: ['原创'],
        },
      },
      {
        keyword: 'B',
        filter: {
          type: [2],
          airDate: ['>=2026-07-01', '<2026-10-01'],
          metaTags: ['原创'],
        },
      },
    ]);
  });

  it('rejects a top-ranked query because the effective cohort contract is all results', async () => {
    const provider = new CohortProvider({});
    await expect(
      compareSubjectCohorts(
        [{ query: { keyword: 'A', media: 'anime', resultMode: 'top' } }],
        {},
        provider,
      ),
    ).rejects.toThrow(/resultMode/);
  });

  it('keeps empty, unavailable, and upstream-error states distinct and deterministic', async () => {
    const empty = new CohortProvider({
      A: [],
      B: [{ id: 1, name: 'B one', score: 8, heat: 10, episodes: 12 }],
    });
    const emptyResult = await compareSubjectCohorts(definitions, {}, empty);
    expect(emptyResult.state).toBe('partial');

    class QueryStateProvider extends CohortProvider {
      constructor(private readonly queryStates: Record<string, 'unavailable' | 'upstream_error'>) {
        super({});
      }

      override async searchSubjects(
        request: SubjectDiscoverySearchRequest,
      ): Promise<CapabilityResult<SubjectDiscoveryPage>> {
        const state = this.queryStates[request.keyword];
        if (state) {
          return {
            state,
            error: {
              code: state === 'unavailable' ? 'upstream_unavailable' : 'upstream_error',
              retryable: state === 'upstream_error',
            },
            warnings: [{ code: 'UPSTREAM_ERROR', message: `fixture ${state}` }],
          };
        }
        return super.searchSubjects(request);
      }
    }

    const unavailable = new QueryStateProvider({ A: 'unavailable', B: 'unavailable' });
    expect((await compareSubjectCohorts(definitions, {}, unavailable)).state).toBe('unavailable');
    const mixedUnavailable = new QueryStateProvider({ A: 'unavailable' });
    expect((await compareSubjectCohorts(definitions, {}, mixedUnavailable)).state).toBe(
      'unavailable',
    );
    const upstreamError = new QueryStateProvider({ A: 'upstream_error', B: 'upstream_error' });
    expect((await compareSubjectCohorts(definitions, {}, upstreamError)).state).toBe(
      'upstream_error',
    );
    const mixedSevere = new QueryStateProvider({ A: 'unavailable', B: 'upstream_error' });
    expect((await compareSubjectCohorts(definitions, {}, mixedSevere)).state).toBe(
      'upstream_error',
    );
  });

  it('reports not_computable when all returned subjects lack every metric', async () => {
    const provider = new CohortProvider(
      {
        A: [{ id: 1, name: 'A missing', score: 8, heat: 10, episodes: 12 }],
        B: [{ id: 2, name: 'B missing', score: 8, heat: 10, episodes: 12 }],
      },
      new Set(),
      new Set([1, 2]),
    );
    const result = await compareSubjectCohorts(definitions, {}, provider);

    expect(result.state).toBe('not_computable');
    expect(result.metrics.every((metric) => metric.state === 'not_computable')).toBe(true);
    expect(
      result.metrics.every((metric) => metric.averages.every((value) => value === undefined)),
    ).toBe(true);
  });

  it('caps flattened evidence by refs and bytes while retaining derived provenance', async () => {
    const provider = new CohortProvider(
      {
        A: [{ id: 1, name: 'A one', score: 8, heat: 10, episodes: 12 }],
        B: [{ id: 2, name: 'B one', score: 8, heat: 10, episodes: 12 }],
      },
      new Set(),
      new Set(),
      400,
    );
    const result = await compareSubjectCohorts(definitions, {}, provider);

    expect(result.coverage.evidence.retained).toBeLessThanOrEqual(256);
    expect(result.coverage.evidence.bytes).toBeLessThanOrEqual(96000);
    expect(result.coverage.evidence.omitted).toBeGreaterThan(0);
    expect(result.coverage.evidence.omittedByBound).toBeGreaterThan(0);
    expect(result.coverage.evidence.truncated).toBe(true);
    expect(result.evidence.at(-1)?.source.class).toBe('derived');
    expect(result.warnings.some((warning) => warning.code === 'COHORT_EVIDENCE_TRUNCATED')).toBe(
      true,
    );
  });

  it('caps warning output and reports warning omission coverage', async () => {
    const provider = new CohortProvider(
      { A: [{ id: 1, name: 'A one', score: 8, heat: 10, episodes: 12 }] },
      new Set(),
      new Set(),
      0,
      20,
    );
    const result = await compareSubjectCohorts(
      [{ query: { keyword: 'A', media: 'anime' } }],
      {},
      provider,
    );

    expect(result.warnings).toHaveLength(12);
    expect(result.coverage.warnings).toMatchObject({
      retained: 12,
      omitted: 8,
      max: 12,
      truncated: true,
    });
  });

  it('marks empty cohorts as not_found and records the bounded output cap', async () => {
    const provider = new CohortProvider({ A: [], B: [] });
    const result = await compareSubjectCohorts(definitions, { maxSubjects: 1 }, provider);

    expect(result.state).toBe('not_found');
    expect(result.cohorts[0]?.coverage.query.state).toBe('not_found');
    expect(result.cohorts[1]?.coverage.query.state).toBe('not_found');
    expect(result.coverage.maxSubjectsPerCohort).toBe(1);
    expect(result.coverage.totalSubjectsReturned).toBe(0);
  });
});
