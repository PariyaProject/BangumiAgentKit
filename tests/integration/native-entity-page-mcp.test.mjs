import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createNativeEntityPageMcpServer } from '../../scripts/acceptance/native-entity-page-mcp.mjs';
import { NATIVE_PAGE_CALLS } from '../../scripts/lib/native-entity-page-verification.mjs';

test('new native MCP host advertises only actual two optional-auth tools and rejects implicit account access', async () => {
  let fetched = 0;
  const host = createNativeEntityPageMcpServer({ fetchImpl: async () => { fetched++; throw new Error('NEVER'); } });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'synthetic-test', version: '1.0.0' });
  try {
    await host.server.connect(serverTransport);
    await client.connect(clientTransport);
    const catalog = await client.listTools();
    assert.deepEqual(catalog.tools.map((x) => x.name), NATIVE_PAGE_CALLS.map((x) => x.toolName));
    for (const tool of catalog.tools) {
      assert.equal(tool.annotations.readOnlyHint, true);
      assert.equal(tool.inputSchema.properties.offset.maximum, Number.MAX_SAFE_INTEGER);
      assert.equal(tool.inputSchema.properties.maxItems.maximum, 50);
      assert.equal(tool.inputSchema.required?.includes('username') ?? false, false); // Real optional-auth schema retained.
    }
    const result = await client.callTool({ name: NATIVE_PAGE_CALLS[0].toolName, arguments: { maxItems: 1, offset: 0 } });
    assert.equal(result.isError, true);
    assert.equal(fetched, 0);
    assert.equal(host.snapshot().forbiddenServiceAttempts, 0);
    assert.equal(host.snapshot().phase, 'FAILED');
  } finally {
    await client.close();
    await host.close();
  }
});

test('new native MCP succeeds through a real child stdio protocol with two fake public GETs and no model', { timeout: 10000 }, async () => {
  const child = spawn(process.execPath, [new URL('fixtures/native-entity-page-mcp-worker.mjs', import.meta.url).pathname], {
    stdio: ['pipe', 'pipe', 'pipe'], env: { PATH: process.env.PATH },
  });
  const exited = once(child, 'exit');
  const pending = new Map();
  let id = 0, stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (part) => { stderr += part; });
  const reader = createInterface({ input: child.stdout });
  reader.on('line', (line) => {
    const value = JSON.parse(line);
    if (pending.has(value.id)) { pending.get(value.id)(value); pending.delete(value.id); }
  });
  function request(method, params) {
    const ownId = ++id;
    const reply = new Promise((resolve) => pending.set(ownId, resolve));
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: ownId, method, params }) + '\n');
    return reply;
  }
  try {
    const initialized = await request('initialize', {
      protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'synthetic-stdio', version: '1.0.0' },
    });
    assert.equal(initialized.result.serverInfo.name, 'bgk_native_entity_pages');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    const catalog = await request('tools/list', {});
    assert.equal(catalog.result.tools.length, 2);
    for (const call of NATIVE_PAGE_CALLS) {
      const reply = await request('tools/call', { name: call.toolName, arguments: call.arguments });
      assert.equal(reply.result.isError, false);
      assert.equal(reply.result.structuredContent.observation.empty, 'collection_empty');
      assert.deepEqual(JSON.parse(reply.result.content[0].text), reply.result.structuredContent.observation);
      assert.equal(JSON.stringify(reply.result).includes('username'), false);
    }
    const extra = await request('tools/call', { name: NATIVE_PAGE_CALLS[0].toolName, arguments: NATIVE_PAGE_CALLS[0].arguments });
    assert.equal(extra.result.isError, true);
    child.stdin.end();
    const [code, signal] = await exited;
    assert.equal(code, 0);
    assert.equal(signal, null);
    const receipt = JSON.parse(stderr.trim());
    assert.equal(receipt.requests, 2);
    assert.equal(receipt.facts.requestCount, 2);
    assert.equal(receipt.facts.forbiddenServiceAttempts, 0);
    assert.equal(receipt.facts.liveEvidence, false);
    assert.equal(receipt.facts.deniedCount, 1);
  } finally {
    reader.close();
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await exited;
  }
});
