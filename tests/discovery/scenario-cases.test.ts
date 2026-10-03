import { describe, expect, it } from 'vitest';
import {
  DISCOVERY_SCENARIOS,
  summarizeDiscoveryScenarioItems,
  validateDiscoveryScenarioItems,
} from '../../scripts/discovery-scenario-cases.js';

describe('fixed discovery acceptance scenarios', () => {
  it('maps the >5000 rating-count phrase to an integer lower bound of 5001', () => {
    expect(DISCOVERY_SCENARIOS.G03.query.ratingCount).toEqual({ min: 5001 });
    expect(DISCOVERY_SCENARIOS.G03.query.from).toBe('2021-10-03');
    expect(DISCOVERY_SCENARIOS.G03.query.to).toBe('2026-10-03');
  });

  it('validates G02 exact concept, media, and half-open 2024 date scope', () => {
    const checks = validateDiscoveryScenarioItems('G02', [
      { id: 20, media: 'anime', date: '2024-01-01', collectionTotal: 42_000, conceptMatched: true },
      { id: 21, media: 'anime', date: '2024-12-31', collectionTotal: 31_000, conceptMatched: true },
    ]);

    expect(Object.values(checks).every(Boolean)).toBe(true);
    expect(
      validateDiscoveryScenarioItems('G02', [
        { id: 22, media: 'anime', date: '2025-01-01', conceptMatched: true },
      ]).dateWindow,
    ).toBe(false);

    const summarized = summarizeDiscoveryScenarioItems('G02', [
      { id: 23, name: 'public title', tags: ['异世界', '冒险'] },
    ]);
    expect(summarized[0]?.conceptMatched).toBe(true);
    expect(JSON.stringify(summarized)).not.toContain('异世界');
    expect(JSON.stringify(summarized)).not.toContain('public title');
  });

  it('validates the observed current collection-count ordering for G02 without retaining titles', () => {
    const summaries = summarizeDiscoveryScenarioItems('G02', [
      {
        id: 60,
        name: 'first public title',
        media: 'anime',
        date: '2024-01-02',
        collectionTotal: 42_000,
        tags: ['异世界'],
      },
      {
        id: 61,
        name: 'second public title',
        media: 'anime',
        date: '2024-03-04',
        collectionTotal: 31_000,
        tags: ['异世界'],
      },
    ]);

    expect(validateDiscoveryScenarioItems('G02', summaries).heatOrderDescending).toBe(true);
    expect(
      validateDiscoveryScenarioItems('G02', [...summaries].reverse()).heatOrderDescending,
    ).toBe(false);
    expect(JSON.stringify(summaries)).not.toContain('public title');

    const missingCount = summarizeDiscoveryScenarioItems('G02', [
      { id: 62, media: 'anime', date: '2024-04-05', tags: ['异世界'] },
    ]);
    expect(validateDiscoveryScenarioItems('G02', missingCount).heatOrderDescending).toBe(false);
  });

  it('validates G03 thresholds and G14 score/rating-count ordering', () => {
    const g03 = validateDiscoveryScenarioItems('G03', [
      {
        id: 30,
        media: 'anime',
        date: '2021-10-03',
        score: 8,
        ratingCount: 5001,
        conceptMatched: true,
      },
    ]);
    expect(Object.values(g03).every(Boolean)).toBe(true);

    const g14 = validateDiscoveryScenarioItems('G14', [
      {
        id: 40,
        media: 'anime',
        category: 'tv',
        date: '2026-04-01',
        score: 9,
        ratingCount: 900,
        conceptMatched: true,
      },
      {
        id: 41,
        media: 'anime',
        category: 'tv',
        date: '2026-04-02',
        score: 9,
        ratingCount: 800,
        conceptMatched: true,
      },
      {
        id: 42,
        media: 'anime',
        category: 'tv',
        date: '2026-04-03',
        score: 8,
        ratingCount: 1200,
        conceptMatched: true,
      },
    ]);
    expect(Object.values(g14).every(Boolean)).toBe(true);
    expect(DISCOVERY_SCENARIOS.G14.query.tieBreak).toEqual({
      field: 'ratingCount',
      order: 'desc',
    });
  });

  it('rejects incorrect G14 tie order and omits titles from live summaries', () => {
    const raw = [
      {
        id: 50,
        name: 'private-looking title',
        media: 'anime',
        category: 'tv',
        date: '2026-04-01',
        score: 9,
        ratingCount: 700,
        metaTags: ['原创'],
      },
      {
        id: 51,
        name: 'another title',
        media: 'anime',
        category: 'tv',
        date: '2026-04-02',
        score: 9,
        ratingCount: 900,
        metaTags: ['原创'],
      },
    ];
    const summaries = summarizeDiscoveryScenarioItems('G14', raw);

    expect(validateDiscoveryScenarioItems('G14', summaries).scoreThenRatingOrder).toBe(false);
    expect(JSON.stringify(summaries)).not.toContain('title');
    expect(JSON.stringify(summaries)).not.toContain('原创');
    expect(summaries.every((item) => item.conceptMatched)).toBe(true);
    expect(summaries.map((item) => item.id)).toEqual([50, 51]);
  });
});
