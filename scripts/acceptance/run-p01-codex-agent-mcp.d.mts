export function canonicalP01ClaimPath(root?: string): string;
export function createP01OneShotClaim(
  claimPath: string,
  input: {
    sourceRevision: string;
    baseSha: string;
    prNumber: number;
    bundleSha256: string;
    reviewerId: string;
    model?: string;
    reasoningEffort?: string;
    ciSha?: string;
    ciStatus?: string;
  },
  options?: { root?: string; claimedAt?: string },
): Record<string, unknown>;
export function buildCodexExecArgs(input: {
  root?: string;
  nodePath?: string;
  serverScript?: string;
  summaryPath: string;
  sourceRevision: string;
  bundleSha256: string;
}): string[];
export function validateP01RunnerArgs(args: string[]): 'help' | 'run';
export function assertP01CandidateReviewGate(
  status: unknown,
  pr: unknown,
  options: {
    sourceRevision: string;
    currentBaseSha: string;
    bundleSha256?: string;
    allowClaimed?: boolean;
  },
): { prNumber: number; candidateSha: string; baseSha: string; reviewerId: string };
export function canonicalP01SafeEventSummary(events: unknown): {
  codexMcpToolEventCount: number;
  nonMcpToolEventCount: number;
  nonMcpToolTypes: string[];
  shellToolCallCount: number;
};
export function hasUnexpectedP01CodexToolActivity(events: unknown): boolean;
