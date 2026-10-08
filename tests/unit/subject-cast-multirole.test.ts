import { describe, expect, it, vi } from 'vitest';
import {
  CharacterService,
  getSubjectCast,
  SUBJECT_CAST_MAX_RESPONSE_BYTES,
} from '@bangumi-agent-kit/bangumi-core';
import { BangumiError, HttpClient } from '@bangumi-agent-kit/bangumi-transport';

function character(
  id: number,
  name: string,
  relation: string,
  actors: Array<{ id: number; name: string; career: string[] }>,
) {
  return {
    id,
    name,
    type: 1,
    summary: '',
    relation,
    actors: actors.map((actor) => ({ ...actor, type: 1 })),
  };
}

function serviceFor(payload: string, fetchFn = vi.fn(async () => new Response(payload))) {
  const client = new HttpClient({ fetchFn: fetchFn as typeof fetch });
  return { service: new CharacterService(client), fetchFn };
}

describe('subject cast multi-role voice actor groups', () => {
  it('groups by person and distinct character IDs, preserves evidence, and counts duplicate links', async () => {
    const rows = [
      character(101, '角色甲', '主角', [
        { id: 11, name: '同名声优', career: ['seiyu', 'actor'] },
        { id: 20, name: '非声优', career: ['writer'] },
        { id: 30, name: '大小写不符', career: ['Seiyu'] },
      ]),
      character(102, '角色乙', '来源原始标签 A', [
        { id: 11, name: '同一 ID 的另一显示名', career: ['seiyu', 'actor'] },
        { id: 12, name: '同名声优', career: ['seiyu'] },
        { id: 20, name: '非声优', career: ['writer'] },
        { id: 30, name: '大小写不符', career: ['Seiyu'] },
      ]),
      character(102, '重复的角色乙行', '其他原始标签', [
        { id: 11, name: '同一 ID 的另一显示名', career: ['seiyu', 'actor'] },
        { id: 12, name: '同名声优', career: ['seiyu'] },
      ]),
      character(103, '角色丙', '客串', [
        { id: 12, name: '同名声优', career: ['seiyu'] },
        { id: 30, name: '大小写不符', career: ['Seiyu'] },
      ]),
    ];
    const payload = JSON.stringify(rows);
    const { service, fetchFn } = serviceFor(payload);

    const result = await getSubjectCast(service, 9001, { limit: 100 });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(result.source).toMatchObject({
      api: 'official-v0',
      operation: 'GET /v0/subjects/{subject_id}/characters',
      status: 'observed',
      responseBytes: Buffer.byteLength(payload),
      responseByteLimit: SUBJECT_CAST_MAX_RESPONSE_BYTES,
      paginationAvailable: false,
      totalCountAvailable: false,
    });
    expect(result.source.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result).toMatchObject({
      observed: 4,
      returned: 4,
      selectedRows: 4,
      omittedRowsByLimit: 0,
      truncated: false,
      duplicateActorCharacterLinks: 2,
    });
    expect(result.multiRoleVoiceActors).toEqual([
      {
        person: { id: 11, name: '同名声优', career: ['seiyu', 'actor'] },
        distinctCharacterCount: 2,
        roles: [
          { characterId: 101, characterName: '角色甲', relation: '主角' },
          { characterId: 102, characterName: '角色乙', relation: '来源原始标签 A' },
        ],
      },
      {
        person: { id: 12, name: '同名声优', career: ['seiyu'] },
        distinctCharacterCount: 2,
        roles: [
          { characterId: 102, characterName: '角色乙', relation: '来源原始标签 A' },
          { characterId: 103, characterName: '角色丙', relation: '客串' },
        ],
      },
    ]);
    expect(result.multiRoleVoiceActors).not.toContainEqual(
      expect.objectContaining({ person: expect.objectContaining({ id: 20 }) }),
    );
    expect(result.multiRoleVoiceActors).not.toContainEqual(
      expect.objectContaining({ person: expect.objectContaining({ id: 30 }) }),
    );
    expect(result.limitations.join(' ')).toContain('未观察到重复声优角色组不表示');
  });

  it('keeps the default 30 row cap and hard-clamps requested limits and byte budgets', async () => {
    const rows = Array.from({ length: 105 }, (_, index) =>
      character(200 + index, `角色${index}`, '配角', []),
    );
    const payload = JSON.stringify(rows);
    const first = serviceFor(payload);
    const defaultResult = await getSubjectCast(first.service, 9002);
    expect(defaultResult).toMatchObject({
      returned: 30,
      selectedRows: 30,
      omittedRowsByLimit: 75,
      truncated: true,
    });

    const second = serviceFor(payload);
    const cappedResult = await getSubjectCast(second.service, 9002, {
      limit: 500,
      maxResponseBytes: SUBJECT_CAST_MAX_RESPONSE_BYTES * 2,
    });
    expect(cappedResult).toMatchObject({
      returned: 100,
      selectedRows: 100,
      omittedRowsByLimit: 5,
      truncated: true,
      source: { responseByteLimit: SUBJECT_CAST_MAX_RESPONSE_BYTES },
    });
  });

  it('does not infer a repeated-role group from zero or one distinct character', async () => {
    const rows = [
      character(301, '唯一角色', '主角', [{ id: 41, name: '声优', career: ['seiyu'] }]),
    ];
    for (const payload of ['[]', JSON.stringify(rows)]) {
      const { service } = serviceFor(payload);
      const result = await getSubjectCast(service, 9004);

      expect(result.multiRoleVoiceActors).toEqual([]);
      expect(result.source.status).toBe('observed');
      expect(result.limitations.join(' ')).toContain('不表示完整作品角色表中不存在');
    }
  });

  it('fails closed for oversized, malformed, and unavailable source responses', async () => {
    const oversized = serviceFor(`[]${' '.repeat(SUBJECT_CAST_MAX_RESPONSE_BYTES)}`);
    await expect(
      getSubjectCast(oversized.service, 9003, {
        maxResponseBytes: SUBJECT_CAST_MAX_RESPONSE_BYTES * 2,
      }),
    ).rejects.toMatchObject({ code: 'RESPONSE_TOO_LARGE' });
    expect(oversized.fetchFn).toHaveBeenCalledTimes(1);

    const malformed = serviceFor('{');
    await expect(getSubjectCast(malformed.service, 9003)).rejects.toMatchObject({
      code: 'PARSER_ERROR',
    });

    const unavailable = serviceFor(
      'Not found',
      vi.fn(async () => new Response('Not found', { status: 404 })),
    );
    const unavailableRequest = getSubjectCast(unavailable.service, 9003);
    await expect(unavailableRequest).rejects.toBeInstanceOf(BangumiError);
    await expect(unavailableRequest).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
