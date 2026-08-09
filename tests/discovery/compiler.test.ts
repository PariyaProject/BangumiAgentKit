import { describe, expect, it } from 'vitest';
import {
  compileDiscoveryPlan,
  getSourceCapabilityMatrix,
  normalizeDiscoveryQuery,
} from '@bangumi-agent-kit/discovery';

describe('discovery capability compiler', () => {
  it('uses official search pushdown for a seasonal concept query', () => {
    const query = normalizeDiscoveryQuery({
      media: 'anime',
      season: '2026-summer',
      concepts: ['后宫'],
      sort: 'heat',
      limit: 10,
    });
    const plan = compileDiscoveryPlan(query, [
      {
        source: 'tag',
        value: '后宫',
        canonical: '后宫',
        reason: 'exact literal',
        evidence: [],
      },
    ]);
    expect(plan.operation).toBe('searchSubjects');
    expect(plan.totalKind).toBe('estimated');
    expect(plan.pushdown.some((item) => item.field === 'dateRange')).toBe(true);
    expect(plan.pushdown.some((item) => item.field === 'concepts')).toBe(true);
    expect(plan.steps[0]).toMatchObject({
      kind: 'search',
      request: { sort: 'heat', filter: { airDate: ['>=2026-07-01', '<2026-10-01'] } },
    });
  });

  it('turns a year-only search into a half-open year window', () => {
    const plan = compileDiscoveryPlan(normalizeDiscoveryQuery({
      media: 'anime',
      year: 2024,
      concepts: ['异世界'],
      sort: 'heat',
    }));
    expect(plan.pushdown).toContainEqual(expect.objectContaining({
      field: 'dateRange',
      value: { from: '2024-01-01', to: '2025-01-01' },
    }));
    expect(plan.steps[0]).toMatchObject({
      request: { filter: { airDate: ['>=2024-01-01', '<2025-01-01'] } },
    });
  });

  it('selects browse when the upstream browse contract is the cheapest exact path', () => {
    const plan = compileDiscoveryPlan(
      normalizeDiscoveryQuery({ media: 'anime', year: 2026, month: 7, sort: 'date' }),
    );
    expect(plan.operation).toBe('browseSubjects');
    expect(plan.totalKind).toBe('exact');
    expect(plan.steps[0]).toMatchObject({
      kind: 'browse',
      request: { type: 2, year: 2026, month: 7, sort: 'date' },
    });
  });

  it('exposes one explicit classification per source operation and field', () => {
    const matrix = getSourceCapabilityMatrix();
    expect(matrix.find((item) => item.field === 'collectionCount' && item.operation === 'searchSubjects')?.classification).toBe(
      'DERIVED_FILTER',
    );
    expect(matrix.filter((item) => item.field === 'heat').length).toBe(0);
    expect(matrix.find((item) => item.field === 'sort:heat' && item.operation === 'searchSubjects')?.notes).toContain(
      '收藏人数',
    );
  });

  it('does not treat undocumented negative meta-tag syntax as trusted pushdown', () => {
    const plan = compileDiscoveryPlan(normalizeDiscoveryQuery({
      media: 'anime',
      excludeMetaTags: ['科幻'],
    }));

    expect(plan.operation).toBe('searchSubjects');
    expect(plan.postFilters).toContainEqual(expect.objectContaining({
      field: 'excludeMetaTags',
      classification: 'POST_FILTER',
    }));
    expect(plan.steps[0]?.kind === 'search' ? plan.steps[0].request.filter : undefined).not.toHaveProperty('metaTags');
    expect(plan.hydrationRequired).toBe(true);
  });
});
