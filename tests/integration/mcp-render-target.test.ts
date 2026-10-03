import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { RenderService } from '@bangumi-agent-kit/renderer';
import { createRuntimeDependenciesWithStorage, ToolRegistry } from '@bangumi-agent-kit/tools';
import { BangumiMcpServer } from '../../apps/mcp/src/server.js';

const subjectFixture = {
  id: 123,
  type: 2,
  name: 'Mobile render fixture',
  name_cn: '手机渲染测试条目',
  date: '2024-01-01',
  platform: 'TV',
  summary: 'A fixture used to verify MCP renderer target behavior.',
  images: { common: '', large: '', medium: '', small: '' },
  tags: [],
  rating: {
    score: 8.6,
    rank: 100,
    total: 10,
    count: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 4, 9: 6, 10: 0 },
  },
  collection: { wish: 2, collect: 4, doing: 2, on_hold: 1, dropped: 1 },
  total_episodes: 12,
};

function createDependencies(
  fetchFn = vi.fn(
    async () =>
      new Response(JSON.stringify(subjectFixture), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  ),
) {
  const httpClient = new HttpClient({
    fetchFn,
  });
  const renderService = {
    renderCard: vi.fn(
      async (
        viewModel: { template: string },
        options?: { width?: number; deviceScaleFactor?: number },
      ) => {
        const cssWidth = options?.width ?? 960;
        const dpr = options?.deviceScaleFactor ?? 2;
        return {
          buffer: Buffer.from('fixture-png'),
          mimeType: 'image/png' as const,
          width: cssWidth * dpr,
          height: 480,
          template: viewModel.template,
          templateVersion: 1,
          cacheKey: 'render-target-fixture',
          warnings: [],
        };
      },
    ),
  };
  const artifactStore = {
    saveArtifact: vi.fn(async (_buffer: Buffer, mimeType = 'image/png' as const, size = {}) => ({
      id: 'render-target-fixture',
      mimeType,
      ...size,
      expiresAt: '2099-01-01T00:00:00.000Z',
    })),
  };
  const dependencies = createRuntimeDependenciesWithStorage(new MemoryStorage(), {
    publicHttpClient: httpClient,
    renderService: renderService as never,
    artifactStore: artifactStore as never,
  });
  return { dependencies, renderService, artifactStore, fetchFn };
}

async function callMcpRender(
  options: {
    renderTarget?: 'chat' | 'full';
    toolName?: string;
    arguments?: Record<string, unknown>;
    fetchFn?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const { dependencies, renderService, artifactStore, fetchFn } = createDependencies(
    options.fetchFn as never,
  );
  const app = new BangumiMcpServer({ dependencies, ...options });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await app.getMcpServer().connect(serverTransport);
  const client = new Client({ name: 'render-target-test', version: '1.0' }, { capabilities: {} });
  await client.connect(clientTransport);
  try {
    const response = await client.callTool({
      name: options.toolName ?? 'bangumi.render_subject_card',
      arguments: options.arguments ?? { subjectId: subjectFixture.id },
    });
    return {
      response,
      renderService,
      artifactStore,
      fetchFn,
    };
  } finally {
    await client.close();
    await app.close();
  }
}

describe('MCP renderer target', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults MCP render artifacts to a 360 CSS-pixel viewport at 2x density', async () => {
    const { response, renderService } = await callMcpRender();

    expect(response.isError).toBeUndefined();
    const artifact = JSON.parse((response as any).content[0].text).artifact;
    expect(artifact).toMatchObject({ width: 720, height: 480 });
    expect(renderService.renderCard).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'subject-card' }),
      { width: 360, deviceScaleFactor: 2 },
    );
  });

  it('allows an MCP caller to explicitly request the full-resolution target', async () => {
    const { response, renderService } = await callMcpRender({ renderTarget: 'full' });

    expect(response.isError).toBeUndefined();
    const artifact = JSON.parse((response as any).content[0].text).artifact;
    expect(artifact).toMatchObject({ width: 1920, height: 480 });
    expect(renderService.renderCard).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'subject-card' }),
    );
  });

  it('identifies a statistics card from official subject metadata while keeping the chat target', async () => {
    const { response, renderService, fetchFn } = await callMcpRender({
      toolName: 'bangumi.render_subject_stats_intelligence',
    });

    expect(response.isError).toBeUndefined();
    const [viewModel, renderOptions] = renderService.renderCard.mock.calls[0] as unknown as [
      { template: string; subjectId: number; subjectIdentity: Record<string, unknown> },
      { width: number; deviceScaleFactor: number },
    ];
    expect(viewModel).toMatchObject({
      template: 'subject-stats',
      subjectId: subjectFixture.id,
      subjectIdentity: {
        state: 'available',
        source: 'official-v0',
        name: subjectFixture.name,
        nameCn: subjectFixture.name_cn,
      },
    });
    expect(renderOptions).toEqual({ width: 360, deviceScaleFactor: 2 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('keeps successful stats when the separate official identity request is not found', async () => {
    const fetchFn = vi.fn(async () => {
      if (fetchFn.mock.calls.length === 1) {
        return new Response(JSON.stringify(subjectFixture), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'identity unavailable' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    });
    const { response, renderService } = await callMcpRender({
      toolName: 'bangumi.render_subject_stats_intelligence',
      fetchFn,
    });

    expect(response.isError).toBeUndefined();
    const [viewModel] = renderService.renderCard.mock.calls[0] as unknown as [
      { state: string; subjectIdentity: Record<string, unknown> },
    ];
    expect(viewModel.state).toBe('complete');
    expect(viewModel.subjectIdentity).toMatchObject({
      state: 'not_found',
      source: 'official-v0',
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('returns successful stats when the optional identity response body stalls', async () => {
    let identityBodyCancelled = false;
    const fetchFn = vi.fn(async () => {
      if (fetchFn.mock.calls.length === 1) {
        return new Response(JSON.stringify(subjectFixture), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(
        new ReadableStream<Uint8Array>({
          cancel() {
            identityBodyCancelled = true;
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    const startedAt = Date.now();
    const { response, renderService } = await callMcpRender({
      toolName: 'bangumi.render_subject_stats_intelligence',
      fetchFn,
    });

    expect(response.isError).toBeUndefined();
    const [viewModel] = renderService.renderCard.mock.calls[0] as unknown as [
      { state: string; subjectIdentity: Record<string, unknown> },
    ];
    expect(viewModel.state).toBe('complete');
    expect(viewModel.subjectIdentity).toMatchObject({
      state: 'unavailable',
      source: 'official-v0',
    });
    expect(identityBodyCancelled).toBe(true);
    expect(Date.now() - startedAt).toBeLessThan(5_000);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  }, 10_000);

  it('keeps direct ToolRegistry rendering on its historical full-resolution target', async () => {
    const { dependencies, renderService, artifactStore } = createDependencies();
    const registry = new ToolRegistry(dependencies);
    const result = await registry.executeTool(
      'bangumi.render_subject_card',
      { subjectId: subjectFixture.id },
      {
        principalId: 'anonymous',
        botInstanceId: 'render-target-test',
        conversationId: 'render-target-test',
      },
    );

    expect(result).toMatchObject({ artifact: { width: 1920, height: 480 } });
    expect(renderService.renderCard).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'subject-card' }),
    );
    await dependencies.storage.close();
    expect(artifactStore.saveArtifact).toHaveBeenCalledOnce();
  });

  it('keeps identity-enriched statistics on the direct full-resolution target', async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(JSON.stringify(subjectFixture), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const renderService = new RenderService();
    const artifactStore = {
      saveArtifact: vi.fn(async (_buffer: Buffer, mimeType = 'image/png' as const, size = {}) => ({
        id: 'stats-full-resolution-png',
        mimeType,
        ...size,
        expiresAt: '2099-01-01T00:00:00.000Z',
      })),
    };
    const dependencies = createRuntimeDependenciesWithStorage(new MemoryStorage(), {
      publicHttpClient: new HttpClient({ fetchFn }),
      renderService: renderService as never,
      artifactStore: artifactStore as never,
    });
    const registry = new ToolRegistry(dependencies);
    try {
      const result = await registry.executeTool(
        'bangumi.render_subject_stats_intelligence',
        { subjectId: subjectFixture.id },
        {
          principalId: 'anonymous',
          botInstanceId: 'render-target-test',
          conversationId: 'render-target-test',
        },
      );

      expect(result).toMatchObject({
        artifact: {
          mimeType: 'image/png',
          width: 1920,
          height: expect.any(Number),
        },
      });
      const artifact = (result as { artifact: { height: number } }).artifact;
      expect(artifact.height).toBeGreaterThan(0);
      const [png] = artifactStore.saveArtifact.mock.calls[0] as unknown as [Buffer];
      expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(fetchFn).toHaveBeenCalledTimes(2);
      expect(artifactStore.saveArtifact).toHaveBeenCalledOnce();
    } finally {
      await renderService.close();
      await dependencies.storage.close();
    }
  });
});
