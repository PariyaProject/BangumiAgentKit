import { describe, expect, it } from 'vitest';
import { compareSubjectCohorts } from '@bangumi-agent-kit/discovery';
import type {
  CapabilityResult,
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
}

function stats(score: number, heat: number): SubjectStatsData {
  return {
    score,
    rank: 1,
    ratingTotal: 100,
    ratingHistogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 },
    collection: { wish: 0, collect: heat, doing: 0, onHold: 0, dropped: 0 },
  };
}

class CohortProvider implements SubjectDiscoveryProvider {
  readonly searchCalls: string[] = [];
  readonly detailCalls: number[] = [];

  constructor(
    private readonly groups: Record<string, FixtureSubject[]>,
    private readonly unavailableIds = new Set<number>(),
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
        stats: stats(subject.score, subject.heat),
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
    const subjects = this.groups[request.keyword] || [];
    const items: SubjectDiscoveryCandidate[] = subjects.map((subject) => ({
      id: subject.id,
      type: 2,
      name: subject.name,
      nameCn: subject.name,
      date: '2026-01-01',
      platform: 'TV',
      score: subject.score,
      collection: { collect: subject.heat },
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
      evidence: {},
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
    ]);
    expect(result.metrics.map((metric) => metric.delta)).toEqual([-2, 10, -2]);
    expect(result.metrics.every((metric) => metric.state === 'complete')).toBe(true);
    expect(result.coverage.totalSubjectsReturned).toBe(4);
    expect(result.coverage.detailHydrationsSucceeded).toBe(4);
    expect(result.formulaVersion).toBe('subject-cohort-comparison-v1');
    expect(result.evidence.at(-1)?.source.class).toBe('derived');
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
      averages: [12, 4],
      validCounts: [1, 1],
      missingCounts: [1, 0],
      state: 'partial',
    });
    expect(episodes?.delta).toBeUndefined();
    expect(result.cohorts[0].subjects[1]?.episodesReported).toBeUndefined();
  });

  it('marks empty cohorts as not_found and records the bounded output cap', async () => {
    const provider = new CohortProvider({ A: [], B: [] });
    const result = await compareSubjectCohorts(definitions, { maxSubjects: 1 }, provider);

    expect(result.state).toBe('not_found');
    expect(result.cohorts[0].coverage.query.state).toBe('not_found');
    expect(result.cohorts[1].coverage.query.state).toBe('not_found');
    expect(result.coverage.maxSubjectsPerCohort).toBe(1);
    expect(result.coverage.totalSubjectsReturned).toBe(0);
  });
});
