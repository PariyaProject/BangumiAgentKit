import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { GeneratedBangumiOpenApiClient, Character } from '@bangumi-agent-kit/bangumi-openapi';
import {
  DomainCharacter,
  CharacterRelationSubject,
  CharacterRelatedPerson,
} from '../models/character.js';
import { CharacterCandidate, SearchResult } from '../results/result.js';

export function mapCharacter(raw: Character | any): DomainCharacter {
  return {
    id: raw.id,
    name: raw.name || '',
    roleName: raw.role_name || undefined,
    type: raw.type || 1,
    summary: raw.summary || '',
    images: raw.images,
    comment: raw.comment ?? undefined,
    collects: raw.collects ?? undefined,
  };
}

export function mapCharacterCandidate(raw: Character | any): CharacterCandidate {
  const image =
    raw.images?.medium ||
    raw.images?.common ||
    raw.images?.small ||
    raw.images?.grid ||
    raw.images?.large;
  return {
    id: raw.id,
    name: raw.name || '',
    type: raw.type || 1,
    image,
    relationHint: raw.role_name || undefined,
  };
}

export interface SearchCharactersOptions {
  limit?: number;
  offset?: number;
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

    const res = await this.api.searchCharacters({ limit, offset }, { keyword: query });

    const data = res.data || [];
    const candidates = data.map(mapCharacterCandidate);

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
    return items.map((item: any) => ({
      id: item.id,
      name: item.name || '',
      nameCn: item.name_cn || item.name || '',
      staffRole: item.staff || item.role_name,
    }));
  }

  async getCharacterRelatedPersons(
    characterId: number,
    limit = 20,
  ): Promise<CharacterRelatedPerson[]> {
    const raw = await this.api.getRelatedPersonsByCharacterId(characterId);
    const items = (raw || []).slice(0, limit);
    return items.map((item: any) => ({
      id: item.id,
      name: item.name || '',
      roleName: item.role_name || item.type,
    }));
  }

  async getSubjectCharacters(subjectId: number): Promise<DomainCharacter[]> {
    const raw = await this.api.getRelatedCharactersBySubjectId(subjectId);
    return (raw || []).map(mapCharacter);
  }
}
