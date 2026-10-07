export const G20_DIRECT_RELATIONS_ANSWER_CHECK_METHOD: string;

export interface G20DirectRelationsAnswerCheck {
  method: string;
  queryArgumentsMatch: boolean;
  exactSingleToolCall: boolean;
  resultReadbackAvailable: boolean;
  structuredContentReadbackAvailable: boolean;
  sourceScopeVerified: boolean;
  coverageConsistent: boolean;
  textProjectionConsistent: boolean;
  textBudgetVerified: boolean;
  toolTextUtf8Bytes: number | null;
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
  boundedSourceDisclosurePresent: boolean;
  responseCountsDisclosurePresent: boolean;
  omissionNotAbsenceDisclosurePresent: boolean;
  nonCanonicalOrderDisclosurePresent: boolean;
  schemaDriftDisclosurePresent: boolean;
  unsupportedCompletenessClaim: boolean;
  unsupportedCanonicalOrderClaim: boolean;
  unsupportedAbsenceClaim: boolean;
  unsupportedReverseClaim: boolean;
  markdownFormattingDetected: boolean;
  passed: boolean;
}

export function verifyG20DirectRelationsAnswer(
  answer: unknown,
  queryArguments: unknown,
  toolOutput: unknown,
  toolCalls: unknown,
  toolTextUtf8Bytes: unknown,
): G20DirectRelationsAnswerCheck;
