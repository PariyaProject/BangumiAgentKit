export function buildCodexExecArgs(input: {
  root?: string;
  nodePath: string;
  serverScript?: string;
  summaryPath: string;
  sourceRevision: string;
  bundleSha256: string;
}): string[];
export function validateRunnerArgs(args: string[]): 'help';
export function buildG04SafeEventSummary(
  events:
    | {
        [key: string]: unknown;
        codexMcpToolEventCount?: unknown;
        codexErrorItemCount?: unknown;
        nonMcpToolEventCount?: unknown;
        nonMcpToolTypes?: unknown;
        shellToolCallCount?: unknown;
      }
    | null
    | undefined,
): {
  codexMcpToolEventCount: number;
  codexErrorItemCount: number | null;
  nonMcpToolEventCount: number;
  nonMcpToolTypes: string[];
  shellToolCallCount: number;
};
export function hasUnexpectedG04CodexToolActivity(
  events:
    | {
        codexErrorItemCount?: number;
        nonMcpToolEventCount?: number;
        shellToolCallCount?: number;
      }
    | null
    | undefined,
): boolean;
export function canonicalG04ClaimPath(root?: string): string;
export function resolveG04ReportWriterOutcome(
  writerResult: { exitCode?: number | null; output?: { passed?: boolean } | null } | null,
  report: { reportExists: boolean; reportValid: boolean },
): {
  state: 'REPORT_WRITTEN' | 'INCONCLUSIVE' | 'REPORT_ARTIFACT_CONFLICT_PENDING';
  recovered: boolean;
};
export function assertG04CandidateReviewGate(
  status: Record<string, unknown>,
  pr: Record<string, unknown>,
  input: {
    sourceRevision: string;
    currentBaseSha: string;
    allowClaimedDisposition?: boolean;
    expectedClaimId?: string;
  },
): {
  prNumber: number;
  candidateSha: string;
  baseSha: string;
  ciSha: string;
  ciStatus: string;
  reviewerId: string;
  model: string;
  reasoningEffort: string;
};
export function runG04CodexAgentMcp(input: {
  claimHarness: (gate: Record<string, unknown>) => Record<string, unknown>;
  persistResult: (
    claim: Record<string, unknown>,
    state: 'INCONCLUSIVE' | 'REPORT_WRITTEN',
    reportSha256?: string,
  ) => boolean;
}): number;
