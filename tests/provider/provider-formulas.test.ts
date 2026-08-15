import { describe, expect, it } from 'vitest';
import {
  COMPLETION_FORMULA,
  COLLECTION_PERCENTAGES_FORMULA,
  HISTOGRAM_MEAN_FORMULA,
  POPULATION_SD_FORMULA,
  computeCollectionCompletionRate,
  computeCollectionPercentages,
  computePopulationStandardDeviation,
  computeRatingPercentages,
  type FieldEvidence,
  type SubjectStatsData,
} from '@bangumi-agent-kit/provider-core';

const stats: SubjectStatsData = {
  score: 6,
  rank: 12,
  ratingTotal: 10,
  ratingHistogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 10, 7: 0, 8: 0, 9: 0, 10: 0 },
  collection: { wish: 1, collect: 2, doing: 3, onHold: 4, dropped: 5 },
};

const inputEvidence: FieldEvidence = {
  'collection.wish': [
    {
      source: { class: 'official_v0', provider: 'bangumi' },
      retrievedAt: '2026-08-09T00:00:00Z',
      fieldPath: 'collection.wish',
    },
  ],
  'collection.collect': [
    {
      source: { class: 'official_v0', provider: 'bangumi' },
      retrievedAt: '2026-08-09T00:00:00Z',
      fieldPath: 'collection.collect',
    },
  ],
  'collection.doing': [
    {
      source: { class: 'official_v0', provider: 'bangumi' },
      retrievedAt: '2026-08-09T00:00:00Z',
      fieldPath: 'collection.doing',
    },
  ],
  'collection.on_hold': [
    {
      source: { class: 'official_v0', provider: 'bangumi' },
      retrievedAt: '2026-08-09T00:00:00Z',
      fieldPath: 'collection.on_hold',
    },
  ],
  'collection.dropped': [
    {
      source: { class: 'official_v0', provider: 'bangumi' },
      retrievedAt: '2026-08-09T00:00:00Z',
      fieldPath: 'collection.dropped',
    },
  ],
  'rating.count.6': [
    {
      source: { class: 'official_v0', provider: 'bangumi' },
      retrievedAt: '2026-08-09T00:00:00Z',
      fieldPath: 'rating.count.6',
    },
  ],
  score: [
    {
      source: { class: 'official_v0', provider: 'bangumi' },
      retrievedAt: '2026-08-09T00:00:00Z',
      fieldPath: 'rating.score',
    },
  ],
};

describe('PR-7B formula foundation', () => {
  it('PF23/PF24: preserves the exact ten rating buckets and five collection buckets', () => {
    expect(Object.keys(stats.ratingHistogram)).toHaveLength(10);
    expect(Object.keys(stats.collection)).toEqual([
      'wish',
      'collect',
      'doing',
      'onHold',
      'dropped',
    ]);
  });

  it('PF25: computes histogram percentages without replacing raw counts', () => {
    const result = computeRatingPercentages({ ...stats.ratingHistogram, 1: 1, 6: 3 });

    expect(result.state).toBe('ok');
    expect(result.data?.[1]).toBe(25);
    expect(result.data?.[6]).toBe(75);
  });

  it('PF26/PF27: computes population SD and safely handles N=0', () => {
    const result = computePopulationStandardDeviation({
      ...stats,
      ratingHistogram: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1 },
    }, inputEvidence);
    expect(result.state).toBe('conflict');
    expect(result.data?.histogramPopulation).toBe(10);
    expect(result.data?.histogramMean).toBe(5.5);
    expect(result.data?.standardDeviation).toBeCloseTo(Math.sqrt(8.25), 8);
    expect(result.data?.upstreamScore).toBe(6);
    expect(result.conflicts).toHaveLength(1);
    expect(result.evidence?.histogramMean?.[0]?.formula).toBe(HISTOGRAM_MEAN_FORMULA.id);
    expect(result.evidence?.histogramMean?.[0]?.fieldPath).toBe('histogramMean');
    expect(result.conflicts?.[0]?.candidates[1]?.evidence?.[0]?.fieldPath).toBe('rating.score');

    const empty = computePopulationStandardDeviation({
      ...stats,
      ratingHistogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 },
    });
    expect(empty.state).toBe('not_computable');
    expect(empty.data).toBeNull();
    expect(JSON.stringify(empty)).not.toContain('NaN');
  });

  it('PF28-PF31: completion uses all five buckets and records empirical formula provenance', () => {
    const result = computeCollectionCompletionRate(stats, inputEvidence, '2026-08-09T00:00:00Z');

    expect(result.state).toBe('ok');
    expect(result.data).toBe(2 / 15);
    expect(result.warnings?.[0]?.code).toBe('FORMULA_EMPIRICALLY_VERIFIED');
    expect(COMPLETION_FORMULA.id).toBe('bangumi.subject.completion.v1');
    expect(COMPLETION_FORMULA.version).toBe(1);
    expect(COMPLETION_FORMULA.evidenceStatus).toBe('empirically_verified');
    expect(COMPLETION_FORMULA.evidenceStatus).not.toBe('official_contract');
    expect(result.evidence?.value?.[0]?.formula).toBe(COMPLETION_FORMULA.id);
  });

  it('PF33: collection percentages preserve all five buckets and zero-population semantics', () => {
    const result = computeCollectionPercentages(stats, inputEvidence, '2026-08-09T00:00:00Z');

    expect(result.state).toBe('ok');
    expect(result.data).toMatchObject({
      wish: (1 / 15) * 100,
      collect: (2 / 15) * 100,
      doing: 20,
      on_hold: (4 / 15) * 100,
      dropped: (5 / 15) * 100,
    });
    expect(COLLECTION_PERCENTAGES_FORMULA.id).toBe('bangumi.collection.percentages.v1');
    expect(result.evidence?.value?.[0]?.formula).toBe(COLLECTION_PERCENTAGES_FORMULA.id);

    const empty = computeCollectionPercentages({
      ...stats,
      collection: { wish: 0, collect: 0, doing: 0, onHold: 0, dropped: 0 },
    });
    expect(empty.state).toBe('not_computable');
    expect(empty.data).toBeNull();
  });

  it('PF29/PF32: zero denominator is not computable and derived evidence retains inputs', () => {
    const result = computeCollectionCompletionRate(
      { ...stats, collection: { wish: 0, collect: 0, doing: 0, onHold: 0, dropped: 0 } },
      inputEvidence,
    );

    expect(result.state).toBe('not_computable');
    expect(result.data).toBeNull();
    expect(result.evidence?.['collection.wish']?.[0]?.source.class).toBe('official_v0');
    expect(result.evidence?.value?.[0]?.source.class).toBe('derived');
    expect(POPULATION_SD_FORMULA.id).toBe('bangumi.rating.population_sd.v1');
  });

  it('SC14/SC15: unresolved score disagreement is conflict, while one-decimal rounding is diagnostic only', () => {
    const unresolved = computePopulationStandardDeviation({
      ...stats,
      ratingHistogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 2, 6: 1, 7: 0, 8: 0, 9: 0, 10: 0 },
    });
    expect(unresolved.state).toBe('conflict');
    expect(unresolved.conflicts).toHaveLength(1);

    const rounded = computePopulationStandardDeviation({
      ...stats,
      score: 5.3,
      ratingHistogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 2, 6: 1, 7: 0, 8: 0, 9: 0, 10: 0 },
    });
    expect(rounded.state).toBe('ok');
    expect(rounded.conflicts).toBeUndefined();
    expect(rounded.warnings?.[0]?.code).toBe('SOURCE_DISAGREEMENT');
  });
});
