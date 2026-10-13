export declare const R01_EXPECTED_QUERY_ARGUMENTS: {
  subjectId: 41529;
  includeEvidence: true;
};
export declare const R01_EPOCH_ID: 'run95-r01-subject-relations-agent-mcp-followup';
export declare const R01_ARGUMENT_PROFILE: 'fixed-r01-subject-41529-include-evidence-v1';
export declare const R01_REPORT_RELATIVE_PATH: string;
export declare function r01EventStreamIsClean(eventsSummary: unknown): boolean;
export declare function buildCodexExecArgs(options: {
  root?: string;
  nodePath: string;
  serverScript?: string;
  summaryPath: string;
  sourceRevision: string;
  bundleSha256: string;
}): string[];
export declare function validateRunnerArgs(args: string[]): 'help' | 'run';
export declare function canonicalR01ClaimPath(root?: string): string;
export declare function createOneShotClaim(
  claimPath: string,
  sourceRevision: string,
  bundleSha256: string,
  durableClaim?: Record<string, unknown> | null,
): Record<string, unknown>;
export declare function createOneShotClaims(options: {
  canonicalClaimPath: string;
  localClaimPath: string;
  sourceRevision: string;
  bundleSha256: string;
  durableClaim?: Record<string, unknown> | null;
}): { paths: string[]; claim: Record<string, unknown> };
export declare function sanitizeCodexEnvironment(
  source?: Record<string, string | undefined>,
): Record<string, string>;
export declare function serverSummaryMatchesCandidate(
  summary: unknown,
  sourceRevision: string,
  bundleSha256: string,
): boolean;
export declare function assertR01CandidateReviewGate(
  status: unknown,
  pr: unknown,
  options: { sourceRevision: string; currentBaseSha: string },
): { prNumber: number; candidateSha: string; baseSha: string; reviewerId: string | undefined };
export declare function runR01CodexAgentMcp(dependencies: {
  claimHarness: (gate: Record<string, unknown>) => Record<string, unknown>;
  persistResult: (
    claim: Record<string, unknown>,
    state: 'INCONCLUSIVE' | 'REPORT_WRITTEN',
    reportSha256?: string | null,
  ) => boolean;
}): number;
