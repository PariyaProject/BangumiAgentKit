export const R01_DIRECT_RELATIONS_ANSWER_CHECK_METHOD: string;

export interface R01DirectRelationsAnswerCheck {
  method: string;
  queryArgumentsMatch: boolean;
  exactSingleToolCall: boolean;
  resultReadbackAvailable: boolean;
  resultRowsReadbackAvailable: boolean;
  structuredContentReadbackAvailable: boolean;
  sourceScopeVerified: boolean;
  coverageConsistent: boolean;
  textProjectionConsistent: boolean;
  textBudgetVerified: boolean;
  toolTextUtf8Bytes: number | null;
  sourceResponseRowsObserved: number | null;
  sourceRowsReturned: number | null;
  sourceSchemaDriftRows: number | null;
  sourceTruncated: boolean | null;
  sourcePaginationAvailable: boolean | null;
  sourceTotalCountAvailable: boolean | null;
  sourceCompleteness: string | null;
  mcpTextRowsOmitted: number | null;
  mcpTextDisplayNamesClipped: number | null;
  mcpTextRelationLabelsClipped: number | null;
  mcpTextLimitationsClipped: number | null;
  visibleSourceRows: number;
  invalidSourceRowsCount: number;
  duplicateSourceRowsCount: number;
  answerRowsParsed: number;
  rowsMatched: number;
  missingRowsCount: number;
  mismatchedRowsCount: number;
  unmatchedRowsCount: number;
  duplicateAnswerRowsCount: number;
  unstructuredAnswerLinesCount: number;
  finalScopeLineVerified: boolean;
  sourceSubjectDisclosurePresent: boolean;
  boundedSourceDisclosurePresent: boolean;
  responseCountsDisclosurePresent: boolean;
  projectionRowsOmittedDisclosurePresent: boolean;
  omissionNotAbsenceDisclosurePresent: boolean;
  reverseTransitiveDisclosurePresent: boolean;
  nonCanonicalOrderDisclosurePresent: boolean;
  schemaDriftDisclosurePresent: boolean;
  unsupportedCompletenessClaim: boolean;
  unsupportedCanonicalOrderClaim: boolean;
  unsupportedAbsenceClaim: boolean;
  unsupportedReverseClaim: boolean;
  markdownFormattingDetected: boolean;
  passed: boolean;
}

export function verifyR01DirectRelationsAnswer(
  answer: unknown,
  queryArguments: unknown,
  toolOutput: unknown,
  toolCalls: unknown,
  toolTextUtf8Bytes: unknown,
): R01DirectRelationsAnswerCheck;
