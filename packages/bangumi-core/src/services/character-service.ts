import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { GeneratedBangumiOpenApiClient, Character } from '@bangumi-agent-kit/bangumi-openapi';
import {
  DomainCharacter,
  DomainRelatedCharacter,
  CharacterRelationSubject,
  CharacterRelatedPerson,
  SubjectCharactersCoverage,
  SubjectCharactersResult,
} from '../models/character.js';
import { CharacterCandidate, SearchResult, SearchStatus } from '../results/result.js';
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

interface ValidSubjectCharacterRow {
  id: number;
  name: string;
  type: number;
  summary: string;
  images?: Record<string, string>;
  relation: string;
  actors: Array<{
    id: number;
    name: string;
    career: string[];
    images?: Record<string, string>;
  }>;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function imageMap(value: unknown): value is Record<string, string> {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.values(value as Record<string, unknown>).every((item) => typeof item === 'string'))
  );
}

function validActor(value: unknown): value is ValidSubjectCharacterRow['actors'][number] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    positiveInteger(row.id) &&
    typeof row.name === 'string' &&
    Array.isArray(row.career) &&
    row.career.every((item) => typeof item === 'string') &&
    imageMap(row.images)
  );
}

function validSubjectCharacter(value: unknown): value is ValidSubjectCharacterRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    positiveInteger(row.id) &&
    typeof row.name === 'string' &&
    typeof row.type === 'number' &&
    Number.isInteger(row.type) &&
    row.type >= 1 &&
    row.type <= 4 &&
    typeof row.summary === 'string' &&
    typeof row.relation === 'string' &&
    Array.isArray(row.actors) &&
    row.actors.every(validActor) &&
    imageMap(row.images)
  );
}

function countInvalidActorIds(rows: readonly unknown[]): number {
  let count = 0;
  for (const value of rows) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const actors = (value as Record<string, unknown>).actors;
    if (!Array.isArray(actors)) continue;
    count += actors.filter((actor) => {
      if (!actor || typeof actor !== 'object' || Array.isArray(actor)) return true;
      return !positiveInteger((actor as Record<string, unknown>).id);
    }).length;
  }
  return count;
}

const subjectCharacterCoverage = new WeakMap<DomainRelatedCharacter[], SubjectCharactersCoverage>();

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

  async getSubjectCharacters(
    subjectId: number,
    options: { limit?: number; maxResponseBytes?: number } = {},
  ): Promise<DomainRelatedCharacter[]> {
    const result = await this.getSubjectCharactersWithCoverage(subjectId, options);
    subjectCharacterCoverage.set(result.items, result.coverage);
    return result.items;
  }

  async getSubjectCharactersWithCoverage(
    subjectId: number,
    options: { limit?: number; maxResponseBytes?: number } = {},
  ): Promise<SubjectCharactersResult> {
    const raw = await this.api.getRelatedCharactersBySubjectId(subjectId, {
      ...(options.maxResponseBytes === undefined
        ? {}
        : { maxResponseBytes: options.maxResponseBytes }),
    });
    const rawRows = Array.isArray(raw) ? raw : [];
    const validRows = rawRows.filter(validSubjectCharacter);
    const schemaDriftRows = Array.isArray(raw) ? rawRows.length - validRows.length : 1;
    const invalidActorIdRows = countInvalidActorIds(rawRows);
    const limit = Math.max(0, Math.floor(options.limit ?? Number.MAX_SAFE_INTEGER));
    const selectedRows = validRows.slice(0, limit);
    const items = selectedRows.map((item) => ({
      character: {
        id: item.id,
        name: item.name,
        type: item.type,
        summary: item.summary,
        ...(item.images === undefined || item.images === null ? {} : { images: item.images }),
      },
      relation: item.relation,
      actors: item.actors.map((actor) => ({
        id: actor.id,
        name: actor.name,
        career: [...actor.career],
        ...(actor.images
          ? {
              image:
                actor.images.medium ||
                actor.images.small ||
                actor.images.grid ||
                actor.images.large,
            }
          : {}),
      })),
    }));
    return {
      items,
      coverage: {
        observed: rawRows.length,
        returned: items.length,
        truncated: validRows.length > selectedRows.length || schemaDriftRows > 0,
        schemaDriftRows,
        invalidActorIdRows,
      },
    };
  }
}

export function getSubjectCharacterCoverage(
  items: readonly DomainRelatedCharacter[],
): SubjectCharactersCoverage | undefined {
  return subjectCharacterCoverage.get(items as DomainRelatedCharacter[]);
}
