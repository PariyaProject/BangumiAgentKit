import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { DomainRevision } from '../models/revision.js';

function mapRevision(raw: any): DomainRevision {
  return {
    id: raw.id,
    type: raw.type || 0,
    summary: raw.summary || '',
    createdAt: raw.created_at || '',
    data: raw.data,
  };
}

export class RevisionService {
  constructor(private client: HttpClient) {}

  async getSubjectRevisions(subjectId: number, options: { limit?: number; offset?: number } = {}): Promise<{ total: number; items: DomainRevision[] }> {
    const raw = await this.client.request<any>({
      method: 'GET',
      path: '/v0/revisions/subjects',
      query: {
        subject_id: subjectId,
        limit: options.limit ?? 10,
        offset: options.offset ?? 0,
      },
      cacheContext: {
        operationId: 'getSubjectRevisions',
        pathParams: { subjectId },
      },
      cacheTtlSeconds: 300,
    });

    const items = (raw.data || []).map(mapRevision);
    return { total: raw.total || items.length, items };
  }

  async getCharacterRevisions(characterId: number, options: { limit?: number; offset?: number } = {}): Promise<{ total: number; items: DomainRevision[] }> {
    const raw = await this.client.request<any>({
      method: 'GET',
      path: '/v0/revisions/characters',
      query: {
        character_id: characterId,
        limit: options.limit ?? 10,
        offset: options.offset ?? 0,
      },
      cacheContext: {
        operationId: 'getCharacterRevisions',
        pathParams: { characterId },
      },
      cacheTtlSeconds: 300,
    });

    const items = (raw.data || []).map(mapRevision);
    return { total: raw.total || items.length, items };
  }

  async getPersonRevisions(personId: number, options: { limit?: number; offset?: number } = {}): Promise<{ total: number; items: DomainRevision[] }> {
    const raw = await this.client.request<any>({
      method: 'GET',
      path: '/v0/revisions/persons',
      query: {
        person_id: personId,
        limit: options.limit ?? 10,
        offset: options.offset ?? 0,
      },
      cacheContext: {
        operationId: 'getPersonRevisions',
        pathParams: { personId },
      },
      cacheTtlSeconds: 300,
    });

    const items = (raw.data || []).map(mapRevision);
    return { total: raw.total || items.length, items };
  }
}
