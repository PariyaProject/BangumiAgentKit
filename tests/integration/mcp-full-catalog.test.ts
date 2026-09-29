import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createFullMcpCatalog } from '../../apps/mcp/src/catalog.js';

describe('standard MCP full catalog', () => {
  it('matches the locked 96-tool catalog and adds confirmation IDs only to writes', async () => {
    const expected = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'docs/tool-catalog.json'), 'utf8'),
    ) as Array<{ name: string; auth: string; risk: string }>;
    const actual = await createFullMcpCatalog();
    const expectedByName = new Map(expected.map((tool) => [tool.name, tool]));

    expect(actual).toHaveLength(96);
    expect(new Set(actual.map((tool) => tool.name))).toEqual(new Set(expectedByName.keys()));
    for (const tool of actual) {
      const expectedTool = expectedByName.get(tool.name)!;
      const properties = tool.inputSchema.properties as Record<string, unknown> | undefined;
      expect(tool.auth).toBe(expectedTool.auth);
      expect(tool.risk).toBe(expectedTool.risk);
      if (tool.risk === 'read') {
        expect(properties?._confirmationId).toBeUndefined();
      } else {
        expect(properties?._confirmationId).toMatchObject({
          type: 'string',
          pattern: '^cfm_[A-Za-z0-9_-]+$',
        });
      }
    }
  });
});
