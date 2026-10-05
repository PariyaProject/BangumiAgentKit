export type G01AgentAnswerCheck = {
  method: string;
  queryArgumentsMatch: boolean;
  resultReadbackAvailable: boolean;
  resultState: string | null;
  returnedRows: number;
  invalidSourceRowsCount: number;
  duplicateSourceRowsCount: number;
  sourceReturnedMatchesVisibleRows: boolean;
  totalKind: string | null;
  experimentalSourceWarningPresent: boolean;
  conceptResolutionVerified: boolean;
  answerRowsParsed: number;
  rowsMatched: number;
  missingRows: number;
  mismatchedRows: number;
  unmatchedRows: number;
  duplicateAnswerRows: number;
  unstructuredAnswerLinesCount: number;
  rowOrderPreserved: boolean;
  exactTagScopeDisclosurePresent: boolean;
  monthScopeDisclosurePresent: boolean;
  animeScopeDisclosurePresent: boolean;
  countDisclosurePresent: boolean;
  boundedCoverageDisclosurePresent: boolean;
  experimentalSourceDisclosurePresent: boolean;
  estimatedTotalDisclosurePresent: boolean;
  nonExhaustiveDisclosurePresent: boolean;
  unsupportedCompletenessClaim: boolean;
  unsupportedAbsenceClaim: boolean;
  markdownFormattingDetected: boolean;
  passed: boolean;
};

export const G01_AGENT_ANSWER_CHECK_METHOD: string;
export const G01_QUERY_ARGUMENTS: Readonly<{
  media: 'anime';
  year: 2026;
  month: 7;
  concepts: readonly ['后宫'];
  resultMode: 'all';
  limit: 100;
  explain: 'full';
}>;
export function verifyG01AgentAnswer(
  answer: string,
  queryArguments: unknown,
  toolOutput: unknown,
): G01AgentAnswerCheck;
