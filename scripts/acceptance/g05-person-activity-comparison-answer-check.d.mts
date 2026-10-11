export const G05_ANSWER_CHECK_METHOD: string;
export const G05_ARGUMENT_PROFILE: string;
export const G05_COVERAGE_FIELDS: readonly string[];
export const G05_EXPECTED_QUERY_ARGUMENTS: Readonly<{
  personId: number;
  kind: string;
  media: string;
  windowMonths: number;
  maxRelations: number;
  maxSubjectDetails: number;
  maxRows: number;
  comparePreviousWindow: boolean;
}>;

export interface G05AnswerCheckResult {
  passed: boolean;
  answerChecks: Record<string, boolean>;
  answerCounters: Record<string, number>;
  resultSummary: Record<string, unknown> | null;
  resultByteLength: number;
  resultSha256: string;
  answerUtf8Bytes: number;
  answerSha256: string;
}

export function summarizeG05PersonActivityResult(result: unknown): Record<string, unknown> | null;
export function verifyG05PersonActivityComparisonAnswer(
  answer: unknown,
  queryArguments: unknown,
  toolOutput: unknown,
  toolCalls: unknown,
  toolTextUtf8Bytes: unknown,
): G05AnswerCheckResult;
