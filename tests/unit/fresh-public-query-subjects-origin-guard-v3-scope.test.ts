import { describe, expect, it } from 'vitest';
import { FRESH_PUBLIC_QUERY_SUBJECTS_ORIGIN_GUARD_V3_SCOPE as scope } from '../../scripts/lib/fresh-public-query-subjects-origin-guard-v3-scope.js';

describe('fresh query-subjects origin-guard v3 scope', () => {
  it('selects one distinct anonymous profile with an eight-request cap', () => {
    expect(scope.id).toBe('run95-query-subjects-origin-guard-v3-20261016');
    expect(scope.maxRequestsPerTool).toBe(8);
    expect(scope.maxRequestsTotal).toBe(8);
    expect(scope.tools).toEqual([
      {
        tool: 'bangumi.query_subjects',
        input: {
          media: 'anime',
          year: 2017,
          month: 9,
          resultMode: 'top',
          limit: 1,
          sort: 'date',
          order: 'asc',
          explain: 'none',
        },
      },
    ]);
  });
});
