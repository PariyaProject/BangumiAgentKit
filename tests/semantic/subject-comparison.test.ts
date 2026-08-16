import { describe, expect, it } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  ProviderRegistry,
  type CapabilityResult,
  type SubjectStatsData,
} from '@bangumi-agent-kit/provider-core';
import type { SubjectComparisonResult } from '@bangumi-agent-kit/bangumi-core';
import { createReadTools, type ToolContext, type ToolDefinition } from '@bangumi-agent-kit/tools';

const context: ToolContext = {
  principalId: 'subject-comparison-test',
  botInstanceId: 'test',
  conversationId: 'test',
};

const subjects = {
  123: {
    id: 123,
    type: 2,
    name: 'First Original Title',
    name_cn: '第一个条目：非常长的中文标题用于覆盖换行',
    summary: 'First subject fixture.',
    nsfw: false,
    locked: false,
    date: '2017-10-06',
    platform: 'TV',
    eps: 12,
    total_episodes: 12,
    rating: { score: 8.6, rank: 42, total: 100 },
    collection: { wish: 10, collect: 20, doing: 3, on_hold: 4, dropped: 2 },
  },
  456: {
    id: 456,
    type: 2,
    name: 'Second Original Title',
    name_cn: '第二个条目',
    summary: 'Second subject fixture.',
    nsfw: false,
    locked: false,
    date: '2020-01-02',
    platform: 'Web',
    eps: 24,
    total_episodes: 26,
    rating: { score: 7.5, rank: 120, total: 80 },
    collection: { wish: 2, collect: 30, doing: 4, on_hold: 1, dropped: 3 },
  },
} as const;

const stats: Record<number, SubjectStatsData> = {
  123: {
    score: 8.6,
    rank: 42,
    ratingTotal: 100,
    ratingHistogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 40, 9: 60, 10: 0 },
    collection: { wish: 10, collect: 20, doing: 3, onHold: 4, dropped: 2 },
  },
  456: {
    score: 7.5,
    rank: 120,
    ratingTotal: 80,
    ratingHistogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 40, 8: 40, 9: 0, 10: 0 },
    collection: { wish: 2, collect: 30, doing: 4, onHold: 1, dropped: 3 },
  },
};

const characters = (subjectId: number) => [
  {
    id: subjectId + 1,
    name: `角色 ${subjectId} A`,
    type: 1,
    relation: '主角',
    actors: [
      { id: 900, name: '共同声优', career: ['seiyu'], images: {} },
      { id: subjectId + 10, name: `声优 ${subjectId} A`, career: ['seiyu'], images: {} },
    ],
  },
  {
    id: subjectId + 2,
    name: `角色 ${subjectId} B`,
    type: 2,
    relation: '配角',
    actors: [{ id: subjectId + 20, name: `声优 ${subjectId} B`, career: ['seiyu'], images: {} }],
  },
];

const persons = (subjectId: number) => [
  {
    id: 901,
    name: '共同制作人员',
    type: 1,
    career: ['director'],
    relation: '导演',
    images: {},
  },
  {
    id: subjectId + 31,
    name: `职员 ${subjectId} B`,
    type: 1,
    career: ['writer'],
    relation: '脚本',
    images: {},
  },
];

const relations = (subjectId: number) => [
  {
    id: subjectId + 40,
    type: 2,
    name: `关联 ${subjectId}`,
    name_cn: `关联 ${subjectId}`,
    relation: '续集',
    images: {},
  },
  {
    id: subjectId + 41,
    type: 1,
    name: `原作 ${subjectId}`,
    name_cn: `原作 ${subjectId}`,
    relation: '原作',
    images: {},
  },
];

function buildClient(
  options: {
    missingSubjectId?: number;
    missingSubjectIds?: number[];
    subjectScoreOverrides?: Record<number, number>;
    failPath?: string;
    malformedPath?: string;
    duplicateCreditRows?: boolean;
    missingActorIdSubject?: number;
    missingStaffIdSubject?: number;
  } = {},
) {
  const requests: string[] = [];
  const client = new HttpClient({
    fetchFn: async (input) => {
      const url = String(input);
      requests.push(url);
      if (options.failPath && url.includes(options.failPath)) {
        return new Response(JSON.stringify({ error: 'fixture failure' }), { status: 503 });
      }
      if (options.malformedPath && url.includes(options.malformedPath)) {
        return new Response(JSON.stringify({ malformed: true }), { status: 200 });
      }
      const match = url.match(/\/v0\/subjects\/(\d+)(?:\/([^/?]+))?$/);
      const subjectId = match ? Number(match[1]) : undefined;
      const endpoint = match?.[2];
      if (!subjectId || !subjects[subjectId as keyof typeof subjects]) {
        return new Response(JSON.stringify({ error: 'missing fixture' }), { status: 404 });
      }
      if (
        (options.missingSubjectId === subjectId ||
          options.missingSubjectIds?.includes(subjectId)) &&
        !endpoint
      ) {
        return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
      }
      if (!endpoint)
        return new Response(
          JSON.stringify({
            ...subjects[subjectId as 123 | 456],
            ...(options.subjectScoreOverrides?.[subjectId] === undefined
              ? {}
              : {
                  rating: {
                    ...subjects[subjectId as 123 | 456].rating,
                    score: options.subjectScoreOverrides[subjectId],
                  },
                }),
          }),
          { status: 200 },
        );
      if (endpoint === 'characters') {
        const data = characters(subjectId).map((item) => ({
          ...item,
          actors: item.actors.map((actor) =>
            options.missingActorIdSubject === subjectId && actor.id === 900
              ? { ...actor, id: 0 }
              : actor,
          ),
        }));
        if (options.duplicateCreditRows && data[0]) {
          data[0] = { ...data[0], actors: [...data[0].actors, data[0].actors[0]!] };
        }
        return new Response(JSON.stringify(data), { status: 200 });
      }
      if (endpoint === 'persons') {
        const data = persons(subjectId).map((item, index) =>
          options.missingStaffIdSubject === subjectId && index === 0 ? { ...item, id: 0 } : item,
        );
        if (options.duplicateCreditRows && data[0]) data.push({ ...data[0] });
        return new Response(JSON.stringify(data), { status: 200 });
      }
      if (endpoint === 'subjects') {
        return new Response(JSON.stringify(relations(subjectId)), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'unknown fixture endpoint' }), { status: 404 });
    },
  });
  return { client, requests };
}

function buildProviderRegistry(
  options: {
    scoreOverrides?: Record<number, number>;
    scoreConflict?: boolean;
    statsCalls?: { value: number };
  } = {},
): ProviderRegistry {
  return new ProviderRegistry({
    v0: {
      async getSubject() {
        return { state: 'ok' as const, data: undefined };
      },
      async getSubjectStats(subjectId: number): Promise<CapabilityResult<SubjectStatsData>> {
        if (options.statsCalls) options.statsCalls.value += 1;
        const score = options.scoreOverrides?.[subjectId] ?? stats[subjectId]!.score;
        return {
          state: options.scoreConflict ? 'conflict' : 'ok',
          data: {
            ...stats[subjectId]!,
            ...(options.scoreOverrides?.[subjectId] === undefined ? {} : { score }),
          },
          retrievedAt: `2026-08-15T00:00:0${subjectId === 123 ? '1' : '2'}.000Z`,
          evidence: {
            'rating.score': [
              {
                source: {
                  class: 'official_v0' as const,
                  provider: 'bangumi',
                  operation: 'getSubjectStats',
                },
                retrievedAt: '2026-08-15T00:00:00.000Z',
              },
            ],
          },
          ...(options.scoreConflict
            ? {
                conflicts: [
                  {
                    state: 'conflict' as const,
                    reason: 'score provider candidates disagree',
                    candidates: [
                      {
                        source: {
                          class: 'official_v0' as const,
                          provider: 'bangumi',
                          operation: 'getSubjectStats',
                        },
                        value: score,
                        evidence: [
                          {
                            source: {
                              class: 'official_v0' as const,
                              provider: 'bangumi',
                              operation: 'getSubjectStats',
                            },
                            retrievedAt: '2026-08-15T00:00:00.000Z',
                            fieldPath: 'score',
                          },
                        ],
                      },
                      {
                        source: {
                          class: 'derived' as const,
                          provider: 'fixture-derived',
                          operation: 'score-candidate',
                        },
                        value: score + 0.1,
                        evidence: [
                          {
                            source: {
                              class: 'derived' as const,
                              provider: 'fixture-derived',
                              operation: 'score-candidate',
                            },
                            retrievedAt: '2026-08-15T00:00:00.000Z',
                            fieldPath: 'score',
                          },
                        ],
                      },
                    ],
                  },
                ],
              }
            : {}),
        };
      },
    },
  });
}

function getTool(client: HttpClient): ToolDefinition {
  const tool = createReadTools(client).find(
    (item) => item.name === 'bangumi.get_subject_comparison',
  );
  if (!tool) throw new Error('subject comparison tool was not registered');
  return tool;
}

describe('Subject comparison semantic contract', () => {
  it('registers a bounded read tool and returns deterministic side-by-side facts', async () => {
    const { client, requests } = buildClient();
    const tool = getTool(client);

    expect(tool.input.safeParse({ subjectIds: [123, 123] }).success).toBe(false);
    expect(tool.input.safeParse({ subjectIds: [123, 456], maxCast: 21 }).success).toBe(false);

    const result = (await tool.execute(
      { subjectIds: [123, 456], maxCast: 2, maxStaff: 2, maxRelations: 2 },
      context,
      { providerRegistry: buildProviderRegistry() },
    )) as Awaited<
      ReturnType<
        typeof import('../../packages/tools/src/subject-comparison.js').getSubjectComparison
      >
    >;

    expect(result).toMatchObject({
      state: 'complete',
      subjectIds: [123, 456],
      subjects: [
        {
          subjectId: 123,
          state: 'complete',
          subject: { nameCn: '第一个条目：非常长的中文标题用于覆盖换行' },
          sections: { cast: 'complete', staff: 'complete', relations: 'complete' },
        },
        {
          subjectId: 456,
          state: 'complete',
          subject: { nameCn: '第二个条目' },
          sections: { cast: 'complete', staff: 'complete', relations: 'complete' },
        },
      ],
      coverage: {
        requestedSubjects: 2,
        returnedSubjects: 2,
        subjectsComplete: 2,
        metricsComplete: 11,
        metricsUnknown: 0,
        limits: { maxSubjects: 2, maxCast: 2, maxStaff: 2, maxRelations: 2 },
      },
    });
    expect(result.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'episodesReported', values: [12, 24], delta: 12 }),
        expect.objectContaining({ key: 'totalEpisodesReported', values: [12, 26], delta: 14 }),
        expect.objectContaining({
          key: 'score',
          values: [8.6, 7.5],
          delta: -1.1,
          deltaPrecision: 1,
        }),
        expect.objectContaining({ key: 'rank', values: [42, 120], delta: 78 }),
        expect.objectContaining({ key: 'ratingTotal', values: [100, 80], delta: -20 }),
        expect.objectContaining({ key: 'collectionTotal', values: [39, 40], delta: 1 }),
        expect.objectContaining({ key: 'ratingPopulation', values: [100, 80], delta: -20 }),
        expect.objectContaining({ key: 'ratingMean', values: [8.6, 7.5], delta: -1.1 }),
        expect.objectContaining({ key: 'ratingStandardDeviation', state: 'complete' }),
        expect.objectContaining({ key: 'collectionPopulation', values: [39, 40], delta: 1 }),
        expect.objectContaining({ key: 'collectionCompletionRate', state: 'complete' }),
      ]),
    );
    expect(result.formulaVersion).toBe('subject-comparison-v2');
    expect(result.statisticsFormulaVersion).toBe('subject-comparison-statistics-v1');
    expect(result.subjects[0]?.statistics).toMatchObject({
      state: 'complete',
      rating: {
        population: 100,
        mean: 8.6,
        distribution: expect.arrayContaining([{ score: 8, count: 40, percentage: 40 }]),
      },
      collection: { total: 39, completionRate: 20 / 39 },
    });
    expect(result.source).toMatchObject({
      official: {
        class: 'official-v0',
        operations: expect.arrayContaining(['GET /v0/subjects/{subject_id}']),
      },
      derived: {
        class: 'derived-s7',
        operations: expect.arrayContaining([
          'subject-overview-composition',
          'subject-comparison',
          'subject-comparison-statistics',
        ]),
      },
    });
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'derived-s7',
          operation: 'subject-comparison',
          formulaVersion: 'subject-comparison-v2',
        }),
        expect.objectContaining({
          source: 'derived-s7',
          operation: 'subject-comparison-statistics',
          formulaVersion: 'subject-comparison-statistics-v1',
        }),
        expect.objectContaining({ subjectIds: [123] }),
        expect.objectContaining({ subjectIds: [456] }),
      ]),
    );
    expect(requests).toHaveLength(8);
  });

  it('keeps one section failure and one missing subject explicit', async () => {
    const failedSection = await getTool(
      buildClient({ failPath: '/subjects/456/persons' }).client,
    ).execute({ subjectIds: [123, 456] }, context, { providerRegistry: buildProviderRegistry() });
    expect(failedSection).toMatchObject({
      state: 'partial',
      subjects: [
        { subjectId: 123, state: 'complete' },
        { subjectId: 456, state: 'partial', sections: { staff: 'unavailable' } },
      ],
    });
    expect((failedSection as { warnings: Array<{ code: string }> }).warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'SUBJECT_STATE_DEGRADED' })]),
    );

    const statsCalls = { value: 0 };
    const missing = await getTool(buildClient({ missingSubjectId: 456 }).client).execute(
      { subjectIds: [123, 456] },
      context,
      { providerRegistry: buildProviderRegistry({ statsCalls }) },
    );
    expect(missing).toMatchObject({
      state: 'partial',
      subjects: [
        { subjectId: 123, state: 'complete' },
        {
          subjectId: 456,
          state: 'not_found',
          sections: {
            stats: 'unavailable',
            cast: 'unavailable',
            staff: 'unavailable',
            relations: 'unavailable',
          },
        },
      ],
      coverage: { subjectsNotFound: 1, metricsComplete: 0 },
    });
    expect((missing as { coverage: { returnedSubjects: number } }).coverage.returnedSubjects).toBe(
      1,
    );
    expect(
      (missing as { subjects: Array<Record<string, unknown>> }).subjects[1],
    ).not.toHaveProperty('subject');
    expect((missing as { warnings: Array<Record<string, unknown>> }).warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ subjectId: 456, state: 'not_found' })]),
    );
    expect(
      (missing as { metrics: Array<{ state: string; delta: number | null }> }).metrics,
    ).toEqual(expect.arrayContaining([expect.objectContaining({ state: 'unknown', delta: null })]));
    expect(statsCalls.value).toBe(1);
  });

  it('keeps malformed sections and cross-source numeric conflicts explicit', async () => {
    const malformed = await getTool(
      buildClient({ malformedPath: '/v0/subjects/456/characters' }).client,
    ).execute({ subjectIds: [123, 456] }, context, {
      providerRegistry: buildProviderRegistry(),
    });
    expect(malformed).toMatchObject({
      state: 'partial',
      subjects: [
        { subjectId: 123, state: 'complete' },
        { subjectId: 456, state: 'partial' },
      ],
    });
    expect(
      (malformed as { subjects: Array<{ sections: { cast: string } }> }).subjects[1]?.sections.cast,
    ).toBe('unavailable');

    const conflict = await getTool(buildClient().client).execute(
      { subjectIds: [123, 456] },
      context,
      { providerRegistry: buildProviderRegistry({ scoreOverrides: { 123: 8.4 } }) },
    );
    expect(conflict).toMatchObject({
      state: 'partial',
      coverage: { metricsConflict: 2 },
      warnings: expect.arrayContaining([
        expect.objectContaining({ code: 'COMPARISON_VALUES_CONFLICT' }),
        expect.objectContaining({ code: 'COMPARISON_STATISTICS_CONFLICT' }),
      ]),
    });
    expect((conflict as { metrics: Array<Record<string, unknown>> }).metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'score',
          state: 'conflict',
          delta: null,
          conflicts: [expect.objectContaining({ side: 'A', subjectValue: 8.6, statsValue: 8.4 })],
        }),
      ]),
    );
    const conflictedSubject = (conflict as SubjectComparisonResult).subjects.find(
      (subject) => subject.subjectId === 123,
    );
    expect(conflictedSubject?.statistics?.rating.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: 'rating',
          fieldPaths: expect.arrayContaining(['histogramMean', 'rating.score']),
          reason: expect.stringContaining('histogram mean'),
          candidates: expect.arrayContaining([
            expect.objectContaining({
              source: expect.objectContaining({ class: 'derived-s7' }),
              evidence: expect.arrayContaining([
                expect.objectContaining({ fieldPath: 'histogramMean' }),
              ]),
            }),
            expect.objectContaining({
              source: expect.objectContaining({ class: 'official-v0' }),
              evidence: expect.arrayContaining([
                expect.objectContaining({ fieldPath: 'rating.score' }),
              ]),
            }),
          ]),
        }),
      ]),
    );
  });

  it('canonicalizes fractional, positive, equal, and non-finite deltas', async () => {
    const positive = await getTool(
      buildClient({ subjectScoreOverrides: { 456: 9.0 } }).client,
    ).execute({ subjectIds: [123, 456] }, context, {
      providerRegistry: buildProviderRegistry({ scoreOverrides: { 456: 9.0 } }),
    });
    expect(
      (positive as { metrics: Array<{ key: string; delta: number | null }> }).metrics.find(
        (metric) => metric.key === 'score',
      ),
    ).toMatchObject({ delta: 0.4 });

    const equal = await getTool(
      buildClient({ subjectScoreOverrides: { 456: 8.6 } }).client,
    ).execute({ subjectIds: [123, 456] }, context, {
      providerRegistry: buildProviderRegistry({ scoreOverrides: { 456: 8.6 } }),
    });
    expect(
      (equal as { metrics: Array<{ key: string; delta: number | null }> }).metrics.find(
        (metric) => metric.key === 'score',
      ),
    ).toMatchObject({ delta: 0 });

    const nonFinite = await getTool(
      buildClient({
        subjectScoreOverrides: { 123: Number.MAX_VALUE, 456: -Number.MAX_VALUE },
      }).client,
    ).execute({ subjectIds: [123, 456] }, context, {
      providerRegistry: buildProviderRegistry({
        scoreOverrides: { 123: Number.MAX_VALUE, 456: -Number.MAX_VALUE },
      }),
    });
    expect(
      (
        nonFinite as { metrics: Array<{ key: string; state: string; delta: number | null }> }
      ).metrics.find((metric) => metric.key === 'score'),
    ).toMatchObject({ state: 'unknown', delta: null });
  });

  it('keeps both missing identities and provider-not-configured statistics explicit', async () => {
    const bothMissing = await getTool(
      buildClient({ missingSubjectIds: [123, 456] }).client,
    ).execute({ subjectIds: [123, 456] }, context);
    expect(bothMissing).toMatchObject({
      state: 'not_found',
      coverage: { returnedSubjects: 0, subjectsNotFound: 2 },
    });

    const providerUnavailable = await getTool(buildClient().client).execute(
      { subjectIds: [123, 456] },
      context,
    );
    expect(providerUnavailable).toMatchObject({
      state: 'partial',
      subjects: [
        { state: 'partial', sections: { stats: 'unavailable' } },
        { state: 'partial', sections: { stats: 'unavailable' } },
      ],
    });
  });

  it('keeps zero-population comparison statistics not-computable without inventing deltas', async () => {
    const zeroStatsRegistry = new ProviderRegistry({
      v0: {
        async getSubject() {
          return { state: 'not_found' as const };
        },
        async getSubjectStats(subjectId: number): Promise<CapabilityResult<SubjectStatsData>> {
          return {
            state: 'ok',
            data: {
              ...stats[subjectId]!,
              ratingTotal: 0,
              ratingHistogram: {
                1: 0,
                2: 0,
                3: 0,
                4: 0,
                5: 0,
                6: 0,
                7: 0,
                8: 0,
                9: 0,
                10: 0,
              },
              collection: { wish: 0, collect: 0, doing: 0, onHold: 0, dropped: 0 },
            },
            evidence: {},
            retrievedAt: '2026-08-15T00:00:00.000Z',
          };
        },
      },
    });
    const result = (await getTool(buildClient().client).execute(
      { subjectIds: [123, 456] },
      context,
      { providerRegistry: zeroStatsRegistry },
    )) as SubjectComparisonResult;

    expect(result.subjects[0]?.statistics).toMatchObject({
      state: 'not_computable',
      rating: { state: 'not_computable' },
      collection: { state: 'not_computable', completionState: 'not_computable' },
    });
    expect(result.subjects[0]?.coverage).toMatchObject({
      sectionsComplete: 3,
      sectionsPartial: 0,
      sectionsUnavailable: 0,
      sectionsNotComputable: 1,
    });
    expect(result.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'ratingMean', state: 'unknown', delta: null }),
        expect.objectContaining({
          key: 'collectionCompletionRate',
          state: 'unknown',
          delta: null,
        }),
      ]),
    );
    expect(JSON.stringify(result)).not.toContain('NaN');
    expect(JSON.stringify(result)).not.toContain('Infinity');
  });

  it('preserves provider-level conflict candidates through comparison metrics', async () => {
    const result = (await getTool(buildClient().client).execute(
      { subjectIds: [123, 456] },
      context,
      { providerRegistry: buildProviderRegistry({ scoreConflict: true }) },
    )) as SubjectComparisonResult;
    expect(result).toMatchObject({
      state: 'partial',
      coverage: { metricsConflict: 1 },
    });
    const conflictedSubject = result.subjects.find((subject) => subject.subjectId === 123);
    expect(conflictedSubject?.stats.state).toBe('partial');
    expect(conflictedSubject?.statistics?.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: 'headline',
          fieldPaths: ['score'],
          reason: 'score provider candidates disagree',
          candidates: expect.arrayContaining([
            expect.objectContaining({
              source: expect.objectContaining({ class: 'official-v0' }),
              evidence: expect.arrayContaining([expect.objectContaining({ fieldPath: 'score' })]),
            }),
          ]),
        }),
      ]),
    );
    expect(conflictedSubject?.stats.conflicts?.score?.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: expect.objectContaining({ class: 'official_v0' }),
          value: 8.6,
        }),
        expect.objectContaining({
          source: expect.objectContaining({ class: 'derived' }),
          value: 8.7,
        }),
      ]),
    );
    expect(result.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'score',
          state: 'conflict',
          delta: null,
          conflicts: expect.arrayContaining([
            expect.objectContaining({
              side: 'A',
              candidates: expect.arrayContaining([
                expect.objectContaining({
                  source: expect.objectContaining({ class: 'official_v0' }),
                  metricValue: 8.6,
                }),
              ]),
            }),
          ]),
        }),
      ]),
    );
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'derived-s7', operation: 'subject-comparison' }),
      ]),
    );
  });

  it('does not convert a missing collection bucket into a complete comparison total', async () => {
    for (const missingSubjectId of [123, 456]) {
      const registry = new ProviderRegistry({
        v0: {
          async getSubject() {
            return { state: 'ok' as const, data: undefined };
          },
          async getSubjectStats(subjectId: number): Promise<CapabilityResult<SubjectStatsData>> {
            if (subjectId !== missingSubjectId) {
              return {
                state: 'ok',
                data: stats[subjectId]!,
                evidence: {},
                retrievedAt: '2026-08-15T00:00:00.000Z',
              };
            }
            return {
              state: 'partial',
              data: {
                ...stats[subjectId]!,
                collection: { ...stats[subjectId]!.collection, dropped: 0 },
                collectionPresence: {
                  wish: true,
                  collect: true,
                  doing: true,
                  onHold: true,
                  dropped: false,
                },
              },
              evidence: {},
              retrievedAt: '2026-08-15T00:00:00.000Z',
              warnings: [
                {
                  code: 'MISSING_FIELD',
                  message: 'collection.dropped is missing in the bounded upstream response',
                },
              ],
            };
          },
        },
      });
      const result = (await getTool(buildClient().client).execute(
        { subjectIds: [123, 456] },
        context,
        { providerRegistry: registry },
      )) as SubjectComparisonResult;
      const missingIndex = missingSubjectId === 123 ? 0 : 1;
      const collectionTotal = result.metrics.find((metric) => metric.key === 'collectionTotal');
      const collectionPopulation = result.metrics.find(
        (metric) => metric.key === 'collectionPopulation',
      );
      expect(collectionTotal).toMatchObject({ state: 'unknown', delta: null });
      expect(collectionTotal?.values[missingIndex]).toBeNull();
      expect(collectionPopulation).toMatchObject({ state: 'unknown', delta: null });
      expect(result.subjects[missingIndex]?.statistics?.collection).toMatchObject({
        state: 'partial',
        total: 37,
      });
      expect(result.subjects[missingIndex]?.statistics?.coverage).toMatchObject({
        collectionBucketsExpected: 5,
        collectionBucketsObserved: 4,
      });
      expect(result.subjects[missingIndex]?.stats.collectionTotal).toBeUndefined();
    }
  });

  it('computes bounded cast and staff overlap by stable person ID with raw credit labels', async () => {
    const result = (await getTool(buildClient({ duplicateCreditRows: true }).client).execute(
      { subjectIds: [123, 456] },
      context,
      { providerRegistry: buildProviderRegistry() },
    )) as SubjectComparisonResult;

    expect(result.overlapFormulaVersion).toBe('subject-comparison-overlap-v1');
    expect(result.overlaps.cast).toMatchObject({
      state: 'complete',
      coverage: {
        candidateIds: 5,
        matchedIds: 1,
        returned: 1,
        omitted: 0,
      },
      items: [
        {
          personId: 900,
          name: '共同声优',
          credits: [
            { side: 'A', characters: [{ name: '角色 123 A', relation: '主角' }] },
            { side: 'B', characters: [{ name: '角色 456 A', relation: '主角' }] },
          ],
        },
      ],
    });
    expect(result.overlaps.cast.items[0]?.credits[0]?.characters).toHaveLength(1);
    expect(result.overlaps.staff).toMatchObject({
      state: 'complete',
      coverage: { candidateIds: 3, matchedIds: 1, returned: 1 },
      items: [
        {
          personId: 901,
          name: '共同制作人员',
          credits: [
            { side: 'A', rawRelations: ['导演'], relations: ['导演'] },
            { side: 'B', rawRelations: ['导演'], relations: ['导演'] },
          ],
        },
      ],
    });
    expect(result.overlaps.staff.items[0]?.credits).toHaveLength(2);
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'derived-s7',
          operation: 'subject-comparison-overlap',
          formulaVersion: 'subject-comparison-overlap-v1',
        }),
      ]),
    );
  });

  it('marks overlap partial for caps and unavailable when one credit source fails', async () => {
    const capped = (await getTool(buildClient().client).execute(
      { subjectIds: [123, 456], maxCast: 1, maxStaff: 1 },
      context,
      { providerRegistry: buildProviderRegistry() },
    )) as SubjectComparisonResult;
    expect(capped.overlaps.cast.state).toBe('partial');
    expect(capped.overlaps.cast.coverage.truncated).toBe(true);
    expect(capped.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'COMPARISON_CAST_OVERLAP_DEGRADED' }),
      ]),
    );

    const unavailable = (await getTool(
      buildClient({ failPath: '/v0/subjects/456/characters' }).client,
    ).execute({ subjectIds: [123, 456] }, context, {
      providerRegistry: buildProviderRegistry(),
    })) as SubjectComparisonResult;
    expect(unavailable.overlaps.cast).toMatchObject({ state: 'unavailable', items: [] });
    expect(unavailable.overlaps.cast.coverage.matchedIds).toBeUndefined();
    expect(unavailable.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'COMPARISON_CAST_OVERLAP_DEGRADED' }),
      ]),
    );
  });

  it('does not treat a missing person ID as a clean empty intersection', async () => {
    const result = (await getTool(buildClient({ missingActorIdSubject: 123 }).client).execute(
      { subjectIds: [123, 456] },
      context,
      { providerRegistry: buildProviderRegistry() },
    )) as SubjectComparisonResult;

    expect(result.overlaps.cast).toMatchObject({
      state: 'partial',
      coverage: {
        left: { missingIdRows: 1 },
        truncated: true,
      },
    });
    expect(result.overlaps.cast.items).toEqual([]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'COMPARISON_CAST_OVERLAP_DEGRADED' }),
      ]),
    );
  });
});
