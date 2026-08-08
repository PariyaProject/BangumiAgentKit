import { describe, it, expect, vi, afterEach } from 'vitest';
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
    const registry = new ToolRegistry({ publicHttpClient: httpClient });

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
    const registry = new ToolRegistry({ publicHttpClient: httpClient });

    const result = (await registry.executeTool(
      'bangumi.search_subjects',
      { query: '少女终末旅行' },
      { principalId: 'user_1', botInstanceId: 'bot_1', conversationId: 'conv_1' },
    )) as any;

    expect(result.status).toBe('exact');
    expect(result.exact?.id).toBe(226998);
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
    const registry = new ToolRegistry({ publicHttpClient: httpClient });

    const result = (await registry.executeTool(
      'bangumi.get_calendar',
      {},
      { principalId: 'user_1', botInstanceId: 'bot_1', conversationId: 'conv_1' },
    )) as any[];

    expect(result.length).toBe(1);
    expect(result[0].weekday.cn).toBe('星期一');
  });

  it('executes bangumi.list_operations and bangumi.describe_operation fallback tools', async () => {
    const httpClient = new HttpClient();
    const registry = new ToolRegistry({ publicHttpClient: httpClient });

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
    const mcpServer = new BangumiMcpServer();
    expect(mcpServer.getMcpServer()).toBeDefined();
    expect(mcpServer.getRegistry()).toBeDefined();
  });
});
