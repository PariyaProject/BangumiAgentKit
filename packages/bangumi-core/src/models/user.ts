import type { DomainEpisode } from './episode.js';

export interface DomainUser {
  id: number;
  username: string;
  nickname: string;
  avatar?: Record<string, string>;
  sign?: string;
}

export interface UserCollectionItem {
  subjectId: number;
  subjectName?: string;
  subjectNameCn?: string;
  subjectType?: string;
  status: 'wish' | 'doing' | 'done' | 'on_hold' | 'dropped' | 'unknown';
  statusLabel?: string;
  rating?: number;
  comment?: string;
  tags?: string[];
  epStatus?: number;
  updatedAt?: string;
  subjectDate?: string;
  subjectImage?: string;
  subjectTotalEpisodes?: number;
  subjectTotalEpisodesRaw?: number | string | null;
  subjectTotalEpisodesValidity?: 'valid' | 'missing' | 'unknown' | 'invalid';
}

export interface UserEpisodeCollectionItem {
  episode?: DomainEpisode;
  type: 0 | 1 | 2 | 3;
  status: UserEpisodeCollectionStatus;
  updatedAt?: number;
}

export type UserEpisodeCollectionStatus = 'uncollected' | 'wish' | 'done' | 'dropped' | 'unknown';

export interface UserCharacterCollectionItem {
  id: number;
  name: string;
  type: number;
  images?: Record<string, string>;
  createdAt: string;
}

export interface UserPersonCollectionItem {
  id: number;
  name: string;
  type: number;
  career: string[];
  images?: Record<string, string>;
  createdAt: string;
}
