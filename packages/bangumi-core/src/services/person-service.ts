import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  GeneratedBangumiOpenApiClient,
  Person,
} from '@bangumi-agent-kit/bangumi-openapi';
import { DomainPerson, PersonRelationSubject } from '../models/person.js';
import { PersonCandidate, SearchResult, SearchStatus } from '../results/result.js';
import { normalizeSearchText } from '../workflows/resolve-subject.js';

export function mapPerson(raw: {
  id: number;
  name?: string;
  type?: number;
  career?: string[];
  short_summary?: string;
  summary?: string;
  images?: Record<string, string>;
}): DomainPerson {
  return {
    id: raw.id,
    name: raw.name || '',
    type: raw.type || 1,
    career: (raw.career as string[]) || [],
    summary: raw.short_summary || raw.summary || '',
    images: raw.images ? (raw.images as Record<string, string>) : undefined,
  };
}

export function mapPersonCandidate(raw: {
  id: number;
  name?: string;
  career?: string[];
  images?: { large?: string; medium?: string; small?: string; grid?: string };
}): PersonCandidate {
  const image =
    raw.images?.medium || raw.images?.small || raw.images?.grid || raw.images?.large;
  return {
    id: raw.id,
    name: raw.name || '',
    career: (raw.career as string[]) || [],
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
    return items.map((item) => ({
      id: item.id,
      name: item.name || '',
      nameCn: item.name_cn || item.name || '',
      staffRole: item.staff || (typeof item.type === 'string' ? item.type : undefined),
    }));
  }

  async getPersonRelatedCharacters(
    personId: number,
    limit = 20,
  ): Promise<PersonRelationCharacter[]> {
    const raw = await this.api.getRelatedCharactersByPersonId(personId);
    const items = (raw || []).slice(0, limit);
    return items.map((item) => ({
      id: item.id,
      name: item.name || '',
      type: item.type,
      subjectId: item.subject_id,
      subjectName: item.subject_name,
    }));
  }

  async getSubjectPersons(subjectId: number): Promise<DomainPerson[]> {
    const raw = await this.api.getRelatedPersonsBySubjectId(subjectId);
    return (raw || []).map((item) => ({
      id: item.id,
      name: item.name || '',
      type: item.type || 1,
      career: item.career || [],
      summary: '',
      images: item.images ? (item.images as Record<string, string>) : undefined,
    }));
  }
}
