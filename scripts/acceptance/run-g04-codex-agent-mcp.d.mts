export function buildCodexExecArgs(input: {
  root?: string;
  nodePath: string;
  serverScript?: string;
  summaryPath: string;
  sourceRevision: string;
  bundleSha256: string;
}): string[];
export function validateRunnerArgs(args: string[]): 'help' | 'run';
export function buildG04SafeEventSummary(
  events:
    | {
        [key: string]: unknown;
        codexMcpToolEventCount?: unknown;
        codexErrorItemCount?: unknown;
        nonMcpToolEventCount?: unknown;
        nonMcpToolTypes?: unknown;
        shellToolCallCount?: unknown;
      }
    | null
    | undefined,
): {
  codexMcpToolEventCount: number;
  codexErrorItemCount: number | null;
  nonMcpToolEventCount: number;
  nonMcpToolTypes: string[];
  shellToolCallCount: number;
};
export function hasUnexpectedG04CodexToolActivity(
  events:
    | {
        codexErrorItemCount?: number;
        nonMcpToolEventCount?: number;
        shellToolCallCount?: number;
      }
    | null
    | undefined,
): boolean;
export function canonicalG04ClaimPath(root?: string): string;
export function createG04OneShotClaim(
  claimPath: string,
  gate: {
    sourceRevision: string;
    baseSha: string;
    prNumber: number;
    bundleSha256: string;
    reviewerId: string;
    model?: string;
    reasoningEffort?: string;
  },
): Record<string, unknown>;
export function assertG04CandidateReviewGate(
  status: Record<string, unknown>,
  pr: Record<string, unknown>,
  input: { sourceRevision: string; currentBaseSha: string },
): {
  prNumber: number;
  candidateSha: string;
  baseSha: string;
  ciSha: string;
  ciStatus: string;
  reviewerId: string;
  model: string;
  reasoningEffort: string;
};
