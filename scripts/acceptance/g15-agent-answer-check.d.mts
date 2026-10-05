export declare const G15_AGENT_ANSWER_CHECK_METHOD: string;
export declare const G15_SUBJECT_IDS: readonly [400602, 420628];

export interface G15AgentAnswerCheck {
  method: string;
  toolNameMatch: boolean;
  queryArgumentsMatch: boolean;
  resultReadbackAvailable: boolean;
  resultState: string | null;
  resultSourceContractPassed: boolean;
  requestedSubjectIdsMatch: boolean;
  sourceSubjectIdentitiesMatch: boolean;
  subjectIdentityRowsExpected: number;
  subjectIdentityRowsMatched: number;
  subjectIdentityRowsUnmatched: number;
  identityOrderPreserved: boolean;
  malformedMetricRows: number;
  duplicateIdentityRows: number;
  requiredMetricsPresent: boolean;
  expectedMetricRows: number;
  answerMetricRowsParsed: number;
  metricRowsMatched: number;
  missingMetricRows: number;
  mismatchedMetricRows: number;
  unmatchedMetricRows: number;
  duplicateMetricRows: number;
  metricStatesPreserved: boolean;
  unstructuredAnswerLinesCount: number;
  currentOfficialV0DisclosurePresent: boolean;
  currentSnapshotDisclosurePresent: boolean;
  noHistoricalTrendClaimPresent: boolean;
  deltaDirectionDisclosurePresent: boolean;
  completionFormulaDisclosurePresent: boolean;
  completionFormulaEvidenceDisclosurePresent: boolean;
  notPersonalWatchProgressDisclosurePresent: boolean;
  boundedOverlapDisclosurePresent: boolean;
  omissionNotAbsenceDisclosurePresent: boolean;
  unsupportedClaimPresent: boolean;
  markdownFormattingDetected: boolean;
  passed: boolean;
}

export declare function verifyG15AgentAnswer(
  answer: unknown,
  toolName: unknown,
  queryArguments: unknown,
  toolOutput: unknown,
): G15AgentAnswerCheck;

export declare function createSanitizedG15CanaryReport(input: {
  createdOn: string;
  candidate: {
    sha: string;
    baseSha: string;
    catalogSha256: string;
    agentImageRevision: string;
    cliVersion: string;
  };
  completedBangumiToolCalls: number;
  otherCompletedToolEvents: number;
  textReadbackAvailable: boolean;
  textProjectionBytes: number;
  separateStructuredContentExposed: boolean;
  preservationRegressionPassed: boolean;
  probeProcessExitCode: number;
  resultStatus: string;
  answerCheck: G15AgentAnswerCheck;
}): Record<string, unknown>;
