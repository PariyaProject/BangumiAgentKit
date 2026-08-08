export interface ResultMeta {
  source: 'bangumi-v0' | 'bangumi-legacy';
  warnings?: string[];
}

export type SearchStatus = 'exact' | 'disambiguation' | 'not_found' | 'partial';

export interface SearchResult<T> {
  status: SearchStatus;
  query: string;
  total: number;
  limit?: number;
  offset?: number;
  exact?: T;
  candidates: T[];
  meta: ResultMeta;
}

export interface SubjectCandidate {
  id: number;
  name: string;
  nameCn: string;
  type: string;
  date?: string;
  image?: string;
  score?: number;
  rank?: number;
  nsfw?: boolean;
}

export interface CharacterCandidate {
  id: number;
  name: string;
  type: number;
  image?: string;
  relationHint?: string;
}

export interface PersonCandidate {
  id: number;
  name: string;
  career: string[];
  image?: string;
}
