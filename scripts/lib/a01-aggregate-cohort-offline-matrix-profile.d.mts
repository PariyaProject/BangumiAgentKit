export const A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID: string;
export const A01_AGGREGATE_COHORT_OFFLINE_EPOCH_ID: string;
export const A01_AGGREGATE_COHORT_OFFLINE_NETWORK_MODE: string;
export const A01_AGGREGATE_COHORT_OFFLINE_V2_PROFILE_ID: string;
export const A01_AGGREGATE_COHORT_OFFLINE_V2_EPOCH_ID: string;
export const A01_AGGREGATE_COHORT_OFFLINE_V2_NETWORK_MODE: string;
export const A01_AGGREGATE_COHORT_OFFLINE_V3_PROFILE_ID: string;
export const A01_AGGREGATE_COHORT_OFFLINE_V3_EPOCH_ID: string;
export const A01_AGGREGATE_COHORT_OFFLINE_V3_NETWORK_MODE: string;
export const A01_AGGREGATE_COHORT_OFFLINE_PROFILE_IDS: readonly string[];
export const A01_AGGREGATE_COHORT_TOOL: 'bangumi.aggregate_subject_cohort';
export const A01_AGGREGATE_COHORT_EXPECTED_ARGUMENTS: Readonly<{
  cohort: {
    label: string;
    query: {
      keyword: string;
      media: 'anime';
      resultMode: 'all';
      limit: 1;
    };
  };
  maxSubjects: 1;
}>;
export const A01_AGGREGATE_COHORT_OFFLINE_V2_EXPECTED_ARGUMENTS: Readonly<{
  cohort: {
    label: string;
    query: {
      keyword: string;
      media: 'anime';
      resultMode: 'all';
      limit: 1;
    };
  };
  maxSubjects: 1;
}>;
export const A01_AGGREGATE_COHORT_OFFLINE_V3_EXPECTED_ARGUMENTS: Readonly<{
  cohort: {
    label: string;
    query: {
      keyword: string;
      media: 'anime';
      resultMode: 'all';
      limit: 1;
    };
  };
  maxSubjects: 1;
}>;

export function getA01AggregateCohortOfflineProfileSpec(
  profileOrId: unknown,
): Record<string, unknown> | null;

export function assertA01AggregateCohortOfflineProfile(profile: unknown): true;

export function createA01AggregateCohortOfflineFetch(profile?: unknown): {
  fetchFn(input: string | URL | Request, init?: RequestInit): Promise<Response>;
  snapshot(): {
    profile: string;
    requestCount: number;
    searchRequestCount: number;
    detailRequestCount: number;
    unexpectedRequestCount: number;
    authorizationHeaderCount: number;
    expectedOperationsComplete: boolean;
  };
};
