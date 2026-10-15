export const FRESH_PUBLIC_QUERY_SUBJECTS_ORIGIN_GUARD_V3_SCOPE = Object.freeze({
  id: 'run95-query-subjects-origin-guard-v3-20261016',
  maxRequestsPerTool: 8,
  maxRequestsTotal: 8,
  tools: Object.freeze([
    Object.freeze({
      tool: 'bangumi.query_subjects',
      input: Object.freeze({
        media: 'anime',
        year: 2017,
        month: 9,
        resultMode: 'top',
        limit: 1,
        sort: 'date',
        order: 'asc',
        explain: 'none',
      }),
    }),
  ]),
});
