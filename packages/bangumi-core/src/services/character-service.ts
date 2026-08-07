import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { DomainCharacter, CharacterRelationSubject, CharacterRelatedPerson } from '../models/character.js';

function mapCharacter(raw: any): DomainCharacter {
  return {
    id: raw.id,
    name: raw.name || '',
    roleName: raw.role_name,
    type: raw.type || 1,
    summary: raw.summary || '',
    images: raw.images,
    comment: raw.comment,
    collects: raw.collects,
  };
}

export class CharacterService {
  constructor(private client: HttpClient) {}

  async getCharacterById(characterId: number): Promise<DomainCharacter> {
    const raw = await this.client.request<any>({
      method: 'GET',
      path: `/v0/characters/${characterId}`,
      cacheContext: {
        operationId: 'getCharacterById',
        pathParams: { characterId },
      },
      cacheTtlSeconds: 300,
    });

    return mapCharacter(raw);
  }

  async getCharacterRelatedSubjects(characterId: number): Promise<CharacterRelationSubject[]> {
    const raw = await this.client.request<any[]>({
      method: 'GET',
      path: `/v0/characters/${characterId}/subjects`,
      cacheContext: {
        operationId: 'getRelatedSubjectsByCharacterId',
        pathParams: { characterId },
      },
      cacheTtlSeconds: 300,
    });

    return (raw || []).map((item: any) => ({
      id: item.id,
      name: item.name || '',
      nameCn: item.name_cn || item.name || '',
      staffRole: item.staff || item.role_name,
    }));
  }

  async getCharacterRelatedPersons(characterId: number): Promise<CharacterRelatedPerson[]> {
    const raw = await this.client.request<any[]>({
      method: 'GET',
      path: `/v0/characters/${characterId}/persons`,
      cacheContext: {
        operationId: 'getRelatedPersonsByCharacterId',
        pathParams: { characterId },
      },
      cacheTtlSeconds: 300,
    });

    return (raw || []).map((item: any) => ({
      id: item.id,
      name: item.name || '',
      roleName: item.role_name || item.type,
    }));
  }

  async getSubjectCharacters(subjectId: number): Promise<DomainCharacter[]> {
    const raw = await this.client.request<any[]>({
      method: 'GET',
      path: `/v0/subjects/${subjectId}/characters`,
      cacheContext: {
        operationId: 'getRelatedCharactersBySubjectId',
        pathParams: { subjectId },
      },
      cacheTtlSeconds: 300,
    });

    return (raw || []).map(mapCharacter);
  }
}
