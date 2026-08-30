export type SubjectType = 'book' | 'anime' | 'music' | 'game' | 'real' | 'other';

export type DomainSubjectMetaTagsState = 'complete' | 'partial' | 'unknown';

export interface DomainSubjectMetaTagsCoverage {
  state: DomainSubjectMetaTagsState;
  observed: number;
  valid: number;
  returned: number;
  omitted: number;
  malformed: number;
  textTruncated: number;
  truncated: boolean;
  maxItems?: number;
  maxCharacters?: number;
}

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
  /** Official v0 subject.meta_tags projection, when the source returned the field. */
  metaTags?: string[];
  /** Validation and bounded-projection evidence for metaTags when requested. */
  metaTagsCoverage?: DomainSubjectMetaTagsCoverage;
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
