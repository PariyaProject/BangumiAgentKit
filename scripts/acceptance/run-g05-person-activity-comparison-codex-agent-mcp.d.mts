export function canonicalG05ClaimPath(root?: string): string;
export function createG05OneShotClaim(
  claimPath: string,
  claim: {
    sourceRevision: string;
    baseSha: string;
    prNumber: number;
    bundleSha256: string;
    reviewerId: string;
  },
  options?: { root?: string },
): Record<string, unknown>;
export function buildCodexExecArgs(options: {
  root?: string;
  nodePath: string;
  serverScript?: string;
  summaryPath: string;
  sourceRevision: string;
  bundleSha256: string;
}): string[];
export function validateG05RunnerArgs(args: string[]): 'help' | 'run';
export function assertG05CandidateReviewGate(
  status: unknown,
  pr: unknown,
  expected: { sourceRevision: string; currentBaseSha: string },
): { prNumber: number; candidateSha: string; baseSha: string; reviewerId: string };
export function hasUnexpectedG05CodexToolActivity(events: unknown): boolean;
