export type SubjectCastAnswerRow = {
  character: {
    id: number;
    name: string;
    displayNameTextTruncated?: boolean;
  };
  relation: string;
  relationTextTruncated?: boolean;
  actors: Array<{
    id: number;
    name: string;
    displayNameTextTruncated?: boolean;
  }>;
  actorCount?: number;
  actorsOmittedFromText?: number;
};

export type SubjectCastAnswerCheck = {
  visibleCastRowsCount: number;
  clippedCastRowsUnavailableCount: number;
  clippedActorNamesUnavailableCount: number;
  castRowsMatchedCount: number;
  missingCastRowsCount: number;
  mismatchedCastRowsCount: number;
  duplicateAnswerRowsCount: number;
  unmatchedAnswerRowsCount: number;
  unstructuredAnswerLinesCount: number;
  characterActorPairsMatchedCount: number;
  rawRelationLabelsMatchedCount: number;
  boundedCoverageDisclosurePresent: boolean;
  omissionNotAbsencePresent: boolean;
  unsupportedCompletenessClaim: boolean;
  unsupportedAbsenceClaim: boolean;
  markdownFormattingDetected: boolean;
  passed: boolean;
};

export function validateSubjectCastAnswer(
  answer: string,
  rows: SubjectCastAnswerRow[],
): SubjectCastAnswerCheck;
