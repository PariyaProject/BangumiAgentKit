import { describe, expect, it } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { ToolRegistry } from '@bangumi-agent-kit/tools';
import { FRESH_PUBLIC_API_MATRIX_SIX_SCOPE as scope } from '../../scripts/lib/fresh-public-api-matrix-six-scope.js';

function profileYear(input: Record<string, unknown>): number {
  if (typeof input.year === 'number') return input.year;
  const cohort = input.cohort as { query?: { year?: number } } | undefined;
  if (typeof cohort?.query?.year === 'number') return cohort.query.year;
  const cohorts = input.cohorts as Array<{ query?: { year?: number } }> | undefined;
  const year = cohorts?.[0]?.query?.year;
  if (typeof year !== 'number') throw new Error('Expected a fixed year-bounded profile.');
  return year;
}

describe('fresh six-row public API scope', () => {
  it('keeps the selected tool order, fixed windows, and one-row limits', () => {
    expect(scope.id).toBe('run95-fresh-six-public-api-rows-20261016');
    expect(scope.maxRequestsPerTool).toBe(8);
    expect(scope.maxRequestsTotal).toBe(32);
    expect(scope.tools.map(({ tool }) => tool)).toEqual([
      'bangumi.aggregate_subject_cohort',
      'bangumi.compare_subject_cohorts',
      'bangumi.query_subjects',
      'bangumi.render_query_subjects',
      'bangumi.render_subject_cohort_aggregation',
      'bangumi.render_subject_cohort_comparison',
    ]);
    expect(scope.tools).toEqual([
      {
        tool: 'bangumi.aggregate_subject_cohort',
        input: {
          cohort: { query: { media: 'anime', year: 2013, month: 2, resultMode: 'all' } },
          maxSubjects: 1,
        },
      },
      {
        tool: 'bangumi.compare_subject_cohorts',
        input: {
          cohorts: [
            {
              label: 'Run95 direct public 2014-03',
              query: { media: 'anime', year: 2014, month: 3, resultMode: 'all' },
            },
          ],
          maxSubjects: 1,
        },
      },
      {
        tool: 'bangumi.query_subjects',
        input: {
          media: 'anime',
          year: 2018,
          month: 6,
          resultMode: 'top',
          limit: 1,
          sort: 'date',
          order: 'asc',
          explain: 'none',
        },
      },
      {
        tool: 'bangumi.render_query_subjects',
        input: { media: 'anime', year: 2019, month: 7, resultMode: 'top', limit: 1 },
      },
      {
        tool: 'bangumi.render_subject_cohort_aggregation',
        input: {
          cohort: { query: { media: 'anime', year: 2015, month: 4, resultMode: 'all' } },
          maxSubjects: 1,
        },
      },
      {
        tool: 'bangumi.render_subject_cohort_comparison',
        input: {
          cohorts: [
            {
              label: 'Run95 direct public 2016-05',
              query: { media: 'anime', year: 2016, month: 5, resultMode: 'all' },
            },
          ],
          maxSubjects: 1,
        },
      },
    ]);
    expect(scope.tools.map(({ input }) => profileYear(input))).toEqual([
      2013, 2014, 2018, 2019, 2015, 2016,
    ]);
    expect(
      scope.tools.every(({ input }) => profileYear(input) >= 2013 && profileYear(input) <= 2019),
    ).toBe(true);
    expect(scope.tools.map(({ input }) => profileYear(input))).not.toContain(2012);
    expect(scope.tools.map(({ input }) => profileYear(input))).not.toContain(2026);
    for (const { input } of scope.tools) {
      const profileInput = input as unknown as Record<string, unknown>;
      if (typeof profileInput.maxSubjects === 'number') expect(profileInput.maxSubjects).toBe(1);
      if (typeof profileInput.limit === 'number') expect(profileInput.limit).toBe(1);
    }
  });

  it('parses all six exact profiles against the current anonymous read ToolRegistry schemas offline', () => {
    const registry = new ToolRegistry({
      storage: new MemoryStorage(),
      publicHttpClient: new HttpClient({
        fetchFn: async () => {
          throw new Error('Unexpected network request during schema validation.');
        },
      }),
    });

    for (const { tool: name, input } of scope.tools) {
      const tool = registry.getTool(name);
      expect(tool, name).toBeDefined();
      expect(tool, name).toMatchObject({ auth: 'none', risk: 'read' });
      expect(tool!.input.safeParse(input).success, name).toBe(true);
    }
  });

  it('does not reuse PR #173 or the consumed A01/G01/G02/D04 query profiles', () => {
    const oldProfiles = new Map<string, unknown[]>([
      [
        'bangumi.aggregate_subject_cohort',
        [
          { cohort: { query: { media: 'anime', year: 2012, resultMode: 'all' } }, maxSubjects: 1 },
          {
            cohort: { query: { media: 'anime', year: 2012, resultMode: 'all' } },
            maxSubjects: 1,
          },
        ],
      ],
      [
        'bangumi.compare_subject_cohorts',
        [
          {
            cohorts: [{ query: { media: 'anime', year: 2012, resultMode: 'all' } }],
            maxSubjects: 1,
          },
          {
            cohorts: [
              {
                label: '目标作品',
                query: {
                  keyword: '少女终末旅行',
                  media: 'anime',
                  categories: 'tv',
                  season: '2017-autumn',
                  resultMode: 'all',
                  nsfw: 'exclude',
                },
              },
              {
                label: '2017-autumn 动画返回样本',
                query: {
                  media: 'anime',
                  season: '2017-autumn',
                  resultMode: 'all',
                  nsfw: 'exclude',
                },
              },
            ],
            maxSubjects: 8,
          },
        ],
      ],
      [
        'bangumi.query_subjects',
        [
          {
            media: 'anime',
            year: 2026,
            month: 7,
            resultMode: 'top',
            limit: 1,
            sort: 'date',
            order: 'asc',
            explain: 'none',
          },
          {
            media: 'anime',
            year: 2026,
            month: 7,
            concepts: ['后宫'],
            resultMode: 'all',
            limit: 100,
            explain: 'full',
          },
          {
            media: 'anime',
            from: '2024-01-01',
            to: '2025-01-01',
            concepts: ['异世界'],
            sort: 'heat',
            order: 'desc',
            resultMode: 'top',
            limit: 10,
            explain: 'full',
          },
          {
            media: 'anime',
            tags: ['科幻'],
            ratingCount: { min: 3001 },
            reportedEpisodeCount: { max: 12 },
            resultMode: 'all',
            limit: 100,
            explain: 'full',
          },
        ],
      ],
      [
        'bangumi.render_query_subjects',
        [
          { media: 'anime', year: 2012, resultMode: 'top', limit: 1 },
          {
            media: 'anime',
            from: '2024-01-01',
            to: '2025-01-01',
            concepts: ['异世界'],
            sort: 'heat',
            order: 'desc',
            resultMode: 'top',
            limit: 10,
            explain: 'full',
          },
        ],
      ],
      [
        'bangumi.render_subject_cohort_aggregation',
        [{ cohort: { query: { media: 'anime', year: 2012, resultMode: 'all' } }, maxSubjects: 1 }],
      ],
      [
        'bangumi.render_subject_cohort_comparison',
        [
          {
            cohorts: [{ query: { media: 'anime', year: 2012, resultMode: 'all' } }],
            maxSubjects: 1,
          },
        ],
      ],
    ]);

    for (const profile of scope.tools) {
      for (const oldInput of oldProfiles.get(profile.tool) ?? []) {
        expect(profile.input).not.toEqual(oldInput);
      }
    }
  });
});
