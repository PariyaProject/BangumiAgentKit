export const G16_ANSWER_CHECK_METHOD: string;
export const G16_ARGUMENT_PROFILE: string;
export const G16_COVERAGE_FIELDS: readonly string[];
export const G16_EXPECTED_QUERY_ARGUMENTS: Readonly<{
  personId: number;
  kind: string;
  staffRole: string;
  media: string;
  windowMonths: number;
  maxRelations: number;
  maxSubjectDetails: number;
  maxRows: number;
}>;

export interface G16AnswerCheckResult {
  passed: boolean;
  answerChecks: Record<string, boolean>;
  answerCounters: Record<string, number>;
  resultSummary: Record<string, unknown> | null;
  resultSha256: string | null;
  resultByteLength: number;
  answerSha256: string | null;
  answerUtf8Bytes: number;
}

export function summarizeG16PersonActivityResult(result: unknown): Record<string, unknown> | null;
export function verifyG16PersonActivityAnswer(
  answer: unknown,
  queryArguments: unknown,
  toolOutput: unknown,
  toolCalls: unknown,
  toolTextUtf8Bytes: unknown,
): G16AnswerCheckResult;
