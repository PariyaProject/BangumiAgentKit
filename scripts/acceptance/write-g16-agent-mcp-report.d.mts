export function buildG16SanitizedReport(
  input: Record<string, unknown>,
  answerResult: Record<string, unknown>,
  hashes: Record<string, string>,
  observedAt?: string,
): Record<string, unknown>;
export function buildG16AgentMcpReport(
  input: Record<string, unknown>,
  options?: {
    root?: string;
    observedAt?: string;
    liveStatus?: Record<string, unknown> | null;
    pullRequest?: Record<string, unknown> | null;
    currentBaseSha?: string | null;
  },
): Record<string, unknown>;
