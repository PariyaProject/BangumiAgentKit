export const C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID: string;

export function getC07RenderComparisonOfflineConfig(profileId?: string): {
  id: string;
  expectedArguments: {
    cohorts: Array<{
      label: string;
      query: {
        keyword: string;
        media: 'anime';
        resultMode: 'all';
        limit: 1;
      };
    }>;
    maxSubjects: 1;
  };
  subjectId: number;
  subjectName: string;
  subjectNameCn: string;
  cohortLabel: string;
} | null;
