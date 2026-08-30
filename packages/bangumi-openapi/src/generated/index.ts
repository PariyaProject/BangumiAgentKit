// Auto-generated Bangumi OpenAPI Client & Types. DO NOT EDIT MANUALLY.
// Spec version: Bangumi OpenAPI v0

import {
  HttpClient,
  HttpClientConfig,
  type HttpRequestOptions,
} from '@bangumi-agent-kit/bangumi-transport';
import type { components, operations, paths } from './schema.js';

export type { components, operations, paths };

// Helper types to extract operation parameters and responses safely
export type OperationPath<K extends keyof operations> = operations[K] extends {
  parameters: { path: infer P };
}
  ? P
  : operations[K] extends { parameters?: { path?: infer P } }
    ? P
    : Record<string, never>;
export type OperationQuery<K extends keyof operations> = operations[K] extends {
  parameters: { query?: infer Q };
}
  ? Q
  : Record<string, unknown>;
export type OperationBody<K extends keyof operations> = operations[K] extends {
  requestBody: { content: { 'application/json': infer B } };
}
  ? B
  : operations[K] extends { requestBody?: { content: { 'application/json': infer B } } }
    ? B
    : never;
export type OperationResponse<K extends keyof operations> = operations[K] extends {
  responses: { 200: { content: { 'application/json': infer R } } };
}
  ? R
  : operations[K] extends { responses: { 201: { content: { 'application/json': infer R } } } }
    ? R
    : operations[K] extends { responses: { 302: unknown } }
      ? { location: string }
      : operations[K] extends { responses: { 301: unknown } }
        ? { location: string }
        : operations[K] extends { responses: { 204: unknown } }
          ? Record<string, never>
          : operations[K] extends { responses: { 200: unknown } }
            ? Record<string, never>
            : never;

// Re-exported DTO types derived strictly from OpenAPI components schema
export type Subject = components['schemas']['Subject'];
export type SubjectType = components['schemas']['SubjectType'];
export type SubjectCategory = components['schemas']['SubjectCategory'];
export type Character = components['schemas']['Character'];
export type Person = components['schemas']['Person'];
export type User = components['schemas']['User'];
export type Episode = components['schemas']['Episode'];
export type EpisodeType = components['schemas']['Episode']['type'];
export type UserSubjectCollection = components['schemas']['UserSubjectCollection'];
export type Index = components['schemas']['Index'];
export type Revision = components['schemas']['Revision'];
export type PagedSubject = components['schemas']['Paged_Subject'];
export type PagedCharacter = components['schemas']['Paged_Character'];
export type PagedPerson = components['schemas']['Paged_Person'];
export type PagedEpisode = components['schemas']['Paged_Episode'];

export class GeneratedBangumiOpenApiClient {
  private transport: HttpClient;

  constructor(configOrTransport?: HttpClient | HttpClientConfig) {
    if (configOrTransport && typeof (configOrTransport as any).request === 'function') {
      this.transport = configOrTransport as HttpClient;
    } else {
      this.transport = new HttpClient(configOrTransport as HttpClientConfig);
    }
  }

  /** 条目搜索 (POST /v0/search/subjects) */
  async searchSubjects(
    query: OperationQuery<'searchSubjects'> | undefined,
    body?: OperationBody<'searchSubjects'>,
  ): Promise<OperationResponse<'searchSubjects'>> {
    return this.transport.request<OperationResponse<'searchSubjects'>>({
      method: 'POST',
      path: `/v0/search/subjects`,
      query: query as Record<string, unknown> | undefined,
      body: body as unknown,
    });
  }

  /** 角色搜索 (POST /v0/search/characters) */
  async searchCharacters(
    query: OperationQuery<'searchCharacters'> | undefined,
    body?: OperationBody<'searchCharacters'>,
  ): Promise<OperationResponse<'searchCharacters'>> {
    return this.transport.request<OperationResponse<'searchCharacters'>>({
      method: 'POST',
      path: `/v0/search/characters`,
      query: query as Record<string, unknown> | undefined,
      body: body as unknown,
    });
  }

  /** 人物搜索 (POST /v0/search/persons) */
  async searchPersons(
    query: OperationQuery<'searchPersons'> | undefined,
    body?: OperationBody<'searchPersons'>,
  ): Promise<OperationResponse<'searchPersons'>> {
    return this.transport.request<OperationResponse<'searchPersons'>>({
      method: 'POST',
      path: `/v0/search/persons`,
      query: query as Record<string, unknown> | undefined,
      body: body as unknown,
    });
  }

  /** 浏览条目 (GET /v0/subjects) */
  async getSubjects(
    query: OperationQuery<'getSubjects'>,
  ): Promise<OperationResponse<'getSubjects'>> {
    return this.transport.request<OperationResponse<'getSubjects'>>({
      method: 'GET',
      path: `/v0/subjects`,
      query: query as Record<string, unknown> | undefined,
    });
  }

  /** 获取条目 (GET /v0/subjects/{subject_id}) */
  async getSubjectById(
    subject_id: OperationPath<'getSubjectById'>['subject_id'],
    requestOptions?: Pick<HttpRequestOptions, 'maxResponseBytes'>,
  ): Promise<OperationResponse<'getSubjectById'>> {
    return this.transport.request<OperationResponse<'getSubjectById'>>({
      method: 'GET',
      path: `/v0/subjects/${encodeURIComponent(String(subject_id))}`,
      ...requestOptions,
    });
  }

  /** Get Subject Image (GET /v0/subjects/{subject_id}/image) */
  async getSubjectImageById(
    subject_id: OperationPath<'getSubjectImageById'>['subject_id'],
    query: OperationQuery<'getSubjectImageById'>,
  ): Promise<OperationResponse<'getSubjectImageById'>> {
    return this.transport.request<OperationResponse<'getSubjectImageById'>>({
      method: 'GET',
      path: `/v0/subjects/${encodeURIComponent(String(subject_id))}/image`,
      query: query as Record<string, unknown> | undefined,
    });
  }

  /** Get Subject Persons (GET /v0/subjects/{subject_id}/persons) */
  async getRelatedPersonsBySubjectId(
    subject_id: OperationPath<'getRelatedPersonsBySubjectId'>['subject_id'],
    requestOptions?: Pick<HttpRequestOptions, 'signal' | 'maxResponseBytes'>,
  ): Promise<OperationResponse<'getRelatedPersonsBySubjectId'>> {
    return this.transport.request<OperationResponse<'getRelatedPersonsBySubjectId'>>({
      method: 'GET',
      path: `/v0/subjects/${encodeURIComponent(String(subject_id))}/persons`,
      ...requestOptions,
    });
  }

  /** Get Subject Characters (GET /v0/subjects/{subject_id}/characters) */
  async getRelatedCharactersBySubjectId(
    subject_id: OperationPath<'getRelatedCharactersBySubjectId'>['subject_id'],
    requestOptions?: Pick<HttpRequestOptions, 'signal' | 'maxResponseBytes'>,
  ): Promise<OperationResponse<'getRelatedCharactersBySubjectId'>> {
    return this.transport.request<OperationResponse<'getRelatedCharactersBySubjectId'>>({
      method: 'GET',
      path: `/v0/subjects/${encodeURIComponent(String(subject_id))}/characters`,
      ...requestOptions,
    });
  }

  /** Get Subject Relations (GET /v0/subjects/{subject_id}/subjects) */
  async getRelatedSubjectsBySubjectId(
    subject_id: OperationPath<'getRelatedSubjectsBySubjectId'>['subject_id'],
    requestOptions?: Pick<HttpRequestOptions, 'maxResponseBytes'>,
  ): Promise<OperationResponse<'getRelatedSubjectsBySubjectId'>> {
    return this.transport.request<OperationResponse<'getRelatedSubjectsBySubjectId'>>({
      method: 'GET',
      path: `/v0/subjects/${encodeURIComponent(String(subject_id))}/subjects`,
      ...requestOptions,
    });
  }

  /** Get Episodes (GET /v0/episodes) */
  async getEpisodes(
    query: OperationQuery<'getEpisodes'>,
  ): Promise<OperationResponse<'getEpisodes'>> {
    return this.transport.request<OperationResponse<'getEpisodes'>>({
      method: 'GET',
      path: `/v0/episodes`,
      query: query as Record<string, unknown> | undefined,
    });
  }

  /** Get Episode (GET /v0/episodes/{episode_id}) */
  async getEpisodeById(
    episode_id: OperationPath<'getEpisodeById'>['episode_id'],
  ): Promise<OperationResponse<'getEpisodeById'>> {
    return this.transport.request<OperationResponse<'getEpisodeById'>>({
      method: 'GET',
      path: `/v0/episodes/${encodeURIComponent(String(episode_id))}`,
    });
  }

  /** Get Character Detail (GET /v0/characters/{character_id}) */
  async getCharacterById(
    character_id: OperationPath<'getCharacterById'>['character_id'],
  ): Promise<OperationResponse<'getCharacterById'>> {
    return this.transport.request<OperationResponse<'getCharacterById'>>({
      method: 'GET',
      path: `/v0/characters/${encodeURIComponent(String(character_id))}`,
    });
  }

  /** Get Character Image (GET /v0/characters/{character_id}/image) */
  async getCharacterImageById(
    character_id: OperationPath<'getCharacterImageById'>['character_id'],
    query: OperationQuery<'getCharacterImageById'>,
  ): Promise<OperationResponse<'getCharacterImageById'>> {
    return this.transport.request<OperationResponse<'getCharacterImageById'>>({
      method: 'GET',
      path: `/v0/characters/${encodeURIComponent(String(character_id))}/image`,
      query: query as Record<string, unknown> | undefined,
    });
  }

  /** get character related subjects (GET /v0/characters/{character_id}/subjects) */
  async getRelatedSubjectsByCharacterId(
    character_id: OperationPath<'getRelatedSubjectsByCharacterId'>['character_id'],
  ): Promise<OperationResponse<'getRelatedSubjectsByCharacterId'>> {
    return this.transport.request<OperationResponse<'getRelatedSubjectsByCharacterId'>>({
      method: 'GET',
      path: `/v0/characters/${encodeURIComponent(String(character_id))}/subjects`,
    });
  }

  /** get character related persons (GET /v0/characters/{character_id}/persons) */
  async getRelatedPersonsByCharacterId(
    character_id: OperationPath<'getRelatedPersonsByCharacterId'>['character_id'],
  ): Promise<OperationResponse<'getRelatedPersonsByCharacterId'>> {
    return this.transport.request<OperationResponse<'getRelatedPersonsByCharacterId'>>({
      method: 'GET',
      path: `/v0/characters/${encodeURIComponent(String(character_id))}/persons`,
    });
  }

  /** Collect character for current user (POST /v0/characters/{character_id}/collect) */
  async collectCharacterByCharacterIdAndUserId(
    character_id: OperationPath<'collectCharacterByCharacterIdAndUserId'>['character_id'],
  ): Promise<OperationResponse<'collectCharacterByCharacterIdAndUserId'>> {
    return this.transport.request<OperationResponse<'collectCharacterByCharacterIdAndUserId'>>({
      method: 'POST',
      path: `/v0/characters/${encodeURIComponent(String(character_id))}/collect`,
    });
  }

  /** Uncollect character for current user (DELETE /v0/characters/{character_id}/collect) */
  async uncollectCharacterByCharacterIdAndUserId(
    character_id: OperationPath<'uncollectCharacterByCharacterIdAndUserId'>['character_id'],
  ): Promise<OperationResponse<'uncollectCharacterByCharacterIdAndUserId'>> {
    return this.transport.request<OperationResponse<'uncollectCharacterByCharacterIdAndUserId'>>({
      method: 'DELETE',
      path: `/v0/characters/${encodeURIComponent(String(character_id))}/collect`,
    });
  }

  /** Get Person (GET /v0/persons/{person_id}) */
  async getPersonById(
    person_id: OperationPath<'getPersonById'>['person_id'],
    requestOptions?: Pick<HttpRequestOptions, 'maxResponseBytes'>,
  ): Promise<OperationResponse<'getPersonById'>> {
    return this.transport.request<OperationResponse<'getPersonById'>>({
      method: 'GET',
      path: `/v0/persons/${encodeURIComponent(String(person_id))}`,
      ...requestOptions,
    });
  }

  /** Get Person Image (GET /v0/persons/{person_id}/image) */
  async getPersonImageById(
    person_id: OperationPath<'getPersonImageById'>['person_id'],
    query: OperationQuery<'getPersonImageById'>,
  ): Promise<OperationResponse<'getPersonImageById'>> {
    return this.transport.request<OperationResponse<'getPersonImageById'>>({
      method: 'GET',
      path: `/v0/persons/${encodeURIComponent(String(person_id))}/image`,
      query: query as Record<string, unknown> | undefined,
    });
  }

  /** get person related subjects (GET /v0/persons/{person_id}/subjects) */
  async getRelatedSubjectsByPersonId(
    person_id: OperationPath<'getRelatedSubjectsByPersonId'>['person_id'],
    requestOptions?: Pick<HttpRequestOptions, 'maxResponseBytes'>,
  ): Promise<OperationResponse<'getRelatedSubjectsByPersonId'>> {
    return this.transport.request<OperationResponse<'getRelatedSubjectsByPersonId'>>({
      method: 'GET',
      path: `/v0/persons/${encodeURIComponent(String(person_id))}/subjects`,
      ...requestOptions,
    });
  }

  /** get person related characters (GET /v0/persons/{person_id}/characters) */
  async getRelatedCharactersByPersonId(
    person_id: OperationPath<'getRelatedCharactersByPersonId'>['person_id'],
    requestOptions?: Pick<HttpRequestOptions, 'maxResponseBytes'>,
  ): Promise<OperationResponse<'getRelatedCharactersByPersonId'>> {
    return this.transport.request<OperationResponse<'getRelatedCharactersByPersonId'>>({
      method: 'GET',
      path: `/v0/persons/${encodeURIComponent(String(person_id))}/characters`,
      ...requestOptions,
    });
  }

  /** Collect person for current user (POST /v0/persons/{person_id}/collect) */
  async collectPersonByPersonIdAndUserId(
    person_id: OperationPath<'collectPersonByPersonIdAndUserId'>['person_id'],
  ): Promise<OperationResponse<'collectPersonByPersonIdAndUserId'>> {
    return this.transport.request<OperationResponse<'collectPersonByPersonIdAndUserId'>>({
      method: 'POST',
      path: `/v0/persons/${encodeURIComponent(String(person_id))}/collect`,
    });
  }

  /** Uncollect person for current user (DELETE /v0/persons/{person_id}/collect) */
  async uncollectPersonByPersonIdAndUserId(
    person_id: OperationPath<'uncollectPersonByPersonIdAndUserId'>['person_id'],
  ): Promise<OperationResponse<'uncollectPersonByPersonIdAndUserId'>> {
    return this.transport.request<OperationResponse<'uncollectPersonByPersonIdAndUserId'>>({
      method: 'DELETE',
      path: `/v0/persons/${encodeURIComponent(String(person_id))}/collect`,
    });
  }

  /** Get User by name (GET /v0/users/{username}) */
  async getUserByName(
    username: OperationPath<'getUserByName'>['username'],
  ): Promise<OperationResponse<'getUserByName'>> {
    return this.transport.request<OperationResponse<'getUserByName'>>({
      method: 'GET',
      path: `/v0/users/${encodeURIComponent(String(username))}`,
    });
  }

  /** Get User Avatar by name (GET /v0/users/{username}/avatar) */
  async getUserAvatarByName(
    username: OperationPath<'getUserAvatarByName'>['username'],
    query: OperationQuery<'getUserAvatarByName'>,
  ): Promise<OperationResponse<'getUserAvatarByName'>> {
    return this.transport.request<OperationResponse<'getUserAvatarByName'>>({
      method: 'GET',
      path: `/v0/users/${encodeURIComponent(String(username))}/avatar`,
      query: query as Record<string, unknown> | undefined,
    });
  }

  /** Get User (GET /v0/me) */
  async getMyself(): Promise<OperationResponse<'getMyself'>> {
    return this.transport.request<OperationResponse<'getMyself'>>({
      method: 'GET',
      path: `/v0/me`,
    });
  }

  /** 获取用户收藏 (GET /v0/users/{username}/collections) */
  async getUserCollectionsByUsername(
    username: OperationPath<'getUserCollectionsByUsername'>['username'],
    query?: OperationQuery<'getUserCollectionsByUsername'>,
    requestOptions?: Pick<HttpRequestOptions, 'signal' | 'maxResponseBytes'>,
  ): Promise<OperationResponse<'getUserCollectionsByUsername'>> {
    return this.transport.request<OperationResponse<'getUserCollectionsByUsername'>>({
      method: 'GET',
      path: `/v0/users/${encodeURIComponent(String(username))}/collections`,
      query: query as Record<string, unknown> | undefined,
      ...requestOptions,
    });
  }

  /** 获取用户单个条目收藏 (GET /v0/users/{username}/collections/{subject_id}) */
  async getUserCollection(
    username: OperationPath<'getUserCollection'>['username'],
    subject_id: OperationPath<'getUserCollection'>['subject_id'],
  ): Promise<OperationResponse<'getUserCollection'>> {
    return this.transport.request<OperationResponse<'getUserCollection'>>({
      method: 'GET',
      path: `/v0/users/${encodeURIComponent(String(username))}/collections/${encodeURIComponent(String(subject_id))}`,
    });
  }

  /** 新增或修改用户单个条目收藏 (POST /v0/users/-/collections/{subject_id}) */
  async postUserCollection(
    subject_id: OperationPath<'postUserCollection'>['subject_id'],
    body?: OperationBody<'postUserCollection'>,
  ): Promise<OperationResponse<'postUserCollection'>> {
    return this.transport.request<OperationResponse<'postUserCollection'>>({
      method: 'POST',
      path: `/v0/users/-/collections/${encodeURIComponent(String(subject_id))}`,
      body: body as unknown,
    });
  }

  /** 修改用户单个收藏 (PATCH /v0/users/-/collections/{subject_id}) */
  async patchUserCollection(
    subject_id: OperationPath<'patchUserCollection'>['subject_id'],
    body?: OperationBody<'patchUserCollection'>,
  ): Promise<OperationResponse<'patchUserCollection'>> {
    return this.transport.request<OperationResponse<'patchUserCollection'>>({
      method: 'PATCH',
      path: `/v0/users/-/collections/${encodeURIComponent(String(subject_id))}`,
      body: body as unknown,
    });
  }

  /** 章节收藏信息 (GET /v0/users/-/collections/{subject_id}/episodes) */
  async getUserSubjectEpisodeCollection(
    subject_id: OperationPath<'getUserSubjectEpisodeCollection'>['subject_id'],
    query?: OperationQuery<'getUserSubjectEpisodeCollection'>,
    requestOptions?: Pick<HttpRequestOptions, 'signal'>,
  ): Promise<OperationResponse<'getUserSubjectEpisodeCollection'>> {
    return this.transport.request<OperationResponse<'getUserSubjectEpisodeCollection'>>({
      method: 'GET',
      path: `/v0/users/-/collections/${encodeURIComponent(String(subject_id))}/episodes`,
      query: query as Record<string, unknown> | undefined,
      ...requestOptions,
    });
  }

  /** 章节收藏信息 (PATCH /v0/users/-/collections/{subject_id}/episodes) */
  async patchUserSubjectEpisodeCollection(
    subject_id: OperationPath<'patchUserSubjectEpisodeCollection'>['subject_id'],
    body?: OperationBody<'patchUserSubjectEpisodeCollection'>,
  ): Promise<OperationResponse<'patchUserSubjectEpisodeCollection'>> {
    return this.transport.request<OperationResponse<'patchUserSubjectEpisodeCollection'>>({
      method: 'PATCH',
      path: `/v0/users/-/collections/${encodeURIComponent(String(subject_id))}/episodes`,
      body: body as unknown,
    });
  }

  /** 章节收藏信息 (GET /v0/users/-/collections/-/episodes/{episode_id}) */
  async getUserEpisodeCollection(
    episode_id: OperationPath<'getUserEpisodeCollection'>['episode_id'],
  ): Promise<OperationResponse<'getUserEpisodeCollection'>> {
    return this.transport.request<OperationResponse<'getUserEpisodeCollection'>>({
      method: 'GET',
      path: `/v0/users/-/collections/-/episodes/${encodeURIComponent(String(episode_id))}`,
    });
  }

  /** 更新章节收藏信息 (PUT /v0/users/-/collections/-/episodes/{episode_id}) */
  async putUserEpisodeCollection(
    episode_id: OperationPath<'putUserEpisodeCollection'>['episode_id'],
    body?: OperationBody<'putUserEpisodeCollection'>,
  ): Promise<OperationResponse<'putUserEpisodeCollection'>> {
    return this.transport.request<OperationResponse<'putUserEpisodeCollection'>>({
      method: 'PUT',
      path: `/v0/users/-/collections/-/episodes/${encodeURIComponent(String(episode_id))}`,
      body: body as unknown,
    });
  }

  /** 获取用户角色收藏列表 (GET /v0/users/{username}/collections/-/characters) */
  async getUserCharacterCollections(
    username: OperationPath<'getUserCharacterCollections'>['username'],
    requestOptions?: Pick<HttpRequestOptions, 'signal' | 'maxResponseBytes'>,
  ): Promise<OperationResponse<'getUserCharacterCollections'>> {
    return this.transport.request<OperationResponse<'getUserCharacterCollections'>>({
      method: 'GET',
      path: `/v0/users/${encodeURIComponent(String(username))}/collections/-/characters`,
      ...requestOptions,
    });
  }

  /** 获取用户单个角色收藏信息 (GET /v0/users/{username}/collections/-/characters/{character_id}) */
  async getUserCharacterCollection(
    username: OperationPath<'getUserCharacterCollection'>['username'],
    character_id: OperationPath<'getUserCharacterCollection'>['character_id'],
  ): Promise<OperationResponse<'getUserCharacterCollection'>> {
    return this.transport.request<OperationResponse<'getUserCharacterCollection'>>({
      method: 'GET',
      path: `/v0/users/${encodeURIComponent(String(username))}/collections/-/characters/${encodeURIComponent(String(character_id))}`,
    });
  }

  /** 获取用户人物收藏列表 (GET /v0/users/{username}/collections/-/persons) */
  async getUserPersonCollections(
    username: OperationPath<'getUserPersonCollections'>['username'],
    requestOptions?: Pick<HttpRequestOptions, 'signal' | 'maxResponseBytes'>,
  ): Promise<OperationResponse<'getUserPersonCollections'>> {
    return this.transport.request<OperationResponse<'getUserPersonCollections'>>({
      method: 'GET',
      path: `/v0/users/${encodeURIComponent(String(username))}/collections/-/persons`,
      ...requestOptions,
    });
  }

  /** 获取用户单个人物收藏信息 (GET /v0/users/{username}/collections/-/persons/{person_id}) */
  async getUserPersonCollection(
    username: OperationPath<'getUserPersonCollection'>['username'],
    person_id: OperationPath<'getUserPersonCollection'>['person_id'],
  ): Promise<OperationResponse<'getUserPersonCollection'>> {
    return this.transport.request<OperationResponse<'getUserPersonCollection'>>({
      method: 'GET',
      path: `/v0/users/${encodeURIComponent(String(username))}/collections/-/persons/${encodeURIComponent(String(person_id))}`,
    });
  }

  /** Get Person Revisions (GET /v0/revisions/persons) */
  async getPersonRevisions(
    query: OperationQuery<'getPersonRevisions'>,
    requestOptions?: Pick<HttpRequestOptions, 'maxResponseBytes' | 'retryOptions'>,
  ): Promise<OperationResponse<'getPersonRevisions'>> {
    return this.transport.request<OperationResponse<'getPersonRevisions'>>({
      method: 'GET',
      path: `/v0/revisions/persons`,
      query: query as Record<string, unknown> | undefined,
      ...requestOptions,
    });
  }

  /** Get Person Revision (GET /v0/revisions/persons/{revision_id}) */
  async getPersonRevisionByRevisionId(
    revision_id: OperationPath<'getPersonRevisionByRevisionId'>['revision_id'],
    requestOptions?: Pick<HttpRequestOptions, 'maxResponseBytes' | 'retryOptions'>,
  ): Promise<OperationResponse<'getPersonRevisionByRevisionId'>> {
    return this.transport.request<OperationResponse<'getPersonRevisionByRevisionId'>>({
      method: 'GET',
      path: `/v0/revisions/persons/${encodeURIComponent(String(revision_id))}`,
      ...requestOptions,
    });
  }

  /** Get Character Revisions (GET /v0/revisions/characters) */
  async getCharacterRevisions(
    query: OperationQuery<'getCharacterRevisions'>,
    requestOptions?: Pick<HttpRequestOptions, 'maxResponseBytes' | 'retryOptions'>,
  ): Promise<OperationResponse<'getCharacterRevisions'>> {
    return this.transport.request<OperationResponse<'getCharacterRevisions'>>({
      method: 'GET',
      path: `/v0/revisions/characters`,
      query: query as Record<string, unknown> | undefined,
      ...requestOptions,
    });
  }

  /** Get Character Revision (GET /v0/revisions/characters/{revision_id}) */
  async getCharacterRevisionByRevisionId(
    revision_id: OperationPath<'getCharacterRevisionByRevisionId'>['revision_id'],
    requestOptions?: Pick<HttpRequestOptions, 'maxResponseBytes' | 'retryOptions'>,
  ): Promise<OperationResponse<'getCharacterRevisionByRevisionId'>> {
    return this.transport.request<OperationResponse<'getCharacterRevisionByRevisionId'>>({
      method: 'GET',
      path: `/v0/revisions/characters/${encodeURIComponent(String(revision_id))}`,
      ...requestOptions,
    });
  }

  /** Get Subject Revisions (GET /v0/revisions/subjects) */
  async getSubjectRevisions(
    query: OperationQuery<'getSubjectRevisions'>,
    requestOptions?: Pick<HttpRequestOptions, 'maxResponseBytes' | 'retryOptions'>,
  ): Promise<OperationResponse<'getSubjectRevisions'>> {
    return this.transport.request<OperationResponse<'getSubjectRevisions'>>({
      method: 'GET',
      path: `/v0/revisions/subjects`,
      query: query as Record<string, unknown> | undefined,
      ...requestOptions,
    });
  }

  /** Get Subject Revision (GET /v0/revisions/subjects/{revision_id}) */
  async getSubjectRevisionByRevisionId(
    revision_id: OperationPath<'getSubjectRevisionByRevisionId'>['revision_id'],
    requestOptions?: Pick<HttpRequestOptions, 'maxResponseBytes' | 'retryOptions'>,
  ): Promise<OperationResponse<'getSubjectRevisionByRevisionId'>> {
    return this.transport.request<OperationResponse<'getSubjectRevisionByRevisionId'>>({
      method: 'GET',
      path: `/v0/revisions/subjects/${encodeURIComponent(String(revision_id))}`,
      ...requestOptions,
    });
  }

  /** Get Episode Revisions (GET /v0/revisions/episodes) */
  async getEpisodeRevisions(
    query: OperationQuery<'getEpisodeRevisions'>,
    requestOptions?: Pick<HttpRequestOptions, 'maxResponseBytes' | 'retryOptions'>,
  ): Promise<OperationResponse<'getEpisodeRevisions'>> {
    return this.transport.request<OperationResponse<'getEpisodeRevisions'>>({
      method: 'GET',
      path: `/v0/revisions/episodes`,
      query: query as Record<string, unknown> | undefined,
      ...requestOptions,
    });
  }

  /** Get Episode Revision (GET /v0/revisions/episodes/{revision_id}) */
  async getEpisodeRevisionByRevisionId(
    revision_id: OperationPath<'getEpisodeRevisionByRevisionId'>['revision_id'],
    requestOptions?: Pick<HttpRequestOptions, 'maxResponseBytes' | 'retryOptions'>,
  ): Promise<OperationResponse<'getEpisodeRevisionByRevisionId'>> {
    return this.transport.request<OperationResponse<'getEpisodeRevisionByRevisionId'>>({
      method: 'GET',
      path: `/v0/revisions/episodes/${encodeURIComponent(String(revision_id))}`,
      ...requestOptions,
    });
  }

  /** Create a new index (POST /v0/indices) */
  async newIndex(): Promise<OperationResponse<'newIndex'>> {
    return this.transport.request<OperationResponse<'newIndex'>>({
      method: 'POST',
      path: `/v0/indices`,
    });
  }

  /** Get Index By ID (GET /v0/indices/{index_id}) */
  async getIndexById(
    index_id: OperationPath<'getIndexById'>['index_id'],
  ): Promise<OperationResponse<'getIndexById'>> {
    return this.transport.request<OperationResponse<'getIndexById'>>({
      method: 'GET',
      path: `/v0/indices/${encodeURIComponent(String(index_id))}`,
    });
  }

  /** Edit index's information (PUT /v0/indices/{index_id}) */
  async editIndexById(
    index_id: OperationPath<'editIndexById'>['index_id'],
    body?: OperationBody<'editIndexById'>,
  ): Promise<OperationResponse<'editIndexById'>> {
    return this.transport.request<OperationResponse<'editIndexById'>>({
      method: 'PUT',
      path: `/v0/indices/${encodeURIComponent(String(index_id))}`,
      body: body as unknown,
    });
  }

  /** Get Index Subjects (GET /v0/indices/{index_id}/subjects) */
  async getIndexSubjectsByIndexId(
    index_id: OperationPath<'getIndexSubjectsByIndexId'>['index_id'],
    query?: OperationQuery<'getIndexSubjectsByIndexId'>,
  ): Promise<OperationResponse<'getIndexSubjectsByIndexId'>> {
    return this.transport.request<OperationResponse<'getIndexSubjectsByIndexId'>>({
      method: 'GET',
      path: `/v0/indices/${encodeURIComponent(String(index_id))}/subjects`,
      query: query as Record<string, unknown> | undefined,
    });
  }

  /** Add a subject to Index (POST /v0/indices/{index_id}/subjects) */
  async addSubjectToIndexByIndexId(
    index_id: OperationPath<'addSubjectToIndexByIndexId'>['index_id'],
    body?: OperationBody<'addSubjectToIndexByIndexId'>,
  ): Promise<OperationResponse<'addSubjectToIndexByIndexId'>> {
    return this.transport.request<OperationResponse<'addSubjectToIndexByIndexId'>>({
      method: 'POST',
      path: `/v0/indices/${encodeURIComponent(String(index_id))}/subjects`,
      body: body as unknown,
    });
  }

  /** Edit subject information in a index (PUT /v0/indices/{index_id}/subjects/{subject_id}) */
  async editIndexSubjectsByIndexIdAndSubjectID(
    index_id: OperationPath<'editIndexSubjectsByIndexIdAndSubjectID'>['index_id'],
    subject_id: OperationPath<'editIndexSubjectsByIndexIdAndSubjectID'>['subject_id'],
    body?: OperationBody<'editIndexSubjectsByIndexIdAndSubjectID'>,
  ): Promise<OperationResponse<'editIndexSubjectsByIndexIdAndSubjectID'>> {
    return this.transport.request<OperationResponse<'editIndexSubjectsByIndexIdAndSubjectID'>>({
      method: 'PUT',
      path: `/v0/indices/${encodeURIComponent(String(index_id))}/subjects/${encodeURIComponent(String(subject_id))}`,
      body: body as unknown,
    });
  }

  /** Delete a subject from a Index (DELETE /v0/indices/{index_id}/subjects/{subject_id}) */
  async delelteSubjectFromIndexByIndexIdAndSubjectID(
    index_id: OperationPath<'delelteSubjectFromIndexByIndexIdAndSubjectID'>['index_id'],
    subject_id: OperationPath<'delelteSubjectFromIndexByIndexIdAndSubjectID'>['subject_id'],
  ): Promise<OperationResponse<'delelteSubjectFromIndexByIndexIdAndSubjectID'>> {
    return this.transport.request<
      OperationResponse<'delelteSubjectFromIndexByIndexIdAndSubjectID'>
    >({
      method: 'DELETE',
      path: `/v0/indices/${encodeURIComponent(String(index_id))}/subjects/${encodeURIComponent(String(subject_id))}`,
    });
  }

  /** Collect index for current user (POST /v0/indices/{index_id}/collect) */
  async collectIndexByIndexIdAndUserId(
    index_id: OperationPath<'collectIndexByIndexIdAndUserId'>['index_id'],
  ): Promise<OperationResponse<'collectIndexByIndexIdAndUserId'>> {
    return this.transport.request<OperationResponse<'collectIndexByIndexIdAndUserId'>>({
      method: 'POST',
      path: `/v0/indices/${encodeURIComponent(String(index_id))}/collect`,
    });
  }

  /** Uncollect index for current user (DELETE /v0/indices/{index_id}/collect) */
  async uncollectIndexByIndexIdAndUserId(
    index_id: OperationPath<'uncollectIndexByIndexIdAndUserId'>['index_id'],
  ): Promise<OperationResponse<'uncollectIndexByIndexIdAndUserId'>> {
    return this.transport.request<OperationResponse<'uncollectIndexByIndexIdAndUserId'>>({
      method: 'DELETE',
      path: `/v0/indices/${encodeURIComponent(String(index_id))}/collect`,
    });
  }
}
