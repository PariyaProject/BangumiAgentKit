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
    );
    for (const width of [360, 720]) {
      const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, width);
      expect(html).toContain('少女终末旅行');
      expect(html).toContain('角色与声优');
      expect(html).toContain('主角');
      expect(html).toContain('配角');
      for (const row of sourceCast) {
        expect(html).toContain(row.name);
        expect(html).toContain(row.actors[0]!.name);
      }
      expect(html).not.toContain('完整名单');
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
    const degradedHtml = renderHtmlTemplate(
      buildCastCardViewModel(
        { id: G06_SUBJECT_ID, name: 'Shuumatsu no Tabitabi', nameCn: '少女终末旅行' },
        degraded.cast,
        100,
      ),
      'bangumi-dark',
      {},
      360,
    );
    expect(degradedHtml).toContain('未映射职位');
    expect(degradedHtml).toContain('暂无 CV/演员');
    expect(degradedHtml).not.toContain('Invalid actor');
  });
});
