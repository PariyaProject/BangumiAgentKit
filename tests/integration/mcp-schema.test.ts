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

    const calendarIntelligenceTool = tools.find(
      (t: any) => t.name === 'bangumi.get_calendar_intelligence',
    );
    expect(calendarIntelligenceTool).toBeDefined();
    const calendarIntelligenceSchema = calendarIntelligenceTool?.inputSchema as any;
    expect(calendarIntelligenceSchema.properties.weekday).toBeDefined();
    expect(calendarIntelligenceSchema.properties.maxPerDay.maximum).toBe(8);
    expect(calendarIntelligenceSchema.properties.maxTotal.maximum).toBe(56);

    const renderCalendarTool = tools.find((t: any) => t.name === 'bangumi.render_calendar');
    expect(renderCalendarTool).toBeDefined();
    const renderCalendarSchema = renderCalendarTool?.inputSchema as any;
    expect(renderCalendarSchema.properties.weekday.type).toBe('number');
    expect(renderCalendarSchema.properties.weekday.minimum).toBeUndefined();
    expect(renderCalendarSchema.properties.weekday.maximum).toBeUndefined();

    const revisionIntelligenceTool = tools.find(
      (t: any) => t.name === 'bangumi.get_revision_intelligence',
    );
    expect(revisionIntelligenceTool).toBeDefined();
    const revisionIntelligenceSchema = revisionIntelligenceTool?.inputSchema as any;
    expect(revisionIntelligenceSchema.properties.entityType.enum).toEqual([
      'subject',
      'episode',
      'character',
      'person',
    ]);
    expect(revisionIntelligenceSchema.properties.limit.maximum).toBe(20);
    expect(revisionIntelligenceSchema.properties.offset.maximum).toBe(1_000_000);

    const renderRevisionTool = tools.find(
      (t: any) => t.name === 'bangumi.render_revision_timeline',
    );
    expect(renderRevisionTool).toBeDefined();
    const renderRevisionSchema = renderRevisionTool?.inputSchema as any;
    const revisionEntityIdMin =
      renderRevisionSchema.properties.entityId.minimum ??
      renderRevisionSchema.properties.entityId.exclusiveMinimum;
    expect(revisionEntityIdMin).toBeGreaterThanOrEqual(0);

    await client.close();
  });
});
