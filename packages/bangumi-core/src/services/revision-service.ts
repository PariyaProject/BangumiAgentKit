import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { GeneratedBangumiOpenApiClient, Revision } from '@bangumi-agent-kit/bangumi-openapi';
import { DomainRevision } from '../models/revision.js';

export function mapRevision(raw: Revision | any): DomainRevision {
  return {
    id: raw.id,
    type: raw.type || 0,
    summary: raw.summary || '',
    createdAt: raw.created_at || raw.createdAt || '',
    data: raw.data,
  };
}

export type RevisionEntityType = 'subject' | 'episode' | 'character' | 'person';

export class RevisionService {
  private api: GeneratedBangumiOpenApiClient;

  constructor(client: GeneratedBangumiOpenApiClient | HttpClient) {
    if (client instanceof GeneratedBangumiOpenApiClient) {
      this.api = client;
    } else {
      this.api = new GeneratedBangumiOpenApiClient(client);
    }
  }

  async listRevisions(
    entityType: RevisionEntityType,
    entityId: number,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ total: number; limit: number; offset: number; items: DomainRevision[] }> {
    const limit = options.limit ?? 10;
    const offset = options.offset ?? 0;

    let res: any;
    switch (entityType) {
      case 'subject':
        res = await this.api.getSubjectRevisions({ subject_id: entityId, limit, offset });
        break;
      case 'episode':
        res = await this.api.getEpisodeRevisions({ episode_id: entityId, limit, offset });
        break;
      case 'character':
        res = await this.api.getCharacterRevisions({ character_id: entityId, limit, offset });
        break;
      case 'person':
        res = await this.api.getPersonRevisions({ person_id: entityId, limit, offset });
        break;
      default:
        throw new Error(`Unsupported entityType: ${entityType}`);
    }

    const data = res.data || [];
    const items = data.map(mapRevision);
    return {
      total: res.total || items.length,
      limit: res.limit || limit,
      offset: res.offset || offset,
      items,
    };
  }

  async getSubjectRevisions(
    subjectId: number,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ total: number; items: DomainRevision[] }> {
    const res = await this.listRevisions('subject', subjectId, options);
    return { total: res.total, items: res.items };
  }

  async getRevision(entityType: RevisionEntityType, revisionId: number): Promise<DomainRevision> {
    let raw: any;
    switch (entityType) {
      case 'subject':
        raw = await this.api.getSubjectRevisionByRevisionId(revisionId);
        break;
      case 'episode':
        raw = await this.api.getEpisodeRevisionByRevisionId(revisionId);
        break;
      case 'character':
        raw = await this.api.getCharacterRevisionByRevisionId(revisionId);
        break;
      case 'person':
        raw = await this.api.getPersonRevisionByRevisionId(revisionId);
        break;
      default:
        throw new Error(`Unsupported entityType: ${entityType}`);
    }
    return mapRevision(raw);
  }
}
