export const P07_PROFILE_ID: string;
export const P07_TOOL_NAME: string;
export const P07_ARGUMENT_PROFILE: string;
export const P07_EXPECTED_ARGUMENTS: Readonly<{
  personId: number;
  kind: string;
  media: string;
  windowMonths: number;
  maxRelations: number;
  maxSubjectDetails: number;
  maxRows: number;
}>;
export const P07_ANSWER_CHECK_METHOD: string;
export const P07_CANONICAL_CAVEAT: string;
export const P07_ANSWER_CHECK_FIELDS: readonly string[];

export interface P07PersonSeasonSummary {
  personId: number;
  kind: 'staff';
  media: 'anime';
  state: 'complete' | 'partial';
  window: {
    months: number;
    start: string;
    end: string;
    asOfSemantics: string;
  };
  datedRowsObserved: number;
  quarterDistribution: Array<{ quarter: string; count: number }>;
  mostObservedQuarters: string[];
  maxQuarterCount: number;
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
  caveat: string;
}

export function summarizeP07PersonActivityToolResult(
  result: unknown,
  expectedArguments?: unknown,
): P07PersonSeasonSummary | null;
export function validateP07PersonSeasonSummary(summary: unknown): boolean;
export function verifyP07PersonSeasonAnswer(
  answer: unknown,
  resultSummary: unknown,
): {
  passed: boolean;
  answerChecks: Record<string, boolean>;
  parsed: P07PersonSeasonSummary | null;
};
export function validateP07McpTextProjection(
  text: unknown,
  resultSummary: unknown,
): { passed: boolean; projection: P07PersonSeasonSummary | null };
