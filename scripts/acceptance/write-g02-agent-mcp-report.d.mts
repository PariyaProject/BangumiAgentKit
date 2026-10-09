export interface G02WrittenReport {
  path: string;
  toolName: 'bangumi.query_subjects' | 'bangumi.render_query_subjects';
  resultCounters: Record<string, unknown>;
}

export type G02ReportWriteResult =
  | { passed: true; reports: G02WrittenReport[] }
  | { passed: false; toolName: string; answerChecks: Record<string, boolean> };

export function writeG02AgentMcpReports(input: unknown, root?: string): G02ReportWriteResult;
