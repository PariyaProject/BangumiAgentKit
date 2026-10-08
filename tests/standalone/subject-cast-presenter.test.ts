import { describe, expect, it } from 'vitest';
import { formatHuman } from '../../apps/standalone/src/presenter.js';

describe('standalone subject cast presenter', () => {
  it('shows bounded voice-actor groups, source coverage, IDs, and raw relation labels', () => {
    const output = formatHuman({
      status: 'ok',
      subjectId: 9001,
      observed: 3,
      returned: 3,
      selectedRows: 3,
      omittedRowsByLimit: 0,
      truncated: false,
      schemaDriftRows: 0,
      invalidActorIdRows: 0,
      duplicateActorCharacterLinks: 1,
      cast: [
        {
          character: { id: 11, name: '角色甲', type: 1 },
          relation: '主角',
          actors: [{ id: 77, name: '声优甲', career: ['seiyu'] }],
        },
      ],
      multiRoleVoiceActors: [
        {
          person: { id: 77, name: '声优甲', career: ['seiyu'] },
          distinctCharacterCount: 2,
          roles: [
            { characterId: 11, characterName: '角色甲', relation: '主角' },
            { characterId: 12, characterName: '角色乙', relation: '来源原始标签' },
          ],
        },
      ],
      source: {
        api: 'official-v0',
        operation: 'GET /v0/subjects/{subject_id}/characters',
        retrievedAt: '2026-10-08T12:00:00.000Z',
        status: 'observed',
        responseBytes: 415,
        responseByteLimit: 1_048_576,
        paginationAvailable: false,
        totalCountAvailable: false,
      },
      limitations: ['limited'],
    });

    expect(output).toContain('作品角色与声优 · 条目 ID 9001');
    expect(output).toContain('来源：official-v0');
    expect(output).toContain('响应：415 / 1048576 bytes');
    expect(output).toContain('声优甲（人物 ID 77；2 个不同角色；career: seiyu）');
    expect(output).toContain('角色乙（角色 ID 12）· 原始关系：来源原始标签');
    expect(output).toContain('角色甲（角色 ID 11）· 原始关系：主角 · 声优甲#77');
    expect(output).toContain('未显示角色和演员不作为不存在的证据');
    expect(output).not.toContain('完整作品角色表中不存在');
  });
});
