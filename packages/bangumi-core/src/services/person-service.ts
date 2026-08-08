import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { GeneratedBangumiOpenApiClient, Person } from '@bangumi-agent-kit/bangumi-openapi';
import { DomainPerson, PersonRelationSubject } from '../models/person.js';
import { PersonCandidate, SearchResult, SearchStatus } from '../results/result.js';
import { normalizeSearchText } from '../workflows/resolve-subject.js';

export function mapPerson(raw: Person | Record<string, unknown>): DomainPerson {
  const item = raw as Record<string, unknown>;
  return {
    id: Number(item.id || 0),
    name: String(item.name || ''),
    type: Number(item.type || 1),
    career: Array.isArray(item.career) ? (item.career as string[]) : [],
    summary: String(item.short_summary || item.summary || ''),
    images: item.images ? (item.images as Record<string, string>) : undefined,
  };
}

export function mapPersonCandidate(raw: Person | Record<string, unknown>): PersonCandidate {
  const item = raw as Record<string, unknown>;
  const images = item.images as Record<string, string> | undefined;
  const image = images?.medium || images?.small || images?.grid || images?.large;
  return {
    id: Number(item.id || 0),
    name: String(item.name || ''),
    career: Array.isArray(item.career) ? (item.career as string[]) : [],
    image,
  };
}

export interface SearchPersonsOptions {
  limit?: number;
  offset?: number;
}

export interface PersonRelationCharacter {
  id: number;
  name: string;
  type?: number;
  subjectId?: number;
  subjectName?: string;
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

    const normQuery = normalizeSearchText(query);
    const exactMatches = candidates.filter(
      (c: PersonCandidate) => normalizeSearchText(c.name) === normQuery,
    );

    let status: SearchStatus = 'disambiguation';
    let exact: PersonCandidate | undefined;

    if (candidates.length === 0) {
      status = 'not_found';
    } else if (exactMatches.length === 1) {
      status = 'exact';
      exact = exactMatches[0];
    } else if (exactMatches.length > 1) {
      status = 'disambiguation';
    } else if (candidates.length === 1) {
      status = 'exact';
      exact = candidates[0];
    } else {
      status = 'disambiguation';
    }

    return {
      status,
      query,
      total: res.total || 0,
      limit: res.limit || limit,
      offset: res.offset || offset,
      exact,
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
    return items.map((item: Record<string, unknown>) => ({
      id: Number(item.id || 0),
      name: String(item.name || ''),
      nameCn: String(item.name_cn || item.name || ''),
      staffRole: (item.staff as string) || (typeof item.type === 'string' ? item.type : undefined),
    }));
  }

  async getPersonRelatedCharacters(
    personId: number,
    limit = 20,
  ): Promise<PersonRelationCharacter[]> {
    const raw = await this.api.getRelatedCharactersByPersonId(personId);
    const items = (raw || []).slice(0, limit);
    return items.map((item: Record<string, unknown>) => ({
      id: Number(item.id || 0),
      name: String(item.name || ''),
      type: item.type as number | undefined,
      subjectId: item.subject_id as number | undefined,
      subjectName: item.subject_name as string | undefined,
    }));
  }

  async getSubjectPersons(subjectId: number): Promise<DomainPerson[]> {
    const raw = await this.api.getRelatedPersonsBySubjectId(subjectId);
    return (raw || []).map((item: Record<string, unknown>) => ({
      id: Number(item.id || 0),
      name: String(item.name || ''),
      type: Number(item.type || 1),
      career: Array.isArray(item.career) ? (item.career as string[]) : [],
      summary: '',
      images: item.images ? (item.images as Record<string, string>) : undefined,
    }));
  }
}
