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
export const P06_RENDER_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID: string;
export const P06_RENDER_PERSON_PROFILE_OFFLINE_V2_EPOCH_ID: string;
export const P06_RENDER_PERSON_PROFILE_OFFLINE_V2_NETWORK_MODE: string;
export const P06_RENDER_PERSON_PROFILE_V2_ARGUMENT_PROFILE: string;
export const P06_RENDER_PERSON_PROFILE_V2_SYNTHETIC_ID: number;
export const P06_RENDER_PERSON_PROFILE_V2_EXPECTED_ARGUMENTS: Readonly<{
  personId: number;
  maxSubjects: 1;
  maxCharacters: 1;
  maxCredits: 1;
  includeChronology: false;
}>;
export const P06_RENDER_PERSON_PROFILE_V3_PROFILE_ID: string;
export const P06_RENDER_PERSON_PROFILE_V3_EPOCH_ID: string;
export const P06_RENDER_PERSON_PROFILE_V3_NETWORK_MODE: string;
export const P06_RENDER_PERSON_PROFILE_V3_ARGUMENT_PROFILE: string;
export const P06_RENDER_PERSON_PROFILE_V3_SYNTHETIC_ID: number;
export const P06_RENDER_PERSON_PROFILE_V3_EXPECTED_ARGUMENTS: Readonly<{
  personId: number;
  maxSubjects: 4;
  maxCharacters: 1;
  maxCredits: 2;
  includeChronology: true;
  maxChronologySubjects: 3;
}>;

export function getP06RenderPersonProfileOfflineConfig(profileId: string): {
  id: string;
  epochId: string;
  networkMode: string;
  argumentProfile: string;
  reportPath: string;
  selectionEvidencePath: string;
  evidenceKind: string;
  answerCheckMethod: string;
  syntheticPersonId: number;
  subjectId: number;
  characterId: number;
  chronologySubjectDetails?: ReadonlyArray<{ id: number; date: string }>;
  expectedArguments: Readonly<Record<string, number | boolean>>;
  version: 1 | 2 | 3;
} | null;

export function assertP06RenderPersonProfileOfflineProfile(profile: unknown): boolean;

export function createP06RenderPersonProfileOfflineFetch(profileId?: string): {
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
    chronologyRequestCount?: number;
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
