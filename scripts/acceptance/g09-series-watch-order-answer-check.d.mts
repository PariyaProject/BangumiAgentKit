export declare const G09_SERIES_WATCH_ORDER_ANSWER_CHECK_METHOD: string;

export declare function verifyG09SeriesWatchOrderAnswer(
  answer: string,
  queryArguments: unknown,
  toolOutput: unknown,
  toolCalls: unknown,
  toolTextUtf8Bytes: number | null | undefined,
): {
  method: string;
  queryArgumentsMatch: boolean;
  exactSingleToolCall: boolean;
  resultReadbackAvailable: boolean;
  exactG09Scope: boolean;
  rootIsFirst: boolean;
  textBudgetVerified: boolean;
  toolTextUtf8Bytes: number | null;
  structuredContentContractPresent: boolean;
  sourceNamesAndLabelsComplete: boolean;
  sourceReturnedMatchesVisibleRows: boolean;
  omittedTextRowsCount: number;
  visibleWatchOrderRows: number;
  invalidSourceRowsCount: number;
  duplicateSourceRowsCount: number;
  answerRowsParsed: number;
  rowsMatched: number;
  missingRowsCount: number;
  mismatchedRowsCount: number;
  unmatchedRowsCount: number;
  duplicateAnswerRowsCount: number;
  unstructuredAnswerLinesCount: number;
  rowOrderPreserved: boolean;
  boundedCoverageDisclosurePresent: boolean;
  nonCanonicalOrderDisclosurePresent: boolean;
  nonAnimeExclusionsDisclosurePresent: boolean;
  omissionNotAbsenceDisclosurePresent: boolean;
  unsupportedCompletenessClaim: boolean;
  unsupportedCanonicalOrderClaim: boolean;
  unsupportedAbsenceClaim: boolean;
  markdownFormattingDetected: boolean;
  passed: boolean;
};
