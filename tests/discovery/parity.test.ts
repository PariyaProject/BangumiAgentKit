import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { ToolRegistry } from '@bangumi-agent-kit/tools';

describe('discovery surface parity', () => {
  it('registers the same semantic discovery tools used by MCP and Standalone', () => {
    const registry = new ToolRegistry({ storage: new MemoryStorage() });
    expect(registry.getTool('bangumi.query_subjects')?.risk).toBe('read');
    expect(registry.getTool('bangumi.resolve_subject_concept')?.risk).toBe('read');
    expect(registry.getTool('bangumi.search_subjects')).toBeDefined();
    expect(registry.getTool('bangumi.get_subject')).toBeDefined();
  });
});
