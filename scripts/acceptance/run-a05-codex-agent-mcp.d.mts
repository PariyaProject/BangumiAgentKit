export function sanitizeA05CodexEnvironment(source?: Record<string, string>): Record<string, string>;
export function buildA05CodexExecArgs(input: {
  root?: string;
  nodePath: string;
  summaryPath: string;
  candidateSha: string;
  bundleSha256: string;
}): string[];
export function validateA05RunnerArgs(args: string[]): 'help' | 'run';
export function assertA05CandidateReviewGate(
  status: unknown,
  pr: unknown,
  input: { candidateSha: string; currentBaseSha: string },
): { prNumber: number; candidateSha: string; baseSha: string };
