export const S04_EXPECTED_QUERY_ARGUMENTS: Readonly<{ subjectId: 565; limit: 100 }>;
export const S04_ANSWER_CHECK_METHOD: 's04-subject-cast-multirole-answer-v1';
export const S04_RESPONSE_BYTE_LIMIT: 1048576;

export function verifyS04SubjectCastAnswer(
  answer: unknown,
  queryArguments: unknown,
  toolOutput: unknown,
  toolCalls: unknown,
): {
  passed: boolean;
  answerChecks: Record<string, boolean>;
  resultCounters: Record<string, unknown>;
  resultSummary: Record<string, unknown> | null;
};
