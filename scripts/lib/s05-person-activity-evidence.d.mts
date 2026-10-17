export const S05_PROFILE_ID: string;
export const S05_NETWORK_MODE: string;
export const S05_TOOL_NAME: string;
export const S05_ARGUMENT_PROFILE: string;
export const S05_EPOCH_ID: string;
export const S05_EXPECTED_ARGUMENTS: Readonly<{
  personId: number;
  kind: 'voice';
  media: 'anime';
  windowMonths: 6;
  maxRelations: 48;
  maxSubjectDetails: 16;
  maxRows: 8;
}>;
export const S05_ANSWER_CHECK_METHOD: string;
export const S05_CANONICAL_CAVEAT: string;
export const S05_ANSWER_CHECK_FIELDS: readonly string[];

export function assertS05PersonActivityProfile(profile: unknown): boolean;

export interface S05PersonActivitySummary {
  state: 'complete' | 'partial';
  window: {
    months: 6;
    start: string;
    end: string;
    asOfSemantics: 'calendar_months_ending_on_as_of_date';
  };
  activityRowsReturned: number;
  uniqueSubjectsObserved: number;
  platformCounts: { tv: number; nonTv: number; unknown: number };
  nonTvObservationDates: string[];
  sourceCompleteness: 'undocumented';
  coverage: {
    relationRowsObserved: number;
    relationRowsSelected: number;
    relationRowsDroppedAtLimit: number;
    sampled: boolean;
    subjectDetailRequests: number;
    subjectDetailsSucceeded: number;
    subjectDetailsFailed: number;
    subjectDetailIdsDroppedAtLimit: number;
    rowsEligible: number;
    rowsReturned: number;
    missingDateRows: number;
    invalidDateRows: number;
    outputTruncated: boolean;
    truncated: boolean;
    retrievedAt: string;
  };
  conclusion: 'positive_non_tv_observation_in_bounded_sample';
  exclusivityConclusion: 'not_established';
  careerCompletenessConclusion: 'not_established';
  caveat: string;
}

export function summarizeS05PersonActivityToolResult(
  result: unknown,
  expectedArguments?: unknown,
): S05PersonActivitySummary | null;
export function validateS05PersonActivitySummary(summary: unknown): boolean;
export function verifyS05PersonActivityAnswer(
  answer: unknown,
  resultSummary: unknown,
): {
  passed: boolean;
  answerChecks: Record<string, boolean>;
  parsed: S05PersonActivitySummary | null;
};
export function validateS05McpTextProjection(
  text: unknown,
  resultSummary: unknown,
): { passed: boolean; projection: S05PersonActivitySummary | null };
