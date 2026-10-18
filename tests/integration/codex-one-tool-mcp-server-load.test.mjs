import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const productRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('one-tool MCP server module imports without starting its stdio entry point', async () => {
  const serverModule = await import('../../apps/mcp/codex-one-tool-mcp-server.mjs');
  assert.equal(typeof serverModule, 'object');
});

test('offline auth_start MCP module imports without stdio and resolves the repository root', async () => {
  const serverModule = await import('../../apps/mcp/codex-auth-start-offline-mcp-server.mjs');
  assert.equal(serverModule.PRODUCT_ROOT, productRoot);
});
