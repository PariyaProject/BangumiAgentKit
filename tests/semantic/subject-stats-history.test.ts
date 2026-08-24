import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import {
  getSubjectStatsHistory,
  type SubjectStatsHistoryDependencies,
} from '../../packages/tools/src/subject-stats-history.js';
import {
  ProviderRegistry,
  type CapabilityResult,
  type SubjectStatsData,
} from '@bangumi-agent-kit/provider-core';

const baseStats: SubjectStatsData = {
  score: 8.6,
  rank: 12,
  ratingTotal: 100,
  ratingHistogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 40, 9: 60, 10: 0 },
  collection: { wish: 2, collect: 4, doing: 2, onHold: 1, dropped: 1 },
};

function evidence(retrievedAt: string) {
  return {
    'rating.score': [
      {
        source: { class: 'official_v0' as const, provider: 'bangumi', operation: 'getSubjectById' },
        retrievedAt,
        fieldPath: 'rating.score',
      },
    ],
    'rating.count.8': [
      {
        source: { class: 'official_v0' as const, provider: 'bangumi', operation: 'getSubjectById' },
        retrievedAt,
        fieldPath: 'rating.count.8',
      },
    ],
    'rating.count.9': [
      {
        source: { class: 'official_v0' as const, provider: 'bangumi', operation: 'getSubjectById' },
        retrievedAt,
        fieldPath: 'rating.count.9',
      },
    ],
    'collection.collect': [
      {
        source: { class: 'official_v0' as const, provider: 'bangumi', operation: 'getSubjectById' },
        retrievedAt,
        fieldPath: 'collection.collect',
      },
    ],
  };
}

function registry(getStats: () => SubjectStatsData): ProviderRegistry {
  return new ProviderRegistry({
    v0: {
      async getSubject() {
        return { state: 'not_found' as const };
      },
      async getSubjectStats(): Promise<CapabilityResult<SubjectStatsData>> {
        const retrievedAt = new Date().toISOString();
        return {
          state: 'ok',
          data: getStats(),
          evidence: evidence(retrievedAt),
          retrievedAt,
        };
      },
    },
  });
}

describe('subject statistics observation history', () => {
  it('starts only on explicit recording, preserves bounded snapshots, and computes safe deltas', async () => {
    const storage = new MemoryStorage();
    let current = baseStats;
    const dependencies: SubjectStatsHistoryDependencies = {
      storage,
      providerRegistry: registry(() => current),
    };

    const readOnly = await getSubjectStatsHistory(
      123,
      { recordCurrent: false, now: new Date('2026-08-24T00:00:00.000Z') },
      dependencies,
    );
    expect(readOnly.collection.observationsObserved).toBe(0);
    expect(readOnly.warnings).toEqual([]);

    const first = await getSubjectStatsHistory(
      123,
      { recordCurrent: true, now: new Date('2026-08-24T00:00:00.000Z') },
      dependencies,
    );
    expect(first.collection.observationsObserved).toBe(1);
    expect(first.collection.changePairs).toBe(0);

    current = {
      ...baseStats,
      score: 8.8,
      ratingTotal: 110,
      ratingHistogram: { ...baseStats.ratingHistogram, 8: 22, 9: 88 },
      collection: { ...baseStats.collection, collect: 5 },
    };
    const second = await getSubjectStatsHistory(
      123,
      { recordCurrent: true, maxObservations: 2, now: new Date('2026-08-25T00:00:00.000Z') },
      dependencies,
    );

    expect(second.state).toBe('complete');
    expect(second.collection.observationsObserved).toBe(2);
    expect(second.collection.changePairs).toBe(1);
    const metrics = second.changes[0]?.metrics || [];
    expect(metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'score', state: 'complete', delta: 0.2 }),
        expect.objectContaining({ key: 'ratingTotal', state: 'complete', delta: 10 }),
        expect.objectContaining({ key: 'collectionTotal', state: 'complete', delta: 1 }),
      ]),
    );
    expect(JSON.stringify(second)).not.toContain('accessToken');

    const throttled = await getSubjectStatsHistory(
      123,
      { recordCurrent: true, maxObservations: 2, now: new Date('2026-08-25T00:30:00.000Z') },
      dependencies,
    );
    expect(throttled.collection.observationsObserved).toBe(2);
    expect(throttled.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'OBSERVATION_INTERVAL_NOT_ELAPSED' }),
      ]),
    );
  });

  it('does not convert missing or partial metrics into zero', async () => {
    const storage = new MemoryStorage();
    const first = await getSubjectStatsHistory(
      123,
      { recordCurrent: true, now: new Date('2026-08-24T00:00:00.000Z') },
      { storage, providerRegistry: registry(() => baseStats) },
    );
    expect(first.collection.observationsObserved).toBe(1);

    const partial: SubjectStatsData = {
      ...baseStats,
      ratingTotal: 0,
      ratingHistogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 },
    };
    const second = await getSubjectStatsHistory(
      123,
      { recordCurrent: true, now: new Date('2026-08-25T00:00:00.000Z') },
      { storage, providerRegistry: registry(() => partial) },
    );
    const meanChange = second.changes[0]?.metrics.find((metric) => metric.key === 'histogramMean');
    expect(meanChange?.state).toBe('not_computable');
    expect(meanChange?.delta).toBeUndefined();
  });
});
