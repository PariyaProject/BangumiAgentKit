export const C07_COHORT_RENDER_OFFLINE_FIXTURE_PROFILE: string;

export const C07_COHORT_RENDER_EXPECTED_ARGUMENTS: {
  cohorts: Array<{
    label: string;
    query: {
      keyword: string;
      media: 'anime';
      resultMode: 'all';
      limit: 1;
    };
  }>;
  maxSubjects: 1;
};

export function assertC07CohortRenderOfflineProfile(input: {
  networkMode?: string;
  toolName: string;
  expectedArguments: unknown;
}): boolean;

export function createC07CohortRenderOfflineFixtureFetch(): {
  fetchFn: typeof fetch;
  snapshot: () => {
    profile: string;
    requestCount: number;
    searchRequestCount: number;
    detailRequestCount: number;
    unexpectedRequestCount: number;
    authorizationHeaderCount: number;
    expectedOperationsComplete: boolean;
  };
};
