export const P02_PERSON_PROFILE_OFFLINE_PROFILE_ID: string;
export const P02_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID: string;
export const P02_PERSON_PROFILE_OFFLINE_EPOCH_ID: string;
export const P02_PERSON_PROFILE_OFFLINE_NETWORK_MODE: string;
export const P02_PERSON_PROFILE_OFFLINE_V2_NETWORK_MODE: string;
export const P02_PERSON_PROFILE_ARGUMENT_PROFILE: string;
export const P02_PERSON_PROFILE_OFFLINE_V2_EPOCH_ID: string;
export const P02_PERSON_PROFILE_OFFLINE_V2_ARGUMENT_PROFILE: string;
export const P02_PERSON_PROFILE_SYNTHETIC_ID: number;
export const P02_PERSON_PROFILE_OFFLINE_V2_SYNTHETIC_ID: number;
export const P02_PERSON_PROFILE_EXPECTED_ARGUMENTS: Readonly<{
  personId: number;
  includeCredits: boolean;
  maxSubjects: number;
  maxCharacters: number;
  includeChronology: boolean;
}>;
export const P02_PERSON_PROFILE_OFFLINE_V2_EXPECTED_ARGUMENTS: Readonly<{
  personId: number;
  includeCredits: boolean;
  maxSubjects: number;
  maxCharacters: number;
  includeChronology: boolean;
}>;
export function getP02PersonProfileOfflineSpec(profileId: string): {
  epochId: string;
  networkMode: string;
  argumentProfile: string;
  personId: number;
  subjectId: number;
  characterId: number;
  expectedArguments: Readonly<Record<string, string | number | boolean>>;
  reportPath: string;
  selectionEvidencePath: string;
  evidenceKind: string;
  answerCheckMethod: string;
  acknowledgement: string;
  serverId: string;
  reportProfile: string;
  receiptKind: string;
} | null;
export function assertP02PersonProfileOfflineProfile(profile: unknown): boolean;
export function createP02PersonProfileOfflineFetch(profileId?: string): {
  fetchFn: (input: unknown, init?: unknown) => Promise<Response>;
  snapshot: () => Record<string, string | number | boolean>;
};
