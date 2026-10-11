export function buildP01SanitizedReport(
  input: Record<string, unknown>,
  answerResult: Record<string, unknown>,
  hashes: Record<string, string>,
  observedAt?: string,
): { passed: true; report: Record<string, unknown> } | { passed: false; reason: string };
export function acceptP01AgentMcpEvidence(
  input: Record<string, unknown>,
  root?: string,
  observedAt?: string,
): Record<string, unknown>;
