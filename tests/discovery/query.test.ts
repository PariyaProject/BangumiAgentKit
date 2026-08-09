import { describe, expect, it } from 'vitest';
import {
  DiscoveryValidationError,
  normalizeDiscoveryQuery,
} from '@bangumi-agent-kit/discovery';

describe('discovery query normalization', () => {
  it('normalizes seasons into half-open date ranges', () => {
    expect(normalizeDiscoveryQuery({ season: '2026-summer' }).dateRange).toEqual({
      from: '2026-07-01',
      to: '2026-10-01',
    });
    expect(normalizeDiscoveryQuery({ season: '2026-autumn' }).dateRange).toEqual({
      from: '2026-10-01',
      to: '2027-01-01',
    });
  });

  it('keeps a year/month window distinct from a season', () => {
    expect(normalizeDiscoveryQuery({ year: 2026, month: 7 }).dateRange).toEqual({
      from: '2026-07-01',
      to: '2026-08-01',
    });
  });

  it('rejects contradictory ranges and included/excluded meta tags', () => {
    expect(() => normalizeDiscoveryQuery({ rating: { min: 9, max: 6 } })).toThrow(
      DiscoveryValidationError,
    );
    expect(() =>
      normalizeDiscoveryQuery({ metaTags: ['原创'], excludeMetaTags: ['原创'] }),
    ).toThrow(DiscoveryValidationError);
  });

  it('provides bounded defaults', () => {
    const query = normalizeDiscoveryQuery({ media: 'anime', limit: 10 });
    expect(query.budget).toEqual({
      maxPages: 10,
      maxCandidates: 500,
      maxHydrations: 120,
      concurrency: 6,
      maxConceptProbes: 8,
      maxReturnedItems: 100,
    });
  });
});
