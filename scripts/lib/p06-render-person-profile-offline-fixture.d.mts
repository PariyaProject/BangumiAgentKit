export const P06_RENDER_PERSON_PROFILE_OFFLINE_PROFILE_ID: string;
export const P06_RENDER_PERSON_PROFILE_OFFLINE_EPOCH_ID: string;
export const P06_RENDER_PERSON_PROFILE_OFFLINE_NETWORK_MODE: string;
export const P06_RENDER_PERSON_PROFILE_ARGUMENT_PROFILE: string;
export const P06_RENDER_PERSON_PROFILE_SYNTHETIC_ID: number;
export const P06_RENDER_PERSON_PROFILE_EXPECTED_ARGUMENTS: Readonly<{
  personId: number;
  maxSubjects: 1;
  maxCharacters: 1;
  maxCredits: 1;
  includeChronology: false;
}>;

export function assertP06RenderPersonProfileOfflineProfile(profile: unknown): boolean;

export function createP06RenderPersonProfileOfflineFetch(): {
  fetchFn: typeof fetch;
  snapshot: () => {
    profile: string;
    requestCount: number;
    personRequestCount: number;
    subjectsRequestCount: number;
    charactersRequestCount: number;
    duplicateRequestCount: number;
    unexpectedRequestCount: number;
    authorizationHeaderCount: number;
    expectedOperationsComplete: boolean;
  };
};

export function createP06RenderPersonProfileAssetGuard(): {
  assetResolver: { resolveAsset(url?: string): Promise<never> };
  snapshot: () => {
    assetResolutionCallCount: number;
    nonEmptyAssetUrlCount: number;
    blockedAssetRequestCount: number;
  };
};
