import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { GeneratedBangumiOpenApiClient, Index } from '@bangumi-agent-kit/bangumi-openapi';
import { DomainIndex, DomainIndexSubjectItem } from '../models/domain-index.js';

export function mapIndex(raw: Index | any): DomainIndex {
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

export class IndexReadService {
  private api: GeneratedBangumiOpenApiClient;

  constructor(client: GeneratedBangumiOpenApiClient | HttpClient) {
    if (client instanceof GeneratedBangumiOpenApiClient) {
      this.api = client;
    } else {
      this.api = new GeneratedBangumiOpenApiClient(client);
    }
  }

  async getIndexById(indexId: number): Promise<DomainIndex> {
    const raw = await this.api.getIndexById(indexId);
    return mapIndex(raw);
  }

  async getIndexSubjects(
    indexId: number,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ total: number; limit: number; offset: number; items: DomainIndexSubjectItem[] }> {
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;

    const res = await this.api.getIndexSubjectsByIndexId(indexId, { limit, offset });

    const data = res.data || [];
    const items = data.map((item: any) => ({
      id: item.id,
      name: item.name || '',
      nameCn: item.name_cn || item.name || '',
      order: item.order || 0,
      comment: item.comment || undefined,
    }));

    return {
      total: res.total || items.length,
      limit: res.limit || limit,
      offset: res.offset || offset,
      items,
    };
  }
}
