export function createC07RenderComparisonOfflineFetch(profile?: string | { id?: string }): {
  fetchFn: typeof fetch;
  snapshot: () => {
    profile: string;
    requestCount: number;
    searchRequestCount: number;
    subjectDetailRequestCount: number;
    duplicateRequestCount: number;
    unexpectedRequestCount: number;
    authorizationHeaderCount: number;
    expectedOperationsComplete: boolean;
    rawFixturePayloadStored: boolean;
  };
};
