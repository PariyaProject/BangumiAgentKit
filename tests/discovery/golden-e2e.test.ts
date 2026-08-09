import { describe, expect, it } from 'vitest';
import {
  ConceptResolver,
  DiscoveryEngine,
  type ConceptDefinition,
} from '@bangumi-agent-kit/discovery';
import {
  createEvidenceRef,
  SOURCE_V0,
  type CapabilityResult,
  type ProviderRequestContext,
  type ProviderSubjectData,
  type SubjectDiscoveryBrowseRequest,
  type SubjectDiscoveryCandidate,
  type SubjectDiscoveryPage,
  type SubjectDiscoveryProvider,
  type SubjectDiscoverySearchRequest,
  type SubjectStatsData,
} from '@bangumi-agent-kit/provider-core';

interface FixtureSubject extends SubjectDiscoveryCandidate {
  score: number;
  rank: number;
  ratingCount: number;
}

const SUBJECTS: FixtureSubject[] = [
  { id: 1, type: 2, name: 'Summer Harem', platform: 'TV', date: '2026-07-01', score: 9.1, rank: 1, ratingCount: 6000, collection: { collect: 100 }, tags: ['后宫', '日常', '百合', '异世界'], metaTags: ['原创'] },
  { id: 2, type: 2, name: 'Summer OVA', platform: 'OVA', date: '2026-07-15', score: 8.8, rank: 2, ratingCount: 200, collection: { collect: 80 }, tags: ['后宫', '异世界'], metaTags: ['原创', '科幻'] },
  { id: 3, type: 2, name: 'Isekai A', platform: 'TV', date: '2024-01-01', score: 9.3, rank: 3, ratingCount: 7000, collection: { collect: 200 }, tags: ['异世界', '日常'], metaTags: ['原创'] },
  { id: 4, type: 2, name: 'Isekai Movie', platform: 'Movie', date: '2024-03-01', score: 9.0, rank: 4, ratingCount: 8000, collection: { collect: 150 }, tags: ['异世界'], metaTags: ['原创'] },
  { id: 5, type: 2, name: 'Isekai B', platform: 'TV', date: '2024-05-01', score: 8.7, rank: 5, ratingCount: 6000, collection: { collect: 160 }, tags: ['异世界'], metaTags: ['原创'] },
  { id: 6, type: 2, name: 'Isekai C', platform: 'Movie', date: '2024-07-01', score: 8.6, rank: 6, ratingCount: 5000, collection: { collect: 140 }, tags: ['异世界'], metaTags: ['原创', '科幻'] },
  { id: 7, type: 2, name: 'Slice Lily A', platform: 'TV', date: '2023-01-01', score: 9.2, rank: 7, ratingCount: 900, collection: { collect: 80 }, tags: ['日常', '百合'], metaTags: ['原创'] },
  { id: 8, type: 2, name: 'Slice Lily B', platform: 'TV', date: '2022-01-01', score: 8.4, rank: 8, ratingCount: 700, collection: { collect: 70 }, tags: ['日常', '百合'], metaTags: ['原创'] },
  { id: 9, type: 2, name: 'Cold Gem', platform: 'TV', date: '2021-01-01', score: 8.8, rank: 9, ratingCount: 300, collection: { collect: 40 }, tags: [], metaTags: ['原创'] },
  { id: 10, type: 2, name: 'Excluded Gem', platform: 'TV', date: '2020-01-01', score: 8.5, rank: 10, ratingCount: 500, collection: { collect: 30 }, tags: [], metaTags: ['原创', '科幻'] },
  { id: 11, type: 2, name: 'Old Isekai', platform: 'TV', date: '2019-01-01', score: 7.0, rank: 11, ratingCount: 100, collection: { collect: 20 }, tags: ['异世界'], metaTags: ['原创'] },
  { id: 12, type: 2, name: 'Archive', platform: 'TV', date: '2018-01-01', score: 7.5, rank: 12, ratingCount: 100, collection: { collect: 10 }, tags: [], metaTags: ['原创'] },
];

function statsFor(subject: FixtureSubject): SubjectStatsData {
  return {
    score: subject.score,
    rank: subject.rank,
    ratingTotal: subject.ratingCount,
    ratingHistogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 },
    collection: { wish: 0, collect: subject.collection?.collect ?? 0, doing: 0, onHold: 0, dropped: 0 },
  };
}

function compareExpression(value: number | string | undefined, expression: string): boolean {
  if (value === undefined) return false;
  const match = /^(>=|<=|<|>|=)(.+)$/u.exec(expression);
  if (!match) return false;
  const [, operator, expected] = match;
  if (expected === undefined) return false;
  const left = typeof value === 'number' ? value : value;
  const right = typeof value === 'number' ? Number(expected) : expected;
  if (typeof left === 'number' && typeof right !== 'number') return false;
  if (operator === '>=') return left >= right;
  if (operator === '<=') return left <= right;
  if (operator === '<') return left < right;
  if (operator === '>') return left > right;
  return left === right;
}

function everyExpression(value: number | string | undefined, expressions: string[] | undefined): boolean {
  return expressions === undefined || expressions.every((expression) => compareExpression(value, expression));
}

class GoldenProvider implements SubjectDiscoveryProvider {
  searchCalls = 0;

  async getSubject(id: number, _context?: ProviderRequestContext): Promise<CapabilityResult<ProviderSubjectData>> {
    const subject = SUBJECTS.find((item) => item.id === id);
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
        date: subject.date,
        platform: subject.platform ?? 'TV',
        images: {},
        eps: 12,
        totalEpisodes: 12,
        tags: [...subject.tags],
        metaTags: [...subject.metaTags],
        stats: statsFor(subject),
      },
      evidence: {
        metaTags: [createEvidenceRef({
          source: { ...SOURCE_V0, operation: 'getSubjectById' },
          retrievedAt: '2026-08-10T00:00:00.000Z',
          entity: { type: 'subject', id },
          fieldPath: 'meta_tags',
          freshness: { state: 'unknown' },
          confidence: 'high',
        })],
      },
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
    const filter = request.filter;
    let subjects = SUBJECTS.filter((subject) =>
      (filter?.type === undefined || filter.type.includes(subject.type)) &&
      (filter?.tag === undefined || filter.tag.every((tag) => subject.tags.includes(tag))) &&
      (filter?.metaTags === undefined || filter.metaTags.every((tag) => subject.metaTags.includes(tag))) &&
      everyExpression(subject.date, filter?.airDate) &&
      everyExpression(subject.score, filter?.rating) &&
      everyExpression(subject.ratingCount, filter?.ratingCount) &&
      everyExpression(subject.rank, filter?.rank) &&
      (filter?.nsfw === undefined || filter.nsfw === false) &&
      (request.keyword === '' || subject.name.includes(request.keyword)),
    );
    if (request.sort === 'heat') {
      subjects = [...subjects].sort((left, right) => (right.collection?.collect ?? 0) - (left.collection?.collect ?? 0));
    } else if (request.sort === 'score') {
      subjects = [...subjects].sort((left, right) => right.score - left.score);
    } else if (request.sort === 'rank') {
      subjects = [...subjects].sort((left, right) => left.rank - right.rank);
    }
    const items = subjects.slice(request.offset, request.offset + 2);
    const evidence = Object.fromEntries(items.map((item) => [
      `items[${item.id}].id`,
      [createEvidenceRef({
        source: { ...SOURCE_V0, operation: 'searchSubjects', experimental: true },
        retrievedAt: '2026-08-10T00:00:00.000Z',
        entity: { type: 'subject', id: item.id },
        fieldPath: `items[${item.id}].id`,
        freshness: { state: 'unknown' },
        confidence: 'high',
      })],
    ]));
    return {
      state: 'ok',
      data: { items, total: subjects.length, totalKind: 'estimated', limit: 2, offset: request.offset },
      evidence,
    };
  }

  async browseSubjects(_request: SubjectDiscoveryBrowseRequest): Promise<CapabilityResult<SubjectDiscoveryPage>> {
    return { state: 'ok', data: { items: [], total: 0, totalKind: 'exact', limit: 20, offset: 0 }, evidence: {} };
  }
}

describe('PR-7C golden discovery scenarios through the public engine seam', () => {
  it('executes G01-G08 with normalization, resolution, planning, pagination, filtering, ordering, coverage, and evidence', async () => {
    const cases = [
      { id: 'G01', input: { media: 'anime' as const, year: 2026, month: 7, concepts: ['后宫'], resultMode: 'all' as const }, expected: [1, 2] },
      { id: 'G02', input: { media: 'anime' as const, year: 2024, concepts: ['异世界'], sort: 'heat' as const, limit: 10, explain: 'full' as const }, expected: [3, 5, 4, 6] },
      { id: 'G03', input: { media: 'anime' as const, from: '2021-01-01', to: '2026-01-01', rating: { min: 8 }, ratingCount: { min: 5000 }, concepts: ['原创'], resultMode: 'all' as const }, expected: [3, 4, 5, 6] },
      { id: 'G04', input: { media: 'anime' as const, year: 2026, month: 7, categories: 'tv' as const, sort: 'score' as const, resultMode: 'all' as const }, expected: [1] },
      { id: 'G05', input: { media: 'anime' as const, tags: ['日常', '百合'], resultMode: 'all' as const }, expected: [1, 7, 8] },
      { id: 'G06', input: { media: 'anime' as const, concepts: ['原创'], excludeMetaTags: ['科幻'], resultMode: 'all' as const }, expected: [1, 3, 4, 5, 7, 8, 9, 11, 12] },
      { id: 'G07', input: { media: 'anime' as const, rating: { min: 8 }, ratingCount: { max: 1000 }, sort: 'score' as const, resultMode: 'all' as const }, expected: [7, 2, 9, 10, 8] },
      { id: 'G08', input: { media: 'anime' as const, year: 2024, concepts: ['异世界'], categories: 'tv' as const, sort: 'heat' as const, limit: 10 }, expected: [3, 5] },
    ];

    for (const scenario of cases) {
      const provider = new GoldenProvider();
      const result = await new DiscoveryEngine(provider).query(scenario.input);
      expect(result.items.map((item) => item.id), scenario.id).toEqual(scenario.expected);
      expect(result.plan.source, scenario.id).toBe('official_v0');
      expect(result.coverage.totalKind, scenario.id).toBe('estimated');
      expect(result.evidence.length, scenario.id).toBeGreaterThan(0);
      if (scenario.id === 'G02') {
        expect(result.explanation?.heat?.meaning).toBe('收藏人数');
        expect(result.explanation?.limitations.join(' ')).toContain('experimental');
      }
      if (scenario.id === 'G06') {
        expect(result.plan.postFilters).toContainEqual(expect.objectContaining({ field: 'excludeMetaTags' }));
      }
      if (scenario.id === 'G08') {
        expect(result.plan.postFilters).toContainEqual(expect.objectContaining({ field: 'categories' }));
        expect(result.coverage.pagesScanned).toBeGreaterThan(1);
      }
    }
  });

  it('returns G09 unsupported instead of an empty success', async () => {
    const provider = new GoldenProvider();
    const result = await new DiscoveryEngine(provider).query({ concepts: ['not-in-vocabulary'] });
    expect(result.state).toBe('unsupported');
    expect(result.items).toEqual([]);
    expect(provider.searchCalls).toBe(0);
  });

  it('returns G10 ambiguity with candidate interpretations and no provider call', async () => {
    const definitions: ConceptDefinition[] = [
      { input: '双源', canonical: '双源', source: 'tag', reason: 'fixture tag', lastVerified: '2026-08-10' },
      { input: '双源', canonical: '双源', source: 'meta_tag', reason: 'fixture meta tag', lastVerified: '2026-08-10' },
    ];
    const provider = new GoldenProvider();
    const result = await new DiscoveryEngine(provider, new ConceptResolver(definitions)).query({ concepts: ['双源'] });
    expect(result.state).toBe('unsupported');
    expect(result.warnings[0]?.code).toBe('DISCOVERY_AMBIGUOUS_CONCEPT');
    expect(result.conceptResolution?.[0]?.candidates).toHaveLength(2);
    expect(provider.searchCalls).toBe(0);
  });
});
