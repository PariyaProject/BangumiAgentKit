export const G04_ANSWER_CHECK_METHOD: string;
export const G04_REQUIRED_CAVEAT: string;
export const G04_EXPECTED_QUERY_ARGUMENTS: Readonly<{
  personId: number;
  kind: string;
  media: string;
  windowMonths: number;
  maxRelations: number;
  maxSubjectDetails: number;
  maxRows: number;
}>;

export interface G04AnswerCheckResult {
  passed: boolean;
  answerChecks: Record<string, boolean>;
  answerCounters: Record<string, number>;
  resultSummary: Record<string, unknown> | null;
  resultSha256: string | null;
  resultByteLength: number;
  answerSha256: string | null;
  answerUtf8Bytes: number;
}

export function summarizeG04PersonActivityResult(result: unknown): Record<string, unknown> | null;
export function verifyG04PersonActivityAnswer(
  answer: unknown,
  queryArguments: unknown,
  toolOutput: unknown,
  toolCalls: unknown,
  toolTextUtf8Bytes: unknown,
): G04AnswerCheckResult;
