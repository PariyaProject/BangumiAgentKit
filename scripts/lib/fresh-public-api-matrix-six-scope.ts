export const FRESH_PUBLIC_API_MATRIX_SIX_SCOPE = Object.freeze({
  id: 'run95-fresh-six-public-api-private-path-guard-v1-20261016',
  maxRequestsPerTool: 8,
  maxRequestsTotal: 32,
  tools: Object.freeze([
    Object.freeze({
      tool: 'bangumi.aggregate_subject_cohort',
      input: Object.freeze({
        cohort: Object.freeze({
          query: Object.freeze({
            media: 'anime',
            year: 2025,
            month: 1,
            resultMode: 'all',
            limit: 1,
          }),
        }),
        maxSubjects: 1,
      }),
    }),
    Object.freeze({
      tool: 'bangumi.compare_subject_cohorts',
      input: Object.freeze({
        cohorts: Object.freeze([
          Object.freeze({
            label: 'Run95 private path guard 2025-02',
            query: Object.freeze({
              media: 'anime',
              year: 2025,
              month: 2,
              resultMode: 'all',
              limit: 1,
            }),
          }),
        ]),
        maxSubjects: 1,
      }),
    }),
    Object.freeze({
      tool: 'bangumi.query_subjects',
      input: Object.freeze({
        media: 'anime',
        year: 2025,
        month: 3,
        resultMode: 'top',
        limit: 1,
        sort: 'date',
        order: 'asc',
        explain: 'none',
      }),
    }),
    Object.freeze({
      tool: 'bangumi.render_query_subjects',
      input: Object.freeze({ media: 'anime', year: 2025, month: 4, resultMode: 'top', limit: 1 }),
    }),
    Object.freeze({
      tool: 'bangumi.render_subject_cohort_aggregation',
      input: Object.freeze({
        cohort: Object.freeze({
          query: Object.freeze({
            media: 'anime',
            year: 2025,
            month: 5,
            resultMode: 'all',
            limit: 1,
          }),
        }),
        maxSubjects: 1,
      }),
    }),
    Object.freeze({
      tool: 'bangumi.render_subject_cohort_comparison',
      input: Object.freeze({
        cohorts: Object.freeze([
          Object.freeze({
            label: 'Run95 private path guard 2025-06',
            query: Object.freeze({
              media: 'anime',
              year: 2025,
              month: 6,
              resultMode: 'all',
              limit: 1,
            }),
          }),
        ]),
        maxSubjects: 1,
      }),
    }),
  ]),
});
