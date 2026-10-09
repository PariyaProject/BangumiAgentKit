export const A05_ANSWER_CHECK_METHOD: string;
export const A05_FORMULA_ID: string;
export const A05_TARGET_TOOL: string;
export const A05_EXPECTED_QUERY_ARGUMENTS: Readonly<Record<string, unknown>>;
export const A05_EXPECTED_CAVEATS: readonly string[];
export function verifyA05CollectionShareAnswer(
  answer: unknown,
  queryArguments: unknown,
  toolOutput: unknown,
  toolCalls: unknown,
  toolTextUtf8Bytes: unknown,
): {
  passed: boolean;
  checks: Record<string, boolean>;
  counters: Record<string, unknown>;
  answerCheckMethod: string;
};
export function querySha256(value?: unknown): string;
