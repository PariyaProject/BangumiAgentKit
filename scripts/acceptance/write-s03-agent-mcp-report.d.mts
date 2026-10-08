export const S03_REPORT_RELATIVE_PATH: string;
export const S03_REPORT_PATH: string;
export function assertS03ReportCandidate(
  input: Record<string, unknown>,
  root?: string,
): { sourceRevision: string; bundleSha256: string };
export function writeS03AgentMcpReport(
  input: Record<string, unknown>,
  root?: string,
): {
  passed: boolean;
  reportPath?: string;
  report?: Record<string, unknown>;
  answerChecks?: Record<string, boolean>;
  resultCounters?: Record<string, unknown>;
  warningCodes?: string[];
};
