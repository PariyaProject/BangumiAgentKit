import { describe, expect, it } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  PersonCollaborationService,
  PERSON_COLLABORATION_FANOUT_CONCURRENCY,
  PERSON_COLLABORATION_MAX_SOURCE_ROWS,
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

  it('marks a combined result partial when one required relation source fails', async () => {
    const fetchFn = async (input: string | URL | Request): Promise<Response> => {
      const url = String(input);
      if (url.endsWith('/v0/persons/20')) return json(personPayload());
      if (url.endsWith('/v0/persons/20/subjects')) return json([]);
      if (url.endsWith('/v0/persons/20/characters')) return json({ error: 'temporary' }, 503);
      return json({ error: 'not found' }, 404);
    };

    const result = await new PersonCollaborationService(
      new HttpClient({ fetchFn }),
    ).getPersonCollaboration(20, { kind: 'all', media: 'all' });

    expect(result.state).toBe('partial');
    expect(result.coverage).toMatchObject({
      relationRowsObserved: 0,
      participantRequests: 0,
      participantRequestsFailed: 0,
    });
    expect(result.sourceOperations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: 'GET /v0/persons/{person_id}/characters',
          attempted: 1,
          succeeded: 0,
          failed: 1,
          outcomes: [
            expect.objectContaining({ state: 'failed', errorCode: 'UPSTREAM_UNAVAILABLE' }),
          ],
        }),
      ]),
    );
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: 'GET /v0/persons/{person_id}/characters',
          outcome: 'failed',
          errorCode: 'UPSTREAM_UNAVAILABLE',
        }),
      ]),
    );
  });

  it('prioritizes a person NOT_FOUND result over unavailable relation sources', async () => {
    const fetchFn = async (input: string | URL | Request): Promise<Response> => {
      const url = String(input);
      if (url.endsWith('/v0/persons/20')) return json({ message: 'missing' }, 404);
      if (url.endsWith('/v0/persons/20/subjects')) return json({ error: 'temporary' }, 503);
      if (url.endsWith('/v0/persons/20/characters')) return json({ error: 'temporary' }, 503);
      return json({ error: 'not found' }, 404);
    };

    const result = await new PersonCollaborationService(
      new HttpClient({ fetchFn }),
    ).getPersonCollaboration(20, { kind: 'all', media: 'all' });

    expect(result.state).toBe('not_found');
    expect(result.person).toBeUndefined();
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'PERSON_NOT_FOUND' })]),
    );
  });

  it.each([
    ['object envelope', { data: [] }],
    ['null envelope', null],
    ['primitive envelope', 'malformed'],
  ])('does not throw for a malformed relation %s', async (_label, malformed) => {
    const fetchFn = async (input: string | URL | Request): Promise<Response> => {
      const url = String(input);
      if (url.endsWith('/v0/persons/20')) return json(personPayload());
      if (url.endsWith('/v0/persons/20/subjects')) return json(malformed);
      return json({ error: 'not found' }, 404);
    };

    const result = await new PersonCollaborationService(
      new HttpClient({ fetchFn }),
    ).getPersonCollaboration(20, { kind: 'staff', media: 'all' });

    expect(result.state).toBe('unavailable');
    expect(result.collaborators).toEqual([]);
    expect(result.sourceOperations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: 'GET /v0/persons/{person_id}/subjects',
          failed: 1,
          outcomes: [expect.objectContaining({ errorCode: 'SCHEMA_DRIFT' })],
        }),
      ]),
    );
  });

  it('validates the person identity envelope before mapping it', async () => {
    const fetchFn = async (input: string | URL | Request): Promise<Response> => {
      const url = String(input);
      if (url.endsWith('/v0/persons/20')) return json({ name: 'Missing stable id' });
      if (url.endsWith('/v0/persons/20/subjects')) return json([]);
      return json({ error: 'not found' }, 404);
    };

    const result = await new PersonCollaborationService(
      new HttpClient({ fetchFn }),
    ).getPersonCollaboration(20, { kind: 'staff', media: 'all' });

    expect(result.state).toBe('partial');
    expect(result.person).toBeUndefined();
    expect(result.sourceOperations[0]).toMatchObject({
      operation: 'GET /v0/persons/{person_id}',
      failed: 1,
      outcomes: [expect.objectContaining({ errorCode: 'SCHEMA_DRIFT' })],
    });
  });

  it('marks missing target identity fields as partial instead of silently treating them as valid', async () => {
    const fetchFn = async (input: string | URL | Request): Promise<Response> => {
      const url = String(input);
      if (url.endsWith('/v0/persons/20')) return json(personPayload());
      if (url.endsWith('/v0/persons/20/subjects')) {
        return json([
          { id: 1, name: 'Known subject', staff: '导演' },
          { type: 2, name: 'Missing subject id', staff: '导演' },
        ]);
      }
      if (url.endsWith('/v0/subjects/1/persons')) return json([]);
      return json({ error: 'not found' }, 404);
    };

    const result = await new PersonCollaborationService(
      new HttpClient({ fetchFn }),
    ).getPersonCollaboration(20, { kind: 'staff', media: 'all' });

    expect(result.state).toBe('partial');
    expect(result.coverage).toMatchObject({
      relationRowsObserved: 2,
      relationRowsMatchingFilters: 1,
      missingSubjectIdRows: 1,
      missingSubjectTypeRows: 1,
    });
    expect(result.exclusions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'missing_subject_id', count: 1 }),
        expect.objectContaining({ reason: 'missing_subject_type', count: 1 }),
      ]),
    );
  });

  it('preserves source row omissions and partial state at the relation response boundary', async () => {
    const subjects = Array.from(
      { length: PERSON_COLLABORATION_MAX_SOURCE_ROWS + 1 },
      (_, index) => ({
        id: index + 1,
        type: 2,
        name: `Subject ${index + 1}`,
        staff: '导演',
      }),
    );
    const fetchFn = async (input: string | URL | Request): Promise<Response> => {
      const url = String(input);
      if (url.endsWith('/v0/persons/20')) return json(personPayload());
      if (url.endsWith('/v0/persons/20/subjects')) return json(subjects);
      if (/\/v0\/subjects\/\d+\/persons$/.test(url)) return json([]);
      return json({ error: 'not found' }, 404);
    };

    const result = await new PersonCollaborationService(
      new HttpClient({ fetchFn }),
    ).getPersonCollaboration(20, { kind: 'staff', media: 'all', maxSubjects: 1 });

    expect(result.state).toBe('partial');
    expect(result.coverage).toMatchObject({
      relationRowsObserved: PERSON_COLLABORATION_MAX_SOURCE_ROWS,
      relationRowsDroppedAtSourceLimit: 1,
      sampled: true,
    });
    expect(result.sourceOperations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: 'GET /v0/persons/{person_id}/subjects',
          rowsOmitted: 1,
          outcomes: [expect.objectContaining({ rowsOmitted: 1 })],
        }),
      ]),
    );
  });

  it('preserves source row omissions and partial state at the participant response boundary', async () => {
    const participants = Array.from(
      { length: PERSON_COLLABORATION_MAX_SOURCE_ROWS + 1 },
      (_, index) => ({ id: index + 1000, name: `Collaborator ${index + 1000}`, relation: '编剧' }),
    );
    const fetchFn = async (input: string | URL | Request): Promise<Response> => {
      const url = String(input);
      if (url.endsWith('/v0/persons/20')) return json(personPayload());
      if (url.endsWith('/v0/persons/20/subjects')) {
        return json([{ id: 1, type: 2, name: 'Subject', staff: '导演' }]);
      }
      if (url.endsWith('/v0/subjects/1/persons')) return json(participants);
      return json({ error: 'not found' }, 404);
    };

    const result = await new PersonCollaborationService(
      new HttpClient({ fetchFn }),
    ).getPersonCollaboration(20, {
      kind: 'staff',
      media: 'all',
      maxSubjects: 1,
      maxCollaborators: 50,
    });

    expect(result.state).toBe('partial');
    expect(result.coverage).toMatchObject({
      participantRowsObserved: PERSON_COLLABORATION_MAX_SOURCE_ROWS,
      participantRowsDroppedAtSourceLimit: 1,
      collaboratorsObserved: PERSON_COLLABORATION_MAX_SOURCE_ROWS,
      collaboratorsReturned: 50,
      truncated: true,
    });
    expect(result.sourceOperations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: 'GET /v0/subjects/{subject_id}/persons',
          rowsOmitted: 1,
          outcomes: [expect.objectContaining({ rowsOmitted: 1 })],
        }),
      ]),
    );
  });

  it('marks shared-work evidence omissions as partial', async () => {
    const subjects = Array.from({ length: 13 }, (_, index) => ({
      id: index + 1,
      type: 2,
      name: `Subject ${index + 1}`,
      staff: '导演',
    }));
    const fetchFn = async (input: string | URL | Request): Promise<Response> => {
      const url = String(input);
      if (url.endsWith('/v0/persons/20')) return json(personPayload());
      if (url.endsWith('/v0/persons/20/subjects')) return json(subjects);
      if (/\/v0\/subjects\/\d+\/persons$/.test(url)) {
        return json([{ id: 2, name: 'Collaborator', relation: '编剧' }]);
      }
      return json({ error: 'not found' }, 404);
    };

    const result = await new PersonCollaborationService(
      new HttpClient({ fetchFn }),
    ).getPersonCollaboration(20, {
      kind: 'staff',
      media: 'all',
      maxSubjects: 13,
      maxSharedSubjects: 1,
    });

    expect(result.state).toBe('partial');
    expect(result.coverage).toMatchObject({
      sharedSubjectRowsObserved: 13,
      sharedSubjectRowsReturned: 1,
      sharedSubjectRowsOmittedAtLimit: 12,
      truncated: true,
    });
    expect(result.collaborators[0]).toMatchObject({ sharedSubjectsOmitted: 12 });
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'SHARED_SUBJECT_OUTPUT_LIMIT_REACHED' }),
      ]),
    );
  });

  it('sorts equal collaboration counts with locale-independent normalization and ID tie breaks', async () => {
    const fetchFn = async (input: string | URL | Request): Promise<Response> => {
      const url = String(input);
      if (url.endsWith('/v0/persons/20')) return json(personPayload());
      if (url.endsWith('/v0/persons/20/subjects')) {
        return json([1, 2, 3].map((id) => ({ id, type: 2, name: `Subject ${id}`, staff: '导演' })));
      }
      if (/\/v0\/subjects\/\d+\/persons$/.test(url)) {
        return json([
          { id: 2, name: 'I', relation: '编剧' },
          { id: 3, name: 'İ', relation: '编剧' },
          { id: 4, name: 'i', relation: '编剧' },
        ]);
      }
      return json({ error: 'not found' }, 404);
    };

    const result = await new PersonCollaborationService(
      new HttpClient({ fetchFn }),
    ).getPersonCollaboration(20, { kind: 'staff', media: 'all', maxSubjects: 3 });

    expect(result.collaborators.map((collaborator) => collaborator.id)).toEqual([2, 4, 3]);
  });
});
