import { describe, expect, it } from 'vitest';
import type { SubjectStatsIntelligenceResult } from '@bangumi-agent-kit/bangumi-core';
import {
  OfficialV0Provider,
  ProviderRegistry,
  type CapabilityResult,
  type SubjectStatsData,
} from '@bangumi-agent-kit/provider-core';
import type { Subject } from '@bangumi-agent-kit/bangumi-openapi';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createReadTools } from '@bangumi-agent-kit/tools';

const stats: SubjectStatsData = {
  score: 8.6,
  rank: 12,
  ratingTotal: 100,
  ratingHistogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 40, 9: 60, 10: 0 },
  collection: { wish: 2, collect: 4, doing: 2, onHold: 1, dropped: 1 },
};

function evidence() {
  return {
    'rating.score': [
      {
        source: { class: 'official_v0' as const, provider: 'bangumi', operation: 'getSubjectById' },
        retrievedAt: '2026-08-15T00:00:00.000Z',
        fieldPath: 'rating.score',
      },
    ],
    'rating.count.8': [
      {
        source: { class: 'official_v0' as const, provider: 'bangumi', operation: 'getSubjectById' },
        retrievedAt: '2026-08-15T00:00:00.000Z',
        fieldPath: 'rating.count.8',
      },
    ],
    'rating.count.9': [
      {
        source: { class: 'official_v0' as const, provider: 'bangumi', operation: 'getSubjectById' },
        retrievedAt: '2026-08-15T00:00:00.000Z',
        fieldPath: 'rating.count.9',
      },
    ],
    'collection.collect': [
      {
        source: { class: 'official_v0' as const, provider: 'bangumi', operation: 'getSubjectById' },
        retrievedAt: '2026-08-15T00:00:00.000Z',
        fieldPath: 'collection.collect',
      },
    ],
  };
}

function registry(result: CapabilityResult<SubjectStatsData> = { state: 'ok', data: stats }) {
  return new ProviderRegistry({
    v0: {
      async getSubject() {
        return { state: 'not_found' as const };
      },
      async getSubjectStats() {
        return {
          ...result,
          evidence: result.evidence || evidence(),
          retrievedAt: result.retrievedAt || '2026-08-15T00:00:00.000Z',
        };
      },
    },
  });
}

interface SubjectStatsTool {
  input: { safeParse: (value: unknown) => { success: boolean } };
  execute: (
    input: { subjectId: number },
    context: unknown,
    dependencies: { providerRegistry: ProviderRegistry },
  ) => Promise<SubjectStatsIntelligenceResult>;
}

interface RawSubjectStatsTool {
  execute: (
    input: { subjectId: number },
    context: unknown,
    dependencies: { providerRegistry: ProviderRegistry },
  ) => Promise<CapabilityResult<SubjectStatsData>>;
}

function getTool(): SubjectStatsTool {
  const tool = createReadTools(new HttpClient()).find(
    (candidate) => candidate.name === 'bangumi.get_subject_stats_intelligence',
  );
  if (!tool) throw new Error('subject stats intelligence tool was not registered');
  return tool as unknown as SubjectStatsTool;
}

describe('Subject statistics intelligence semantic contract', () => {
  it('computes deterministic distributions and preserves formula/source evidence', async () => {
    const tool = getTool();
    expect(tool.input.safeParse({ subjectId: 123 }).success).toBe(true);
    expect(tool.input.safeParse({ subjectId: 0 }).success).toBe(false);

    const result = await tool.execute(
      { subjectId: 123 },
      { principalId: 'stats-test' },
      { providerRegistry: registry() },
    );

    expect(result).toMatchObject({
      subjectId: 123,
      state: 'complete',
      raw: { ratingTotal: 100 },
      rating: {
        state: 'complete',
        population: 100,
        mean: 8.6,
        formulas: expect.objectContaining({
          histogramMean: expect.objectContaining({ id: 'bangumi.rating.histogram_mean.v1' }),
        }),
        distribution: expect.arrayContaining([
          { score: 8, count: 40, percentage: 40 },
          { score: 9, count: 60, percentage: 60 },
        ]),
      },
      collection: {
        state: 'complete',
        total: 10,
        completionRate: 0.4,
        completionState: 'complete',
        distribution: expect.arrayContaining([{ status: 'collect', count: 4, percentage: 40 }]),
      },
      coverage: {
        formulasAttempted: 5,
        formulasComplete: 5,
        formulasPartial: 0,
        formulasNotComputable: 0,
        formulasConflict: 0,
      },
    });
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'official-v0', fieldPath: 'rating.score' }),
        expect.objectContaining({ source: 'derived-s7', formula: 'bangumi.rating.percentages.v1' }),
        expect.objectContaining({
          source: 'derived-s7',
          formula: 'bangumi.rating.histogram_mean.v1',
        }),
        expect.objectContaining({
          source: 'derived-s7',
          formula: 'bangumi.collection.percentages.v1',
        }),
      ]),
    );
  });

  it('keeps a material histogram mean conflict explicit', async () => {
    const result = await getTool().execute(
      { subjectId: 123 },
      { principalId: 'stats-test' },
      {
        providerRegistry: registry({
          state: 'ok',
          data: { ...stats, score: 6 },
          evidence: evidence(),
        }),
      },
    );

    expect(result).toMatchObject({
      state: 'conflict',
      rating: {
        state: 'conflict',
        conflicts: [
          {
            state: 'conflict',
            candidates: expect.arrayContaining([
              expect.objectContaining({
                source: expect.objectContaining({ class: 'derived-s7' }),
                value: 8.6,
                evidence: expect.arrayContaining([
                  expect.objectContaining({ formula: 'bangumi.rating.histogram_mean.v1' }),
                ]),
              }),
              expect.objectContaining({
                source: expect.objectContaining({ class: 'official-v0' }),
                value: 6,
                evidence: expect.arrayContaining([
                  expect.objectContaining({ fieldPath: 'rating.score' }),
                ]),
              }),
            ]),
          },
        ],
      },
      coverage: { formulasComplete: 4, formulasConflict: 1 },
    });
  });

  it('preserves structured rating and collection conflict candidates without non-finite coercion', async () => {
    const result = await getTool().execute(
      { subjectId: 123 },
      { principalId: 'stats-test' },
      {
        providerRegistry: registry({
          state: 'conflict',
          data: stats,
          evidence: evidence(),
          conflicts: [
            {
              state: 'conflict',
              reason: 'rating bucket candidates disagree',
              candidates: [
                {
                  source: {
                    class: 'official_v0',
                    provider: 'bangumi',
                    operation: 'getSubjectById',
                  },
                  value: { rating: { count: { 8: 40 } } },
                  evidence: [
                    {
                      source: {
                        class: 'official_v0',
                        provider: 'bangumi',
                        operation: 'getSubjectById',
                      },
                      retrievedAt: '2026-08-15T00:00:00.000Z',
                      fieldPath: 'rating.count.8',
                    },
                  ],
                },
                {
                  source: { class: 'derived', provider: 'fixture-derived' },
                  value: { rating: { count: { 8: 41 } } },
                  evidence: [
                    {
                      source: { class: 'derived', provider: 'fixture-derived' },
                      retrievedAt: '2026-08-15T00:00:00.000Z',
                      fieldPath: 'rating.count.8',
                    },
                  ],
                },
              ],
            },
            {
              state: 'conflict',
              reason: 'collection bucket candidate is malformed',
              candidates: [
                {
                  source: { class: 'official_v0', provider: 'bangumi' },
                  value: Number.NaN,
                  evidence: [
                    {
                      source: { class: 'official_v0', provider: 'bangumi' },
                      retrievedAt: '2026-08-15T00:00:00.000Z',
                      fieldPath: 'collection.collect',
                    },
                  ],
                },
              ],
            },
          ],
        }),
      },
    );

    expect(result).toMatchObject({
      state: 'conflict',
      coverage: { formulasAttempted: 5, formulasConflict: 5 },
      rating: {
        state: 'conflict',
        conflicts: [expect.objectContaining({ scope: 'rating', fieldPaths: ['rating.count.8'] })],
      },
      collection: {
        state: 'conflict',
        conflicts: [expect.objectContaining({ scope: 'collection' })],
      },
    });
    expect(result.conflicts).toHaveLength(2);
    expect(result.conflicts?.[0]?.candidates[0]?.value).toEqual({ rating: { count: { 8: 40 } } });
    expect(result.conflicts?.[1]?.candidates[0]?.value).toEqual({
      state: 'unknown',
      reason: 'non_finite_candidate_value',
    });
    expect(JSON.stringify(result)).not.toContain('NaN');
    expect(JSON.stringify(result)).not.toContain('Infinity');
  });

  it('preserves granular official evidence through the real provider adapter', async () => {
    const raw = {
      id: 123,
      rating: {
        score: 6,
        rank: 12,
        total: 100,
        count: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 40, 9: 60, 10: 0 },
      },
      collection: { wish: 2, collect: 4, doing: 2, on_hold: 1, dropped: 1 },
    } as unknown as Subject;

    const result = await getTool().execute(
      { subjectId: 123 },
      { principalId: 'stats-test' },
      {
        providerRegistry: new ProviderRegistry({
          v0: new OfficialV0Provider({ getSubjectById: async () => raw }),
        }),
      },
    );

    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'official-v0', fieldPath: 'rating.score' }),
        expect.objectContaining({ source: 'official-v0', fieldPath: 'rating.count.8' }),
        expect.objectContaining({
          source: 'derived-s7',
          formula: 'bangumi.rating.histogram_mean.v1',
        }),
      ]),
    );
    const ratingConflict = result.rating?.conflicts?.[0];
    expect(ratingConflict?.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: expect.objectContaining({ class: 'derived-s7' }),
          evidence: expect.arrayContaining([
            expect.objectContaining({ formula: 'bangumi.rating.histogram_mean.v1' }),
          ]),
        }),
        expect.objectContaining({
          source: expect.objectContaining({ class: 'official-v0' }),
          evidence: expect.arrayContaining([
            expect.objectContaining({ fieldPath: 'rating.score' }),
          ]),
        }),
      ]),
    );
    expect(result.source.official.operations).toEqual(['getSubjectById']);
    expect(result.source.derived.operations).toEqual(
      expect.arrayContaining([
        'bangumi.rating.percentages.v1',
        'bangumi.rating.histogram_mean.v1',
        'bangumi.rating.population_sd.v1',
        'bangumi.collection.percentages.v1',
        'bangumi.subject.completion.v1',
      ]),
    );
    expect(result.source.derived.operations).not.toContain('getSubjectById');
    expect(result.source.derived.operations).not.toContain('getSubjectStats');
  });

  it('propagates incomplete official coverage through the registry and raw stats tool', async () => {
    const raw = {
      id: 123,
      rating: {
        score: 6,
        rank: 12,
        total: 100,
        count: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 9: 60, 10: 0 },
      },
      collection: { wish: 2, collect: 4, doing: 2, on_hold: 1, dropped: 1 },
    } as unknown as Subject;
    const rawToolDefinition = createReadTools(new HttpClient()).find(
      (candidate) => candidate.name === 'bangumi.get_subject_stats',
    );
    if (!rawToolDefinition) throw new Error('raw subject stats tool was not registered');
    const rawTool = rawToolDefinition as unknown as RawSubjectStatsTool;

    const rawResult = await rawTool.execute(
      { subjectId: 123 },
      { principalId: 'stats-test' },
      {
        providerRegistry: new ProviderRegistry({
          v0: new OfficialV0Provider({ getSubjectById: async () => raw }),
        }),
      },
    );

    expect(rawResult).toMatchObject({
      state: 'partial',
      coverage: { state: 'partial' },
      data: { ratingHistogramPresence: { 8: false } },
    });
    expect(rawResult.evidence?.['rating.count.8']).toBeUndefined();
  });

  it('distinguishes zero-population not-computable data from unavailable data', async () => {
    const result = await getTool().execute(
      { subjectId: 123 },
      { principalId: 'stats-test' },
      {
        providerRegistry: registry({
          state: 'ok',
          data: {
            ...stats,
            ratingTotal: 0,
            ratingHistogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 },
            collection: { wish: 0, collect: 0, doing: 0, onHold: 0, dropped: 0 },
          },
          evidence: evidence(),
        }),
      },
    );

    expect(result).toMatchObject({
      state: 'not_computable',
      rating: { state: 'not_computable' },
      collection: { state: 'not_computable', total: 0, completionState: 'not_computable' },
      coverage: { formulasAttempted: 5, formulasNotComputable: 5 },
    });
    expect(JSON.stringify(result)).not.toContain('NaN');
    expect(JSON.stringify(result)).not.toContain('Infinity');
  });

  it('does not turn malformed provider data into derived numbers', async () => {
    const result = await getTool().execute(
      { subjectId: 123 },
      { principalId: 'stats-test' },
      {
        providerRegistry: registry({
          state: 'ok',
          data: { ...stats, ratingHistogram: { ...stats.ratingHistogram, 8: -1 } },
          evidence: evidence(),
        }),
      },
    );

    expect(result).toMatchObject({
      state: 'partial',
      warnings: [expect.objectContaining({ code: 'INVALID_STATS_INPUT' })],
    });
    expect(result).not.toHaveProperty('rating.mean');
  });

  it('does not treat a successful empty provider payload as complete', async () => {
    const result = await getTool().execute(
      { subjectId: 123 },
      { principalId: 'stats-test' },
      {
        providerRegistry: registry({ state: 'ok', data: undefined, evidence: evidence() }),
      },
    );

    expect(result).toMatchObject({
      state: 'partial',
      warnings: [expect.objectContaining({ code: 'MISSING_STATS_DATA' })],
    });
    expect(result).not.toHaveProperty('raw');
  });
});
