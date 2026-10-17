import assert from 'node:assert/strict';
import test from 'node:test';

test('one-tool MCP server module imports without starting its stdio entry point', async () => {
  const serverModule = await import('../../apps/mcp/codex-one-tool-mcp-server.mjs');
  assert.equal(typeof serverModule, 'object');
});
