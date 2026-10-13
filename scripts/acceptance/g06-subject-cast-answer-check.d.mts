export interface G06ToolOutput {
  content?: Array<{ type?: string; text?: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export interface G06ToolCall {
  name: string;
  state: string;
  arguments: Record<string, unknown>;
  result?: G06ToolOutput;
}

export interface G06AnswerCounters {
  sourceRowsObserved: number | null;
  sourceRowsReturned: number | null;
  rowsUsedForAnswerCheck: number;
  structuredContentReadbackAvailable: boolean;
  rowsOmittedFromText: number | null;
  actorRowsOmittedFromText: number | null;
  sourceTruncated: boolean | null;
  schemaDriftRows: number | null;
  invalidActorIdRows: number | null;
  visibleCastRowsCount: number;
  castRowsMatchedCount: number;
  missingCastRowsCount: number;
  mismatchedCastRowsCount: number;
  duplicateAnswerRowsCount: number;
  unmatchedAnswerRowsCount: number;
  clippedCastRowsUnavailableCount: number;
  clippedActorNamesUnavailableCount: number;
  characterActorPairsMatchedCount: number;
  rawRelationLabelsMatchedCount: number;
  toolTextUtf8Bytes: number | null;
}

export const G06_SUBJECT_CAST_ANSWER_CHECK_METHOD: string;
export const G06_EXPECTED_QUERY_ARGUMENTS: Readonly<{ subjectId: number; limit: number }>;
export const G06_ARGUMENT_PROFILE: string;
export const G06_TOOL_NAME: string;
export const G06_EPOCH_ID: string;
export const G06_REPORT_RELATIVE_PATH: string;

export function verifyG06SubjectCastObservation(input: {
  queryArguments: Record<string, unknown>;
  toolOutput: G06ToolOutput;
  toolCalls: G06ToolCall[];
  answer: string;
  toolTextUtf8Bytes: number;
}): {
  method: string;
  passed: boolean;
  checks: Record<string, boolean>;
  counters: G06AnswerCounters;
};
export function canonicalG06ArgumentsSha256(): string;
export function sha256Text(value: string): string;
export function summarizeG06ToolResult(toolOutput: G06ToolOutput): Record<string, unknown>;
