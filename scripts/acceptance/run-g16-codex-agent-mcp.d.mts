export function canonicalG16ClaimPath(root?: string): string;
export function createG16OneShotClaim(
  claimPath: string,
  input: {
    sourceRevision: string;
    baseSha: string;
    prNumber: number;
    bundleSha256: string;
    reviewerId: string;
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
  input: { sourceRevision: string; currentBaseSha: string },
): { prNumber: number; candidateSha: string; baseSha: string; reviewerId: string };
export function canonicalG16SafeEventSummary(events: {
  [key: string]: unknown;
  codexMcpToolEventCount?: unknown;
  nonMcpToolEventCount?: unknown;
  nonMcpToolTypes?: unknown;
  shellToolCallCount?: unknown;
} | null | undefined): {
  codexMcpToolEventCount: number;
  nonMcpToolEventCount: number;
  nonMcpToolTypes: string[];
  shellToolCallCount: number;
};
export function hasUnexpectedG16CodexToolActivity(events: {
  nonMcpToolEventCount?: number;
  shellToolCallCount?: number;
} | null | undefined): boolean;
