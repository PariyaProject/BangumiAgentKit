export const P02_PERSON_PROFILE_OFFLINE_PROFILE_ID: string;
export const P02_PERSON_PROFILE_OFFLINE_EPOCH_ID: string;
export const P02_PERSON_PROFILE_OFFLINE_NETWORK_MODE: string;
export const P02_PERSON_PROFILE_ARGUMENT_PROFILE: string;
export const P02_PERSON_PROFILE_SYNTHETIC_ID: number;
export const P02_PERSON_PROFILE_EXPECTED_ARGUMENTS: Readonly<{
  personId: number;
  includeCredits: boolean;
  maxSubjects: number;
  maxCharacters: number;
  includeChronology: boolean;
}>;
export function assertP02PersonProfileOfflineProfile(profile: unknown): boolean;
export function createP02PersonProfileOfflineFetch(): {
  fetchFn: (input: unknown, init?: unknown) => Promise<Response>;
  snapshot: () => Record<string, string | number | boolean>;
};
