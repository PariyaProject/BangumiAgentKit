import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  GeneratedBangumiOpenApiClient,
  OperationQuery,
  User,
  SubjectType as OpenApiSubjectType,
} from '@bangumi-agent-kit/bangumi-openapi';
import {
  DomainUser,
  UserCharacterCollectionItem,
  UserCollectionItem,
  UserEpisodeCollectionItem,
  UserPersonCollectionItem,
} from '../models/user.js';
import { mapEpisode } from './episode-service.js';
import { getCollectionStatusLabel, mapCollectionStatus } from './collection-service.js';
import { mapSubjectType } from './subject-service.js';

export function mapUser(raw: User, defaultUsername?: string): DomainUser {
  return {
    id: raw.id,
    username: raw.username || defaultUsername || String(raw.id),
    nickname: raw.nickname || raw.username || defaultUsername || String(raw.id),
    avatar: raw.avatar ? (raw.avatar as Record<string, string>) : undefined,
    sign: raw.sign || undefined,
  };
}

function mapSubjectEpisodeTotal(subject: unknown): {
  value?: number;
  raw?: number | string | null;
  validity: 'valid' | 'missing' | 'unknown' | 'invalid';
} {
  const raw =
    subject && typeof subject === 'object' ? (subject as { eps?: unknown }).eps : undefined;
  if (raw === undefined || raw === null) {
    return { validity: 'missing', raw: raw === null ? null : undefined };
  }
  if (raw === 0) return { validity: 'unknown', raw: 0 };
  if (typeof raw === 'number' && Number.isSafeInteger(raw) && raw > 0) {
    return { value: raw, raw, validity: 'valid' };
  }
  return {
    raw: typeof raw === 'number' || typeof raw === 'string' ? raw : undefined,
    validity: 'invalid',
  };
}

function mapCollectionImages(
  images: Record<string, string> | null | undefined,
): Record<string, string> | undefined {
  return images ? { ...images } : undefined;
}

function mapUserCharacterCollection(raw: {
  id: number;
  name: string;
  type: number;
  images?: Record<string, string> | null;
  created_at: string;
}): UserCharacterCollectionItem {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    images: mapCollectionImages(raw.images),
    createdAt: raw.created_at,
  };
}

function mapUserPersonCollection(raw: {
  id: number;
  name: string;
  type: number;
  career: string[];
  images?: Record<string, string> | null;
  created_at: string;
}): UserPersonCollectionItem {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    career: [...raw.career],
    images: mapCollectionImages(raw.images),
    createdAt: raw.created_at,
  };
}

function mapUserCollectionPage<T>(
  total: number,
  limit: number,
  offset: number,
  data: T[],
  maxItems: number,
): {
  total?: number;
  limit: number;
  offset: number;
  items: T[];
  observed: number;
  returned: number;
  truncated: boolean;
} {
  const responseTotal = Number.isInteger(total) && total >= data.length ? total : undefined;
  const responseLimit = Number.isInteger(limit) && limit >= 0 ? limit : data.length;
  const responseOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0;
  const items = data.slice(0, maxItems);
  return {
    total: responseTotal,
    limit: responseLimit,
    offset: responseOffset,
    items,
    observed: data.length,
    returned: items.length,
    truncated:
      items.length < data.length || (responseTotal !== undefined && data.length < responseTotal),
  };
}

export class UserService {
  private api: GeneratedBangumiOpenApiClient;

  constructor(client: GeneratedBangumiOpenApiClient | HttpClient) {
    if (client instanceof GeneratedBangumiOpenApiClient) {
      this.api = client;
    } else {
      this.api = new GeneratedBangumiOpenApiClient(client);
    }
  }

  async getUserByName(username: string): Promise<DomainUser> {
    const raw = await this.api.getUserByName(username);
    return mapUser(raw, username);
  }

  async getMyself(): Promise<DomainUser> {
    const raw = await this.api.getMyself();
    return mapUser(raw);
  }

  async getUserCollections(
    username: string,
    options: {
      subjectType?: number | string;
      type?: number | string;
      limit?: number;
      offset?: number;
      signal?: AbortSignal;
    } = {},
  ): Promise<{
    total?: number;
    limit: number;
    offset: number;
    items: (UserCollectionItem & { statusLabel: string })[];
  }> {
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;

    let subjectTypeNum: number | undefined;
    if (typeof options.subjectType === 'number') {
      subjectTypeNum = options.subjectType;
    } else if (typeof options.subjectType === 'string') {
      const map: Record<string, number> = { book: 1, anime: 2, music: 3, game: 4, real: 6 };
      subjectTypeNum = map[options.subjectType.toLowerCase()];
    }

    let typeNum: number | undefined;
    if (typeof options.type === 'number') {
      typeNum = options.type;
    } else if (typeof options.type === 'string') {
      const map: Record<string, number> = { wish: 1, done: 2, doing: 3, on_hold: 4, dropped: 5 };
      typeNum = map[options.type.toLowerCase()];
    }

    const res = await this.api.getUserCollectionsByUsername(
      username,
      {
        subject_type: subjectTypeNum as OpenApiSubjectType | undefined,
        type: typeNum as 1 | 2 | 3 | 4 | 5 | undefined,
        limit,
        offset,
      },
      { signal: options.signal },
    );

    const data = res.data || [];
    const items = data.map((col) => {
      const status = mapCollectionStatus(col.type);
      const subjectTypeStr = mapSubjectType(col.subject_type ?? col.subject?.type);
      const statusLabel = getCollectionStatusLabel(subjectTypeStr, status);
      const subjectEpisodeTotal = mapSubjectEpisodeTotal(col.subject);

      return {
        subjectId: col.subject_id,
        subjectName: col.subject?.name,
        subjectNameCn: col.subject?.name_cn || col.subject?.name,
        subjectType: subjectTypeStr,
        status,
        statusLabel,
        rating: col.rate,
        comment: col.comment,
        tags: col.tags,
        epStatus: col.ep_status,
        updatedAt: col.updated_at,
        subjectDate: col.subject?.date || undefined,
        subjectImage:
          col.subject?.images?.large || col.subject?.images?.common || col.subject?.images?.medium,
        subjectTotalEpisodes: subjectEpisodeTotal.value,
        subjectTotalEpisodesRaw: subjectEpisodeTotal.raw,
        subjectTotalEpisodesValidity: subjectEpisodeTotal.validity,
      };
    });

    const responseOffset = Number.isInteger(res.offset) && res.offset >= 0 ? res.offset : offset;
    const responseLimit = Number.isInteger(res.limit) && res.limit > 0 ? res.limit : limit;
    const responseTotal =
      Number.isInteger(res.total) && res.total >= responseOffset + items.length
        ? res.total
        : undefined;

    return {
      total: responseTotal,
      limit: responseLimit,
      offset: responseOffset,
      items,
    };
  }

  async getUserSubjectCollection(
    username: string,
    subjectId: number,
  ): Promise<{ found: boolean; collection?: UserCollectionItem & { statusLabel: string } }> {
    try {
      const raw = await this.api.getUserCollection(username, subjectId);
      const status = mapCollectionStatus(raw.type);
      const subjectTypeStr = mapSubjectType(raw.subject_type ?? raw.subject?.type);
      const statusLabel = getCollectionStatusLabel(subjectTypeStr, status);
      const subjectEpisodeTotal = mapSubjectEpisodeTotal(raw.subject);

      return {
        found: true,
        collection: {
          subjectId: raw.subject_id,
          subjectName: raw.subject?.name,
          subjectNameCn: raw.subject?.name_cn || raw.subject?.name,
          subjectType: subjectTypeStr,
          status,
          statusLabel,
          rating: raw.rate,
          comment: raw.comment,
          tags: raw.tags,
          epStatus: raw.ep_status,
          updatedAt: raw.updated_at,
          subjectDate: raw.subject?.date || undefined,
          subjectImage:
            raw.subject?.images?.large ||
            raw.subject?.images?.common ||
            raw.subject?.images?.medium,
          subjectTotalEpisodes: subjectEpisodeTotal.value,
          subjectTotalEpisodesRaw: subjectEpisodeTotal.raw,
          subjectTotalEpisodesValidity: subjectEpisodeTotal.validity,
        },
      };
    } catch (err: unknown) {
      const errorObj = err as { status?: number; code?: string; statusCode?: number };
      if (
        errorObj?.status === 404 ||
        errorObj?.code === 'NOT_FOUND' ||
        errorObj?.statusCode === 404
      ) {
        return { found: false };
      }
      throw err;
    }
  }

  async getUserEpisodeCollections(
    subjectId: number,
    options: {
      episodeType?: OperationQuery<'getUserSubjectEpisodeCollection'>['episode_type'];
      limit?: number;
      offset?: number;
      signal?: AbortSignal;
    } = {},
  ): Promise<{
    total?: number;
    limit: number;
    offset: number;
    items: UserEpisodeCollectionItem[];
  }> {
    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;
    const res = await this.api.getUserSubjectEpisodeCollection(
      subjectId,
      {
        episode_type: options.episodeType,
        limit,
        offset,
      },
      { signal: options.signal },
    );
    const data = res.data || [];
    const items = data.map((item) => ({
      episode: item.episode ? mapEpisode(item.episode, subjectId) : undefined,
      type: item.type,
      updatedAt:
        Number.isInteger(item.updated_at) && item.updated_at > 0 ? item.updated_at : undefined,
    }));
    const responseOffset = Number.isInteger(res.offset) && res.offset >= 0 ? res.offset : offset;
    const responseLimit = Number.isInteger(res.limit) && res.limit > 0 ? res.limit : limit;
    const responseTotal =
      Number.isInteger(res.total) && res.total >= responseOffset + items.length
        ? res.total
        : undefined;

    return {
      total: responseTotal,
      limit: responseLimit,
      offset: responseOffset,
      items,
    };
  }

  async getUserCharacterCollections(
    username: string,
    options: { maxItems?: number; signal?: AbortSignal } = {},
  ): Promise<{
    total?: number;
    limit: number;
    offset: number;
    items: UserCharacterCollectionItem[];
    observed: number;
    returned: number;
    truncated: boolean;
  }> {
    const maxItems = options.maxItems ?? 50;
    const res = await this.api.getUserCharacterCollections(username);
    const data = res.data || [];
    return mapUserCollectionPage(
      res.total,
      res.limit,
      res.offset,
      data.map(mapUserCharacterCollection),
      maxItems,
    );
  }

  async getUserCharacterCollection(
    username: string,
    characterId: number,
  ): Promise<{ found: boolean; item?: UserCharacterCollectionItem }> {
    try {
      const raw = await this.api.getUserCharacterCollection(username, characterId);
      return { found: true, item: mapUserCharacterCollection(raw) };
    } catch (err: unknown) {
      const errorObj = err as { status?: number; code?: string; statusCode?: number };
      if (
        errorObj?.status === 404 ||
        errorObj?.code === 'NOT_FOUND' ||
        errorObj?.statusCode === 404
      ) {
        return { found: false };
      }
      throw err;
    }
  }

  async getUserPersonCollections(
    username: string,
    options: { maxItems?: number; signal?: AbortSignal } = {},
  ): Promise<{
    total?: number;
    limit: number;
    offset: number;
    items: UserPersonCollectionItem[];
    observed: number;
    returned: number;
    truncated: boolean;
  }> {
    const maxItems = options.maxItems ?? 50;
    const res = await this.api.getUserPersonCollections(username);
    const data = res.data || [];
    return mapUserCollectionPage(
      res.total,
      res.limit,
      res.offset,
      data.map(mapUserPersonCollection),
      maxItems,
    );
  }

  async getUserPersonCollection(
    username: string,
    personId: number,
  ): Promise<{ found: boolean; item?: UserPersonCollectionItem }> {
    try {
      const raw = await this.api.getUserPersonCollection(username, personId);
      return { found: true, item: mapUserPersonCollection(raw) };
    } catch (err: unknown) {
      const errorObj = err as { status?: number; code?: string; statusCode?: number };
      if (
        errorObj?.status === 404 ||
        errorObj?.code === 'NOT_FOUND' ||
        errorObj?.statusCode === 404
      ) {
        return { found: false };
      }
      throw err;
    }
  }
}
