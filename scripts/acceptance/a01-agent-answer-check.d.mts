export const A01_TARGET_TOOL: 'bangumi.compare_subject_cohorts';
export const A01_MAX_SUBJECTS: 8;
export const A01_EXPECTED_QUERY_ARGUMENTS: {
  cohorts: [
    {
      label: '目标作品';
      query: {
        keyword: '少女终末旅行';
        media: 'anime';
        categories: 'tv';
        season: '2017-autumn';
        resultMode: 'all';
        nsfw: 'exclude';
      };
    },
    {
      label: '2017-autumn 动画返回样本';
      query: {
        media: 'anime';
        season: '2017-autumn';
        resultMode: 'all';
        nsfw: 'exclude';
      };
    },
  ];
  maxSubjects: 8;
};

export function canonicalJson(value: unknown): string;
export function sha256(value: string): string;
export function expectedA01AnswerLines(result: unknown): {
  rows: string[];
  averageLine: string;
  scopeTokens: string[];
};
export function verifyA01AgentAnswer(input: {
  answer: string;
  queryArguments: unknown;
  toolResult: { structuredContent?: unknown };
}): {
  passed: boolean;
  checks: Record<string, boolean>;
  answerSha256: string | null;
  answerUtf8Bytes: number | null;
};
