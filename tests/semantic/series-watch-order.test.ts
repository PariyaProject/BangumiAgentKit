import { describe, expect, it, vi } from 'vitest';
import { HttpClient, toPublicError } from '@bangumi-agent-kit/bangumi-transport';
import { createReadTools, createRenderPresentationTools } from '@bangumi-agent-kit/tools';
import type { ArtifactStore, RenderService } from '@bangumi-agent-kit/renderer';

describe('Series / Watch-Order semantic contracts', () => {
  it('preserves structured non-retryable root relation failure through the read tool', async () => {
    const fetchFn = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith('/v0/subjects/100')) {
        return new Response(JSON.stringify({ id: 100, type: 2, name: '起点', name_cn: '起点' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('relation endpoint missing', { status: 404 });
    });
    const tool = createReadTools(new HttpClient({ fetchFn: fetchFn as typeof fetch }))[3];
    expect(tool?.name).toBe('bangumi.get_series_watch_order');

    try {
      await tool!.execute(
        { subjectId: 100 },
        { principalId: 'p', botInstanceId: 'b', conversationId: 'c' },
        { publicHttpClient: new HttpClient({ fetchFn: fetchFn as typeof fetch }) },
      );
      throw new Error('expected root relation failure');
    } catch (error) {
      expect(error).toMatchObject({ code: 'NOT_FOUND', retryable: false, upstreamStatus: 404 });
      expect(toPublicError(error)).toMatchObject({ code: 'NOT_FOUND', retryable: false });
    }
  });

  it('registers bounded read and render tools with compatible public limits', async () => {
    const fetchFn = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith('/v0/subjects/100')) {
        return new Response(
          JSON.stringify({ id: 100, type: 2, name: '起点', name_cn: '起点', date: '2020-01-01' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.endsWith('/v0/subjects/100/subjects')) {
        return new Response(
          JSON.stringify([
            { id: 101, type: 2, name: '续集', name_cn: '续集', relation: '续集' },
            { id: 102, type: 1, name: '原作', name_cn: '原作', relation: '原作' },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.endsWith('/v0/subjects/101')) {
        return new Response(
          JSON.stringify({ id: 101, type: 2, name: '续集', name_cn: '续集', date: '2021-01-01' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.endsWith('/v0/persons/20/characters')) {
        return new Response(
          JSON.stringify([
            {
              id: 1,
              name: '角色一',
              type: 1,
              subject_id: 100,
              subject_type: 2,
              subject_name: '起点',
              subject_name_cn: '起点',
              staff: '主役',
            },
            {
              id: 2,
              name: '角色二',
              type: 1,
              subject_id: 101,
              subject_type: 2,
              subject_name: '续集',
              subject_name_cn: '续集',
              staff: '配角',
            },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('not found', { status: 404 });
    });
    const readTool = createReadTools(new HttpClient({ fetchFn: fetchFn as typeof fetch }))[3];
    expect(readTool).toMatchObject({
      name: 'bangumi.get_series_watch_order',
      auth: 'none',
      risk: 'read',
    });
    expect(readTool?.description).toContain('日期不会回溯改变已选上限');
    expect(
      readTool?.input.safeParse({ subjectId: 100, depth: 2, maxNodes: 16, media: 'all' }).success,
    ).toBe(true);
    expect(
      readTool?.input.safeParse({
        subjectId: 100,
        voiceActorPersonId: 20,
        maxVoiceCredits: 120,
      }).success,
    ).toBe(true);
    expect(readTool?.input.safeParse({ subjectId: 100, voiceActorPersonId: 0 }).success).toBe(
      false,
    );
    expect(readTool?.input.safeParse({ subjectId: 100, maxVoiceCredits: 121 }).success).toBe(false);
    expect(readTool?.input.safeParse({ subjectId: 100, depth: 3 }).success).toBe(false);
    expect(readTool?.input.safeParse({ subjectId: 100, maxNodes: 17 }).success).toBe(false);

    const result = await readTool?.execute(
      {
        subjectId: 100,
        depth: 0,
        maxNodes: 1,
        media: 'all',
        voiceActorPersonId: 20,
        maxVoiceCredits: 4,
      },
      { principalId: 'p', botInstanceId: 'b', conversationId: 'c' },
      { publicHttpClient: new HttpClient({ fetchFn: fetchFn as typeof fetch }) },
    );
    expect(result).toMatchObject({
      subjectId: 100,
      coverage: { maxNodes: 1, media: 'all', nonAnimeRowsReturned: 1 },
      voiceActorPresence: {
        matchStatus: 'multi_work_found',
        distinctWorks: 2,
        works: [{ subjectId: 100 }, { subjectId: 101 }],
      },
    });

    const renderService = { renderCard: vi.fn() } as unknown as RenderService;
    const artifactStore = {} as ArtifactStore;
    const renderTool = createRenderPresentationTools(renderService, artifactStore).find(
      (tool) => tool.name === 'bangumi.render_series_watch_order',
    );
    expect(renderTool).toBeDefined();
    expect(renderTool).toMatchObject({
      name: 'bangumi.render_series_watch_order',
      auth: 'none',
      risk: 'read',
    });
    expect(renderTool?.description).toContain('日期不会回溯改变已选上限');
    expect(
      renderTool?.input.safeParse({ subjectId: 100, depth: 2, maxNodes: 16, media: 'all' }).success,
    ).toBe(true);
    expect(
      renderTool?.input.safeParse({
        subjectId: 100,
        voiceActorPersonId: 20,
        maxVoiceCredits: 120,
      }).success,
    ).toBe(true);
    expect(renderTool?.input.safeParse({ subjectId: 100, voiceActorPersonId: -1 }).success).toBe(
      false,
    );
    expect(renderTool?.input.safeParse({ subjectId: 100, maxVoiceCredits: 121 }).success).toBe(
      false,
    );
  });

  it('places a bounded synthetic prequel before its root using one-hop relations', async () => {
    const requests: string[] = [];
    const fixture = new Map<string, unknown>([
      [
        'https://api.bgm.tv/v0/subjects/990817',
        {
          id: 990817,
          type: 2,
          name: 'Synthetic Watch-Order Root 990817',
          name_cn: '合成观看顺序起点 990817',
          date: '2020-01-01',
          platform: 'TV',
        },
      ],
      [
        'https://api.bgm.tv/v0/subjects/990817/subjects',
        [
          {
            id: 990818,
            type: 2,
            name: 'Synthetic Watch-Order Prequel 990818',
            name_cn: '合成前传 990818',
            relation: '前传',
          },
        ],
      ],
      ['https://api.bgm.tv/v0/subjects/990818/subjects', []],
      [
        'https://api.bgm.tv/v0/subjects/990818',
        {
          id: 990818,
          type: 2,
          name: 'Synthetic Watch-Order Prequel 990818',
          name_cn: '合成前传 990818',
          date: '2019-01-01',
          platform: 'TV',
        },
      ],
    ]);
    const fetchFn = vi.fn(async (input: string | URL) => {
      const url = String(input);
      requests.push(url);
      const body = fixture.get(url);
      return body === undefined
        ? new Response('unexpected route', { status: 599 })
        : new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
    });
    const client = new HttpClient({ fetchFn: fetchFn as typeof fetch });
    const tool = createReadTools(client)[3];
    expect(tool?.name).toBe('bangumi.get_series_watch_order');
    const result = await tool!.execute(
      { subjectId: 990817, depth: 1, maxNodes: 1, media: 'anime' },
      { principalId: 'synthetic', botInstanceId: 'synthetic', conversationId: 'synthetic' },
      { publicHttpClient: client },
    );

    expect(result).toMatchObject({
      state: 'complete',
      subjectId: 990817,
      watchOrder: [
        { id: 990818, isRoot: false, placement: 'before_root' },
        { id: 990817, isRoot: true, placement: 'root' },
      ],
      related: [{ id: 990818, includedInWatchOrder: true }],
      coverage: { relationRequests: 2, relationRowsObserved: 1, detailsAttempted: 1 },
    });
    expect(requests).toHaveLength(4);
    expect(new Set(requests)).toEqual(new Set(fixture.keys()));
  });

  it('places two bounded direct synthetic nodes around a root using one-hop relations', async () => {
    const requests: string[] = [];
    const fixture = new Map<string, unknown>([
      [
        'https://api.bgm.tv/v0/subjects/991404',
        {
          id: 991404,
          type: 2,
          name: 'Synthetic Multi-Node Watch-Order Root 991404',
          name_cn: '合成多节点观看顺序起点 991404',
          date: '2020-01-01',
          platform: 'TV',
        },
      ],
      [
        'https://api.bgm.tv/v0/subjects/991404/subjects',
        [
          {
            id: 991405,
            type: 2,
            name: 'Synthetic Multi-Node Prequel 991405',
            name_cn: '合成前传 991405',
            relation: '前传',
          },
          {
            id: 991406,
            type: 2,
            name: 'Synthetic Multi-Node Sequel 991406',
            name_cn: '合成续集 991406',
            relation: '续集',
          },
        ],
      ],
      ['https://api.bgm.tv/v0/subjects/991405/subjects', []],
      ['https://api.bgm.tv/v0/subjects/991406/subjects', []],
      [
        'https://api.bgm.tv/v0/subjects/991405',
        {
          id: 991405,
          type: 2,
          name: 'Synthetic Multi-Node Prequel 991405',
          name_cn: '合成前传 991405',
          date: '2019-01-01',
          platform: 'TV',
        },
      ],
      [
        'https://api.bgm.tv/v0/subjects/991406',
        {
          id: 991406,
          type: 2,
          name: 'Synthetic Multi-Node Sequel 991406',
          name_cn: '合成续集 991406',
          date: '2021-01-01',
          platform: 'TV',
        },
      ],
    ]);
    const fetchFn = vi.fn(async (input: string | URL) => {
      const url = String(input);
      requests.push(url);
      const body = fixture.get(url);
      return body === undefined
        ? new Response('unexpected route', { status: 599 })
        : new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
    });
    const client = new HttpClient({ fetchFn: fetchFn as typeof fetch });
    const tool = createReadTools(client)[3];
    expect(tool?.name).toBe('bangumi.get_series_watch_order');
    const result = await tool!.execute(
      { subjectId: 991404, depth: 1, maxNodes: 2, media: 'anime' },
      { principalId: 'synthetic', botInstanceId: 'synthetic', conversationId: 'synthetic' },
      { publicHttpClient: client },
    );

    expect(result).toMatchObject({
      state: 'complete',
      subjectId: 991404,
      watchOrder: [
        { id: 991405, isRoot: false, placement: 'before_root' },
        { id: 991404, isRoot: true, placement: 'root' },
        { id: 991406, isRoot: false, placement: 'after_root' },
      ],
      related: [
        { id: 991405, includedInWatchOrder: true },
        { id: 991406, includedInWatchOrder: true },
      ],
      coverage: { relationRequests: 3, relationRowsObserved: 2, detailsAttempted: 2 },
    });
    expect(requests).toHaveLength(6);
    expect(new Set(requests)).toEqual(new Set(fixture.keys()));
  });
});
