export const S02_RANKING_ANSWER_CHECK_METHOD: 's02-top-rated-main-voice-answer-v1';

export const S02_EXPECTED_QUERY_ARGUMENTS: Readonly<{
  personId: 3474;
  rankingMode: 'top_rated_main_voice';
  media: 'all';
}>;

export function verifyS02RankingAnswer(
  answer: unknown,
  queryArguments: unknown,
  toolOutput: unknown,
  toolCalls: unknown,
): {
  method: typeof S02_RANKING_ANSWER_CHECK_METHOD;
  passed: boolean;
  answerChecks: Record<string, boolean>;
  answerCounters: {
    sourceRows: number;
    answerRows: number;
    rowsMatched: number;
    missingRowsCount: number;
    extraRowsCount: number;
    duplicateAnswerRowsCount: number;
    coverageFieldsMatched: number;
  };
  resultSummary: null | {
    state: string;
    scope: string;
    media: string;
    truncated: boolean;
    rows: Array<{
      subjectId: number;
      ratingScore: number;
      ratingTotal: number | null;
    }>;
    coverage: Record<string, number>;
  };
};
