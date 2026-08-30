import { describe, expect, it } from 'vitest';
import { createDiscoveryTools } from '@bangumi-agent-kit/tools';

describe('bangumi.compare_subject_cohorts tool contract', () => {
  it('registers a strict two-query read-only tool with bounded inputs', () => {
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
    expect(() =>
      tool?.input.parse({
        cohorts: [{ query: { media: 'anime' } }],
      }),
    ).toThrow();
    expect(() =>
      tool?.input.parse({
        cohorts: [{ query: { media: 'anime' } }, { query: { media: 'anime' } }],
        maxSubjects: 61,
      }),
    ).toThrow();
  });
});
