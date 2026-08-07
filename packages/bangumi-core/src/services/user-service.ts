import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { DomainUser, UserCollectionItem } from '../models/user.js';

function mapCollectionStatus(statusType: number | string): UserCollectionItem['status'] {
  if (typeof statusType === 'string') {
    if (['wish', 'doing', 'done', 'on_hold', 'dropped'].includes(statusType)) {
      return statusType as UserCollectionItem['status'];
    }
  }
  switch (Number(statusType)) {
    case 1: return 'wish';
    case 2: return 'done';
    case 3: return 'doing';
    case 4: return 'on_hold';
    case 5: return 'dropped';
    default: return 'doing';
  }
}

export class UserService {
  constructor(private client: HttpClient) {}

  async getUserByName(username: string): Promise<DomainUser> {
    const raw = await this.client.request<any>({
      method: 'GET',
      path: `/v0/users/${username}`,
      cacheContext: {
        operationId: 'getUserByName',
        pathParams: { username },
      },
      cacheTtlSeconds: 300,
    });

    return {
      id: raw.id,
      username: raw.username || username,
      nickname: raw.nickname || raw.username || username,
      avatar: raw.avatar,
      sign: raw.sign,
    };
  }

  async getMyself(accessToken: string): Promise<DomainUser> {
    const raw = await this.client.request<any>({
      method: 'GET',
      path: '/v0/me',
      accessToken,
      cacheTtlSeconds: 0,
    });

    return {
      id: raw.id,
      username: raw.username,
      nickname: raw.nickname || raw.username,
      avatar: raw.avatar,
      sign: raw.sign,
    };
  }

  async getUserCollections(username: string, options: { subjectType?: number; type?: number; limit?: number; offset?: number } = {}): Promise<{ total: number; items: UserCollectionItem[] }> {
    const query: Record<string, unknown> = {
      limit: options.limit ?? 10,
      offset: options.offset ?? 0,
    };
    if (options.subjectType) query.subject_type = options.subjectType;
    if (options.type) query.type = options.type;

    const raw = await this.client.request<any>({
      method: 'GET',
      path: `/v0/users/${username}/collections`,
      query,
      cacheContext: {
        operationId: 'getUserCollectionsByUsername',
        pathParams: { username },
        queryParams: query,
      },
      cacheTtlSeconds: 120,
    });

    const items = (raw.data || []).map((col: any) => ({
      subjectId: col.subject_id,
      subjectName: col.subject?.name,
      subjectNameCn: col.subject?.name_cn || col.subject?.name,
      status: mapCollectionStatus(col.type),
      rating: col.rate,
      comment: col.comment,
      tags: col.tags,
      epStatus: col.ep_status,
      updatedAt: col.updated_at,
    }));

    return {
      total: raw.total || items.length,
      items,
    };
  }
}
