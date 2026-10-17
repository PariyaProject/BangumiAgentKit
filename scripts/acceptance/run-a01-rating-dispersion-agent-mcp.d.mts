export function validateA01RatingDispersionRunnerArgs(args: string[]): 'help' | 'run';
export function classifyA01RatingDispersionAttempt(
  profileStatus: unknown,
  reportExists: boolean,
): string;
export function assertA01RatingDispersionCandidateReviewGate(
  status: unknown,
  pr: unknown,
  options: {
    sourceRevision: string;
    currentBaseSha: string;
    gitTextFn?: (...args: string[]) => string;
  },
): { candidateSha: string; baseSha: string; prNumber: number; reviewerId: string };
export function buildA01RatingDispersionCodexExecArgs(options: {
  nodePath?: string;
  summaryPath: string;
  sourceRevision: string;
  bundleSha256: string;
}): string[];
export function runA01RatingDispersionProfile(): number;
