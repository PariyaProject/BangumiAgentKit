export declare const G20_EXPECTED_QUERY_ARGUMENTS: {
  subjectId: 227245;
  includeEvidence: true;
};
export declare function buildCodexExecArgs(options: {
  root?: string;
  nodePath: string;
  serverScript?: string;
  summaryPath: string;
  sourceRevision: string;
  bundleSha256: string;
}): string[];
export declare function validateRunnerArgs(args: string[]): 'help' | 'run';
export declare function canonicalG20ClaimPath(root?: string): string;
export declare function createOneShotClaim(
  claimPath: string,
  sourceRevision: string,
  bundleSha256: string,
): Record<string, unknown>;
export declare function createOneShotClaims(options: {
  canonicalClaimPath: string;
  localClaimPath: string;
  sourceRevision: string;
  bundleSha256: string;
}): { paths: string[]; claim: Record<string, unknown> };
export declare function sanitizeCodexEnvironment(
  source?: Record<string, string | undefined>,
): Record<string, string>;
export declare function serverSummaryMatchesCandidate(
  summary: unknown,
  sourceRevision: string,
  bundleSha256: string,
): boolean;
export declare function assertG20CandidateReviewGate(
  status: unknown,
  pr: unknown,
  options: { sourceRevision: string; currentBaseSha: string },
): { prNumber: number; candidateSha: string };
