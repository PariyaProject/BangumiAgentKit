export function buildG05SanitizedReport(
  input: Record<string, unknown>,
  answerResult: {
    passed: boolean;
    answerChecks: Record<string, boolean>;
    answerCounters: Record<string, number>;
    resultSummary: Record<string, unknown> | null;
    resultByteLength: number;
    resultSha256: string;
    answerUtf8Bytes: number;
    answerSha256: string;
  },
  hashes: Record<string, string>,
  observedAt: string,
): Record<string, unknown>;

export function buildG05PersonActivityComparisonReport(
  input: Record<string, unknown>,
  options?: { observedAt?: string },
): {
  passed: boolean;
  report?: Record<string, unknown>;
  answerChecks: Record<string, boolean>;
  answerCounters: Record<string, number>;
  resultSummary?: Record<string, unknown>;
};
