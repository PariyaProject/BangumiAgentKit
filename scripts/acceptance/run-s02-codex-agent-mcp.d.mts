export function buildCodexExecArgs(input: {
  root?: string;
  nodePath: string;
  serverScript?: string;
  summaryPath: string;
  sourceRevision: string;
  bundleSha256: string;
}): string[];

export function validateRunnerArgs(args: string[]): 'help' | 'run';
export function canonicalS02ClaimPath(root?: string): string;
export function createS02OneShotClaim(
  claimPath: string,
  sourceRevision: string,
  bundleSha256: string,
  root?: string,
): Record<string, unknown>;

export function assertS02CandidateReviewGate(
  status: Record<string, unknown>,
  pr: Record<string, unknown>,
  input: { sourceRevision: string; currentBaseSha: string },
): { prNumber: number; candidateSha: string };

export function buildS02EvidenceReport(input: {
  answer: string;
  queryArguments: unknown;
  toolOutput: unknown;
  toolCalls: unknown;
  sourceRevision: string;
  bundleSha256: string;
  observedAt: string;
  codexCliVersion: string;
  processExitCode: number;
  serverSummary: Record<string, unknown>;
  eventStreamParsed: boolean;
  eventsSummary: {
    codexMcpToolEventCount: number;
    nonMcpToolEventCount: number;
    shellToolCallCount: number;
    toolCalls: Array<{ name: string; state: string }>;
  };
}): {
  report: Record<string, unknown>;
  answer: ReturnType<typeof import('./s02-agent-answer-check.mjs').verifyS02RankingAnswer>;
};
