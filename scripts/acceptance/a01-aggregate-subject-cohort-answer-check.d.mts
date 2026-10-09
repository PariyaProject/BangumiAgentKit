export const A01_AGGREGATE_TARGET_TOOL: 'bangumi.aggregate_subject_cohort';
export const A01_AGGREGATE_ARGUMENT_PROFILE: 'a01-aggregate-2012-anime-sample-v1';
export const A01_AGGREGATE_EXPECTED_ARGUMENTS: Readonly<{
  cohort: Readonly<{
    query: Readonly<{
      media: 'anime';
      year: 2012;
      resultMode: 'all';
    }>;
  }>;
  maxSubjects: 1;
}>;
export function summarizeA01AggregateResult(result: unknown): Record<string, unknown> | null;
export function expectedA01AggregateAnswer(summary: Record<string, unknown>): string;
export function verifyA01AggregateAnswer(input: {
  answer: string;
  queryArguments: unknown;
  toolResult: unknown;
}): {
  passed: boolean;
  checks: Record<string, boolean>;
  summary: Record<string, unknown> | null;
};
