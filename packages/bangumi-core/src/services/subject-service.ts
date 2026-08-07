import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { DomainSubject, SubjectSearchResult, SubjectRelationItem, SubjectType } from '../models/subject.js';

function mapSubjectType(typeNum: number): SubjectType {
  switch (typeNum) {
    case 1: return 'book';
    case 2: return 'anime';
    case 3: return 'music';
    case 4: return 'game';
    case 6: return 'real';
    default: return 'other';
  }
}

function mapSubject(raw: any): DomainSubject {
  return {
    id: raw.id,
    type: mapSubjectType(raw.type),
    name: raw.name || '',
    nameCn: raw.name_cn || raw.name || '',
    summary: raw.summary || '',
    nsfw: Boolean(raw.nsfw),
    locked: Boolean(raw.locked),
    date: raw.date,
    platform: raw.platform,
    images: raw.images,
    score: raw.rating?.score,
    rank: raw.rating?.rank,
    ratingTotal: raw.rating?.total,
    ratingCount: raw.rating?.count,
    collectionCounts: raw.collection ? {
      wish: raw.collection.wish || 0,
      collect: raw.collection.collect || 0,
      doing: raw.collection.doing || 0,
      onHold: raw.collection.on_hold || 0,
      dropped: raw.collection.dropped || 0,
    } : undefined,
    eps: raw.eps,
    totalEpisodes: raw.total_episodes,
  };
}

export class SubjectService {
  constructor(private client: HttpClient) {}

  async searchSubjects(keyword: string, options: { limit?: number; offset?: number; type?: number } = {}): Promise<SubjectSearchResult> {
    const raw = await this.client.request<any>({
      method: 'POST',
      path: '/v0/search/subjects',
      query: {
        limit: options.limit ?? 10,
        offset: options.offset ?? 0,
      },
      body: {
        keyword,
        filter: options.type ? { type: [options.type] } : undefined,
      },
      cacheContext: {
        operationId: 'searchSubjects',
        queryParams: { keyword, ...options },
      },
      cacheTtlSeconds: 60,
    });

    return {
      total: raw.total || 0,
      limit: raw.limit || 10,
      offset: raw.offset || 0,
      items: (raw.data || []).map(mapSubject),
    };
  }

  async getSubjectById(subjectId: number): Promise<DomainSubject> {
    const raw = await this.client.request<any>({
      method: 'GET',
      path: `/v0/subjects/${subjectId}`,
      cacheContext: {
        operationId: 'getSubjectById',
        pathParams: { subjectId },
      },
      cacheTtlSeconds: 300,
    });

    return mapSubject(raw);
  }

  async getSubjectRelations(subjectId: number): Promise<SubjectRelationItem[]> {
    const raw = await this.client.request<any[]>({
      method: 'GET',
      path: `/v0/subjects/${subjectId}/subjects`,
      cacheContext: {
        operationId: 'getRelatedSubjectsBySubjectId',
        pathParams: { subjectId },
      },
      cacheTtlSeconds: 300,
    });

    return (raw || []).map((item: any) => ({
      id: item.id,
      type: mapSubjectType(item.type),
      name: item.name || '',
      nameCn: item.name_cn || item.name || '',
      relation: item.relation || '关联条目',
      images: item.images,
    }));
  }
}
