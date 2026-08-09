import { describe, expect, it } from 'vitest';
import {
  compileDiscoveryPlan,
  ConceptResolver,
  DEFAULT_CONCEPT_DEFINITIONS,
  normalizeDiscoveryQuery,
} from '@bangumi-agent-kit/discovery';

describe('PR-7C golden planning scenarios', () => {
  const cases = [
    ['G01 summer harem all', { media: 'anime', year: 2026, month: 7, concepts: ['后宫'], resultMode: 'all' }, 'searchSubjects'],
    ['G02 2024 hot isekai', { media: 'anime', year: 2024, concepts: ['异世界'], sort: 'heat', limit: 10 }, 'searchSubjects'],
    ['G03 recent high-rated original', { media: 'anime', from: '2021-01-01', to: '2026-01-01', rating: { min: 8 }, ratingCount: { min: 5000 }, concepts: ['原创'] }, 'searchSubjects'],
    ['G04 July TV score', { media: 'anime', year: 2026, month: 7, categories: 'tv', sort: 'score' }, 'searchSubjects'],
    ['G05 tag AND', { media: 'anime', tags: ['日常', '百合'] }, 'searchSubjects'],
    ['G06 meta-tag exclusion', { media: 'anime', concepts: ['原创'], excludeMetaTags: ['科幻'] }, 'searchSubjects'],
    ['G07 high score low count', { media: 'anime', rating: { min: 8 }, ratingCount: { max: 1000 }, sort: 'score' }, 'searchSubjects'],
    ['G08 hot isekai TV top 10', { media: 'anime', year: 2024, concepts: ['异世界'], categories: 'tv', sort: 'heat', limit: 10 }, 'searchSubjects'],
    ['G09 unsupported concept', { concepts: ['未知词'] }, 'searchSubjects'],
    ['G10 ambiguous concept', { concepts: ['双源'] }, 'searchSubjects'],
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

  it('G09 remains unsupported at execution boundary rather than becoming empty success', () => {
    const resolution = new ConceptResolver().resolve('未知词');
    expect(resolution.state).toBe('unknown');
    expect(resolution.candidates).toEqual([]);
  });

  it('G08 makes category hydration/post-filtering inspectable on search', () => {
    const query = normalizeDiscoveryQuery({ media: 'anime', year: 2024, concepts: ['异世界'], categories: 'tv', sort: 'heat', limit: 10 });
    const plan = compileDiscoveryPlan(query);
    expect(plan.hydrationRequired).toBe(true);
    expect(plan.postFilters.map((item) => item.field)).toContain('categories');
  });
});
