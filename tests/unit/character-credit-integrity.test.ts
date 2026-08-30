import { describe, expect, it } from 'vitest';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { CharacterCreditIntegrityService } from '@bangumi-agent-kit/bangumi-core';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function detail(id = 100) {
  return { id, name: '已知角色', type: 1, summary: '角色简介', locked: false, stat: {} };
}

function subject(id: number, name = `作品 ${id}`) {
  return {
    id,
    type: 2,
    name,
    name_cn: name,
    staff: '主角',
    eps: '1',
  };
}

function person(id: number, subjectId: number, name = `CV ${id}`) {
  return {
    id,
    name,
    type: 1,
    subject_id: subjectId,
    subject_type: 2,
    subject_name: `作品 ${subjectId}`,
    subject_name_cn: `作品 ${subjectId}`,
    staff: '声优',
  };
}

function service(fetchFn: typeof fetch): CharacterCreditIntegrityService {
  return new CharacterCreditIntegrityService(
    new GeneratedBangumiOpenApiClient(new HttpClient({ fetchFn })),
  );
}

describe('CharacterCreditIntegrityService', () => {
  it('deduplicates by stable ID and reports duplicate, collision, and field-conflict evidence', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith('/characters/100')) return json(detail());
      if (path.endsWith('/characters/100/subjects')) {
        return json([
          subject(10, '同名作品'),
          subject(10, '同名作品（别名观测）'),
          subject(11, '同名作品'),
          { id: 'malformed' },
        ]);
      }
      if (path.endsWith('/characters/100/persons')) {
        return json([
          person(20, 10, '同名 CV'),
          person(20, 10, '同名 CV'),
          person(20, 11, '同名 CV'),
          person(21, 11, '同名 CV'),
          { id: 22, name: '缺字段' },
        ]);
      }
      return json({ message: 'unexpected' }, 500);
    };

    const result = await service(fetchFn).getCharacterCreditIntegrity(100);

    expect(result.state).toBe('conflict');
    expect(result.character).toMatchObject({ id: 100, name: '已知角色' });
    expect(result.subjectCredits).toHaveLength(2);
    expect(result.personCredits).toHaveLength(2);
    expect(result.personCredits[0]).toMatchObject({
      id: 20,
      subjects: [{ subjectId: 10 }, { subjectId: 11 }],
    });
    expect(result.coverage.subjects).toMatchObject({
      observedRows: 4,
      validRows: 3,
      uniqueIdsObserved: 2,
      returnedRows: 2,
      malformedRows: 1,
      duplicateRows: 1,
      conflictRows: 1,
      truncated: true,
    });
    expect(result.coverage.persons).toMatchObject({
      observedRows: 5,
      validRows: 4,
      uniqueIdsObserved: 2,
      malformedRows: 1,
      duplicateRows: 1,
      truncated: true,
    });
    expect(result.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'duplicate_stable_id', entity: 'subject', ids: [10] }),
        expect.objectContaining({ kind: 'duplicate_stable_id', entity: 'person', ids: [20] }),
        expect.objectContaining({
          kind: 'same_name_distinct_ids',
          entity: 'subject',
          ids: [10, 11],
        }),
        expect.objectContaining({
          kind: 'same_name_distinct_ids',
          entity: 'person',
          ids: [20, 21],
        }),
        expect.objectContaining({ kind: 'stable_id_name_conflict', entity: 'subject', ids: [10] }),
      ]),
    );
    expect(JSON.stringify(result)).toContain('不做名称合并');
    expect(result.operationEvidence).toHaveLength(3);
    expect(result.source.operations).toEqual([
      'GET /v0/characters/{character_id}',
      'GET /v0/characters/{character_id}/subjects',
      'GET /v0/characters/{character_id}/persons',
    ]);
  });

  it('preserves complete coverage for clean stable-ID rows and exposes output caps', async () => {
    const requests: string[] = [];
    const fetchFn: typeof fetch = async (input) => {
      const path = new URL(String(input)).pathname;
      requests.push(path);
      if (path.endsWith('/characters/100')) return json(detail());
      if (path.endsWith('/characters/100/subjects')) return json([subject(10), subject(11)]);
      if (path.endsWith('/characters/100/persons')) return json([person(20, 10), person(21, 11)]);
      return json({ message: 'unexpected' }, 500);
    };

    const result = await service(fetchFn).getCharacterCreditIntegrity(100, {
      maxSubjects: 1,
      maxPersons: 1,
    });

    expect(result.state).toBe('partial');
    expect(result.coverage.output).toMatchObject({
      maxSubjects: 1,
      maxPersons: 1,
      returnedSubjects: 1,
      returnedPersons: 1,
      truncated: true,
    });
    expect(result.coverage.subjects.truncated).toBe(true);
    expect(result.coverage.persons.truncated).toBe(true);
    expect(result.risks).toEqual([]);
    expect(requests).toHaveLength(3);
  });

  it('keeps source failures explicit instead of turning them into empty negative conclusions', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith('/characters/100')) return json(detail());
      if (path.endsWith('/subjects')) return json({ message: 'temporarily unavailable' }, 503);
      if (path.endsWith('/persons')) return json({ message: 'missing' }, 404);
      return json({ message: 'unexpected' }, 500);
    };

    const result = await service(fetchFn).getCharacterCreditIntegrity(100);

    expect(result.state).toBe('partial');
    expect(result.subjectCredits).toEqual([]);
    expect(result.personCredits).toEqual([]);
    expect(result.coverage.subjects.state).toBe('unavailable');
    expect(result.coverage.persons.state).toBe('not_found');
    expect(result.operationEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: 'GET /v0/characters/{character_id}/subjects',
          outcome: 'unavailable',
        }),
        expect.objectContaining({
          operation: 'GET /v0/characters/{character_id}/persons',
          outcome: 'not_found',
        }),
      ]),
    );
    expect(result.warnings.map((warning) => warning.message).join(' ')).toContain(
      '未把空结果解释为没有作品',
    );
  });

  it('reports a missing known character as not_found', async () => {
    const fetchFn: typeof fetch = async () => json({ message: 'missing' }, 404);
    const result = await service(fetchFn).getCharacterCreditIntegrity(999);
    expect(result.state).toBe('not_found');
    expect(result.error).toMatchObject({ code: 'NOT_FOUND' });
    expect(result.character).toBeUndefined();
  });
});
