export const A01_RATING_DISPERSION_REPORT_RELATIVE_PATH: string;
export function validateA01RatingDispersionServerSummary(
  summary: unknown,
  sourceRevision: string,
  bundleSha256: string,
  root?: string,
): boolean;
export function buildA01RatingDispersionProfileReport(
  input: Record<string, unknown>,
  options?: { privateKey?: unknown; root?: string },
): { passed: boolean; report?: unknown; reason?: string; answerChecks?: Record<string, boolean> };
export function validateA01RatingDispersionProfileReport(
  report: unknown,
  claim: unknown,
  reportBytes?: Uint8Array | null,
  root?: string,
): { passed: boolean; reportPath?: string; reason?: string };
export function validateA01RatingDispersionSanitizedReportFile(
  claim: unknown,
  root?: string,
  reportPath?: string | null,
): { passed: boolean; reportPath?: string; reportSha256?: string; reason?: string };
export function buildA01RatingDispersionRunnerReceiptPayload(
  report: Record<string, unknown>,
  hashes: { eventStreamSha256: string; serverSummarySha256: string },
): Record<string, unknown>;
export function writeA01RatingDispersionProfileReport(
  input: Record<string, unknown>,
  options?: { privateKey?: unknown; root?: string },
): {
  passed: boolean;
  reportPath?: string;
  reportSha256?: string;
  report?: unknown;
  reason?: string;
};
