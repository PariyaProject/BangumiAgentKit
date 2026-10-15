import { describe, expect, it } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { ToolRegistry } from '@bangumi-agent-kit/tools';
import { FRESH_PUBLIC_API_MATRIX_FIVE_POST_V2_SCOPE as scope } from '../../scripts/lib/fresh-public-api-matrix-five-post-v2-scope.js';

function profileYear(input: unknown): number {
  const record = input as Record<string, unknown>;
  if (typeof record.year === 'number') return record.year;
  const cohort = record.cohort as { query?: { year?: number } } | undefined;
  if (typeof cohort?.query?.year === 'number') return cohort.query.year;
  const cohorts = record.cohorts as Array<{ query?: { year?: number } }> | undefined;
  const year = cohorts?.[0]?.query?.year;
  if (typeof year !== 'number') throw new Error('Expected a fixed year-bounded profile.');
  return year;
}

describe('fresh five-row POST-safe public API scope v2', () => {
  it('keeps five new fixed profiles, distinct from the consumed six-row scope', () => {
    expect(scope.id).toBe('run95-fresh-five-public-api-post-v2-20261016');
    expect(scope.maxRequestsPerTool).toBe(8);
    expect(scope.maxRequestsTotal).toBe(32);
    expect(scope.tools.map(({ tool }) => tool)).toEqual([
      'bangumi.aggregate_subject_cohort',
      'bangumi.compare_subject_cohorts',
      'bangumi.render_query_subjects',
      'bangumi.render_subject_cohort_aggregation',
      'bangumi.render_subject_cohort_comparison',
    ]);
    const years = scope.tools.map(({ input }) => profileYear(input));
    expect(years).toEqual([2020, 2021, 2022, 2023, 2020]);
    expect(years.every((year) => year >= 2020 && year <= 2023)).toBe(true);
    expect(scope.tools.map(({ input }) => JSON.stringify(input))).not.toContain(
      JSON.stringify({
        media: 'anime',
        year: 2018,
        month: 6,
        resultMode: 'top',
        limit: 1,
        sort: 'date',
        order: 'asc',
        explain: 'none',
      }),
    );
    for (const { input } of scope.tools) {
      const profileInput = input as unknown as Record<string, unknown>;
      if (typeof profileInput.maxSubjects === 'number') expect(profileInput.maxSubjects).toBe(1);
      if (typeof profileInput.limit === 'number') expect(profileInput.limit).toBe(1);
    }
  });

  it('parses every new profile as an anonymous read-only tool without network access', () => {
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
});
