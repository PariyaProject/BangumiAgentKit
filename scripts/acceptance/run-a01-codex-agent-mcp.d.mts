export function validateRunnerArgs(args: string[]): 'help' | 'run';
export function parseCodexCliVersion(output: string): string;
export function buildCodexExecArgs(input: {
  root?: string;
  nodePath: string;
  summaryPath: string;
  sourceRevision: string;
  bundleSha256: string;
}): string[];
export function projectA01CohortQuery(query: Record<string, unknown>): Record<string, unknown>;
export function assertA01CandidateGate(
  status: unknown,
  pr: unknown,
  identity: { candidateSha: string; currentBaseSha: string },
): { prNumber: number; candidateSha: string; baseSha: string; reviewerId: string };
export function canonicalA01ClaimPath(root?: string): string;
export function createA01OneShotClaim(
  claimPath: string,
  details: {
    sourceRevision: string;
    baseSha: string;
    prNumber: number;
    bundleSha256: string;
  },
  root?: string,
): {
  schemaVersion: 1;
  runNumber: 95;
  frontierId: 'A01';
  epochId: 'run95-a01-agent-mcp-acceptance';
  state: 'CLAIMED';
  createdAt: string;
  model: 'gpt-6-luna';
  reasoningEffort: 'max';
  targetTool: 'bangumi.compare_subject_cohorts';
  expectedArgumentsSha256: string;
  sourceRevision: string;
  baseSha: string;
  prNumber: number;
  bundleSha256: string;
};
