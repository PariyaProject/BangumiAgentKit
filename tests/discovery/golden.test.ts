import { describe, expect, it } from 'vitest';
import {
  compileDiscoveryPlan,
  ConceptResolver,
  DEFAULT_CONCEPT_DEFINITIONS,
  normalizeDiscoveryQuery,
} from '@bangumi-agent-kit/discovery';

describe('PR-7C golden planning scenarios', () => {
  const cases = [
    ['G01 keyword search', { keyword: '少女终末旅行' }, 'searchSubjects'],
    ['G02 anime media', { media: 'anime' }, 'searchSubjects'],
    ['G03 seasonal anime', { media: 'anime', season: '2026-summer' }, 'searchSubjects'],
    ['G04 July score query', { media: 'anime', year: 2026, month: 7, sort: 'score' }, 'searchSubjects'],
    ['G05 resolved concept', { concepts: ['后宫'] }, 'searchSubjects'],
    ['G06 unknown concept', { concepts: ['未知词'] }, 'searchSubjects'],
    ['G07 explicit category browse', { media: 'anime', year: 2026, categories: 'tv', sort: 'date' }, 'browseSubjects'],
    ['G08 all mode', { media: 'anime', resultMode: 'all' }, 'searchSubjects'],
    ['G09 post-filter category', { media: 'anime', categories: 'movie', keyword: '作品' }, 'searchSubjects'],
    ['G10 explanation', { media: 'anime', sort: 'heat', explain: 'full' }, 'searchSubjects'],
  ] as const;

  it.each(cases)('%s', (_name, input, operation) => {
    const query = normalizeDiscoveryQuery(input);
    const resolved = new ConceptResolver(DEFAULT_CONCEPT_DEFINITIONS)
      .resolveMany(query.concepts)
      .flatMap((item) => item.candidates);
    const plan = compileDiscoveryPlan(query, resolved);
    expect(plan.operation).toBe(operation);
    expect(plan.source).toBe('official_v0');
    expect(plan.budget.maxPages).toBe(10);
  });

  it('G06 remains unsupported at execution boundary rather than becoming empty success', () => {
    const resolution = new ConceptResolver().resolve('未知词');
    expect(resolution.state).toBe('unknown');
    expect(resolution.candidates).toEqual([]);
  });

  it('G07 makes category hydration/post-filtering inspectable on search', () => {
    const query = normalizeDiscoveryQuery({ media: 'anime', categories: 'movie', keyword: '作品' });
    const plan = compileDiscoveryPlan(query);
    expect(plan.hydrationRequired).toBe(true);
    expect(plan.postFilters.map((item) => item.field)).toContain('categories');
  });
});
