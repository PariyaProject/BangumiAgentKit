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
export function validateG16SanitizedReportFile(
  disposition: Record<string, unknown>,
  root?: string,
  reportPath?: string,
): {
  passed: boolean;
  reason?: string;
  report?: Record<string, unknown>;
  reportPath?: string;
  reportSha256?: string;
};
