import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { DomainIndex } from '../models/domain-index.js';

export class IndexWriteService {
  constructor(private client: HttpClient) {}

  async createIndex(title: string, desc: string, accessToken: string): Promise<DomainIndex> {
    const raw = await this.client.request<any>({
      method: 'POST',
      path: '/v0/indices',
      accessToken,
      body: { title, desc },
    });

    return {
      id: raw.id,
      title: raw.title || title,
      desc: raw.desc || desc,
      total: 0,
      collects: 0,
      comments: 0,
      createdAt: raw.created_at || new Date().toISOString(),
    };
  }

  async editIndex(indexId: number, title: string, desc: string, accessToken: string): Promise<void> {
    await this.client.request<any>({
      method: 'PUT',
      path: `/v0/indices/${indexId}`,
      accessToken,
      body: { title, desc },
    });
  }

  async addSubjectToIndex(indexId: number, subjectId: number, comment?: string, accessToken?: string): Promise<void> {
    await this.client.request<any>({
      method: 'POST',
      path: `/v0/indices/${indexId}/subjects`,
      accessToken,
      body: { subject_id: subjectId, comment },
    });
  }

  async removeSubjectFromIndex(indexId: number, subjectId: number, accessToken?: string): Promise<void> {
    await this.client.request<any>({
      method: 'DELETE',
      path: `/v0/indices/${indexId}/subjects/${subjectId}`,
      accessToken,
    });
  }

  async collectIndex(indexId: number, accessToken: string): Promise<void> {
    await this.client.request<any>({
      method: 'POST',
      path: `/v0/indices/${indexId}/collect`,
      accessToken,
    });
  }

  async uncollectIndex(indexId: number, accessToken: string): Promise<void> {
    await this.client.request<any>({
      method: 'DELETE',
      path: `/v0/indices/${indexId}/collect`,
      accessToken,
    });
  }
}
