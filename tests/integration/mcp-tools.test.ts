import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryStorage } from '../../packages/db/src/index.js';
import { HttpClient } from '../../packages/bangumi-transport/src/index.js';
import { ToolRegistry } from '../../packages/tools/src/index.js';
import { BangumiMcpServer } from '../../apps/mcp/src/server.js';

describe('Phase 4: MCP Server & Tools Integration Test', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('ToolRegistry exposes curated tools by default and full tools when configured', () => {
    const httpClient = new HttpClient();
    const storage = new MemoryStorage();
    const registry = new ToolRegistry({ storage, publicHttpClient: httpClient });

    const curatedTools = registry.getTools();
    expect(curatedTools.length).toBeGreaterThanOrEqual(15);
    const toolNames = curatedTools.map((t) => t.name);
    expect(toolNames).toContain('bangumi.search_subjects');
    expect(toolNames).toContain('bangumi.get_subject');
    expect(toolNames).toContain('bangumi.get_calendar');
    expect(toolNames).toContain('bangumi.get_subject_cast');
    expect(toolNames).toContain('bangumi.list_operations');
    expect(toolNames).toContain('bangumi.call_operation');
  });

  it('executes bangumi.search_subjects tool successfully', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          total: 1,
          limit: 10,
          offset: 0,
          data: [{ id: 226998, name: '少女終末旅行', name_cn: '少女终末旅行', type: 2 }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', mockFetch);

    const httpClient = new HttpClient();
    const registry = new ToolRegistry({
      storage: new MemoryStorage(),
      publicHttpClient: httpClient,
    });

    const result = (await registry.executeTool(
      'bangumi.search_subjects',
      { query: '少女终末旅行' },
      { principalId: 'user_1', botInstanceId: 'bot_1', conversationId: 'conv_1' },
    )) as any;

    expect(result.status).toBe('exact');
    expect(result.exact?.id).toBe(226998);
  });

  it('preserves the legacy bangumi.get_subject shape through ToolRegistry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 123,
            type: 2,
            name: '少女終末旅行',
            name_cn: '少女终末旅行',
            summary: 'MCP semantic fixture',
            nsfw: false,
            locked: false,
            date: '2017-10-06',
            platform: 'TV',
            images: { medium: 'https://example.test/medium.png' },
            eps: 12,
            total_episodes: 12,
            rating: { score: 8.2, rank: 42, total: 100, count: { '8': 10 } },
            collection: { wish: 1, collect: 2, doing: 3, on_hold: 4, dropped: 5 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    const registry = new ToolRegistry({ storage: new MemoryStorage() });

    const result = (await registry.executeTool(
      'bangumi.get_subject',
      { subjectId: 123 },
      { principalId: 'user_1', botInstanceId: 'bot_1', conversationId: 'conv_1' },
    )) as Record<string, unknown>;

    expect(result).toMatchObject({ id: 123, type: 'anime', nameCn: '少女终末旅行' });
    expect(result).toHaveProperty('score', 8.2);
    expect(result).toHaveProperty('collectionCounts');
    expect(result).not.toHaveProperty('state');
    expect(result).not.toHaveProperty('data');
  });

  it('executes bangumi.get_calendar tool successfully', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            weekday: { en: 'Mon', cn: '星期一', ja: '月曜日', id: 1 },
            items: [{ id: 1, name: 'Monday Anime' }],
          },
        ]),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', mockFetch);

    const httpClient = new HttpClient();
    const registry = new ToolRegistry({
      storage: new MemoryStorage(),
      publicHttpClient: httpClient,
    });

    const result = (await registry.executeTool(
      'bangumi.get_calendar',
      {},
      { principalId: 'user_1', botInstanceId: 'bot_1', conversationId: 'conv_1' },
    )) as any[];

    expect(result.length).toBe(1);
    expect(result[0].weekday.cn).toBe('星期一');
  });

  it('executes bangumi.get_calendar_intelligence with bounded evidence', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            weekday: { en: 'Mon', cn: '星期一', ja: '月曜日', id: 1 },
            items: [
              {
                id: 1,
                type: 2,
                name: 'Monday Anime',
                name_cn: '周一动画',
                air_date: '2026-08-10',
                rating: { score: 8.2 },
              },
              { id: 2, name: 'Monday Anime 2', name_cn: '周一动画2' },
            ],
          },
        ]),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', mockFetch);

    const registry = new ToolRegistry({
      storage: new MemoryStorage(),
      publicHttpClient: new HttpClient(),
    });
    const result = (await registry.executeTool(
      'bangumi.get_calendar_intelligence',
      { weekday: 1, maxPerDay: 1, maxTotal: 1 },
      { principalId: 'user_1', botInstanceId: 'bot_1', conversationId: 'conv_1' },
    )) as any;

    expect(result.state).toBe('partial');
    expect(result.coverage).toMatchObject({ observed: 2, returned: 1, maxTotal: 1 });
    expect(result.days[0].items[0]).toMatchObject({ type: 2, typeLabel: 'anime' });
    expect(result.evidence).toEqual(
      expect.arrayContaining([expect.objectContaining({ source: 'official-legacy' })]),
    );
  });

  it('executes bangumi.list_operations and bangumi.describe_operation fallback tools', async () => {
    const httpClient = new HttpClient();
    const registry = new ToolRegistry({
      storage: new MemoryStorage(),
      publicHttpClient: httpClient,
    });

    const listRes = (await registry.executeTool(
      'bangumi.list_operations',
      { tag: '条目' },
      { principalId: 'user_1', botInstanceId: 'bot_1', conversationId: 'conv_1' },
    )) as any;

    expect(listRes.total).toBeGreaterThan(0);
    expect(listRes.operations.some((op: any) => op.operationId === 'getSubjectById')).toBe(true);

    const descRes = (await registry.executeTool(
      'bangumi.describe_operation',
      { operationId: 'getSubjectById' },
      { principalId: 'user_1', botInstanceId: 'bot_1', conversationId: 'conv_1' },
    )) as any;

    expect(descRes.operationId).toBe('getSubjectById');
    expect(descRes.method).toBe('GET');
  });

  it('BangumiMcpServer initializes correctly with handlers', () => {
    const mcpServer = new BangumiMcpServer({ storage: new MemoryStorage() });
    expect(mcpServer.getMcpServer()).toBeDefined();
    expect(mcpServer.getRegistry()).toBeDefined();
  });

  it('requires the async runtime factory when storage is not explicitly injected', () => {
    expect(() => new BangumiMcpServer({})).toThrow(
      'Use BangumiMcpServer.create() for runtime initialization.',
    );
  });
});
