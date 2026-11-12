import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { HttpClient } from '../../packages/bangumi-transport/dist/index.js';
import { createRelationSafetyMcpServer } from '../../scripts/acceptance/native-relation-safety-mcp.mjs';
import {
  RELATION_SAFETY_CALLS,
  RELATION_SAFETY_IDS,
  verifyRelationSafetyResult,
} from '../../scripts/lib/native-relation-safety-contract.mjs';

const call = (client, index, change = {}) =>
  client.callTool({
    name: RELATION_SAFETY_CALLS[index].toolName,
    arguments: structuredClone(RELATION_SAFETY_CALLS[index].arguments),
    ...change,
  });
async function connected(options) {
  const host = createRelationSafetyMcpServer(options);
  const client = new Client({ name: 'native-relation-fixture', version: '1.0.0' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await host.server.connect(st);
  await client.connect(ct);
  return {
    host,
    client,
    close: async () => {
      await client.close();
      await host.close();
    },
  };
}
const read = (result) => result.structuredContent ?? JSON.parse(result.content[0].text);

test('actual registry, provider and SDK preserve conflicting rows and derive only safe anime steps', async () => {
  const f = await connected();
  try {
    const catalog = await f.client.listTools();
    assert.deepEqual(
      catalog.tools.map((tool) => tool.name),
      RELATION_SAFETY_CALLS.map((c) => c.toolName),
    );
    assert.equal(catalog.tools[0].inputSchema.properties.includeEvidence.type, 'boolean');
    assert(catalog.tools[1].inputSchema.properties.media.enum.includes('all'));
    const direct = await call(f.client, 0);
    assert.notEqual(direct.isError, true);
    const source = read(direct);
    verifyRelationSafetyResult(0, source);
    assert.equal(f.host.snapshot().fixtureReads, 1);
    const order = await call(f.client, 1);
    assert.notEqual(order.isError, true);
    const full = read(order);
    verifyRelationSafetyResult(1, full);
    const text = JSON.parse(order.content[0].text);
    assert(Buffer.byteLength(order.content[0].text) <= 3600);
    assert(order.structuredContent, 'normal compact presenter must retain full structure');
    assert.equal(text.excluded.samples.length + text.excluded.samplesOmittedFromText, 3);
    assert.equal(text.related.length + text.mcpTextProjection.relatedRowsOmittedFromText, 4);
    assert.equal(text.watchOrder.length + text.mcpTextProjection.watchOrderRowsOmittedFromText, 2);
    assert.equal(full.excluded.samples.length, 3);
    assert.deepEqual(
      full.related.find((r) => r.id === RELATION_SAFETY_IDS.conflict).relationLabels,
      ['前传', '续集'],
    );
    const snapshot = f.host.snapshot();
    assert.equal(snapshot.phase, 'COMPLETE');
    assert.equal(snapshot.completedCalls, 2);
    assert.equal(snapshot.fixtureReads, 5);
    assert.equal(snapshot.denied, 0);
    assert.equal(snapshot.failure, null);
    for (const key of ['modelEvidence', 'acceptanceCredit', 'retryAllowed'])
      assert.equal(snapshot[key], false);
    assert.equal(snapshot.liveRequests, 0);
    snapshot.observations[1].stepIds[0] = 1;
    assert.equal(f.host.snapshot().observations[1].stepIds[0], RELATION_SAFETY_IDS.prequel);
  } finally {
    await f.close();
    await f.host.close();
    assert.equal(f.host.snapshot().closed, true);
  }
});

for (const kind of ['wrong order', 'wrong argument', 'extra identity', 'wrong tool', 'duplicate']) {
  test(`finite native contract permanently rejects ${kind} without extra source work`, async () => {
    const f = await connected();
    try {
      let response;
      if (kind === 'wrong order') response = await call(f.client, 1);
      if (kind === 'wrong argument')
        response = await call(f.client, 0, { arguments: { subjectId: 1, includeEvidence: true } });
      if (kind === 'extra identity')
        response = await call(f.client, 0, {
          arguments: { ...RELATION_SAFETY_CALLS[0].arguments, userId: 'synthetic' },
        });
      if (kind === 'wrong tool') response = await call(f.client, 0, { name: 'bangumi.auth_start' });
      if (kind === 'duplicate') {
        assert.notEqual((await call(f.client, 0)).isError, true);
        assert.notEqual((await call(f.client, 1)).isError, true);
        response = await call(f.client, 1);
      }
      assert.equal(response.isError, true);
      const reads = f.host.snapshot().fixtureReads;
      assert.equal(reads, kind === 'duplicate' ? 5 : 0);
      assert.equal(f.host.snapshot().phase, 'FAILED');
      assert.equal((await call(f.client, 0)).isError, true);
      assert.equal(f.host.snapshot().fixtureReads, reads);
    } finally {
      await f.close();
    }
  });
}

test('overlapping requests fail closed and cannot be reset by catalog reads', async () => {
  const f = await connected();
  try {
    const results = await Promise.all([call(f.client, 0), call(f.client, 0)]);
    assert(results.some((result) => result.isError));
    assert.equal(f.host.snapshot().phase, 'FAILED');
    const reads = f.host.snapshot().fixtureReads;
    await f.client.listTools();
    assert.equal((await call(f.client, 1)).isError, true);
    assert.equal(f.host.snapshot().fixtureReads, reads);
  } finally {
    await f.close();
  }
});

test('semantic verifier rejects loss of raw conflict, fabricated completeness and unsafe steps', async () => {
  const f = await connected();
  try {
    const direct = read(await call(f.client, 0));
    const order = read(await call(f.client, 1));
    const mutate = (index, source, edit) => {
      const copy = structuredClone(source);
      edit(copy);
      assert.throws(
        () => verifyRelationSafetyResult(index, copy),
        /NATIVE_RELATION_RESULT_INVALID/u,
      );
    };
    mutate(0, direct, (v) => v.items.splice(2, 1));
    mutate(0, direct, (v) => {
      v.coverage.completeness = 'complete';
    });
    mutate(0, direct, (v) => {
      v.source.direction = 'undirected';
    });
    mutate(1, order, (v) => {
      v.watchOrder[0].id = RELATION_SAFETY_IDS.conflict;
    });
    mutate(1, order, (v) => {
      v.watchOrder[0].type = 'book';
    });
    mutate(1, order, (v) => {
      v.excluded.samples[0].relationLabels.pop();
    });
    mutate(1, order, (v) => {
      v.related.find((r) => r.id === RELATION_SAFETY_IDS.book).includedInWatchOrder = true;
    });
    mutate(1, order, (v) => {
      v.coverage.relationRowsObserved = 5;
    });
    mutate(1, order, (v) => {
      v.state = 'complete';
    });
    mutate(1, order, (v) => {
      v.edges.pop();
    });
    mutate(1, order, (v) => {
      v.limitations = [];
    });
  } finally {
    await f.close();
  }
});

test('same actual SDK also completes over a separate stdio child with no model', async () => {
  const client = new Client({ name: 'native-relation-stdio', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('./fixtures/native-relation-safety-worker.mjs', import.meta.url))],
    stderr: 'pipe',
    env: { PATH: process.env.PATH },
  });
  try {
    await client.connect(transport);
    assert.equal((await client.listTools()).tools.length, 2);
    for (let index = 0; index < 2; index++) {
      const result = await call(client, index);
      assert.notEqual(result.isError, true);
      verifyRelationSafetyResult(index, read(result));
    }
  } finally {
    await client.close();
  }
});

for (const [name, edit] of [
  ['extra source path', (o) => ({ ...o, path: '/v0/subjects/1/subjects' })],
  ['credential header', (o) => ({ ...o, accessToken: 'synthetic-forbidden' })],
  ['query expansion', (o) => ({ ...o, query: { offset: 1 } })],
  ['write method', (o) => ({ ...o, method: 'POST', body: { synthetic: true } })],
]) {
  test(`actual transport refuses ${name} before any fixture read or live fallback`, async () => {
    const f = await connected();
    const request = HttpClient.prototype.request;
    const fetch = globalThis.fetch;
    let network = 0;
    globalThis.fetch = async () => {
      network++;
      throw new Error('NO_LIVE_FETCH');
    };
    HttpClient.prototype.request = function (options) {
      return request.call(this, { ...edit(options), retryOptions: { maxRetries: 0 } });
    };
    try {
      assert.equal((await call(f.client, 0)).isError, true);
      assert.equal(f.host.snapshot().phase, 'FAILED');
      assert.equal(f.host.snapshot().fixtureReads, 0);
      assert.equal(network, 0);
    } finally {
      HttpClient.prototype.request = request;
      globalThis.fetch = fetch;
      await f.close();
    }
  });
}

test('close aborts admitted work, drains it, and cannot reopen the instance', async () => {
  const f = await connected();
  const request = HttpClient.prototype.request;
  let release, admitted;
  const started = new Promise((resolve) => {
    admitted = resolve;
  });
  const held = new Promise((resolve) => {
    release = resolve;
  });
  HttpClient.prototype.request = async function (options) {
    admitted();
    await held;
    return request.call(this, { ...options, retryOptions: { maxRetries: 0 } });
  };
  try {
    const response = call(f.client, 0).catch(() => null);
    await started;
    const closing = f.host.close();
    assert.equal(f.host.snapshot().closed, true);
    release();
    await closing;
    await response;
    assert.equal(f.host.snapshot().fixtureReads, 0);
    assert.equal(f.host.snapshot().failure.stage, 'cleanup');
    assert.equal(f.host.snapshot().phase, 'FAILED');
    await f.host.close();
  } finally {
    release();
    HttpClient.prototype.request = request;
    await f.close();
  }
});

for (const mode of ['cancellation', 'deadline']) {
  test(`actual SDK ${mode} records the first safe failure and denies late source work`, async () => {
    const f = await connected({ timeoutMs: mode === 'deadline' ? 10 : 20000 });
    const request = HttpClient.prototype.request;
    let release, admitted;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    const started = new Promise((resolve) => {
      admitted = resolve;
    });
    HttpClient.prototype.request = async function (options) {
      admitted();
      await held;
      return request.call(this, { ...options, retryOptions: { maxRetries: 0 } });
    };
    const abort = new AbortController();
    try {
      const response = f.client
        .callTool(
          {
            name: RELATION_SAFETY_CALLS[0].toolName,
            arguments: structuredClone(RELATION_SAFETY_CALLS[0].arguments),
          },
          undefined,
          { signal: abort.signal },
        )
        .catch(() => null);
      await started;
      if (mode === 'cancellation') abort.abort();
      await response;
      for (let i = 0; i < 100 && f.host.snapshot().phase !== 'FAILED'; i++)
        await new Promise((resolve) => setTimeout(resolve, 5));
      assert.equal(f.host.snapshot().phase, 'FAILED');
      assert.equal(f.host.snapshot().failure.stage, mode);
      release();
      const closing = f.host.close();
      await closing;
      assert.equal(f.host.snapshot().fixtureReads, 0);
      assert.equal(f.host.snapshot().failure.stage, mode);
    } finally {
      release();
      HttpClient.prototype.request = request;
      await f.close();
    }
  });
}
