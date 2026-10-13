export const G06_RUNNER_CONSTANTS: Readonly<{
  runNumber: number;
  epochId: string;
  toolName: string;
  argumentProfile: string;
  argumentSha256: string;
  model: string;
  reasoningEffort: string;
  reportPath: string;
}>;

export function buildG06CodexExecArgs(input: {
  root?: string;
  nodePath: string;
  serverScript?: string;
  summaryPath: string;
  sourceRevision: string;
  bundleSha256: string;
}): string[];
export function validateG06RunnerArgs(args: string[]): 'help' | 'run';
export function assertG06CandidateReviewGate(
  status: unknown,
  pr: unknown,
  input: {
    sourceRevision: string;
    currentBaseSha: string;
    allowClaimedDisposition?: boolean;
    expectedClaimId?: string;
  },
): { prNumber: number; candidateSha: string; baseSha: string; reviewerId: string };
export function canonicalG06ClaimPath(root?: string): string;
export function createG06OneShotClaim(
  claimPath: string,
  durableClaim: Record<string, unknown>,
  options?: { root?: string },
): Record<string, unknown>;
export function localG06ClaimMatchesHarnessClaim(
  local: Record<string, unknown>,
  durable: Record<string, unknown>,
): boolean;
export function runG06CodexAgentMcp(options?: {
  claimHarness?: (gate: Record<string, unknown>) => Record<string, unknown>;
  persistResult?: (
    claim: Record<string, unknown>,
    state: 'INCONCLUSIVE' | 'REPORT_WRITTEN',
    reportSha256?: string | null,
  ) => boolean;
  assertClaimStillClaimed?: (claim: Record<string, unknown>) => boolean;
}): number;
