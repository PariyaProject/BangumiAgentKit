import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '../../packages/db/src/index.js';
import { HttpClient } from '../../packages/bangumi-transport/src/index.js';
import {
  COMPACT_MCP_PROFILE,
  COMPACT_MCP_TOOL_NAMES,
  ToolRegistry,
} from '../../packages/tools/src/index.js';
import { BangumiMcpServer } from '../../apps/mcp/src/server.js';

describe('Bangumi Compact MCP profile', () => {
  it('exposes the stable public read-only allowlist and no operational tools', () => {
    const registry = new ToolRegistry(
      { storage: new MemoryStorage(), publicHttpClient: new HttpClient() },
      { profile: 'compact' },
    );

    expect(registry.getMode()).toBe('compact');
    expect(registry.getTools().map((tool) => tool.name)).toEqual([...COMPACT_MCP_TOOL_NAMES]);
    expect(registry.getTools().every((tool) => tool.risk === 'read')).toBe(true);
    expect(registry.getTool('bangumi.update_collection')).toBeUndefined();
    expect(registry.getTool('bangumi.call_operation')).toBeUndefined();
    expect(registry.getTool('bangumi.auth_start')).toBeUndefined();
    expect(registry.getTool('bangumi.render_subject_card')).toBeUndefined();
    expect(COMPACT_MCP_PROFILE.id).toBe('bangumi-compact-v1');
    expect(COMPACT_MCP_PROFILE.toolNames).toEqual(COMPACT_MCP_TOOL_NAMES);
  });

  it('keeps the full registry surface unchanged when selected explicitly', () => {
    const compact = new ToolRegistry(
      { storage: new MemoryStorage(), publicHttpClient: new HttpClient() },
      { mode: 'compact' },
    );
    const full = new ToolRegistry(
      { storage: new MemoryStorage(), publicHttpClient: new HttpClient() },
      { mode: 'full' },
    );

    expect(full.getMode()).toBe('full');
    expect(full.getTools().length).toBeGreaterThan(compact.getTools().length);
    expect(full.getTool('bangumi.update_collection')).toBeDefined();
    expect(full.getTool('bangumi.render_subject_card')).toBeDefined();
  });

  it('selects the profile at the MCP server boundary', () => {
    const mcpApp = new BangumiMcpServer({
      storage: new MemoryStorage(),
      profile: 'compact',
    });

    expect(mcpApp.getRegistry().getMode()).toBe('compact');
    expect(mcpApp.getRegistry().getTools().map((tool) => tool.name)).toEqual([
      ...COMPACT_MCP_TOOL_NAMES,
    ]);
  });
});
