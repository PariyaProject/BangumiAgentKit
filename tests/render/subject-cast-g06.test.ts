import { describe, expect, it, vi } from 'vitest';
import { CharacterService, getSubjectCast } from '@bangumi-agent-kit/bangumi-core';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { buildCastCardViewModel, renderHtmlTemplate } from '@bangumi-agent-kit/renderer';

const G06_SUBJECT_ID = 218707;

const sourceCast = [
  { id: 257181, name: 'Character 1', relation: '主角', actorId: 6860, actorName: 'Actor 1' },
  { id: 257182, name: 'Character 2', relation: '主角', actorId: 6861, actorName: 'Actor 2' },
  { id: 257183, name: 'Character 3', relation: '配角', actorId: 6862, actorName: 'Actor 3' },
  { id: 257184, name: 'Character 4', relation: '配角', actorId: 6863, actorName: 'Actor 4' },
  { id: 257185, name: 'Character 5', relation: '配角', actorId: 6864, actorName: 'Actor 5' },
  { id: 257186, name: 'Character 6', relation: '配角', actorId: 6865, actorName: 'Actor 6' },
  { id: 257187, name: 'Character 7', relation: '配角', actorId: 6866, actorName: 'Actor 7' },
].map((item) => ({
  id: item.id,
  type: 1,
  name: item.name,
  summary: '',
  relation: item.relation,
  actors: [
    {
      id: item.actorId,
      name: item.actorName,
      type: 1,
      career: ['seiyu'],
    },
  ],
}));

describe('G06 Girls’ Last Tour cast and voice-actor scenario', () => {
  it('preserves observed source roles and actor identities in bounded phone and desktop cards', async () => {
    const requests: string[] = [];
    const fetchFn = vi.fn(async (input: string | URL) => {
      const url = String(input);
      requests.push(url);
      if (url.endsWith(`/v0/subjects/${G06_SUBJECT_ID}/characters`)) {
        return new Response(JSON.stringify(sourceCast), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('unexpected fixture request', { status: 404 });
    });

    const result = await getSubjectCast(
      new CharacterService(new HttpClient({ fetchFn: fetchFn as typeof fetch })),
      G06_SUBJECT_ID,
      { limit: 100 },
    );

    expect(requests).toEqual([`https://api.bgm.tv/v0/subjects/${G06_SUBJECT_ID}/characters`]);
    expect(result).toMatchObject({
      status: 'ok',
      subjectId: G06_SUBJECT_ID,
      observed: 7,
      returned: 7,
      truncated: false,
      schemaDriftRows: 0,
      invalidActorIdRows: 0,
    });
    expect(result.cast.map((item) => item.character.id)).toEqual(sourceCast.map((item) => item.id));
    expect(result.cast.map((item) => item.relation)).toEqual([
      '主角',
      '主角',
      '配角',
      '配角',
      '配角',
      '配角',
      '配角',
    ]);
    expect(result.cast.flatMap((item) => item.actors.map((actor) => actor.id))).toEqual(
      sourceCast.map((item) => item.actors[0]!.id),
    );

    const viewModel = buildCastCardViewModel(
      { id: G06_SUBJECT_ID, name: 'Shuumatsu no Tabitabi', nameCn: '少女终末旅行' },
      result.cast,
      100,
      {
        observed: result.observed,
        returned: result.returned,
        truncated: result.truncated,
        schemaDriftRows: result.schemaDriftRows,
        invalidActorIdRows: result.invalidActorIdRows,
      },
    );
    for (const width of [360, 720]) {
      const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, width);
      expect(html).toContain('少女终末旅行');
      expect(html).toContain('角色与声优');
      expect(html).toContain('本次来源响应：观测 7 条，可用 7 条；本卡显示 7 条。');
      expect(html).toContain('主角');
      expect(html).toContain('配角');
      for (const row of sourceCast) {
        expect(html).toContain(row.name);
        expect(html).toContain(row.actors[0]!.name);
      }
      expect(html).not.toContain('完整名单');
      expect(html).not.toContain('覆盖完整');
    }

    const actorlessUnknownRole = {
      id: 257188,
      type: 1,
      name: 'Unmapped role',
      summary: '',
      relation: '未映射职位',
      actors: [],
    };
    const invalidActorId = {
      id: 257189,
      type: 1,
      name: 'Malformed actor relation',
      summary: '',
      relation: '配角',
      actors: [{ id: 0, name: 'Invalid actor', type: 1, career: ['seiyu'] }],
    };
    const degradedFetchFn = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith(`/v0/subjects/${G06_SUBJECT_ID}/characters`)) {
        return new Response(JSON.stringify([...sourceCast, actorlessUnknownRole, invalidActorId]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('unexpected degraded-fixture request', { status: 404 });
    });
    const degraded = await getSubjectCast(
      new CharacterService(new HttpClient({ fetchFn: degradedFetchFn as typeof fetch })),
      G06_SUBJECT_ID,
      { limit: 100 },
    );
    expect(degraded).toMatchObject({
      observed: 9,
      returned: 8,
      truncated: true,
      schemaDriftRows: 1,
      invalidActorIdRows: 1,
    });
    expect(degraded.cast.at(-1)).toMatchObject({
      character: { id: actorlessUnknownRole.id, name: actorlessUnknownRole.name },
      relation: actorlessUnknownRole.relation,
      actors: [],
    });
    const degradedViewModel = buildCastCardViewModel(
      { id: G06_SUBJECT_ID, name: 'Shuumatsu no Tabitabi', nameCn: '少女终末旅行' },
      degraded.cast,
      100,
      {
        observed: degraded.observed,
        returned: degraded.returned,
        truncated: degraded.truncated,
        schemaDriftRows: degraded.schemaDriftRows,
        invalidActorIdRows: degraded.invalidActorIdRows,
      },
    );
    for (const width of [360, 720]) {
      const html = renderHtmlTemplate(degradedViewModel, 'bangumi-dark', {}, width);
      expect(html).toContain('本次来源响应：观测 9 条，可用 8 条；本卡显示 8 条。');
      expect(html).toContain('本次读取结果不完整');
      expect(html).toContain('字段异常记录：1 条未纳入。');
      expect(html).toContain('无效演员 ID：1 个（与字段异常记录可能重叠）。');
      expect(html).toContain('未映射职位');
      expect(html).toContain('暂无 CV/演员');
      expect(html).not.toContain('Invalid actor');
    }
  });

  it('renders bounded ID-grounded multi-role voice-actor groups with raw relation labels', async () => {
    const rows = [
      {
        id: 257181,
        type: 1,
        name: '角色甲',
        summary: '',
        relation: '主角',
        actors: [{ id: 777, name: '同一声优', type: 1, career: ['seiyu'] }],
      },
      {
        id: 257182,
        type: 1,
        name: '角色乙',
        summary: '',
        relation: '原始关系标签·乙',
        actors: [{ id: 777, name: '同一声优', type: 1, career: ['seiyu'] }],
      },
      {
        id: 257182,
        type: 1,
        name: '重复角色乙行',
        summary: '',
        relation: '另一个原始标签',
        actors: [{ id: 777, name: '同一声优', type: 1, career: ['seiyu'] }],
      },
    ];
    const fetchFn = vi.fn(
      async () =>
        new Response(JSON.stringify(rows), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const result = await getSubjectCast(
      new CharacterService(new HttpClient({ fetchFn: fetchFn as typeof fetch })),
      G06_SUBJECT_ID,
      { limit: 100 },
    );
    const viewModel = buildCastCardViewModel(
      { id: G06_SUBJECT_ID, name: '少女终末旅行' },
      result.cast,
      20,
      {
        observed: result.observed,
        returned: result.returned,
        truncated: result.truncated,
        schemaDriftRows: result.schemaDriftRows,
        invalidActorIdRows: result.invalidActorIdRows,
        responseBytes: result.source.responseBytes,
        responseByteLimit: result.source.responseByteLimit,
        rowsOmittedByLimit: result.omittedRowsByLimit,
        duplicateActorCharacterLinks: result.duplicateActorCharacterLinks,
        sourceStatus: result.source.status,
      },
      result.multiRoleVoiceActors,
    );
    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 360);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(result.multiRoleVoiceActors).toMatchObject([
      {
        person: { id: 777, career: ['seiyu'] },
        distinctCharacterCount: 2,
        roles: [
          { characterId: 257181, relation: '主角' },
          { characterId: 257182, relation: '原始关系标签·乙' },
        ],
      },
    ]);
    expect(html).toContain('同一声优 ID 对应多个角色');
    expect(html).toContain('career: seiyu');
    expect(html).toContain('原始关系标签·乙');
    expect(html).toContain('关系标签保留原文，不作主角或主役分类');
    expect(html).toContain('重复人物 ID—角色 ID 关系：1 条（分组时去重）。');
  });

  it('separates a source limit from the card display cap', async () => {
    const cappedFetchFn = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith(`/v0/subjects/${G06_SUBJECT_ID}/characters`)) {
        return new Response(JSON.stringify(sourceCast), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('unexpected capped-fixture request', { status: 404 });
    });
    const capped = await getSubjectCast(
      new CharacterService(new HttpClient({ fetchFn: cappedFetchFn as typeof fetch })),
      G06_SUBJECT_ID,
      { limit: 3 },
    );
    expect(capped).toMatchObject({
      observed: 7,
      returned: 3,
      truncated: true,
      schemaDriftRows: 0,
      invalidActorIdRows: 0,
    });

    const viewModel = buildCastCardViewModel(
      { id: G06_SUBJECT_ID, name: 'Shuumatsu no Tabitabi', nameCn: '少女终末旅行' },
      capped.cast,
      2,
      {
        observed: capped.observed,
        returned: capped.returned,
        truncated: capped.truncated,
        schemaDriftRows: capped.schemaDriftRows,
        invalidActorIdRows: capped.invalidActorIdRows,
      },
    );
    for (const width of [360, 720]) {
      const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, width);
      expect(html).toContain('本次来源响应：观测 7 条，可用 3 条；本卡显示 2 条。');
      expect(html).toContain('本次读取结果不完整');
      expect(html).toContain('另有 1 位关联角色未全部展示');
    }
  });
});
