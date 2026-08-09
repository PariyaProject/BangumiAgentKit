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

  async getSubject(id: number): Promise<CapabilityResult<ProviderSubjectData>> {
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
    return result.data ? { ...result, data: result.data.stats } : result as CapabilityResult<SubjectStatsData>;
  }

  async searchSubjects(request: SubjectDiscoverySearchRequest): Promise<CapabilityResult<SubjectDiscoveryPage>> {
    this.searchCalls += 1;
    const start = request.offset;
    const page = this.subjects.slice(start, start + 2);
    return {
      state: 'ok',
      data: { items: page, total: this.subjects.length, limit: 2, offset: request.offset },
      evidence: {},
    };
  }

  async browseSubjects(_request: SubjectDiscoveryBrowseRequest): Promise<CapabilityResult<SubjectDiscoveryPage>> {
    return { state: 'ok', data: { items: [], total: 0, limit: 20, offset: 0 }, evidence: {} };
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
    expect(result.coverage.pagesScanned).toBe(2);
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
