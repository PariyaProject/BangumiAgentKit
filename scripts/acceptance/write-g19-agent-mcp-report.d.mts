export function buildG19SanitizedReport(
  input: Record<string, unknown>,
  answerResult: Record<string, unknown>,
  hashes: Record<string, string>,
  observedAt?: string,
): { passed: boolean; report?: Record<string, unknown>; reason?: string };
export function acceptG19AgentMcpEvidence(
  input: Record<string, unknown>,
  root?: string,
  observedAt?: string,
): Record<string, unknown>;
