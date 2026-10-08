import { describe, expect, it } from 'vitest';
import { DiscoveryValidationError, normalizeDiscoveryQuery } from '@bangumi-agent-kit/discovery';

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

  it('resolves the current season from an injectable Asia/Tokyo instant', () => {
    const current = normalizeDiscoveryQuery(
      { season: 'current' },
      { now: new Date('2026-10-07T15:00:00.000Z') },
    );

    expect(current.season).toBe('2026-autumn');
    expect(current.dateRange).toEqual({ from: '2026-10-01', to: '2027-01-01' });
  });

  it.each([
    ['2025-12-31T14:59:59.999Z', '2025-autumn', '2025-10-01', '2026-01-01'],
    ['2025-12-31T15:00:00.000Z', '2026-winter', '2026-01-01', '2026-04-01'],
    ['2026-03-31T14:59:59.999Z', '2026-winter', '2026-01-01', '2026-04-01'],
    ['2026-03-31T15:00:00.000Z', '2026-spring', '2026-04-01', '2026-07-01'],
    ['2026-06-30T14:59:59.999Z', '2026-spring', '2026-04-01', '2026-07-01'],
    ['2026-06-30T15:00:00.000Z', '2026-summer', '2026-07-01', '2026-10-01'],
    ['2026-09-30T14:59:59.999Z', '2026-summer', '2026-07-01', '2026-10-01'],
    ['2026-09-30T15:00:00.000Z', '2026-autumn', '2026-10-01', '2027-01-01'],
  ])('switches season exactly at the Tokyo quarter boundary %s', (now, season, from, to) => {
    const query = normalizeDiscoveryQuery({ season: 'current' }, { now: new Date(now) });

    expect(query.season).toBe(season);
    expect(query.dateRange).toEqual({ from, to });
  });

  it('preserves explicit seasons regardless of the reference instant', () => {
    const query = normalizeDiscoveryQuery(
      { season: '2024-summer' },
      { now: new Date('2026-10-07T15:00:00.000Z') },
    );

    expect(query.season).toBe('2024-summer');
    expect(query.dateRange).toEqual({ from: '2024-07-01', to: '2024-10-01' });
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

  it('uses source-native order when order is omitted', () => {
    expect(normalizeDiscoveryQuery({ sort: 'rank' }).order).toBe('asc');
    expect(normalizeDiscoveryQuery({ sort: 'score' }).order).toBe('desc');
    expect(normalizeDiscoveryQuery({ sort: 'heat' }).order).toBe('desc');
    expect(normalizeDiscoveryQuery({ sort: 'date' }).order).toBe('desc');
    expect(normalizeDiscoveryQuery({ sort: 'relevance' }).order).toBe('desc');
  });

  it('normalizes rating-count score tie-breaks and rejects them for other primary sorts', () => {
    expect(
      normalizeDiscoveryQuery({
        sort: 'score',
        tieBreak: { field: 'ratingCount' },
      }).tieBreak,
    ).toEqual({ field: 'ratingCount', order: 'desc' });
    expect(() =>
      normalizeDiscoveryQuery({
        sort: 'heat',
        tieBreak: { field: 'ratingCount' },
      }),
    ).toThrow(DiscoveryValidationError);
  });

  it('rejects model-controlled workload values above the server authority ceiling', () => {
    expect(() => normalizeDiscoveryQuery({ limit: 101 })).toThrow(DiscoveryValidationError);
    expect(() => normalizeDiscoveryQuery({ budget: { maxPages: 11 } })).toThrow(
      DiscoveryValidationError,
    );
    expect(() => normalizeDiscoveryQuery({ budget: { maxCandidates: 501 } })).toThrow(
      DiscoveryValidationError,
    );
  });
});
