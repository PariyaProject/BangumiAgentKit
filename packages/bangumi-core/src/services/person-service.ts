import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { GeneratedBangumiOpenApiClient, Person } from '@bangumi-agent-kit/bangumi-openapi';
import { DomainPerson, PersonRelationSubject } from '../models/person.js';
import { PersonCandidate, SearchResult } from '../results/result.js';

export function mapPerson(raw: Person | any): DomainPerson {
  return {
    id: raw.id,
    name: raw.name || '',
    type: raw.type || 1,
    career: Array.isArray(raw.career) ? raw.career : [],
    summary: raw.summary || '',
    images: raw.images,
  };
}

export function mapPersonCandidate(raw: Person | any): PersonCandidate {
  const image =
    raw.images?.medium ||
    raw.images?.common ||
    raw.images?.small ||
    raw.images?.grid ||
    raw.images?.large;
  return {
    id: raw.id,
    name: raw.name || '',
    career: Array.isArray(raw.career) ? raw.career : [],
    image,
  };
}

export interface SearchPersonsOptions {
  limit?: number;
  offset?: number;
}

export class PersonService {
  private api: GeneratedBangumiOpenApiClient;

  constructor(client: GeneratedBangumiOpenApiClient | HttpClient) {
    if (client instanceof GeneratedBangumiOpenApiClient) {
      this.api = client;
    } else {
      this.api = new GeneratedBangumiOpenApiClient(client);
    }
  }

  async searchPersons(
    query: string,
    options: SearchPersonsOptions = {},
  ): Promise<SearchResult<PersonCandidate>> {
    const limit = options.limit ?? 10;
    const offset = options.offset ?? 0;

    const res = await this.api.searchPersons({ limit, offset }, { keyword: query });

    const data = res.data || [];
    const candidates = data.map(mapPersonCandidate);

    return {
      status: candidates.length === 0 ? 'not_found' : 'disambiguation',
      query,
      total: res.total || 0,
      limit: res.limit || limit,
      offset: res.offset || offset,
      candidates,
      meta: { source: 'bangumi-v0' },
    };
  }

  async getPersonById(personId: number): Promise<DomainPerson> {
    const raw = await this.api.getPersonById(personId);
    return mapPerson(raw);
  }

  async getPersonRelatedSubjects(personId: number, limit = 20): Promise<PersonRelationSubject[]> {
    const raw = await this.api.getRelatedSubjectsByPersonId(personId);
    const items = (raw || []).slice(0, limit);
    return items.map((item: any) => ({
      id: item.id,
      name: item.name || '',
      nameCn: item.name_cn || item.name || '',
      staffRole: item.staff || item.type,
    }));
  }

  async getPersonRelatedCharacters(personId: number, limit = 20): Promise<any[]> {
    const raw = await this.api.getRelatedCharactersByPersonId(personId);
    const items = (raw || []).slice(0, limit);
    return items.map((item: any) => ({
      id: item.id,
      name: item.name || '',
      type: item.type,
      subjectId: item.subject_id,
      subjectName: item.subject_name,
    }));
  }

  async getSubjectPersons(subjectId: number): Promise<DomainPerson[]> {
    const raw = await this.api.getRelatedPersonsBySubjectId(subjectId);
    return (raw || []).map(mapPerson);
  }
}
