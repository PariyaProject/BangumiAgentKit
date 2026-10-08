export function sanitizeS03CodexEnvironment(source?: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
export function buildCodexExecArgs(input: {
  root?: string;
  nodePath: string;
  serverScript?: string;
  summaryPath: string;
  sourceRevision: string;
  bundleSha256: string;
  claimPath: string;
  authorizationToken: string;
  currentBaseSha: string;
  reviewerId: string;
}): string[];
export function validateRunnerArgs(args: string[]): 'help' | 'run';
export function canonicalS03ClaimPath(root?: string, configuredDirectory?: string): string;
export function assertS03CandidateReviewGate(
  status: unknown,
  pr: unknown,
  state: { sourceRevision: string; currentBaseSha: string },
): { prNumber: number; candidateSha: string; baseSha: string; reviewerId: string };
