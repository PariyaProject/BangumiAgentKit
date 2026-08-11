import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { ToolRegistry } from '@bangumi-agent-kit/tools';

describe('discovery surface parity', () => {
  it('registers the same semantic discovery tools used by MCP and Standalone', () => {
    const registry = new ToolRegistry({ storage: new MemoryStorage() });
    expect(registry.getTool('bangumi.query_subjects')?.risk).toBe('read');
    expect(registry.getTool('bangumi.resolve_subject_concept')?.risk).toBe('read');
    expect(registry.getTool('bangumi.render_query_subjects')?.risk).toBe('read');
    expect(registry.getTool('bangumi.search_subjects')).toBeDefined();
    expect(registry.getTool('bangumi.get_subject')).toBeDefined();
  });

  it('keeps raw execution budgets out of the model-facing discovery schema', () => {
    const tool = new ToolRegistry({ storage: new MemoryStorage() }).getTool(
      'bangumi.query_subjects',
    );
    expect(tool?.input.safeParse({ media: 'anime', limit: 100 }).success).toBe(true);
    expect(tool?.input.safeParse({ media: 'anime', limit: 101 }).success).toBe(false);
    expect(tool?.input.safeParse({ media: 'anime', budget: { maxPages: 1000 } }).success).toBe(
      false,
    );

    const renderTool = new ToolRegistry({ storage: new MemoryStorage() }).getTool(
      'bangumi.render_query_subjects',
    );
    expect(renderTool?.auth).toBe('none');
    expect(renderTool?.input.safeParse({ media: 'anime', rating: { min: 8 } }).success).toBe(true);
    expect(renderTool?.input.safeParse({ media: 'anime', budget: { maxPages: 1 } }).success).toBe(
      false,
    );
  });
});
