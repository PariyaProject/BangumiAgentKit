export interface DomainRevision {
  id: number;
  type: number;
  summary: string;
  createdAt: string;
  creator?: {
    username?: string;
    nickname?: string;
  };
  data?: unknown;
}
