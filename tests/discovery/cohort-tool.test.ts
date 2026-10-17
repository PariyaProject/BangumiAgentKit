import { describe, expect, it } from 'vitest';
import { createDiscoveryTools } from '@bangumi-agent-kit/tools';

describe('bangumi.compare_subject_cohorts tool contract', () => {
  it('registers a strict one-or-two-query read-only tool with bounded inputs', () => {
    const tools = createDiscoveryTools();
    const tool = tools.find((candidate) => candidate.name === 'bangumi.compare_subject_cohorts');

    expect(tool).toBeDefined();
    expect(tool).toMatchObject({ auth: 'none', risk: 'read', scopes: [] });
    expect(
      tool?.input.parse({
        cohorts: [
          { label: 'A', query: { season: '2026-spring', media: 'anime' } },
          { label: 'B', query: { season: '2026-summer', media: 'anime' } },
        ],
        maxSubjects: 12,
      }),
    ).toMatchObject({ maxSubjects: 12 });
    expect(
      tool?.input.parse({
        cohorts: [
          {
            query: {
              media: 'anime',
              season: '1998-spring',
              resultMode: 'all',
              budget: {
                maxPages: 1,
                maxCandidates: 20,
                maxHydrations: 4,
                concurrency: 2,
                maxConceptProbes: 1,
                maxReturnedItems: 4,
              },
            },
          },
        ],
        maxSubjects: 4,
      }),
    ).toMatchObject({
      cohorts: [
        {
          query: {
            budget: {
              maxPages: 1,
              maxCandidates: 20,
              maxHydrations: 4,
              concurrency: 2,
              maxConceptProbes: 1,
              maxReturnedItems: 4,
            },
          },
        },
      ],
      maxSubjects: 4,
    });
    expect(() =>
      tool?.input.parse({
        cohorts: [
          {
            query: {
              media: 'anime',
              season: '1998-spring',
              budget: { maxPages: 7 },
            },
          },
        ],
      }),
    ).toThrow();
    expect(
      tool?.input.parse({
        cohorts: [{ query: { media: 'anime' } }],
      }),
    ).toMatchObject({ cohorts: [{ query: { media: 'anime' } }] });
    expect(() =>
      tool?.input.parse({
        cohorts: [{ query: { media: 'anime' } }, { query: { media: 'anime' } }],
        maxSubjects: 61,
      }),
    ).toThrow();

    const aggregateTool = tools.find(
      (candidate) => candidate.name === 'bangumi.aggregate_subject_cohort',
    );
    expect(aggregateTool).toBeDefined();
    expect(aggregateTool).toMatchObject({ auth: 'none', risk: 'read', scopes: [] });
    expect(
      aggregateTool?.input.parse({
        cohort: {
          label: 'Spring originals',
          query: { season: '2026-spring', media: 'anime', metaTags: ['原创'] },
        },
      }),
    ).toMatchObject({ cohort: { label: 'Spring originals' } });
  });
});
