import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { MemoryStorage } from '@bangumi-agent-kit/db';
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
  rating: { score: 8.6, rank: 100, total: 10, count: {} },
  total_episodes: 12,
};

function createDependencies() {
  const httpClient = new HttpClient({
    fetchFn: vi.fn(
      async () =>
        new Response(JSON.stringify(subjectFixture), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    ),
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
  return { dependencies, renderService, artifactStore };
}

async function callMcpRender(options: { renderTarget?: 'chat' | 'full' } = {}) {
  const { dependencies, renderService, artifactStore } = createDependencies();
  const app = new BangumiMcpServer({ dependencies, ...options });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await app.getMcpServer().connect(serverTransport);
  const client = new Client({ name: 'render-target-test', version: '1.0' }, { capabilities: {} });
  await client.connect(clientTransport);
  try {
    const response = await client.callTool({
      name: 'bangumi.render_subject_card',
      arguments: { subjectId: subjectFixture.id },
    });
    return {
      response,
      renderService,
      artifactStore,
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
});
