import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { BangumiMcpServer } from '../../apps/mcp/src/server.js';
import { MemoryStorage } from '../../packages/db/src/index.js';

describe('Phase 2: MCP Tool Schema Tests', () => {
  it('publishes valid inputSchema for bangumi.search_subjects, bangumi.get_subject, and bangumi.get_calendar', async () => {
    const mcpApp = new BangumiMcpServer({ storage: new MemoryStorage() });
    const server = mcpApp.getMcpServer();

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client({ name: 'test-client', version: '1.0' }, { capabilities: {} });
    await client.connect(clientTransport);

    const response = await client.listTools();
    const tools = response.tools;
    expect(Array.isArray(tools)).toBe(true);

    // 1. bangumi.search_subjects schema check
    const searchTool = tools.find((t: any) => t.name === 'bangumi.search_subjects');
    expect(searchTool).toBeDefined();
    const searchSchema = searchTool?.inputSchema as any;
    expect(searchSchema.type).toBe('object');
    expect(searchSchema.properties.query).toBeDefined();
    expect(searchSchema.properties.query.type).toBe('string');
    expect(Array.isArray(searchSchema.required)).toBe(true);
    expect(searchSchema.required).toContain('query');
    expect(searchSchema.properties.limit).toBeDefined();
    expect(searchSchema.properties.offset).toBeDefined();

    // 2. bangumi.get_subject schema check
    const getSubjectTool = tools.find((t: any) => t.name === 'bangumi.get_subject');
    expect(getSubjectTool).toBeDefined();
    const subjectSchema = getSubjectTool?.inputSchema as any;
    expect(subjectSchema.type).toBe('object');
    expect(subjectSchema.properties.subjectId).toBeDefined();
    expect(['integer', 'number']).toContain(subjectSchema.properties.subjectId.type);
    const subjectMin =
      subjectSchema.properties.subjectId.minimum ??
      subjectSchema.properties.subjectId.exclusiveMinimum;
    expect(subjectMin).toBeGreaterThanOrEqual(0);
    expect(subjectSchema.required).toContain('subjectId');

    // 3. bangumi.get_calendar schema check
    const calendarTool = tools.find((t: any) => t.name === 'bangumi.get_calendar');
    expect(calendarTool).toBeDefined();
    const calendarSchema = calendarTool?.inputSchema as any;
    expect(calendarSchema.type).toBe('object');

    await client.close();
  });
});
