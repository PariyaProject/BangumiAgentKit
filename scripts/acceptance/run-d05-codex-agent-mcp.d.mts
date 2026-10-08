export const D05_EXPECTED_QUERY_ARGUMENTS: Readonly<{
  media: 'anime';
  season: 'current';
  tags: readonly ['校园', '恋爱'];
  sort: 'heat';
  order: 'desc';
  resultMode: 'top';
  limit: 8;
  explain: 'compact';
}>;

export function buildCodexExecArgs(options: {
  root?: string;
  nodePath: string;
  serverScript?: string;
  summaryPath: string;
  sourceRevision: string;
  bundleSha256: string;
}): string[];
export function validateRunnerArgs(args: string[]): 'help' | 'run';
export function sanitizeD05CodexEnvironment(source?: Record<string, string>): Record<string, string>;
export function canonicalD05ClaimPath(root?: string): string;
export function createD05OneShotClaim(
  claimPath: string,
  sourceRevision: string,
  bundleSha256: string,
  root?: string,
): Record<string, unknown>;
export function mandatoryChecksSuccessful(checks: unknown): boolean;
export function assertD05CandidateReviewGate(
  status: unknown,
  pr: unknown,
  options: { sourceRevision: string; currentBaseSha: string },
): { prNumber: number; candidateSha: string; baseSha: string };
