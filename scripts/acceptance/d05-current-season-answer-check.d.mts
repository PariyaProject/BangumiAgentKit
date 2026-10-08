export const D05_ANSWER_CHECK_METHOD: string;
export const D05_EXPECTED_QUERY_ARGUMENTS: Readonly<{
  media: 'anime';
  season: 'current';
  tags: readonly ['校园', '恋爱'];
  sort: 'heat';
  order: 'desc';
  resultMode: 'top';
  limit: 8;
  explain: 'compact';
}>;

export function verifyD05CurrentSeasonAnswer(
  answer: unknown,
  queryArguments: unknown,
  toolOutput: unknown,
  toolCalls: unknown,
  toolTextUtf8Bytes: number | null,
): {
  method: string;
  passed: boolean;
  answerChecks: Record<string, boolean>;
  resultCounters: Record<string, number | string | null>;
  warningCodes: string[];
  privacy: Record<string, boolean>;
};
