import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { BangumiMcpServer } from '../../apps/mcp/src/server.js';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { createRuntimeDependencies } from '@bangumi-agent-kit/tools';

describe('D. MCP Schema Regression Test', () => {
  it('exposes correct JSON Schema for manage_index enum and update_episode_progress array items', async () => {
    const storage = new MemoryStorage();
    const deps = createRuntimeDependencies({
      storage,
      secretKey: 'test-secret-key-123456789012345678901234',
    });
    const mcpApp = new BangumiMcpServer({ dependencies: deps, storage });

    const server = mcpApp.getMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client({ name: 'test-client', version: '1.0' }, { capabilities: {} });
    await client.connect(clientTransport);

    const toolsList = await client.listTools();

    // 1. Verify bangumi.manage_index action enum
    const manageIndexTool = toolsList.tools.find((t) => t.name === 'bangumi.manage_index');
    expect(manageIndexTool).toBeDefined();

    const schemaStr = JSON.stringify(manageIndexTool?.inputSchema);
    expect(schemaStr).toContain('create');
    expect(schemaStr).toContain('edit');
    expect(schemaStr).toContain('add_subject');
    expect(schemaStr).toContain('remove_subject');

    // 2. Verify bangumi.update_episode_progress episodeIds array items integer type and minimum
    const updateProgressTool = toolsList.tools.find(
      (t) => t.name === 'bangumi.update_episode_progress',
    );
    expect(updateProgressTool).toBeDefined();

    const episodeIdsSchema = (updateProgressTool?.inputSchema?.properties as any)?.episodeIds;
    expect(episodeIdsSchema).toBeDefined();
    expect(episodeIdsSchema.type).toBe('array');
    expect(episodeIdsSchema.items).toBeDefined();
    expect(episodeIdsSchema.items.type).toBe('integer');
    expect(episodeIdsSchema.items.minimum).toBe(1);

    await client.close();
  });
});
