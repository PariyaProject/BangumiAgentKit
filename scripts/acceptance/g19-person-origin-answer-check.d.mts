export const G19_ANSWER_CHECK_METHOD: string;
export const G19_ARGUMENT_PROFILE: string;
export const G19_EXPECTED_QUERY_ARGUMENTS: Readonly<{
  personId: number;
  kind: 'all';
  media: 'anime';
  windowMonths: 3;
  maxRelations: 48;
  maxSubjectDetails: 16;
  maxRows: 8;
}>;
export const G19_COVERAGE_FIELDS: readonly string[];
export const G19_ORIGIN_COVERAGE_FIELDS: readonly string[];
export const G19_APPROVED_CAVEAT: string;
export function summarizeG19PersonActivityResult(result: unknown): Record<string, unknown> | null;
export function verifyG19PersonOriginAnswer(
  answer: unknown,
  queryArguments: unknown,
  toolOutput: unknown,
  toolCalls: unknown,
  toolTextUtf8Bytes: number,
): {
  passed: boolean;
  answerChecks: Record<string, boolean>;
  answerCounters: Record<string, number>;
  resultSummary: Record<string, unknown> | null;
  resultByteLength: number;
  resultSha256: string | null;
  answerUtf8Bytes: number;
  answerSha256: string | null;
};
