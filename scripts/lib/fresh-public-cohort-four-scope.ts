export const FRESH_PUBLIC_COHORT_FOUR_SCOPE = Object.freeze({
  id: 'run95-fresh-public-cohort-four-all-private-path-guard-v1-20261016',
  maxRequestsPerTool: 8,
  maxRequestsTotal: 20,
  tools: Object.freeze([
    Object.freeze({
      tool: 'bangumi.aggregate_subject_cohort',
      input: Object.freeze({
        cohort: Object.freeze({
          query: Object.freeze({
            keyword: '少女終末旅行',
            media: 'anime',
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
            label: 'Run95 bounded cohort comparison',
            query: Object.freeze({
              keyword: '少女終末旅行',
              media: 'anime',
              resultMode: 'all',
              limit: 1,
            }),
          }),
        ]),
        maxSubjects: 1,
      }),
    }),
    Object.freeze({
      tool: 'bangumi.render_subject_cohort_aggregation',
      input: Object.freeze({
        cohort: Object.freeze({
          query: Object.freeze({
            keyword: '少女終末旅行',
            media: 'anime',
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
            label: 'Run95 bounded cohort render',
            query: Object.freeze({
              keyword: '少女終末旅行',
              media: 'anime',
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
