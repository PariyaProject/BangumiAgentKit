import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EXECUTION_BUDGET,
  normalizeDiscoveryQuery,
} from '@bangumi-agent-kit/discovery';
import { A05_EXPECTED_QUERY_ARGUMENTS } from '../../scripts/acceptance/a05-collection-share-answer-check.mjs';
import {
  DISCOVERY_SCENARIOS,
  selectDiscoveryScenario,
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

  it('defines a bounded A05 public sample and checks explicit score/share thresholds', () => {
    expect(DISCOVERY_SCENARIOS.A05.query).toMatchObject({
      media: 'anime',
      rating: { min: 8 },
      collectionCompletionRate: { max: 0.4 },
      sort: 'score',
      order: 'desc',
      limit: 8,
      resultMode: 'top',
      explain: 'full',
    });
    expect(DISCOVERY_SCENARIOS.A05.query).toEqual(A05_EXPECTED_QUERY_ARGUMENTS);
    expect(DISCOVERY_SCENARIOS.A05.query).not.toHaveProperty('budget');
    expect(normalizeDiscoveryQuery(DISCOVERY_SCENARIOS.A05.query).budget).toEqual(
      DEFAULT_EXECUTION_BUDGET,
    );

    const summaries = summarizeDiscoveryScenarioItems('A05', [
      {
        id: 501,
        name: 'public title',
        media: 'anime',
        score: 8.4,
        collectionCompletionRate: 0.2,
      },
      {
        id: 502,
        name: 'threshold title',
        media: 'anime',
        score: 8,
        collectionCompletionRate: 0.4,
      },
    ]);
    expect(Object.values(validateDiscoveryScenarioItems('A05', summaries)).every(Boolean)).toBe(true);
    expect(JSON.stringify(summaries)).not.toContain('public title');
    expect(JSON.stringify(summaries)).not.toContain('threshold title');

    const invalid = summarizeDiscoveryScenarioItems('A05', [
      { id: 503, media: 'anime', score: 8, collectionCompletionRate: 0.401 },
    ]);
    const checks = validateDiscoveryScenarioItems('A05', invalid);
    expect(checks.collectionCompletionRateThreshold).toBe(false);
  });

  it('defines G26 as one exact documented tag with integer and half-open bounds', () => {
    expect(DISCOVERY_SCENARIOS.G26.query).toEqual({
      media: 'anime',
      from: '2019-01-01',
      to: '2025-01-01',
      ratingCount: { min: 10001 },
      tags: ['女性向'],
      categories: 'tv',
      resultMode: 'all',
      limit: 100,
      explain: 'full',
    });

    const valid = summarizeDiscoveryScenarioItems('G26', [
      {
        id: 260,
        name: 'public title',
        media: 'anime',
        category: 'tv',
        date: '2019-01-01',
        ratingCount: 10001,
        tags: ['女性向', '恋爱'],
        metaTags: ['游戏'],
      },
      {
        id: 261,
        media: 'anime',
        category: 'tv',
        date: '2024-12-31',
        ratingCount: 25000,
        tags: ['女性向'],
        metaTags: [],
      },
    ]);
    expect(Object.values(validateDiscoveryScenarioItems('G26', valid)).every(Boolean)).toBe(true);
    expect(valid.every((item) => item.exactTagMatched)).toBe(true);
    expect(JSON.stringify(valid)).not.toContain('public title');
    expect(JSON.stringify(valid)).not.toContain('女性向');

    const underThreshold = summarizeDiscoveryScenarioItems('G26', [
      {
        id: 262,
        media: 'anime',
        category: 'tv',
        date: '2020-01-01',
        ratingCount: 10000,
        tags: ['女性向'],
      },
    ]);
    expect(validateDiscoveryScenarioItems('G26', underThreshold).strictRatingCountThreshold).toBe(
      false,
    );

    const wrongFacetAndEndDate = summarizeDiscoveryScenarioItems('G26', [
      {
        id: 263,
        media: 'anime',
        category: 'tv',
        date: '2025-01-01',
        ratingCount: 10001,
        tags: ['乙女向'],
        metaTags: ['女性向'],
      },
    ]);
    const checks = validateDiscoveryScenarioItems('G26', wrongFacetAndEndDate);
    expect(checks.dateWindow).toBe(false);
    expect(checks.exactTagMatch).toBe(false);
  });

  it('requires an explicit single live scenario selection', () => {
    expect(selectDiscoveryScenario(['--scenario', 'G26', '--live'])).toBe('G26');
    expect(() => selectDiscoveryScenario(['--live'])).toThrow(/exactly one --scenario/u);
    expect(() => selectDiscoveryScenario(['--scenario', 'G26', '--scenario', 'G02'])).toThrow(
      /exactly one --scenario/u,
    );
    expect(() => selectDiscoveryScenario(['--scenario', 'unknown'])).toThrow(
      /Unknown discovery scenario/u,
    );
  });
});
