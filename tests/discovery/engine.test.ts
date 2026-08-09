import { describe, expect, it } from 'vitest';
import {
  ConceptResolver,
  DiscoveryEngine,
  type ConceptDefinition,
} from '@bangumi-agent-kit/discovery';
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

function stats(score: number, rank: number, total: number): SubjectStatsData {
  return {
    score,
    rank,
    ratingTotal: total,
    ratingHistogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 },
    collection: { wish: 1, collect: 2, doing: 3, onHold: 4, dropped: 5 },
  };
}

class FixtureDiscoveryProvider implements SubjectDiscoveryProvider {
  inFlight = 0;
  maxInFlight = 0;
  searchCalls = 0;
  hydrateCalls = 0;
  private readonly subjects = [
    { id: 1, type: 2, name: 'A', nameCn: '甲', platform: 'TV', date: '2026-07-01', tags: ['后宫'], metaTags: ['原创'], score: 8, rank: 3, ratingCount: 100 },
    { id: 2, type: 2, name: 'B', nameCn: '乙', platform: 'Movie', date: '2026-07-02', tags: ['后宫'], metaTags: [], score: 9, rank: 2, ratingCount: 200 },
    { id: 2, type: 2, name: 'B duplicate', nameCn: '乙', platform: 'Movie', date: '2026-07-02', tags: ['后宫'], metaTags: [], score: 9, rank: 2, ratingCount: 200 },
    { id: 3, type: 2, name: 'C', nameCn: '丙', platform: 'TV', date: '2026-07-03', tags: [], metaTags: [], score: 7, rank: 4, ratingCount: 50 },
  ];

  async getSubject(id: number, _context?: ProviderRequestContext): Promise<CapabilityResult<ProviderSubjectData>> {
    this.inFlight += 1;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    this.hydrateCalls += 1;
    await Promise.resolve();
    const subject = this.subjects.find((item) => item.id === id);
    this.inFlight -= 1;
    if (!subject) return { state: 'not_found' };
    return {
      state: 'ok',
      data: {
        id,
        type: subject.type,
        name: subject.name,
        nameCn: subject.nameCn,
        summary: '',
        nsfw: false,
        locked: false,
        date: subject.date,
        platform: subject.platform,
        images: { medium: `https://img.example/${id}.jpg` },
        eps: 12,
        totalEpisodes: 12,
        stats: stats(subject.score, subject.rank, subject.ratingCount),
      },
      evidence: {},
    };
  }

  async getSubjectStats(id: number, context?: ProviderRequestContext): Promise<CapabilityResult<SubjectStatsData>> {
    const result = await this.getSubject(id, context);
    return result.data
      ? { ...result, data: result.data.stats }
      : (result as unknown as CapabilityResult<SubjectStatsData>);
  }

  async searchSubjects(request: SubjectDiscoverySearchRequest): Promise<CapabilityResult<SubjectDiscoveryPage>> {
    this.searchCalls += 1;
    const start = request.offset;
    const page = this.subjects.slice(start, start + 2);
    return {
      state: 'ok',
      data: { items: page, total: this.subjects.length, totalKind: 'estimated', limit: 2, offset: request.offset },
      evidence: {},
    };
  }

  async browseSubjects(_request: SubjectDiscoveryBrowseRequest): Promise<CapabilityResult<SubjectDiscoveryPage>> {
    return { state: 'ok', data: { items: [], total: 0, totalKind: 'exact', limit: 20, offset: 0 }, evidence: {} };
  }
}

class LargeAllModeProvider implements SubjectDiscoveryProvider {
  readonly searchCalls: number[] = [];
  private readonly subjects = Array.from({ length: 47 }, (_, index) => ({
    id: index + 1,
    type: 2,
    name: `Subject ${index + 1}`,
    nameCn: `条目 ${index + 1}`,
    platform: 'TV',
    date: '2026-07-01',
    tags: [],
    metaTags: [],
    score: 10 - index / 100,
    rank: index + 1,
    ratingCount: 1000,
  }));

  async getSubject(): Promise<CapabilityResult<ProviderSubjectData>> {
    return { state: 'not_found' };
  }

  async getSubjectStats(): Promise<CapabilityResult<SubjectStatsData>> {
    return { state: 'not_found' };
  }

  async searchSubjects(request: SubjectDiscoverySearchRequest): Promise<CapabilityResult<SubjectDiscoveryPage>> {
    this.searchCalls.push(request.offset);
    const items = this.subjects.slice(request.offset, request.offset + request.limit);
    return {
      state: 'ok',
      data: { items, total: this.subjects.length, totalKind: 'estimated', limit: request.limit, offset: request.offset },
      evidence: {},
    };
  }

  async browseSubjects(_request: SubjectDiscoveryBrowseRequest): Promise<CapabilityResult<SubjectDiscoveryPage>> {
    return { state: 'ok', data: { items: [], total: 0, totalKind: 'exact', limit: 20, offset: 0 }, evidence: {} };
  }
}

class EstimatedTotalProvider implements SubjectDiscoveryProvider {
  readonly searchCalls: number[] = [];
  private readonly subjects: SubjectDiscoveryCandidate[] = Array.from({ length: 4 }, (_, index) => ({
    id: index + 1,
    type: 2,
    name: `Estimated ${index + 1}`,
    platform: 'TV',
    tags: [],
    metaTags: [],
  }));

  async getSubject(): Promise<CapabilityResult<ProviderSubjectData>> {
    return { state: 'not_found' };
  }

  async getSubjectStats(): Promise<CapabilityResult<SubjectStatsData>> {
    return { state: 'not_found' };
  }

  async searchSubjects(request: SubjectDiscoverySearchRequest): Promise<CapabilityResult<SubjectDiscoveryPage>> {
    this.searchCalls.push(request.offset);
    const items = this.subjects.slice(request.offset, request.offset + 2);
    return {
      state: 'ok',
      data: { items, total: 2, totalKind: 'estimated', limit: 2, offset: request.offset },
      evidence: {},
    };
  }

  async browseSubjects(_request: SubjectDiscoveryBrowseRequest): Promise<CapabilityResult<SubjectDiscoveryPage>> {
    return { state: 'ok', data: { items: [], total: 0, totalKind: 'exact', limit: 20, offset: 0 }, evidence: {} };
  }
}

class ExactBrowseProvider implements SubjectDiscoveryProvider {
  private readonly subjects: SubjectDiscoveryCandidate[] = Array.from({ length: 4 }, (_, index) => ({
    id: index + 1,
    type: 2,
    name: `Browse ${index + 1}`,
    platform: 'TV',
    date: `2026-07-0${index + 1}`,
    tags: [],
    metaTags: [],
  }));

  async getSubject(): Promise<CapabilityResult<ProviderSubjectData>> {
    return { state: 'not_found' };
  }

  async getSubjectStats(): Promise<CapabilityResult<SubjectStatsData>> {
    return { state: 'not_found' };
  }

  async searchSubjects(_request: SubjectDiscoverySearchRequest): Promise<CapabilityResult<SubjectDiscoveryPage>> {
    return { state: 'ok', data: { items: [], total: 0, totalKind: 'estimated', limit: 20, offset: 0 }, evidence: {} };
  }

  async browseSubjects(request: SubjectDiscoveryBrowseRequest): Promise<CapabilityResult<SubjectDiscoveryPage>> {
    const items = this.subjects.slice(request.offset, request.offset + 2);
    return {
      state: 'ok',
      data: { items, total: this.subjects.length, totalKind: 'exact', limit: 2, offset: request.offset },
      evidence: {},
    };
  }
}

class MultiCategoryProvider implements SubjectDiscoveryProvider {
  readonly searchCalls = 0;
  private readonly subjects: SubjectDiscoveryCandidate[] = [
    { id: 101, type: 2, name: 'TV subject', platform: 'TV', tags: [], metaTags: [] },
    { id: 102, type: 2, name: 'OVA subject', platform: 'OVA', tags: [], metaTags: [] },
  ];

  async getSubject(id: number): Promise<CapabilityResult<ProviderSubjectData>> {
    const subject = this.subjects.find((item) => item.id === id);
    if (!subject) return { state: 'not_found' };
    return {
      state: 'ok',
      data: {
        id: subject.id,
        type: subject.type,
        name: subject.name,
        nameCn: subject.name,
        summary: '',
        nsfw: false,
        locked: false,
        date: '2026-07-01',
        platform: subject.platform ?? 'TV',
        images: {},
        eps: 1,
        totalEpisodes: 1,
        stats: stats(8, subject.id, 100),
      },
      evidence: {},
    };
  }

  async getSubjectStats(id: number): Promise<CapabilityResult<SubjectStatsData>> {
    const result = await this.getSubject(id);
    return result.data
      ? { ...result, data: result.data.stats }
      : (result as unknown as CapabilityResult<SubjectStatsData>);
  }

  async searchSubjects(_request: SubjectDiscoverySearchRequest): Promise<CapabilityResult<SubjectDiscoveryPage>> {
    return {
      state: 'ok',
      data: { items: this.subjects, total: 2, totalKind: 'estimated', limit: 2, offset: 0 },
      evidence: {},
    };
  }

  async browseSubjects(_request: SubjectDiscoveryBrowseRequest): Promise<CapabilityResult<SubjectDiscoveryPage>> {
    return {
      state: 'ok',
      data: { items: [this.subjects[0]!], total: 1, totalKind: 'exact', limit: 1, offset: 0 },
      evidence: {},
    };
  }
}

class NativeOrderProvider implements SubjectDiscoveryProvider {
  readonly searchCalls: number[] = [];
  hydrateCalls = 0;
  private readonly subjects: SubjectDiscoveryCandidate[] = [
    { id: 1, type: 2, name: 'Rank 1', platform: 'TV', date: '2026-01-01', score: 7, rank: 1, collection: { collect: 100 }, tags: [], metaTags: [] },
    { id: 2, type: 2, name: 'Rank 2', platform: 'TV', date: '2026-02-01', score: 8, rank: 2, collection: { collect: 80 }, tags: [], metaTags: [] },
    { id: 3, type: 2, name: 'Rank 3', platform: 'TV', date: '2026-03-01', score: 9, rank: 3, collection: { collect: 60 }, tags: [], metaTags: [] },
    { id: 4, type: 2, name: 'Rank 4', platform: 'TV', date: '2026-04-01', score: 10, rank: 4, collection: { collect: 40 }, tags: [], metaTags: [] },
  ];

  async getSubject(): Promise<CapabilityResult<ProviderSubjectData>> {
    this.hydrateCalls += 1;
    return { state: 'not_found' };
  }

  async getSubjectStats(): Promise<CapabilityResult<SubjectStatsData>> {
    return { state: 'not_found' };
  }

  async searchSubjects(request: SubjectDiscoverySearchRequest): Promise<CapabilityResult<SubjectDiscoveryPage>> {
    this.searchCalls.push(request.offset);
    const ordered = request.sort === 'rank'
      ? [this.subjects[0]!, this.subjects[1]!, this.subjects[2]!, this.subjects[3]!]
      : request.sort === 'score'
        ? [this.subjects[3]!, this.subjects[2]!, this.subjects[1]!, this.subjects[0]!]
        : request.sort === 'heat'
          ? [this.subjects[0]!, this.subjects[1]!, this.subjects[2]!, this.subjects[3]!]
          : [this.subjects[2]!, this.subjects[0]!, this.subjects[3]!, this.subjects[1]!];
    const items = ordered.slice(request.offset, request.offset + 2);
    return {
      state: 'ok',
      data: { items, total: ordered.length, totalKind: 'estimated', limit: 2, offset: request.offset },
      evidence: {},
    };
  }

  async browseSubjects(_request: SubjectDiscoveryBrowseRequest): Promise<CapabilityResult<SubjectDiscoveryPage>> {
    return { state: 'ok', data: { items: [], total: 0, totalKind: 'exact', limit: 20, offset: 0 }, evidence: {} };
  }
}

class MetaExclusionProvider implements SubjectDiscoveryProvider {
  private readonly subjects: SubjectDiscoveryCandidate[] = [
    { id: 201, type: 2, name: 'Original', platform: 'TV', tags: [], metaTags: ['原创'] },
    { id: 202, type: 2, name: 'Science fiction', platform: 'TV', tags: [], metaTags: ['原创', '科幻'] },
  ];

  async getSubject(id: number): Promise<CapabilityResult<ProviderSubjectData>> {
    const subject = this.subjects.find((item) => item.id === id);
    if (!subject) return { state: 'not_found' };
    return {
      state: 'ok',
      data: {
        id: subject.id,
        type: subject.type,
        name: subject.name,
        nameCn: subject.name,
        summary: '',
        nsfw: false,
        locked: false,
        date: '2026-07-01',
        platform: subject.platform ?? 'TV',
        images: {},
        eps: 1,
        totalEpisodes: 1,
        tags: [...subject.tags],
        metaTags: [...subject.metaTags],
        stats: stats(8, subject.id, 100),
      },
      evidence: {},
    };
  }

  async getSubjectStats(id: number): Promise<CapabilityResult<SubjectStatsData>> {
    const result = await this.getSubject(id);
    return result.data
      ? { ...result, data: result.data.stats }
      : (result as unknown as CapabilityResult<SubjectStatsData>);
  }

  async searchSubjects(_request: SubjectDiscoverySearchRequest): Promise<CapabilityResult<SubjectDiscoveryPage>> {
    return {
      state: 'ok',
      data: { items: this.subjects, total: 2, totalKind: 'estimated', limit: 2, offset: 0 },
      evidence: {},
    };
  }

  async browseSubjects(_request: SubjectDiscoveryBrowseRequest): Promise<CapabilityResult<SubjectDiscoveryPage>> {
    return { state: 'ok', data: { items: [], total: 0, totalKind: 'exact', limit: 20, offset: 0 }, evidence: {} };
  }
}

class GlobalHydrationBudgetProvider implements SubjectDiscoveryProvider {
  getSubjectCalls = 0;

  async getSubject(id: number): Promise<CapabilityResult<ProviderSubjectData>> {
    this.getSubjectCalls += 1;
    const retained = (id - 1) % 20 < 2;
    return {
      state: 'ok',
      data: {
        id,
        type: 2,
        name: `Hydrated ${id}`,
        nameCn: `Hydrated ${id}`,
        summary: '',
        nsfw: false,
        locked: false,
        date: '2026-07-01',
        platform: retained ? 'TV' : 'Movie',
        images: {},
        eps: 1,
        totalEpisodes: 1,
        stats: stats(8, id, 100),
      },
      evidence: {},
    };
  }

  async getSubjectStats(id: number): Promise<CapabilityResult<SubjectStatsData>> {
    const result = await this.getSubject(id);
    return result.data
      ? { ...result, data: result.data.stats }
      : (result as unknown as CapabilityResult<SubjectStatsData>);
  }

  async searchSubjects(request: SubjectDiscoverySearchRequest): Promise<CapabilityResult<SubjectDiscoveryPage>> {
    const items = Array.from({ length: 20 }, (_, index) => ({
      id: request.offset + index + 1,
      type: 2,
      name: `Candidate ${request.offset + index + 1}`,
      tags: [],
      metaTags: [],
    }));
    return {
      state: 'ok',
      data: { items, total: 200, totalKind: 'estimated', limit: 20, offset: request.offset },
      evidence: {},
    };
  }

  async browseSubjects(_request: SubjectDiscoveryBrowseRequest): Promise<CapabilityResult<SubjectDiscoveryPage>> {
    return { state: 'ok', data: { items: [], total: 0, totalKind: 'exact', limit: 20, offset: 0 }, evidence: {} };
  }
}

class FailedHydrationProvider implements SubjectDiscoveryProvider {
  getSubjectCalls = 0;

  constructor(private readonly failureState: 'unavailable' | 'not_found' = 'unavailable') {}

  async getSubject(): Promise<CapabilityResult<ProviderSubjectData>> {
    this.getSubjectCalls += 1;
    return {
      state: this.failureState,
      error: {
        code: this.failureState === 'not_found' ? 'not_found' : 'upstream_unavailable',
        retryable: this.failureState !== 'not_found',
      },
      warnings: [{
        code: this.failureState === 'not_found' ? 'UPSTREAM_NOT_FOUND' : 'UPSTREAM_ERROR',
        message: 'fixture unavailable',
      }],
    };
  }

  async getSubjectStats(): Promise<CapabilityResult<SubjectStatsData>> {
    return { state: 'unavailable', error: { code: 'upstream_unavailable', retryable: true } };
  }

  async searchSubjects(_request: SubjectDiscoverySearchRequest): Promise<CapabilityResult<SubjectDiscoveryPage>> {
    return {
      state: 'ok',
      data: {
        items: [{ id: 901, type: 2, name: 'Unresolved candidate', tags: [], metaTags: [] }],
        total: 1,
        totalKind: 'estimated',
        limit: 20,
        offset: 0,
      },
      evidence: {},
    };
  }

  async browseSubjects(_request: SubjectDiscoveryBrowseRequest): Promise<CapabilityResult<SubjectDiscoveryPage>> {
    return { state: 'ok', data: { items: [], total: 0, totalKind: 'exact', limit: 20, offset: 0 }, evidence: {} };
  }
}

describe('bounded discovery engine', () => {
  it('deduplicates pages, hydrates with bounded concurrency, and applies post-filters', async () => {
    const provider = new FixtureDiscoveryProvider();
    const result = await new DiscoveryEngine(provider).query({
      media: 'anime',
      categories: 'tv',
      collectionCount: { min: 10 },
      resultMode: 'all',
      explain: 'full',
      budget: { maxPages: 10, maxCandidates: 20, maxHydrations: 10, concurrency: 2 },
    });
    expect(result.state).toBe('ok');
    expect(result.items.map((item) => item.id)).toEqual([1, 3]);
    expect(result.coverage.pagesScanned).toBe(3);
    expect(result.coverage.postFilterCount).toBe(1);
    expect(result.items[0]?.collectionTotal).toBe(15);
    expect(result.items[0]?.evidence.collectionTotal?.[0]?.formula).toContain('wish');
    expect(provider.maxInFlight).toBeLessThanOrEqual(2);
    expect(provider.hydrateCalls).toBe(3);
  });

  it('reports partial rather than silently truncating an all query', async () => {
    const provider = new FixtureDiscoveryProvider();
    const result = await new DiscoveryEngine(provider).query({
      media: 'anime',
      resultMode: 'all',
      budget: { maxPages: 1, maxCandidates: 20, maxHydrations: 0 },
    });
    expect(result.state).toBe('partial');
    expect(result.coverage.budgetExceeded).toBe(true);
    expect(result.warnings.some((item) => item.code === 'DISCOVERY_BUDGET_EXCEEDED')).toBe(true);
  });

  it('returns every matched item for an exhausted all query instead of applying top-N limit', async () => {
    const provider = new LargeAllModeProvider();
    const result = await new DiscoveryEngine(provider).query({
      media: 'anime',
      resultMode: 'all',
    });

    expect(result.items).toHaveLength(47);
    expect(result.coverage.state).toBe('complete');
    expect(result.coverage.matched).toBe(47);
    expect(result.coverage.returned).toBe(47);
    expect(provider.searchCalls.length).toBeGreaterThan(1);
  });

  it('reports output-cap truncation as partial with trusted cap metadata', async () => {
    const provider = new LargeAllModeProvider();
    const result = await new DiscoveryEngine(provider).query({
      media: 'anime',
      resultMode: 'all',
      limit: 10,
      budget: { maxReturnedItems: 10 },
    });

    expect(result.items).toHaveLength(10);
    expect(result.state).toBe('partial');
    expect(result.coverage).toMatchObject({
      state: 'partial',
      matched: 47,
      returned: 10,
      outputCap: 10,
      reason: 'output_cap',
    });
    expect(result.warnings).toContainEqual(expect.objectContaining({
      code: 'DISCOVERY_OUTPUT_TRUNCATED',
      matched: 47,
      returned: 10,
      outputCap: 10,
    }));
  });

  it('does not use an estimated search total as pagination exhaustion evidence', async () => {
    const provider = new EstimatedTotalProvider();
    const result = await new DiscoveryEngine(provider).query({
      keyword: 'estimated',
      resultMode: 'all',
      limit: 4,
    });

    expect(result.items.map((item) => item.id)).toEqual([1, 2, 3, 4]);
    expect(result.coverage.state).toBe('complete');
    expect(result.coverage.totalKind).toBe('estimated');
    expect(provider.searchCalls).toEqual([0, 2, 4]);
  });

  it('may use an exact browse total after the final page', async () => {
    const result = await new DiscoveryEngine(new ExactBrowseProvider()).query({
      media: 'anime',
      year: 2026,
      month: 7,
      sort: 'date',
      resultMode: 'all',
      limit: 4,
    });

    expect(result.plan.operation).toBe('browseSubjects');
    expect(result.items.map((item) => item.id)).toEqual([4, 3, 2, 1]);
    expect(result.coverage.state).toBe('complete');
    expect(result.coverage.totalKind).toBe('exact');
  });

  it('does not silently collapse a multi-category query to the first browse category', async () => {
    const result = await new DiscoveryEngine(new MultiCategoryProvider()).query({
      media: 'anime',
      year: 2026,
      categories: ['tv', 'ova'],
      sort: 'date',
      resultMode: 'all',
    });

    expect(result.plan.operation).toBe('searchSubjects');
    expect(result.items.map((item) => item.category)).toEqual(['tv', 'ova']);
  });

  it('preserves each source-native default order and only early-stops compatible top-N queries', async () => {
    const rankProvider = new NativeOrderProvider();
    const rank = await new DiscoveryEngine(rankProvider).query({ media: 'anime', sort: 'rank', limit: 2 });
    expect(rank.items.map((item) => item.id)).toEqual([1, 2]);
    expect(rankProvider.searchCalls).toEqual([0]);

    const score = await new DiscoveryEngine(new NativeOrderProvider()).query({ media: 'anime', sort: 'score', limit: 2 });
    expect(score.items.map((item) => item.id)).toEqual([4, 3]);

    const heat = await new DiscoveryEngine(new NativeOrderProvider()).query({ media: 'anime', sort: 'heat', limit: 2 });
    expect(heat.items.map((item) => item.id)).toEqual([1, 2]);

    const relevance = await new DiscoveryEngine(new NativeOrderProvider()).query({ media: 'anime', sort: 'relevance', limit: 2 });
    expect(relevance.items.map((item) => item.id)).toEqual([3, 1]);

    const date = await new DiscoveryEngine(new NativeOrderProvider()).query({ media: 'anime', sort: 'date', limit: 2 });
    expect(date.items.map((item) => item.id)).toEqual([4, 3]);
  });

  it('exhausts before claiming a globally correct reverse-rank top-N', async () => {
    const provider = new NativeOrderProvider();
    const result = await new DiscoveryEngine(provider).query({
      media: 'anime',
      sort: 'rank',
      order: 'desc',
      limit: 2,
    });

    expect(result.items.map((item) => item.id)).toEqual([4, 3]);
    expect(provider.searchCalls).toEqual([0, 2, 4]);
    expect(result.coverage.upstreamExhausted).toBe(true);
    expect(provider.hydrateCalls).toBe(0);
  });

  it('enforces maxHydrations across every page of one query', async () => {
    const provider = new GlobalHydrationBudgetProvider();
    const result = await new DiscoveryEngine(provider).query({
      media: 'anime',
      categories: 'tv',
      resultMode: 'all',
      budget: { maxPages: 10, maxCandidates: 500, maxHydrations: 30, concurrency: 6 },
    });

    expect(provider.getSubjectCalls).toBe(30);
    expect(provider.getSubjectCalls).toBeLessThanOrEqual(30);
    expect(result.coverage.hydrationsAttempted).toBe(30);
    expect(result.coverage.hydrationsSucceeded).toBe(30);
    expect(result.coverage.hydrationsFailed).toBe(0);
    expect(result.coverage.hydrationsUnresolved).toBeGreaterThan(0);
    expect(result.coverage.state).toBe('partial');
    expect(result.coverage.budgetExceeded).toBe(true);
    expect(result.coverage.hydrationBudgetExceeded).toBe(true);
    expect(result.warnings).toContainEqual(expect.objectContaining({
      code: 'DISCOVERY_HYDRATION_BUDGET_EXCEEDED',
    }));
  });

  it('keeps hydration failures unresolved instead of counting them as filter misses', async () => {
    const provider = new FailedHydrationProvider();
    const result = await new DiscoveryEngine(provider).query({
      media: 'anime',
      categories: 'tv',
      resultMode: 'all',
    });

    expect(provider.getSubjectCalls).toBe(1);
    expect(result.state).toBe('partial');
    expect(result.items).toEqual([]);
    expect(result.coverage.hydrationsAttempted).toBe(1);
    expect(result.coverage.hydrationsSucceeded).toBe(0);
    expect(result.coverage.hydrationsFailed).toBe(1);
    expect(result.coverage.hydrationsUnresolved).toBe(1);
    expect(result.coverage.postFilterCount).toBe(0);
    expect(result.warnings).toContainEqual(expect.objectContaining({
      code: 'DISCOVERY_HYDRATION_UNRESOLVED',
    }));
  });

  it('marks hydration NOT_FOUND as a source-changed unresolved candidate', async () => {
    const result = await new DiscoveryEngine(new FailedHydrationProvider('not_found')).query({
      media: 'anime',
      categories: 'tv',
      resultMode: 'all',
    });

    expect(result.state).toBe('partial');
    expect(result.coverage.postFilterCount).toBe(0);
    expect(result.warnings).toContainEqual(expect.objectContaining({
      code: 'UPSTREAM_NOT_FOUND',
    }));
    expect(result.warnings).toContainEqual(expect.objectContaining({
      code: 'DISCOVERY_HYDRATION_UNRESOLVED',
      message: expect.stringContaining('source_changed'),
    }));
  });

  it('applies meta-tag exclusion against hydrated canonical fields', async () => {
    const result = await new DiscoveryEngine(new MetaExclusionProvider()).query({
      media: 'anime',
      metaTags: ['原创'],
      excludeMetaTags: ['科幻'],
      resultMode: 'all',
    });

    expect(result.items.map((item) => item.id)).toEqual([201]);
    expect(result.plan.postFilters).toContainEqual(expect.objectContaining({
      field: 'excludeMetaTags',
      classification: 'POST_FILTER',
    }));
  });

  it('does not call the provider for an ambiguous concept', async () => {
    const provider = new FixtureDiscoveryProvider();
    const definitions: ConceptDefinition[] = [
      { input: '双源', canonical: '双源', source: 'tag', reason: 'fixture', lastVerified: '2026-08-09' },
      { input: '双源', canonical: '双源', source: 'meta_tag', reason: 'fixture', lastVerified: '2026-08-09' },
    ];
    const result = await new DiscoveryEngine(provider, new ConceptResolver(definitions)).query({
      concepts: ['双源'],
    });
    expect(result.state).toBe('unsupported');
    expect(result.coverage.scanned).toBe(0);
    expect(provider.searchCalls).toBe(0);
  });
});
