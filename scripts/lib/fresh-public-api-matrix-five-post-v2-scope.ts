export const FRESH_PUBLIC_API_MATRIX_FIVE_POST_V2_SCOPE = Object.freeze({
  id: 'run95-fresh-five-public-api-post-v2-20261016',
  maxRequestsPerTool: 8,
  maxRequestsTotal: 32,
  tools: Object.freeze([
    Object.freeze({
      tool: 'bangumi.aggregate_subject_cohort',
      input: Object.freeze({
        cohort: Object.freeze({
          query: Object.freeze({
            media: 'anime',
            year: 2020,
            month: 2,
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
            label: 'Run95 public POST-safe 2021-03',
            query: Object.freeze({
              media: 'anime',
              year: 2021,
              month: 3,
              resultMode: 'all',
              limit: 1,
            }),
          }),
        ]),
        maxSubjects: 1,
      }),
    }),
    Object.freeze({
      tool: 'bangumi.render_query_subjects',
      input: Object.freeze({
        media: 'anime',
        year: 2022,
        month: 6,
        resultMode: 'top',
        limit: 1,
      }),
    }),
    Object.freeze({
      tool: 'bangumi.render_subject_cohort_aggregation',
      input: Object.freeze({
        cohort: Object.freeze({
          query: Object.freeze({
            media: 'anime',
            year: 2023,
            month: 4,
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
            label: 'Run95 public POST-safe 2020-05',
            query: Object.freeze({
              media: 'anime',
              year: 2020,
              month: 5,
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
