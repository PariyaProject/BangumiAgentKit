export function buildCodexExecArgs(input: {
  root?: string;
  nodePath: string;
  serverScript?: string;
  summaryPath: string;
  sourceRevision: string;
  bundleSha256: string;
}): string[];
export function validateRunnerArgs(args: string[]): 'help' | 'run';
export function canonicalG04ClaimPath(root?: string): string;
export function createG04OneShotClaim(
  claimPath: string,
  sourceRevision: string,
  bundleSha256: string,
): Record<string, unknown>;
export function assertG04CandidateReviewGate(
  status: Record<string, unknown>,
  pr: Record<string, unknown>,
  input: { sourceRevision: string; currentBaseSha: string },
): { prNumber: number; candidateSha: string };
