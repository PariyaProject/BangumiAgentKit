export const G06_REPORT_EVIDENCE_KIND: string;
export const G06_MODEL: string;
export const G06_REASONING_EFFORT: string;
export const G06_PRIVACY: Readonly<Record<string, string | boolean>>;
export const G06_ANSWER_CHECKS: ReadonlySet<string>;

export function g06ServerPrivacyMatches(
  summary: Record<string, unknown> | null | undefined,
): boolean;
export function buildG06AgentMcpReport(input: Record<string, unknown>): {
  passed: boolean;
  report: {
    claimId: string;
    prNumber: number;
    sourceRevision: string;
    baseSha: string;
    ciSha: string;
    ciStatus: string;
    reviewerId: string;
    bundleSha256: string;
    reportSha256?: string;
    answerChecks: Record<string, boolean>;
    answerCounters: Record<string, number | boolean | null>;
    toolResultSummary: Record<string, unknown>;
    privacy: Record<string, string | boolean>;
    [key: string]: unknown;
  };
};
export function writeG06AgentMcpReport(
  input: Record<string, unknown>,
  reportPath?: string,
): {
  passed: boolean;
  reportPath?: string;
  reportSha256?: string;
  answerChecks?: Record<string, boolean>;
  answerCounters?: Record<string, number | boolean | null>;
  reason?: string;
};
export function validateG06SanitizedReportFile(
  disposition: Record<string, unknown>,
  root?: string,
  reportPath?: string,
): {
  passed: boolean;
  report: Record<string, unknown> | null;
  reportPath: string;
  reportSha256: string | null;
  reason?: string;
};
