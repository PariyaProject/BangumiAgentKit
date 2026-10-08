export function s03ServerSummarySha256(summary: unknown): string;
export function s03EventEvidenceSha256(input: {
  eventsSummary: Record<string, unknown>;
  queryArguments: unknown;
  toolOutput: unknown;
  answer: unknown;
  toolTextUtf8Bytes: number | null;
}): string;
export function claimS03ServerCall(
  claimPath: string,
  authorizationToken: string,
  expected: {
    sourceRevision: string;
    bundleSha256: string;
    expectedArgumentsSha256: string;
    baseSha: string;
    reviewerId: string;
  },
): boolean;
export function verifyS03ServerAuthorization(
  claimPath: string,
  authorizationToken: string,
  expected: {
    sourceRevision: string;
    bundleSha256: string;
    expectedArgumentsSha256: string;
    baseSha: string;
    reviewerId: string;
  },
): Record<string, unknown>;
export function captureS03ServerResult(
  claimPath: string,
  authorizationToken: string,
  serverSummary: Record<string, unknown>,
): Record<string, unknown>;
export function prepareS03ReportClaim(
  claimPath: string,
  authorizationToken: string,
  reportAuthorization: Record<string, unknown>,
): Record<string, unknown>;
export function verifyS03ReportClaim(
  claimPath: string,
  authorizationToken: string,
): Record<string, unknown>;
