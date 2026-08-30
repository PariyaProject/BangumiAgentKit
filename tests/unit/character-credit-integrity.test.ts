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
      observedRows: 3,
      duplicateRows: 2,
      duplicateRelationRows: 1,
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
      duplicateRows: 2,
      duplicateRelationRows: 1,
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

  it('counts cross-work person repeats separately from repeated relation pairs', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith('/characters/100')) return json(detail());
      if (path.endsWith('/subjects')) return json([]);
      if (path.endsWith('/persons')) {
        return json([person(20, 10), person(20, 11), person(20, 11), person(21, 12)]);
      }
      return json({ message: 'unexpected' }, 500);
    };

    const result = await service(fetchFn).getCharacterCreditIntegrity(100);
    expect(result.personCredits[0]).toMatchObject({
      id: 20,
      observedRows: 3,
      duplicateRows: 2,
      duplicateRelationRows: 1,
      subjects: [{ subjectId: 10 }, { subjectId: 11 }],
    });
    expect(result.coverage.persons).toMatchObject({
      duplicateRows: 2,
      duplicateRelationRows: 1,
      duplicateIds: [20],
    });
    expect(result.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'duplicate_stable_id',
          entity: 'person',
          ids: [20],
          observedRows: 2,
        }),
      ]),
    );
  });

  it('reports nested relation omissions across the source person cap and per-person cap', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith('/characters/100')) return json(detail());
      if (path.endsWith('/subjects')) return json([]);
      if (path.endsWith('/persons')) {
        return json(Array.from({ length: 33 }, (_, index) => person(20, 100 + index)));
      }
      return json({ message: 'unexpected' }, 500);
    };

    const result = await service(fetchFn).getCharacterCreditIntegrity(100);
    expect(result.personCredits[0]).toMatchObject({
      subjects: expect.any(Array),
      subjectsOmitted: 1,
    });
    expect(result.personCredits[0]?.subjects).toHaveLength(32);
    expect(result.coverage.output).toMatchObject({
      returnedPersonSubjectCredits: 32,
      omittedPersonSubjectCredits: 1,
      truncated: true,
    });
    expect(result.coverage.persons.truncated).toBe(true);
  });

  it('keeps positive list evidence when character detail is missing or unavailable', async () => {
    for (const status of [404, 503]) {
      const fetchFn: typeof fetch = async (input) => {
        const path = new URL(String(input)).pathname;
        if (path.endsWith('/characters/100')) return json({ message: 'detail failure' }, status);
        if (path.endsWith('/subjects')) return json([subject(10)]);
        if (path.endsWith('/persons')) return json([person(20, 10)]);
        return json({ message: 'unexpected' }, 500);
      };

      const result = await service(fetchFn).getCharacterCreditIntegrity(100);
      expect(result.state).toBe('partial');
      expect(result.character).toBeUndefined();
      expect(result.subjectCredits).toHaveLength(1);
      expect(result.personCredits).toHaveLength(1);
      expect(result.coverage.detail.state).toBe(status === 404 ? 'not_found' : 'unavailable');
    }
  });

  it('preserves every source spelling while counting each entity once per normalized key', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith('/characters/100')) return json(detail());
      if (path.endsWith('/subjects')) {
        return json([
          subject(10, 'ＡＢＣ'),
          subject(10, 'ABC'),
          subject(10, 'abc'),
          subject(11, ' ABC  '),
        ]);
      }
      if (path.endsWith('/persons')) return json([]);
      return json({ message: 'unexpected' }, 500);
    };

    const result = await service(fetchFn).getCharacterCreditIntegrity(100);
    const sameNameRisk = result.risks.find(
      (risk) => risk.kind === 'same_name_distinct_ids' && risk.entity === 'subject',
    );
    expect(sameNameRisk).toMatchObject({
      ids: [10, 11],
      names: ['ＡＢＣ', 'ABC', 'abc', ' ABC  '],
      observedRows: 4,
    });
    expect(sameNameRisk?.namesOmitted).toBeUndefined();
  });

  it('counts each entity once per normalized key and preserves all risk candidates before capping', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith('/characters/100')) return json(detail());
      if (path.endsWith('/subjects')) {
        const rows = Array.from({ length: 66 }, (_, index) => {
          const id = 1000 + index;
          const name = `共享名称${' '.repeat(index)}`;
          return [subject(id, name), { ...subject(id, name), staff: '配角' }];
        }).flat();
        return json(rows);
      }
      if (path.endsWith('/persons')) return json([]);
      return json({ message: 'unexpected' }, 500);
    };

    const result = await service(fetchFn).getCharacterCreditIntegrity(100);
    const sameNameRisk = result.risks.find(
      (risk) => risk.kind === 'same_name_distinct_ids' && risk.entity === 'subject',
    );
    expect(sameNameRisk).toMatchObject({
      observedRows: 132,
      membersOmitted: 50,
      namesOmitted: 50,
    });
    expect(sameNameRisk?.names).toHaveLength(16);
    expect(result.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'duplicate_stable_id', entity: 'subject' }),
        expect.objectContaining({ kind: 'same_name_distinct_ids', entity: 'subject' }),
      ]),
    );
    expect(result.risks).toHaveLength(64);
    expect(result.coverage.output.risksOmitted).toBe(4);
  });

  it('records an upstream response-size failure without hiding list evidence', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith('/characters/100')) {
        return json({ ...detail(), summary: '超大响应'.repeat(600) });
      }
      if (path.endsWith('/subjects')) return json([subject(10)]);
      if (path.endsWith('/persons')) return json([]);
      return json({ message: 'unexpected' }, 500);
    };

    const result = await service(fetchFn).getCharacterCreditIntegrity(100, {
      maxResponseBytes: 1_024,
    });
    expect(result.state).toBe('partial');
    expect(result.coverage.detail).toMatchObject({
      state: 'unavailable',
      errorCode: 'RESPONSE_TOO_LARGE',
      maxResponseBytes: 1_024,
    });
    expect(result.operationEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: 'GET /v0/characters/{character_id}',
          errorCode: 'RESPONSE_TOO_LARGE',
        }),
      ]),
    );
    expect(result.subjectCredits).toHaveLength(1);
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
