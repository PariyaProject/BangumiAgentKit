export const C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID: string;
export const C07_RENDER_COMPARISON_OFFLINE_V4_PROFILE_ID: string;

export function getC07RenderComparisonOfflineConfig(profileId?: string): {
  id: string;
  networkMode: string;
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
  cohorts: Array<{
    keyword: string;
    subjectId: number;
    cohortLabel: string;
    subjectName?: string;
    subjectNameCn?: string;
    score?: number;
    rank?: number;
    collection?: {
      wish: number;
      collect: number;
      doing: number;
      on_hold: number;
      dropped: number;
    };
    eps?: number;
    totalEpisodes?: number;
  }>;
} | null;
export function isC07ReviewerId(reviewerId: unknown): boolean;
