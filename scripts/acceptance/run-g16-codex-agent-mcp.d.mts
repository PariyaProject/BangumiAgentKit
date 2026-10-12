export function canonicalG16ClaimPath(root?: string): string;
export function createG16OneShotClaim(
  claimPath: string,
  input: {
    claimId: string;
    sourceRevision: string;
    baseSha: string;
    ciSha: string;
    ciStatus: string;
    prNumber: number;
    bundleSha256: string;
    reviewerId: string;
    runnerReceiptPublicKey: string;
    model?: 'gpt-6-luna';
    reasoningEffort?: 'max';
  },
  options?: { root?: string; claimedAt?: string },
): Record<string, unknown>;
export function buildCodexExecArgs(input: {
  root?: string;
  nodePath: string;
  serverScript?: string;
  summaryPath: string;
  sourceRevision: string;
  bundleSha256: string;
}): string[];
export function validateG16RunnerArgs(args: string[]): 'help' | 'run';
export function assertG16CandidateReviewGate(
  status: Record<string, unknown>,
  pr: Record<string, unknown>,
  input: {
    sourceRevision: string;
    currentBaseSha: string;
    allowClaimedDisposition?: boolean;
    expectedClaimId?: string;
    runnerReceiptPublicKey?: string;
    bundleSha256?: string;
  },
): { prNumber: number; candidateSha: string; baseSha: string; reviewerId: string };
export function validateG16HarnessClaim(
  claim: Record<string, unknown>,
  gate: {
    prNumber: number;
    sourceRevision: string;
    baseSha: string;
    bundleSha256: string;
    reviewerId: string;
    runnerReceiptPublicKey: string;
  },
): Record<string, unknown>;
export function runG16CodexAgentMcp(input?: {
  claimHarness?: (gate: Record<string, unknown>) => Record<string, unknown>;
  persistResult?: (
    claim: Record<string, unknown>,
    state: 'INCONCLUSIVE' | 'REPORT_WRITTEN',
    reportSha256?: string,
    receipt?: Record<string, unknown>,
  ) => boolean;
}): number;
export function recoverG16PreexistingAttempt(input?: {
  claimPath?: string;
  reportPath?: string;
  persistResult?: (
    claim: Record<string, unknown>,
    state: 'INCONCLUSIVE' | 'REPORT_WRITTEN',
    reportSha256?: string,
    receipt?: Record<string, unknown>,
  ) => boolean;
  readStatus?: () => Record<string, unknown>;
}): number | null;
export function canonicalG16SafeEventSummary(events: {
  [key: string]: unknown;
  codexMcpToolEventCount?: unknown;
  codexErrorItemCount?: unknown;
  nonMcpToolEventCount?: unknown;
  nonMcpToolTypes?: unknown;
  shellToolCallCount?: unknown;
} | null | undefined): {
  codexMcpToolEventCount: number;
  codexErrorItemCount: number;
  nonMcpToolEventCount: number;
  nonMcpToolTypes: string[];
  shellToolCallCount: number;
};
export function hasUnexpectedG16CodexToolActivity(events: {
  codexErrorItemCount?: number;
  nonMcpToolEventCount?: number;
  shellToolCallCount?: number;
} | null | undefined): boolean;
