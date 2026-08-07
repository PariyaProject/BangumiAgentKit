export type DomainEpisodeCategory = 'main' | 'sp' | 'op' | 'ed' | 'other';

export interface DomainEpisode {
  id: number;
  subjectId?: number;
  category: DomainEpisodeCategory;
  rawType: number;
  name: string;
  nameCn: string;
  sort: number;
  ep?: number;
  airdate?: string;
  comment?: number;
  duration?: string;
  desc?: string;
  disc?: number;
}
