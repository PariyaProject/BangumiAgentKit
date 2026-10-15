export const P05_TOOL_NAME: 'bangumi.get_person_profile';
export const P05_EPOCH_ID: string;
export const P05_ARGUMENT_PROFILE: string;
export const P05_ARGUMENTS: Readonly<{
  personId: number;
  includeCredits: boolean;
  maxSubjects: number;
  maxCharacters: number;
}>;
export const P05_REQUIRED_CHECKS: readonly string[];
export function projectP05PersonMediaSummary(result: unknown): Record<string, unknown> | null;
export function p05PersonMediaSummaryIsValid(summary: unknown): boolean;
export function p05CandidateGateIsReady(input: {
  status: unknown;
  pr: unknown;
  currentHead: string;
  currentBaseSha: string;
  currentBranch: string;
}): boolean;
