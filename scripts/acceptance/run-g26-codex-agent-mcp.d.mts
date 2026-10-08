export declare const G26_EXPECTED_QUERY_ARGUMENTS: {
  media: 'anime';
  from: '2019-01-01';
  to: '2025-01-01';
  ratingCount: { min: 10001 };
  tags: ['女性向'];
  categories: 'tv';
  resultMode: 'all';
  limit: 100;
  explain: 'full';
};

export declare function buildCodexExecArgs(options: {
  root: string;
  nodePath: string;
  serverScript: string;
  summaryPath: string;
  sourceRevision: string;
  bundleSha256: string;
}): string[];

export declare function canonicalG26ClaimPath(root?: string): string;

export declare function validateRunnerArgs(args: readonly string[]): 'help' | 'run';

export declare function parseCodexJsonl(text: string): {
  events: unknown[];
  parsed: boolean;
  malformedLinesCount: number;
};

export declare function sanitizeCodexEnvironment(
  source?: Record<string, string | undefined>,
): Record<string, string | undefined>;

export declare function serverSummaryMatchesCandidate(
  summary: unknown,
  sourceRevision: string,
  bundleSha256: string,
): boolean;

export declare function createOneShotClaim(
  claimPath: string,
  sourceRevision: string,
  bundleSha256: string,
): Record<string, unknown>;

export declare function createOneShotClaims(options: {
  canonicalClaimPath: string;
  localClaimPath: string;
  sourceRevision: string;
  bundleSha256: string;
}): { paths: string[]; claim: Record<string, unknown> };

export declare function createAttestedOneShotClaims(options: {
  canonicalClaimPath: string;
  localClaimPath: string;
  sourceRevision: string;
  bundleSha256: string;
  attestationSha256: string;
}): { paths: string[]; claim: Record<string, unknown> };

export declare function summarizeCodexEvents(events: readonly unknown[]): {
  eventStreamComplete: boolean;
  codexMcpToolEventCount: number;
  mcpServerNames: unknown[];
  nonMcpToolEventCount: number;
  nonMcpToolTypes: string[];
  shellToolCallCount: number;
  toolCalls: Array<{ name: unknown; arguments: unknown; state: string }>;
  completedMcpCalls: Array<{
    result?: { structuredContent?: { items?: Array<{ id?: number }> } };
  }>;
  answer: string | null;
};
