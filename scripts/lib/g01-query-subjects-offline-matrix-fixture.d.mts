export interface G01QuerySubjectsOfflineFixtureSnapshot {
  profile: string;
  requestCount: number;
  searchRequestCount: number;
  duplicateRequestCount: number;
  unexpectedRequestCount: number;
  rejectedHeaderCount: number;
  expectedOperationsComplete: boolean;
  rawFixturePayloadStored: boolean;
}

export function createG01QuerySubjectsOfflineFetch(): {
  fetchFn: (input: string | URL, init?: RequestInit) => Promise<Response>;
  snapshot: () => G01QuerySubjectsOfflineFixtureSnapshot;
};

export function assertG01QuerySubjectsOfflineFixtureProfile(profile: unknown): boolean;
