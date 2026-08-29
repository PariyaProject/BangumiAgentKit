import { describe, expect, it } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  PersonCollaborationService,
  PERSON_COLLABORATION_FANOUT_CONCURRENCY,
} from '@bangumi-agent-kit/bangumi-core';

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function personPayload() {
  return {
    id: 20,
    name: 'Person',
    career: ['seiyu'],
    infobox: [{ key: '简体中文名', value: '人物' }],
  };
}

describe('PersonCollaborationService', () => {
  it('deduplicates stable people and subjects while preserving shared-work evidence', async () => {
    const fetchFn = async (input: string | URL | Request): Promise<Response> => {
      const url = String(input);
      if (url.endsWith('/v0/persons/20')) return json(personPayload());
      if (url.endsWith('/v0/persons/20/characters')) {
        return json([
          {
            id: 101,
            name: '主角',
            subject_id: 1,
            subject_type: 2,
            subject_name: 'One',
            staff: '主角',
          },
          {
            id: 102,
            name: '配角',
            subject_id: 1,
            subject_type: 2,
            subject_name: 'One',
            staff: '配角',
          },
          {
            id: 103,
            name: '主角',
            subject_id: 2,
            subject_type: 2,
            subject_name: 'Two',
            staff: '主角',
          },
        ]);
      }
      if (url.endsWith('/v0/subjects/1/characters')) {
        return json([
          {
            id: 201,
            name: '主角',
            relation: '主角',
            actors: [
              { id: 2, name: 'Collaborator', career: ['seiyu'] },
              { id: 20, name: 'Person', career: ['seiyu'] },
            ],
          },
          {
            id: 202,
            name: '配角',
            relation: '配角',
            actors: [{ id: 2, name: 'Collaborator', career: ['seiyu'] }],
          },
        ]);
      }
      if (url.endsWith('/v0/subjects/2/characters')) {
        return json([
          {
            id: 203,
            name: '另一角色',
            relation: '配角',
            actors: [{ id: 2, name: 'Collaborator', career: ['seiyu'] }],
          },
        ]);
      }
      return json({ error: 'not found' }, 404);
    };

    const result = await new PersonCollaborationService(
      new HttpClient({ fetchFn }),
    ).getPersonCollaboration(20, { kind: 'voice', media: 'anime' });

    expect(result.state).toBe('complete');
    expect(result.person?.nameCn).toBe('人物');
    expect(result.collaborators).toHaveLength(1);
    expect(result.collaborators[0]).toMatchObject({
      id: 2,
      uniqueSubjects: 2,
      creditRows: 3,
      relationKinds: ['voice'],
    });
    expect(result.collaborators[0]?.sharedSubjects).toEqual([
      expect.objectContaining({ id: 1, targetRoles: ['主角', '配角'], relationKinds: ['voice'] }),
      expect.objectContaining({ id: 2, targetRoles: ['主角'], relationKinds: ['voice'] }),
    ]);
    expect(result.coverage).toMatchObject({
      relationRowsObserved: 3,
      relationRowsMatchingFilters: 3,
      relationRowsSelected: 3,
      subjectIdsObserved: 2,
      subjectIdsSelected: 2,
      participantRequests: 2,
      participantRequestsSucceeded: 2,
      participantRowsObserved: 4,
      participantRowsReturned: 3,
      selfRowsExcluded: 1,
      collaboratorsObserved: 1,
      collaboratorsReturned: 1,
      fanoutConcurrency: PERSON_COLLABORATION_FANOUT_CONCURRENCY,
    });
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'derived-s7',
          formulaVersion: 'person-collaboration-v1',
        }),
      ]),
    );
  });

  it('applies literal staff role filters and reports malformed or failed fan-out', async () => {
    const fetchFn = async (input: string | URL | Request): Promise<Response> => {
      const url = String(input);
      if (url.endsWith('/v0/persons/20')) return json(personPayload());
      if (url.endsWith('/v0/persons/20/subjects')) {
        return json([
          { id: 1, type: 2, name: 'One', name_cn: '一', staff: '导演' },
          { id: 2, type: 2, name: 'Two', name_cn: '二', staff: '导演' },
          { id: 3, type: 2, name: 'Three', name_cn: '三', staff: '编剧' },
        ]);
      }
      if (url.endsWith('/v0/subjects/1/persons')) {
        return json([
          { id: 2, name: 'Writer', career: ['writer'], relation: '编剧', eps: '' },
          { id: 3, name: 'Producer', career: ['producer'], relation: '制片', eps: '' },
        ]);
      }
      if (url.endsWith('/v0/subjects/2/persons')) return json({ error: 'temporary' }, 503);
      if (url.endsWith('/v0/subjects/3/persons')) {
        return json([
          { name: 'missing id', relation: '编剧', eps: '' },
          { id: 2, name: 'Writer' },
        ]);
      }
      return json({ error: 'not found' }, 404);
    };

    const result = await new PersonCollaborationService(
      new HttpClient({ fetchFn }),
    ).getPersonCollaboration(20, {
      kind: 'staff',
      targetRole: '导演',
      collaboratorRole: '编剧',
      maxSubjects: 3,
    });

    expect(result.state).toBe('partial');
    expect(result.collaborators).toHaveLength(1);
    expect(result.collaborators[0]).toMatchObject({ id: 2, uniqueSubjects: 1, creditRows: 1 });
    expect(result.coverage).toMatchObject({
      relationRowsObserved: 3,
      relationRowsMatchingFilters: 2,
      subjectIdsObserved: 2,
      participantRequests: 2,
      participantRequestsSucceeded: 1,
      participantRequestsFailed: 1,
      malformedParticipantRows: 0,
      collaboratorRoleExcludedRows: 1,
    });
    expect(result.exclusions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'fanout_unavailable', count: 1 }),
        expect.objectContaining({ reason: 'collaborator_role_excluded', count: 1 }),
      ]),
    );
  });
});
