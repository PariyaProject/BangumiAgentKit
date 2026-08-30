export type SubjectType = 'book' | 'anime' | 'music' | 'game' | 'real' | 'other';

export interface DomainSubject {
  id: number;
  type: SubjectType;
  name: string;
  nameCn: string;
  summary: string;
  nsfw: boolean;
  locked: boolean;
  date?: string;
  platform?: string;
  /** Raw official v0 subject.meta_tags, when the source returned the field. */
  metaTags?: string[];
  images?: {
    large?: string;
    common?: string;
    medium?: string;
    small?: string;
    grid?: string;
  };
  score?: number;
  rank?: number;
  ratingTotal?: number;
  ratingCount?: Record<string, number>;
  collectionCounts?: {
    wish: number;
    collect: number;
    doing: number;
    onHold: number;
    dropped: number;
  };
  eps?: number;
  totalEpisodes?: number;
}

export interface SubjectSearchResult {
  total: number;
  limit: number;
  offset: number;
  items: DomainSubject[];
}

export interface SubjectRelationItem {
  id: number;
  type: SubjectType;
  name: string;
  nameCn: string;
  relation: string;
  images?: Record<string, string>;
}
