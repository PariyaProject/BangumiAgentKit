export const FRESH_PUBLIC_COHORT_FOUR_V2_SCOPE = Object.freeze({
  id: 'run95-fresh-public-cohort-four-v2-20261016',
  maxRequestsPerTool: 8,
  maxRequestsTotal: 32,
  tools: Object.freeze([
    Object.freeze({
      tool: 'bangumi.aggregate_subject_cohort',
      input: Object.freeze({
        cohort: Object.freeze({
          query: Object.freeze({
            keyword: '葬送のフリーレン',
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
            label: 'Run95 fresh cohort comparison v2',
            query: Object.freeze({
              keyword: '薬屋のひとりごと',
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
            keyword: '呪術廻戦',
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
            label: 'Run95 fresh cohort render v2',
            query: Object.freeze({
              keyword: '鬼滅の刃',
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
