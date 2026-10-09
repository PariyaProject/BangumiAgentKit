export function validateRunnerArgs(args: string[]): 'help' | 'run';
export function buildCodexExecArgs(input: {
  root?: string;
  nodePath: string;
  summaryPath: string;
  sourceRevision: string;
  bundleSha256: string;
}): string[];
export function assertA01AggregateCandidateGate(
  status: Record<string, any>,
  pr: Record<string, any>,
  input: { candidateSha: string; currentBaseSha: string },
): {
  prNumber: number;
  candidateSha: string;
  baseSha: string;
  reviewerId: string;
  ciSha: string;
  reviewPassSha: string;
};
export function canonicalA01AggregateClaimPath(root?: string): string;
export function createA01AggregateOneShotClaim(
  claimPath: string,
  details: { sourceRevision: string; baseSha: string; prNumber: number; bundleSha256: string },
  root?: string,
): Record<string, unknown>;
