export const P01_ANSWER_CHECK_METHOD: 'p01-bounded-person-role-frequency-answer-v1';
export const P01_ARGUMENT_PROFILE: 'fixed-p01-person-1040-staff-anime-36m-48r-16d-8rows-v1';
export const P01_EXPECTED_QUERY_ARGUMENTS: Readonly<{
  personId: 1040;
  kind: 'staff';
  media: 'anime';
  windowMonths: 36;
  maxRelations: 48;
  maxSubjectDetails: 16;
  maxRows: 8;
}>;
export const P01_COVERAGE_FIELDS: readonly string[];

export function summarizeP01PersonPositionResult(result: unknown): {
  personId: number;
  kind: 'staff';
  media: 'anime';
  state: 'complete' | 'partial';
  window: Record<string, unknown>;
  summary: { creditRows: number; uniqueSubjects: number; uniqueCharacters: number };
  coverage: Record<string, unknown>;
  rowCount: number;
  roleLabelCount: number;
  unknownRoleRows: number;
  sourceRowDigest: string;
  sourceOperations: Array<{
    operation: string;
    attempted: number;
    succeeded: number;
    failed: number;
  }> | null;
} | null;

export function verifyP01PersonPositionAnswer(
  answer: unknown,
  queryArguments: unknown,
  toolOutput: unknown,
  toolCalls: unknown,
  toolTextUtf8Bytes: unknown,
): {
  passed: boolean;
  answerChecks: Record<string, boolean>;
  answerCounters: Record<string, number>;
  resultSummary: ReturnType<typeof summarizeP01PersonPositionResult>;
  resultSha256: string | null;
  resultByteLength: number;
  answerSha256: string | null;
  answerUtf8Bytes: number;
};
