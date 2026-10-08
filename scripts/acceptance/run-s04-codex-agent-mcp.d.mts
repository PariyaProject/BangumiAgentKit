export function sanitizeS04CodexEnvironment(source?: NodeJS.ProcessEnv): NodeJS.ProcessEnv;

export function buildCodexExecArgs(input: {
  root?: string;
  nodePath: string;
  serverScript?: string;
  summaryPath: string;
  sourceRevision: string;
  bundleSha256: string;
  baseSha: string;
  reviewerId: string;
  prNumber: number;
}): string[];

export function validateRunnerArgs(args: string[]): 'help' | 'run';
export function canonicalS04ClaimPath(root?: string): string;
export function createS04OneShotClaim(
  claimPath: string,
  sourceRevision: string,
  bundleSha256: string,
  details: { baseSha: string; prNumber: number; reviewerId: string },
  root?: string,
): Record<string, unknown>;
export function mandatoryChecksSuccessful(checks: unknown): boolean;
export function assertS04CandidateReviewGate(
  status: unknown,
  pr: unknown,
  input: { sourceRevision: string; currentBaseSha: string },
): { prNumber: number; candidateSha: string; baseSha: string; reviewerId: string };
export function buildS04AgentMcpReport(input: Record<string, unknown>): Record<string, unknown>;
