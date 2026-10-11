export function buildP01SanitizedReport(
  input: Record<string, unknown>,
  answerResult: Record<string, unknown>,
  hashes: Record<string, string>,
  observedAt?: string,
): { passed: true; report: Record<string, unknown> } | { passed: false; reason: string };
export function p01CatalogHashes(root?: string): Record<string, string>;
export function validateP01SanitizedReport(
  report: Record<string, unknown>,
  expected: Record<string, unknown>,
  root?: string,
): { passed: true } | { passed: false; reason: string };
export function validateP01SanitizedReportFile(
  expected: Record<string, unknown>,
  root?: string,
  reportPath?: string,
):
  | { passed: true; reportPath: string; reportSha256: string }
  | { passed: false; reason: string };
export function acceptP01AgentMcpEvidence(
  input: Record<string, unknown>,
  root?: string,
  observedAt?: string,
): Record<string, unknown>;
