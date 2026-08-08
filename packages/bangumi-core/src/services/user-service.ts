import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { GeneratedBangumiOpenApiClient, User } from '@bangumi-agent-kit/bangumi-openapi';
import { DomainUser, UserCollectionItem } from '../models/user.js';
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
    } = {},
  ): Promise<{
    total: number;
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

    const res = await this.api.getUserCollectionsByUsername(username, {
      subject_type: subjectTypeNum as any,
      type: typeNum as any,
      limit,
      offset,
    });

    const data = res.data || [];
    const items = data.map((col: Record<string, unknown>) => {
      const colSubject = col.subject as Record<string, unknown> | undefined;
      const status = mapCollectionStatus(col.type as number | string);
      const subjectTypeStr = mapSubjectType(colSubject?.type as number | undefined);
      const statusLabel = getCollectionStatusLabel(subjectTypeStr, status);

      return {
        subjectId: Number(col.subject_id || 0),
        subjectName: colSubject?.name as string | undefined,
        subjectNameCn: (colSubject?.name_cn || colSubject?.name) as string | undefined,
        status,
        statusLabel,
        rating: col.rate as number | undefined,
        comment: col.comment as string | undefined,
        tags: col.tags as string[] | undefined,
        epStatus: col.ep_status as number | undefined,
        updatedAt: col.updated_at as string | undefined,
      };
    });

    return {
      total: res.total || items.length,
      limit: res.limit || limit,
      offset: res.offset || offset,
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
      const subjectTypeStr = mapSubjectType(raw.subject?.type);
      const statusLabel = getCollectionStatusLabel(subjectTypeStr, status);

      return {
        found: true,
        collection: {
          subjectId: raw.subject_id,
          subjectName: raw.subject?.name,
          subjectNameCn: raw.subject?.name_cn || raw.subject?.name,
          status,
          statusLabel,
          rating: raw.rate,
          comment: raw.comment,
          tags: raw.tags,
          epStatus: raw.ep_status,
          updatedAt: raw.updated_at,
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
}
