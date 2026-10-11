export interface G04ReportBuildResult {
  passed: boolean;
  answerChecks?: Record<string, boolean>;
  answerCounters?: Record<string, number>;
  resultSummary?: Record<string, unknown> | null;
  report?: Record<string, unknown>;
}

export function buildG04AgentMcpReport(
  input: Record<string, unknown>,
  options?: {
    root?: string;
    observedAt?: string;
    liveStatus?: Record<string, unknown> | null;
  },
): G04ReportBuildResult;

export function writeG04AgentMcpReport(
  input: Record<string, unknown>,
  options?: { root?: string; observedAt?: string },
): G04ReportBuildResult;
