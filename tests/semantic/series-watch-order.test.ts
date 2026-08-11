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
    expect(readTool?.input.safeParse({ subjectId: 100, depth: 3 }).success).toBe(false);
    expect(readTool?.input.safeParse({ subjectId: 100, maxNodes: 17 }).success).toBe(false);

    const result = await readTool?.execute(
      { subjectId: 100, depth: 0, maxNodes: 1, media: 'all' },
      { principalId: 'p', botInstanceId: 'b', conversationId: 'c' },
      { publicHttpClient: new HttpClient({ fetchFn: fetchFn as typeof fetch }) },
    );
    expect(result).toMatchObject({
      subjectId: 100,
      coverage: { maxNodes: 1, media: 'all', nonAnimeRowsReturned: 1 },
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
  });
});
