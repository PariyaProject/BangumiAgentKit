import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { DomainIndex, DomainIndexSubjectItem } from '../models/domain-index.js';

export class IndexReadService {
  constructor(private client: HttpClient) {}

  async getIndexById(indexId: number): Promise<DomainIndex> {
    const raw = await this.client.request<any>({
      method: 'GET',
      path: `/v0/indices/${indexId}`,
      cacheContext: {
        operationId: 'getIndexById',
        pathParams: { indexId },
      },
      cacheTtlSeconds: 300,
    });

    return {
      id: raw.id,
      title: raw.title || '',
      desc: raw.desc || '',
      total: raw.total || 0,
      collects: raw.stat?.collects || 0,
      comments: raw.stat?.comment || 0,
      createdAt: raw.created_at || '',
    };
  }

  async getIndexSubjects(indexId: number, options: { limit?: number; offset?: number } = {}): Promise<{ total: number; items: DomainIndexSubjectItem[] }> {
    const raw = await this.client.request<any>({
      method: 'GET',
      path: `/v0/indices/${indexId}/subjects`,
      query: {
        limit: options.limit ?? 10,
        offset: options.offset ?? 0,
      },
      cacheContext: {
        operationId: 'getIndexSubjectsByIndexId',
        pathParams: { indexId },
      },
      cacheTtlSeconds: 300,
    });

    const items = (raw.data || []).map((item: any) => ({
      id: item.id,
      name: item.name || '',
      nameCn: item.name_cn || item.name || '',
      order: item.order || 0,
      comment: item.comment,
    }));

    return {
      total: raw.total || items.length,
      items,
    };
  }
}
