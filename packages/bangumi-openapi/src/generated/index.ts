// Auto-generated Bangumi OpenAPI Client & Types. DO NOT EDIT MANUALLY.
// Spec version: Bangumi OpenAPI v0

import { HttpClient, HttpClientConfig } from '@bangumi-agent-kit/bangumi-transport';

export type SubjectType = 1 | 2 | 3 | 4 | 6; // 1: book, 2: anime, 3: music, 4: game, 6: real
export type CollectionStatus = 'wish' | 'collect' | 'do' | 'on_hold' | 'dropped';
export type EpisodeType = 0 | 1 | 2 | 3 | 4 | 5; // 0: main, 1: SP, 2: OP, 3: ED, etc.

export interface Subject {
  id: number;
  type: SubjectType;
  name: string;
  name_cn: string;
  summary: string;
  nsfw: boolean;
  locked: boolean;
  date?: string;
  platform?: string;
  images?: {
    large?: string;
    common?: string;
    medium?: string;
    small?: string;
    grid?: string;
  };
  rating?: {
    total: number;
    count: Record<string, number>;
    score: number;
    rank: number;
  };
  collection?: {
    wish: number;
    collect: number;
    doing: number;
    on_hold: number;
    dropped: number;
  };
  eps?: number;
  total_episodes?: number;
}

export interface PagedResult<T> {
  total: number;
  limit: number;
  offset: number;
  data: T[];
}

export interface Character {
  id: number;
  name: string;
  role_name?: string;
  type: number;
  summary: string;
  images?: Record<string, string>;
  comment?: number;
  collects?: number;
}

export interface Person {
  id: number;
  name: string;
  type: number;
  career: string[];
  summary: string;
  images?: Record<string, string>;
}

export interface User {
  id: number;
  username: string;
  nickname: string;
  user_group: number;
  avatar?: Record<string, string>;
  sign?: string;
}

export interface Episode {
  id: number;
  type: EpisodeType;
  name: string;
  name_cn: string;
  sort: number;
  ep?: number;
  airdate?: string;
  comment?: number;
  duration?: string;
  desc?: string;
  disc?: number;
}

export interface Collection {
  subject_id: number;
  rate?: number;
  type: number;
  comment?: string;
  tags?: string[];
  ep_status?: number;
  vol_status?: number;
  updated_at?: string;
  private?: boolean;
}

export interface Index {
  id: number;
  title: string;
  desc: string;
  total: number;
  stat: {
    collects: number;
    comment: number;
  };
  created_at: string;
}

export interface Revision {
  id: number;
  type: number;
  summary: string;
  created_at: string;
  data?: any;
}

export class GeneratedBangumiOpenApiClient {
  private transport: HttpClient;

  constructor(configOrTransport?: HttpClient | HttpClientConfig) {
    if (configOrTransport instanceof HttpClient) {
      this.transport = configOrTransport;
    } else {
      this.transport = new HttpClient(configOrTransport);
    }
  }

  /** 条目搜索 (POST /v0/search/subjects) */
  async searchSubjects(query?: Record<string, unknown>, body?: unknown): Promise<any> {
    return this.transport.request<any>({
      method: 'POST',
      path: `/v0/search/subjects`,
      query,
      body,
    });
  }

  /** 角色搜索 (POST /v0/search/characters) */
  async searchCharacters(query?: Record<string, unknown>, body?: unknown): Promise<any> {
    return this.transport.request<any>({
      method: 'POST',
      path: `/v0/search/characters`,
      query,
      body,
    });
  }

  /** 人物搜索 (POST /v0/search/persons) */
  async searchPersons(query?: Record<string, unknown>, body?: unknown): Promise<any> {
    return this.transport.request<any>({
      method: 'POST',
      path: `/v0/search/persons`,
      query,
      body,
    });
  }

  /** 浏览条目 (GET /v0/subjects) */
  async getSubjects(query?: Record<string, unknown>): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/subjects`,
      query,
    });
  }

  /** 获取条目 (GET /v0/subjects/{subject_id}) */
  async getSubjectById(subject_id: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/subjects/${encodeURIComponent(String(subject_id))}`,
    });
  }

  /** Get Subject Image (GET /v0/subjects/{subject_id}/image) */
  async getSubjectImageById(subject_id: string | number, query?: Record<string, unknown>): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/subjects/${encodeURIComponent(String(subject_id))}/image`,
      query,
    });
  }

  /** Get Subject Persons (GET /v0/subjects/{subject_id}/persons) */
  async getRelatedPersonsBySubjectId(subject_id: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/subjects/${encodeURIComponent(String(subject_id))}/persons`,
    });
  }

  /** Get Subject Characters (GET /v0/subjects/{subject_id}/characters) */
  async getRelatedCharactersBySubjectId(subject_id: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/subjects/${encodeURIComponent(String(subject_id))}/characters`,
    });
  }

  /** Get Subject Relations (GET /v0/subjects/{subject_id}/subjects) */
  async getRelatedSubjectsBySubjectId(subject_id: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/subjects/${encodeURIComponent(String(subject_id))}/subjects`,
    });
  }

  /** Get Episodes (GET /v0/episodes) */
  async getEpisodes(query?: Record<string, unknown>): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/episodes`,
      query,
    });
  }

  /** Get Episode (GET /v0/episodes/{episode_id}) */
  async getEpisodeById(episode_id: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/episodes/${encodeURIComponent(String(episode_id))}`,
    });
  }

  /** Get Character Detail (GET /v0/characters/{character_id}) */
  async getCharacterById(character_id: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/characters/${encodeURIComponent(String(character_id))}`,
    });
  }

  /** Get Character Image (GET /v0/characters/{character_id}/image) */
  async getCharacterImageById(character_id: string | number, query?: Record<string, unknown>): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/characters/${encodeURIComponent(String(character_id))}/image`,
      query,
    });
  }

  /** get character related subjects (GET /v0/characters/{character_id}/subjects) */
  async getRelatedSubjectsByCharacterId(character_id: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/characters/${encodeURIComponent(String(character_id))}/subjects`,
    });
  }

  /** get character related persons (GET /v0/characters/{character_id}/persons) */
  async getRelatedPersonsByCharacterId(character_id: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/characters/${encodeURIComponent(String(character_id))}/persons`,
    });
  }

  /** Collect character for current user (POST /v0/characters/{character_id}/collect) */
  async collectCharacterByCharacterIdAndUserId(character_id: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'POST',
      path: `/v0/characters/${encodeURIComponent(String(character_id))}/collect`,
    });
  }

  /** Uncollect character for current user (DELETE /v0/characters/{character_id}/collect) */
  async uncollectCharacterByCharacterIdAndUserId(character_id: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'DELETE',
      path: `/v0/characters/${encodeURIComponent(String(character_id))}/collect`,
    });
  }

  /** Get Person (GET /v0/persons/{person_id}) */
  async getPersonById(person_id: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/persons/${encodeURIComponent(String(person_id))}`,
    });
  }

  /** Get Person Image (GET /v0/persons/{person_id}/image) */
  async getPersonImageById(person_id: string | number, query?: Record<string, unknown>): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/persons/${encodeURIComponent(String(person_id))}/image`,
      query,
    });
  }

  /** get person related subjects (GET /v0/persons/{person_id}/subjects) */
  async getRelatedSubjectsByPersonId(person_id: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/persons/${encodeURIComponent(String(person_id))}/subjects`,
    });
  }

  /** get person related characters (GET /v0/persons/{person_id}/characters) */
  async getRelatedCharactersByPersonId(person_id: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/persons/${encodeURIComponent(String(person_id))}/characters`,
    });
  }

  /** Collect person for current user (POST /v0/persons/{person_id}/collect) */
  async collectPersonByPersonIdAndUserId(person_id: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'POST',
      path: `/v0/persons/${encodeURIComponent(String(person_id))}/collect`,
    });
  }

  /** Uncollect person for current user (DELETE /v0/persons/{person_id}/collect) */
  async uncollectPersonByPersonIdAndUserId(person_id: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'DELETE',
      path: `/v0/persons/${encodeURIComponent(String(person_id))}/collect`,
    });
  }

  /** Get User by name (GET /v0/users/{username}) */
  async getUserByName(username: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/users/${encodeURIComponent(String(username))}`,
    });
  }

  /** Get User Avatar by name (GET /v0/users/{username}/avatar) */
  async getUserAvatarByName(username: string | number, query?: Record<string, unknown>): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/users/${encodeURIComponent(String(username))}/avatar`,
      query,
    });
  }

  /** Get User (GET /v0/me) */
  async getMyself(): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/me`,
    });
  }

  /** 获取用户收藏 (GET /v0/users/{username}/collections) */
  async getUserCollectionsByUsername(username: string | number, query?: Record<string, unknown>): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/users/${encodeURIComponent(String(username))}/collections`,
      query,
    });
  }

  /** 获取用户单个条目收藏 (GET /v0/users/{username}/collections/{subject_id}) */
  async getUserCollection(username: string | number, subject_id: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/users/${encodeURIComponent(String(username))}/collections/${encodeURIComponent(String(subject_id))}`,
    });
  }

  /** 新增或修改用户单个条目收藏 (POST /v0/users/-/collections/{subject_id}) */
  async postUserCollection(subject_id: string | number, body?: unknown): Promise<any> {
    return this.transport.request<any>({
      method: 'POST',
      path: `/v0/users/-/collections/${encodeURIComponent(String(subject_id))}`,
      body,
    });
  }

  /** 修改用户单个收藏 (PATCH /v0/users/-/collections/{subject_id}) */
  async patchUserCollection(subject_id: string | number, body?: unknown): Promise<any> {
    return this.transport.request<any>({
      method: 'PATCH',
      path: `/v0/users/-/collections/${encodeURIComponent(String(subject_id))}`,
      body,
    });
  }

  /** 章节收藏信息 (GET /v0/users/-/collections/{subject_id}/episodes) */
  async getUserSubjectEpisodeCollection(subject_id: string | number, query?: Record<string, unknown>): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/users/-/collections/${encodeURIComponent(String(subject_id))}/episodes`,
      query,
    });
  }

  /** 章节收藏信息 (PATCH /v0/users/-/collections/{subject_id}/episodes) */
  async patchUserSubjectEpisodeCollection(subject_id: string | number, body?: unknown): Promise<any> {
    return this.transport.request<any>({
      method: 'PATCH',
      path: `/v0/users/-/collections/${encodeURIComponent(String(subject_id))}/episodes`,
      body,
    });
  }

  /** 章节收藏信息 (GET /v0/users/-/collections/-/episodes/{episode_id}) */
  async getUserEpisodeCollection(episode_id: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/users/-/collections/-/episodes/${encodeURIComponent(String(episode_id))}`,
    });
  }

  /** 更新章节收藏信息 (PUT /v0/users/-/collections/-/episodes/{episode_id}) */
  async putUserEpisodeCollection(episode_id: string | number, body?: unknown): Promise<any> {
    return this.transport.request<any>({
      method: 'PUT',
      path: `/v0/users/-/collections/-/episodes/${encodeURIComponent(String(episode_id))}`,
      body,
    });
  }

  /** 获取用户角色收藏列表 (GET /v0/users/{username}/collections/-/characters) */
  async getUserCharacterCollections(username: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/users/${encodeURIComponent(String(username))}/collections/-/characters`,
    });
  }

  /** 获取用户单个角色收藏信息 (GET /v0/users/{username}/collections/-/characters/{character_id}) */
  async getUserCharacterCollection(username: string | number, character_id: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/users/${encodeURIComponent(String(username))}/collections/-/characters/${encodeURIComponent(String(character_id))}`,
    });
  }

  /** 获取用户人物收藏列表 (GET /v0/users/{username}/collections/-/persons) */
  async getUserPersonCollections(username: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/users/${encodeURIComponent(String(username))}/collections/-/persons`,
    });
  }

  /** 获取用户单个人物收藏信息 (GET /v0/users/{username}/collections/-/persons/{person_id}) */
  async getUserPersonCollection(username: string | number, person_id: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/users/${encodeURIComponent(String(username))}/collections/-/persons/${encodeURIComponent(String(person_id))}`,
    });
  }

  /** Get Person Revisions (GET /v0/revisions/persons) */
  async getPersonRevisions(query?: Record<string, unknown>): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/revisions/persons`,
      query,
    });
  }

  /** Get Person Revision (GET /v0/revisions/persons/{revision_id}) */
  async getPersonRevisionByRevisionId(revision_id: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/revisions/persons/${encodeURIComponent(String(revision_id))}`,
    });
  }

  /** Get Character Revisions (GET /v0/revisions/characters) */
  async getCharacterRevisions(query?: Record<string, unknown>): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/revisions/characters`,
      query,
    });
  }

  /** Get Character Revision (GET /v0/revisions/characters/{revision_id}) */
  async getCharacterRevisionByRevisionId(revision_id: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/revisions/characters/${encodeURIComponent(String(revision_id))}`,
    });
  }

  /** Get Subject Revisions (GET /v0/revisions/subjects) */
  async getSubjectRevisions(query?: Record<string, unknown>): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/revisions/subjects`,
      query,
    });
  }

  /** Get Subject Revision (GET /v0/revisions/subjects/{revision_id}) */
  async getSubjectRevisionByRevisionId(revision_id: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/revisions/subjects/${encodeURIComponent(String(revision_id))}`,
    });
  }

  /** Get Episode Revisions (GET /v0/revisions/episodes) */
  async getEpisodeRevisions(query?: Record<string, unknown>): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/revisions/episodes`,
      query,
    });
  }

  /** Get Episode Revision (GET /v0/revisions/episodes/{revision_id}) */
  async getEpisodeRevisionByRevisionId(revision_id: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/revisions/episodes/${encodeURIComponent(String(revision_id))}`,
    });
  }

  /** Create a new index (POST /v0/indices) */
  async newIndex(): Promise<any> {
    return this.transport.request<any>({
      method: 'POST',
      path: `/v0/indices`,
    });
  }

  /** Get Index By ID (GET /v0/indices/{index_id}) */
  async getIndexById(index_id: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/indices/${encodeURIComponent(String(index_id))}`,
    });
  }

  /** Edit index's information (PUT /v0/indices/{index_id}) */
  async editIndexById(index_id: string | number, body?: unknown): Promise<any> {
    return this.transport.request<any>({
      method: 'PUT',
      path: `/v0/indices/${encodeURIComponent(String(index_id))}`,
      body,
    });
  }

  /** Get Index Subjects (GET /v0/indices/{index_id}/subjects) */
  async getIndexSubjectsByIndexId(index_id: string | number, query?: Record<string, unknown>): Promise<any> {
    return this.transport.request<any>({
      method: 'GET',
      path: `/v0/indices/${encodeURIComponent(String(index_id))}/subjects`,
      query,
    });
  }

  /** Add a subject to Index (POST /v0/indices/{index_id}/subjects) */
  async addSubjectToIndexByIndexId(index_id: string | number, body?: unknown): Promise<any> {
    return this.transport.request<any>({
      method: 'POST',
      path: `/v0/indices/${encodeURIComponent(String(index_id))}/subjects`,
      body,
    });
  }

  /** Edit subject information in a index (PUT /v0/indices/{index_id}/subjects/{subject_id}) */
  async editIndexSubjectsByIndexIdAndSubjectID(index_id: string | number, subject_id: string | number, body?: unknown): Promise<any> {
    return this.transport.request<any>({
      method: 'PUT',
      path: `/v0/indices/${encodeURIComponent(String(index_id))}/subjects/${encodeURIComponent(String(subject_id))}`,
      body,
    });
  }

  /** Delete a subject from a Index (DELETE /v0/indices/{index_id}/subjects/{subject_id}) */
  async delelteSubjectFromIndexByIndexIdAndSubjectID(index_id: string | number, subject_id: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'DELETE',
      path: `/v0/indices/${encodeURIComponent(String(index_id))}/subjects/${encodeURIComponent(String(subject_id))}`,
    });
  }

  /** Collect index for current user (POST /v0/indices/{index_id}/collect) */
  async collectIndexByIndexIdAndUserId(index_id: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'POST',
      path: `/v0/indices/${encodeURIComponent(String(index_id))}/collect`,
    });
  }

  /** Uncollect index for current user (DELETE /v0/indices/{index_id}/collect) */
  async uncollectIndexByIndexIdAndUserId(index_id: string | number): Promise<any> {
    return this.transport.request<any>({
      method: 'DELETE',
      path: `/v0/indices/${encodeURIComponent(String(index_id))}/collect`,
    });
  }

}
