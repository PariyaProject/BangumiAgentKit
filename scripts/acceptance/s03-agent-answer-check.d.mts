export const S03_EXPECTED_QUERY_ARGUMENTS: Readonly<Record<string, unknown>>;
export const S03_ANSWER_CHECK_METHOD: string;
export function verifyS03VoiceActorOverlapAnswer(
  answer: unknown,
  queryArguments: unknown,
  toolOutput: unknown,
  toolCalls: unknown,
): {
  passed: boolean;
  method: string;
  answerChecks: Record<string, boolean>;
  resultCounters: Record<string, number>;
  resultSummary: Record<string, unknown> | null;
  warningCodes: string[];
};
