export function assertD05ReportCandidate(
  input: unknown,
  root?: string,
): { sourceRevision: string; bundleSha256: string };
export function writeD05AgentMcpReport(
  input: unknown,
  root?: string,
): {
  passed: boolean;
  reportPath?: string;
  report?: Record<string, unknown>;
};
