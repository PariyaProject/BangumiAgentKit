export function canonicalG19ClaimPath(root?: string): string;
export function createG19OneShotClaim(
  claimPath: string,
  input: { sourceRevision: string; baseSha: string; prNumber: number; bundleSha256: string; reviewerId: string },
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
export function validateG19RunnerArgs(args: string[]): 'help' | 'run';
export function assertG19CandidateReviewGate(
  status: unknown,
  pr: unknown,
  input: { sourceRevision: string; currentBaseSha: string },
): { prNumber: number; candidateSha: string; baseSha: string; reviewerId: string };
export function canonicalG19SafeEventSummary(events: unknown): Record<string, unknown>;
export function hasUnexpectedG19CodexToolActivity(events: unknown): boolean;
