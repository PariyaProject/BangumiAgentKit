export interface G02QueryArguments {
  media: 'anime';
  from: '2024-01-01';
  to: '2025-01-01';
  concepts: ['异世界'];
  sort: 'heat';
  order: 'desc';
  resultMode: 'top';
  limit: 10;
  explain: 'full';
}

export interface G02AnswerCheckResult {
  passed: boolean;
  answerChecks: Record<string, boolean>;
  resultCounters?: {
    resultState: string;
    coverageState: string;
    totalKind: string;
    scanned: number;
    matched: number;
    returned: number;
    warningCodes: string[];
    sourceRowsValidated: number;
    answerRowsMatched: number;
  } | null;
  artifactSummary?: {
    mimeType: 'image/png';
    width: number;
    height: number;
    byteLength: number;
    sha256: string;
    pngSignatureValid: true;
  } | null;
}

export const G02_QUERY_ARGUMENTS: G02QueryArguments;
export function verifyG02QueryAnswer(input: {
  answer: string;
  queryArguments: unknown;
  toolOutput: unknown;
}): G02AnswerCheckResult;
export function verifyG02RendererAnswer(input: {
  answer: string;
  queryArguments: unknown;
  toolResultSummary: unknown;
}): G02AnswerCheckResult;
export function findDiscoveryResult(value: unknown): unknown;
