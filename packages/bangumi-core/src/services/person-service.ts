import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { DomainPerson, PersonRelationSubject } from '../models/person.js';

function mapPerson(raw: any): DomainPerson {
  return {
    id: raw.id,
    name: raw.name || '',
    type: raw.type || 1,
    career: Array.isArray(raw.career) ? raw.career : [],
    summary: raw.summary || '',
    images: raw.images,
  };
}

export class PersonService {
  constructor(private client: HttpClient) {}

  async getPersonById(personId: number): Promise<DomainPerson> {
    const raw = await this.client.request<any>({
      method: 'GET',
      path: `/v0/persons/${personId}`,
      cacheContext: {
        operationId: 'getPersonById',
        pathParams: { personId },
      },
      cacheTtlSeconds: 300,
    });

    return mapPerson(raw);
  }

  async getPersonRelatedSubjects(personId: number): Promise<PersonRelationSubject[]> {
    const raw = await this.client.request<any[]>({
      method: 'GET',
      path: `/v0/persons/${personId}/subjects`,
      cacheContext: {
        operationId: 'getRelatedSubjectsByPersonId',
        pathParams: { personId },
      },
      cacheTtlSeconds: 300,
    });

    return (raw || []).map((item: any) => ({
      id: item.id,
      name: item.name || '',
      nameCn: item.name_cn || item.name || '',
      staffRole: item.staff || item.type,
    }));
  }

  async getSubjectPersons(subjectId: number): Promise<DomainPerson[]> {
    const raw = await this.client.request<any[]>({
      method: 'GET',
      path: `/v0/subjects/${subjectId}/persons`,
      cacheContext: {
        operationId: 'getRelatedPersonsBySubjectId',
        pathParams: { subjectId },
      },
      cacheTtlSeconds: 300,
    });

    return (raw || []).map(mapPerson);
  }
}
