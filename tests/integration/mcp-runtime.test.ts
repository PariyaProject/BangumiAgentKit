import { describe, it, expect, vi, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { HttpClient } from '../../packages/bangumi-transport/src/index.js';
import { BangumiMcpServer } from '../../apps/mcp/src/server.js';
import { MemoryStorage } from '../../packages/db/src/index.js';
import { z } from 'zod';

describe('Phase 2: MCP Runtime Tests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('verifies tool schema validation and execution via MCP Client connection', async () => {
    const mockFetch = vi.fn().mockImplementation(async (_url: string) => {
      return new Response(
        JSON.stringify({
          total: 1,
          limit: 10,
          offset: 0,
          data: [{ id: 226998, name: '少女終末旅行', name_cn: '少女终末旅行', type: 2 }],
        }),
        { status: 200 },
      );
    });

    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const mcpApp = new BangumiMcpServer({ httpClient, storage: new MemoryStorage() });
    const server = mcpApp.getMcpServer();

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client({ name: 'test-client', version: '1.0' }, { capabilities: {} });
    await client.connect(clientTransport);

    // 1. bangumi.search_subjects called with {} should be rejected by schema validation
    const emptyResult = await client.callTool({
      name: 'bangumi.search_subjects',
      arguments: {},
    });
    expect(emptyResult.isError).toBe(true);

    // 2. bangumi.search_subjects called with valid query should enter tool handler
    const validResult = await client.callTool({
      name: 'bangumi.search_subjects',
      arguments: { query: '少女終末旅行' },
    });
    expect(validResult.isError).toBeUndefined();
    const content = (validResult.content as any[])[0]?.text;
    expect(content).toContain('少女終末旅行');

    // 3. bangumi.get_subject called with invalid subjectId (-1) should be rejected
    const invalidIdResult = await client.callTool({
      name: 'bangumi.get_subject',
      arguments: { subjectId: -1 },
    });
    expect(invalidIdResult.isError).toBe(true);

    // 4. Listed tool schema matches Zod schema source of truth
    const toolsList = await client.listTools();
    const searchTool = toolsList.tools.find((t) => t.name === 'bangumi.search_subjects');
    expect(searchTool).toBeDefined();

    const rawTool = mcpApp
      .getRegistry()
      .getTools()
      .find((t) => t.name === 'bangumi.search_subjects');
    expect(rawTool).toBeDefined();

    const derivedJsonSchema = z.toJSONSchema(rawTool!.input) as Record<string, any>;
    delete derivedJsonSchema.$schema;

    expect(searchTool?.inputSchema).toEqual(derivedJsonSchema);

    await client.close();
  });
});
