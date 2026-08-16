import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { GeneratedBangumiOpenApiClient, Character } from '@bangumi-agent-kit/bangumi-openapi';
import {
  DomainCharacter,
  DomainRelatedCharacter,
  CharacterRelationSubject,
  CharacterRelatedPerson,
} from '../models/character.js';
import { CharacterCandidate, SearchResult, SearchStatus } from '../results/result.js';
import { mapPersonCandidate } from './person-service.js';
import { normalizeSearchText } from '../workflows/resolve-subject.js';

export function mapCharacter(raw: Character): DomainCharacter {
  return {
    id: raw.id,
    name: raw.name || '',
    type: raw.type || 1,
    summary: raw.summary || '',
    images: raw.images ? (raw.images as Record<string, string>) : undefined,
  };
}

export function mapCharacterCandidate(raw: Character): CharacterCandidate {
  const image = raw.images?.medium || raw.images?.small || raw.images?.grid || raw.images?.large;
  return {
    id: raw.id,
    name: raw.name || '',
    type: raw.type || 1,
    image,
  };
}

export interface SearchCharactersOptions {
  limit?: number;
  offset?: number;
  nsfw?: boolean;
}

export class CharacterService {
  private api: GeneratedBangumiOpenApiClient;

  constructor(client: GeneratedBangumiOpenApiClient | HttpClient) {
    if (client instanceof GeneratedBangumiOpenApiClient) {
      this.api = client;
    } else {
      this.api = new GeneratedBangumiOpenApiClient(client);
    }
  }

  async searchCharacters(
    query: string,
    options: SearchCharactersOptions = {},
  ): Promise<SearchResult<CharacterCandidate>> {
    const limit = options.limit ?? 10;
    const offset = options.offset ?? 0;

    const res = await this.api.searchCharacters(
      { limit, offset },
      {
        keyword: query,
        ...(options.nsfw === undefined ? {} : { filter: { nsfw: options.nsfw } }),
      },
    );

    const data = res.data || [];
    const candidates = data.map(mapCharacterCandidate);

    const normQuery = normalizeSearchText(query);
    const exactMatches = candidates.filter((c) => normalizeSearchText(c.name) === normQuery);

    let status: SearchStatus = 'disambiguation';
    let exact: CharacterCandidate | undefined;

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

  async getCharacterById(characterId: number): Promise<DomainCharacter> {
    const raw = await this.api.getCharacterById(characterId);
    return mapCharacter(raw);
  }

  async getCharacterRelatedSubjects(
    characterId: number,
    limit = 20,
  ): Promise<CharacterRelationSubject[]> {
    const raw = await this.api.getRelatedSubjectsByCharacterId(characterId);
    const items = (raw || []).slice(0, limit);
    return items.map((item) => ({
      id: item.id,
      name: item.name || '',
      nameCn: item.name_cn || item.name || '',
      staffRole: item.staff,
    }));
  }

  async getCharacterRelatedPersons(
    characterId: number,
    limit = 20,
  ): Promise<CharacterRelatedPerson[]> {
    const raw = await this.api.getRelatedPersonsByCharacterId(characterId);
    const items = (raw || []).slice(0, limit);
    return items.map((item) => ({
      id: item.id,
      name: item.name || '',
      type: item.type,
      subjectId: item.subject_id,
      subjectType: item.subject_type,
      subjectName: item.subject_name || '',
      subjectNameCn: item.subject_name_cn || item.subject_name || '',
      staff: item.staff,
    }));
  }

  async getSubjectCharacters(subjectId: number): Promise<DomainRelatedCharacter[]> {
    const raw = await this.api.getRelatedCharactersBySubjectId(subjectId);
    return (raw || []).map((item) => ({
      character: {
        id: item.id,
        name: item.name || '',
        type: item.type || 1,
        summary: item.summary || undefined,
        images: item.images ? (item.images as Record<string, string>) : undefined,
      },
      relation: item.relation || '',
      actors: (item.actors || []).map((actor) => mapPersonCandidate(actor)),
    }));
  }
}
