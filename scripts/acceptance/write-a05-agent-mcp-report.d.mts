export const A05_REPORT_RELATIVE_PATH: string;
export const A05_SOURCE_REPORT_RELATIVE_PATH: string;
export const A05_ONE_SHOT_CLAIM_RELATIVE_PATH: string;
export const A05_UPSTREAM_SOURCE_COMMIT: string;
export function buildA05AgentMcpReport(
  input: Record<string, unknown>,
  context: Record<string, unknown>,
): {
  passed: boolean;
  reportPath?: string;
  report?: Record<string, unknown>;
  checks?: Record<string, boolean>;
  counters?: Record<string, unknown>;
};
export function writeA05AgentMcpReport(input: Record<string, unknown>, root?: string): Record<string, unknown>;
