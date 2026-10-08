import { describe, expect, it } from 'vitest';
import {
  S04_EXPECTED_QUERY_ARGUMENTS,
  verifyS04SubjectCastAnswer,
} from '../../scripts/acceptance/s04-agent-answer-check.mjs';

type CastActorFixture = { id: number; name: string; career: string[] };
type CastRoleFixture = { characterId: number; characterName: string; relation: string };
type GroupFixture = {
  person: { id: number; name: string; career: string[] };
  distinctCharacterCount: number;
  roles: CastRoleFixture[];
};
type SubjectCastFixture = {
  status: 'ok';
  subjectId: number;
  cast: Array<{
    character: { id: number; name: string; type: number };
    relation: string;
    actors: CastActorFixture[];
  }>;
  observed: number;
  returned: number;
  selectedRows: number;
  omittedRowsByLimit: number;
  truncated: boolean;
  schemaDriftRows: number;
  invalidActorIdRows: number;
  duplicateActorCharacterLinks: number;
  multiRoleVoiceActors: GroupFixture[];
  source: {
    api: 'official-v0';
    operation: 'GET /v0/subjects/{subject_id}/characters';
    retrievedAt: string;
    status: 'observed' | 'partial';
    responseBytes: number;
    responseByteLimit: number;
    paginationAvailable: false;
    totalCountAvailable: false;
  };
  limitations: string[];
};

function subjectCastResult(withGroups = true): SubjectCastFixture {
  const cast = withGroups
    ? [
        {
          character: { id: 11, name: '角色甲', type: 1 },
          relation: '主角',
          actors: [
            { id: 77, name: '同名声优', career: ['seiyu', 'actor'] },
            { id: 88, name: '另一个同名声优', career: ['seiyu'] },
            { id: 99, name: '非声优', career: ['writer'] },
          ],
        },
        {
          character: { id: 12, name: '角色乙', type: 1 },
          relation: '原始关系乙',
          actors: [
            { id: 77, name: '不同显示名', career: ['seiyu', 'actor'] },
            { id: 88, name: '另一个同名声优', career: ['seiyu'] },
            { id: 99, name: '非声优', career: ['writer'] },
          ],
        },
        {
          character: { id: 12, name: '重复角色乙行', type: 1 },
          relation: '另一个原始标签',
          actors: [{ id: 77, name: '不同显示名', career: ['seiyu', 'actor'] }],
        },
      ]
    : [];
  const multiRoleVoiceActors = withGroups
    ? [
        {
          person: { id: 77, name: '同名声优', career: ['seiyu', 'actor'] },
          distinctCharacterCount: 2,
          roles: [
            { characterId: 11, characterName: '角色甲', relation: '主角' },
            { characterId: 12, characterName: '角色乙', relation: '原始关系乙' },
          ],
        },
        {
          person: { id: 88, name: '另一个同名声优', career: ['seiyu'] },
          distinctCharacterCount: 2,
          roles: [
            { characterId: 11, characterName: '角色甲', relation: '主角' },
            { characterId: 12, characterName: '角色乙', relation: '原始关系乙' },
          ],
        },
      ]
    : [];
  return {
    status: 'ok',
    subjectId: 565,
    cast,
    observed: withGroups ? 3 : 0,
    returned: cast.length,
    selectedRows: cast.length,
    omittedRowsByLimit: 0,
    truncated: false,
    schemaDriftRows: 0,
    invalidActorIdRows: 0,
    duplicateActorCharacterLinks: withGroups ? 1 : 0,
    multiRoleVoiceActors,
    source: {
      api: 'official-v0',
      operation: 'GET /v0/subjects/{subject_id}/characters',
      retrievedAt: '2026-10-08T12:00:00.000Z',
      status: 'observed',
      responseBytes: 1234,
      responseByteLimit: 1_048_576,
      paginationAvailable: false,
      totalCountAvailable: false,
    },
    limitations: ['bounded'],
  };
}

function validAnswer(result: SubjectCastFixture) {
  return {
    subjectId: result.subjectId,
    source: result.source,
    coverage: {
      observed: result.observed,
      selectedRows: result.selectedRows,
      omittedRowsByLimit: result.omittedRowsByLimit,
      truncated: result.truncated,
      schemaDriftRows: result.schemaDriftRows,
      invalidActorIdRows: result.invalidActorIdRows,
      duplicateActorCharacterLinks: result.duplicateActorCharacterLinks,
      sourceStatus: result.source.status,
      responseBytes: result.source.responseBytes,
      responseByteLimit: result.source.responseByteLimit,
    },
    multiRoleVoiceActors: result.multiRoleVoiceActors.map((group) => ({
      person: {
        id: group.person.id,
        name: group.person.name,
        career: [...group.person.career],
      },
      distinctCharacterCount: group.distinctCharacterCount,
      roles: group.roles.map((role) => ({ ...role })),
    })),
    caveat:
      '结论只依据本次选取的合法角色行；接口没有分页或总数；关系标签不作主角或主役分类；未观察到重复声优角色组不表示完整作品角色表中不存在。' +
      (result.multiRoleVoiceActors.length === 0 ? '本次范围未建立多角色声优组。' : ''),
  };
}

function verify(
  result: SubjectCastFixture,
  answer = validAnswer(result),
  toolCalls = [{ name: 'bangumi.get_subject_cast', state: 'DONE' }],
) {
  return verifyS04SubjectCastAnswer(
    JSON.stringify(answer),
    S04_EXPECTED_QUERY_ARGUMENTS,
    { structuredContent: result },
    toolCalls,
  );
}

describe('S04 one-shot subject cast answer checks', () => {
  it('accepts ID-grounded groups and preserves raw relations and exact career values', () => {
    const result = subjectCastResult();

    const check = verify(result);

    expect(check.passed).toBe(true);
    expect(check.resultCounters).toMatchObject({
      multiRoleVoiceActorGroups: 2,
      distinctCharactersByGroup: [2, 2],
      duplicateActorCharacterLinks: 1,
    });
  });

  it('rejects relation reclassification and group data joined by display name', () => {
    const result = subjectCastResult();
    const reclassified = validAnswer(result);
    reclassified.multiRoleVoiceActors[0]!.roles[0]!.relation = '主役';
    expect(verify(result, reclassified).answerChecks.answerGroupsMatch).toBe(false);

    const joinedByName = validAnswer(result);
    joinedByName.multiRoleVoiceActors.pop();
    expect(verify(result, joinedByName).answerChecks.answerGroupsMatch).toBe(false);
  });

  it('accepts an empty observed set only with explicit scope and no-absence caveats', () => {
    const result = subjectCastResult(false);

    expect(verify(result).passed).toBe(true);
    const unsafe = validAnswer(result);
    unsafe.caveat = '本次选取的合法角色行没有声优。';
    expect(verify(result, unsafe).passed).toBe(false);
    expect(verify(result, unsafe).answerChecks.boundedScopeCaveatPresent).toBe(false);
  });

  it('accepts honest row-cap coverage while preserving the zero-group caveat', () => {
    const result = subjectCastResult(false);
    result.cast = Array.from({ length: 100 }, (_, index) => ({
      character: { id: 1000 + index, name: `角色${index}`, type: 1 },
      relation: '配角',
      actors: [],
    }));
    result.returned = 100;
    result.selectedRows = 100;
    result.observed = 113;
    result.omittedRowsByLimit = 13;
    result.truncated = true;
    result.source.status = 'partial';

    const check = verify(result);

    expect(check.passed).toBe(true);
    expect(check.resultSummary).toMatchObject({
      observed: 113,
      selectedRows: 100,
      omittedRowsByLimit: 13,
      truncated: true,
      sourceStatus: 'partial',
    });
  });

  it('rejects a byte-cap breach and extra tool calls', () => {
    const result = subjectCastResult();
    result.source.responseBytes = 1_048_577;
    expect(verify(result).answerChecks.responseLimitValid).toBe(false);

    result.source.responseBytes = 1234;
    expect(
      verify(result, validAnswer(result), [
        { name: 'bangumi.get_subject_cast', state: 'DONE' },
        { name: 'bangumi.get_subject_cast', state: 'DONE' },
      ]).answerChecks.exactSingleToolCall,
    ).toBe(false);
  });
});
