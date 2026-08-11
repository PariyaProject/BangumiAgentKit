import { describe, expect, it, vi } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createReadTools, createRenderPresentationTools } from '@bangumi-agent-kit/tools';
import type { ArtifactStore, RenderService } from '@bangumi-agent-kit/renderer';

describe('Series / Watch-Order semantic contracts', () => {
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
    expect(
      renderTool?.input.safeParse({ subjectId: 100, depth: 2, maxNodes: 16, media: 'all' }).success,
    ).toBe(true);
  });
});
