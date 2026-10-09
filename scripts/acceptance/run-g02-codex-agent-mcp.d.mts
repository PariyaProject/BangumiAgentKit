import type { G02QueryArguments } from './g02-discovery-answer-check.mjs';

export const G02_TOOL_PROFILES: Record<
  'bangumi.query_subjects' | 'bangumi.render_query_subjects',
  { argumentProfile: string; prompt: string }
>;
export function buildCodexExecArgs(input: {
  root?: string;
  nodePath: string;
  toolName: 'bangumi.query_subjects' | 'bangumi.render_query_subjects';
  summaryPath: string;
  sourceRevision: string;
  bundleSha256: string;
}): string[];
export function validateRunnerArgs(args: string[]): 'help' | 'run';
export function canonicalG02ClaimPath(root?: string): string;
export function createG02OneShotClaim(
  claimPath: string,
  authorization: {
    sourceRevision: string;
    bundleSha256: string;
    baseSha: string;
    prNumber: number;
  },
  root?: string,
): {
  schemaVersion: 1;
  runNumber: 95;
  frontierId: 'G02';
  epochId: string;
  toolNames: string[];
  expectedArgumentsSha256: string;
  sourceRevision: string;
  bundleSha256: string;
  baseSha: string;
  prNumber: number;
  model: 'gpt-6-luna';
  reasoningEffort: 'max';
  state: 'CLAIMED';
  claimedAt: string;
};
export function assertG02CandidateReviewGate(
  status: Record<string, unknown>,
  pr: Record<string, unknown>,
  identity: { sourceRevision: string; currentBaseSha: string },
): { prNumber: number; candidateSha: string };

export type G02QueryArgumentsForRunner = G02QueryArguments;
