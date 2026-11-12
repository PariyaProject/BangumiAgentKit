import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { DiscoveryEngine } from '../../packages/discovery/dist/index.js';
import { HttpClient } from '../../packages/bangumi-transport/dist/index.js';
import { GeneratedBangumiOpenApiClient } from '../../packages/bangumi-openapi/dist/index.js';
import { OfficialV0Provider } from '../../packages/provider-core/dist/index.js';
import { buildDiscoveryResultsViewModel } from '../../packages/renderer/dist/index.js';
import { createG03NativeMcpServer } from '../../scripts/acceptance/g03-native-discovery-mcp.mjs';
import {
  createG03NativeVerification,
  G03_NATIVE_CALLS,
  G03_NATIVE_QUERY,
  G03_NATIVE_ROWS,
} from '../../scripts/lib/g03-native-discovery-verification.mjs';

const queryCall = G03_NATIVE_CALLS[0],
  renderCall = G03_NATIVE_CALLS[1];
const invoke = (kernel, execute, call = queryCall, options) =>
  kernel.call(execute, call.toolName, call.arguments, options);
let png, imageFacts;

function fixture({ readArtifact = async () => png, timeoutMs } = {}) {
  const kernel = createG03NativeVerification({ readArtifact, timeoutMs });
  const engine = new DiscoveryEngine(
    new OfficialV0Provider(
      new GeneratedBangumiOpenApiClient(new HttpClient({ fetchFn: kernel.fetchFn })),
    ),
  );
  return { kernel, query: () => engine.query(G03_NATIVE_QUERY) };
}

before(async () => {
  const host = await createG03NativeMcpServer();
  const client = new Client({ name: 'g03-fixture-image', version: '1.0.0' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  try {
    await host.server.connect(st);
    await client.connect(ct);
    const catalog = await client.listTools();
    assert.deepEqual(
      catalog.tools.map((tool) => tool.name),
      G03_NATIVE_CALLS.map((call) => call.toolName),
    );
    for (const tool of catalog.tools) {
      assert.equal(tool.inputSchema.properties.from.type, 'string');
      assert.equal(tool.inputSchema.properties.ratingCount.type, 'object');
    }
    for (const call of G03_NATIVE_CALLS) {
      const result = await client.callTool({ name: call.toolName, arguments: call.arguments });
      assert.notEqual(result.isError, true);
    }
    png = host.verifiedPng();
    imageFacts = host.snapshot().image;
    assert.equal(host.snapshot().phase, 'COMPLETE');
    assert.equal(host.snapshot().forbiddenServices, 0);
    assert.equal(imageFacts.width, 720);
    assert.deepEqual(imageFacts.rows, G03_NATIVE_ROWS);
  } finally {
    await client.close();
    await host.close();
    await host.close();
    assert.throws(() => host.verifiedPng(), /G03_NATIVE/u);
  }
});

test('native query validates real transport, hydration, order, coverage and immutable snapshots', async () => {
  const { kernel, query } = fixture();
  await invoke(kernel, query);
  const snapshot = kernel.snapshot();
  assert.equal(snapshot.phase, 'QUERY_VERIFIED');
  assert.equal(snapshot.searchRequests, 1);
  assert.equal(snapshot.detailRequests, 6);
  assert.equal(snapshot.denied, 0);
  assert.deepEqual(snapshot.observation.rows, G03_NATIVE_ROWS);
  snapshot.observation.rows[0].date = 'forged';
  assert.deepEqual(kernel.snapshot().observation.rows, G03_NATIVE_ROWS);
  assert.equal(snapshot.modelEvidence, false);
  assert.equal(snapshot.liveEvidence, false);
});

test('stored PNG must match the observed real render, and both calls remain consumed', async () => {
  for (const corrupt of [false, true]) {
    const { kernel, query } = fixture({
      readArtifact: async () => (corrupt ? Buffer.from('forged') : png),
    });
    await invoke(kernel, query);
    const executeRender = async () => {
      const result = await query();
      kernel.observeRender(
        buildDiscoveryResultsViewModel(result, G03_NATIVE_QUERY),
        { ...imageFacts, buffer: png },
        { width: 360, deviceScaleFactor: 2, theme: 'light' },
      );
      kernel.admitArtifactWrite(png, 'image/png', imageFacts);
      return {
        artifact: {
          id: 'art_' + 'a'.repeat(32),
          mimeType: 'image/png',
          width: imageFacts.width,
          height: imageFacts.height,
        },
      };
    };
    if (corrupt) {
      await assert.rejects(invoke(kernel, executeRender, renderCall), /G03_NATIVE/u);
      assert.equal(kernel.snapshot().phase, 'FAILED');
    } else {
      await invoke(kernel, executeRender, renderCall);
      assert.equal(kernel.snapshot().phase, 'COMPLETE');
      assert.equal(kernel.snapshot().searchRequests, 2);
      assert.equal(kernel.snapshot().detailRequests, 12);
      assert.equal(kernel.snapshot().denied, 0);
    }
    let retried = false;
    await assert.rejects(
      invoke(kernel, async () => {
        retried = true;
      }),
      /G03_NATIVE/u,
    );
    assert.equal(retried, false);
  }
});

test('wrong tool, missing, expanded, and changed arguments refuse before execution', async () => {
  const invalid = [
    { ...queryCall, toolName: renderCall.toolName },
    { ...queryCall, arguments: {} },
    { ...queryCall, arguments: { ...G03_NATIVE_QUERY, limit: 1 } },
    { ...queryCall, arguments: { ...G03_NATIVE_QUERY, from: '2024-02-01' } },
    { ...queryCall, arguments: { ...G03_NATIVE_QUERY, _principalId: 'untrusted' } },
  ];
  for (const call of invalid) {
    const { kernel } = fixture();
    let executed = false;
    await assert.rejects(
      invoke(
        kernel,
        async () => {
          executed = true;
        },
        call,
      ),
      /G03_NATIVE/u,
    );
    assert.equal(executed, false);
    assert.equal(kernel.snapshot().searchRequests, 0);
    assert.equal(kernel.snapshot().phase, 'FAILED');
  }
});

test('unobserved, forged, or corrupted render output cannot become verified', async () => {
  const mutations = [
    (view) => {
      view.items[0].date = '2024-05-01';
    },
    (view) => {
      view.items[0].score = 9;
    },
    (view) => {
      view.items[0].ratingCount = 5000;
    },
    (view) => {
      view.items[0].name = 'forged';
    },
    (view, result) => {
      result.buffer = result.buffer.subarray(0, result.buffer.length - 1);
    },
    (view, result) => {
      result.width = 721;
    },
    (view, result, options) => {
      options.width = 640;
    },
  ];
  for (const mutate of mutations) {
    const { kernel, query } = fixture();
    await invoke(kernel, query);
    await assert.rejects(
      invoke(
        kernel,
        async () => {
          const queryResult = await query();
          const view = buildDiscoveryResultsViewModel(queryResult, G03_NATIVE_QUERY);
          const result = { ...imageFacts, buffer: png };
          const options = { width: 360, deviceScaleFactor: 2, theme: 'light' };
          mutate(view, result, options);
          kernel.observeRender(view, result, options);
        },
        renderCall,
      ),
      /G03_NATIVE/u,
    );
    assert.equal(kernel.snapshot().phase, 'FAILED');
  }
  const { kernel, query } = fixture();
  await invoke(kernel, query);
  await assert.rejects(
    invoke(kernel, () => ({ artifact: {} }), renderCall),
    /G03_NATIVE/u,
  );
});

test('forged result rows, absent caveats, or inaccurate coverage are terminal', async () => {
  const mutations = [
    (result) => {
      result.items[0].date = '2024-05-01';
    },
    (result) => {
      result.items.reverse();
    },
    (result) => {
      result.items[0].score = 9;
    },
    (result) => {
      result.coverage.totalKind = 'exact';
    },
    (result) => {
      result.coverage.hydrationsAttempted = 5;
    },
    (result) => {
      result.plan.limitations = [];
    },
    (result) => {
      result.warnings = [];
    },
    (result) => {
      result.extra = 'x'.repeat(512 * 1024);
    },
    (result) => {
      result.items[0].image = 'https://example.invalid/cover.png';
    },
  ];
  for (const mutate of mutations) {
    const { kernel, query } = fixture();
    await assert.rejects(
      invoke(kernel, async () => {
        const result = await query();
        mutate(result);
        return result;
      }),
      /G03_NATIVE/u,
    );
    assert.equal(kernel.snapshot().phase, 'FAILED');
  }
});

test('fixture denies outside routes, duplicate reads, credentials, and altered search', async () => {
  const invalid = [
    ['https://example.invalid/v0/search/subjects', { method: 'POST' }],
    ['https://api.bgm.tv/v0/subjects/9631001', { method: 'PUT' }],
    ['https://api.bgm.tv/v0/search/subjects?limit=20&offset=0', { method: 'POST', body: '{}' }],
    [
      'https://api.bgm.tv/v0/subjects/9631001',
      { method: 'GET', headers: { authorization: 'fixture-only' } },
    ],
  ];
  for (const [url, init] of invalid) {
    const { kernel } = fixture();
    await assert.rejects(
      invoke(kernel, () => kernel.fetchFn(url, init)),
      /G03_NATIVE/u,
    );
    assert.equal(kernel.snapshot().searchRequests, 0);
    assert.equal(kernel.snapshot().detailRequests, 0);
  }
  const { kernel, query } = fixture();
  await assert.rejects(
    invoke(kernel, async () => {
      await query();
      await kernel.fetchFn('https://api.bgm.tv/v0/subjects/9631001', { method: 'GET' });
    }),
    /G03_NATIVE/u,
  );
  assert.equal(kernel.snapshot().detailRequests, 6);
});

test('cancellation, overlap, deadline and stop settle an active call and forbid later I/O', async () => {
  for (const action of ['cancel', 'overlap', 'deadline', 'stop']) {
    const { kernel } = fixture({ timeoutMs: action === 'deadline' ? 10 : 1000 });
    const abort = new AbortController();
    const pending = invoke(kernel, () => new Promise(() => {}), queryCall, {
      signal: abort.signal,
    });
    const rejected = assert.rejects(pending, /G03_NATIVE/u);
    if (action === 'cancel') abort.abort();
    if (action === 'stop') kernel.stop();
    if (action === 'overlap')
      await assert.rejects(
        invoke(kernel, async () => {}),
        /G03_NATIVE/u,
      );
    await rejected;
    await assert.rejects(
      kernel.fetchFn('https://api.bgm.tv/v0/subjects/9631001', { method: 'GET' }),
      /G03_NATIVE/u,
    );
    assert.equal(kernel.snapshot().searchRequests, 0);
  }
  await delay(0);
});

test('cancel after source completion and pre-abort cannot authorize a later render', async () => {
  const { kernel, query } = fixture();
  const abort = new AbortController();
  let sourceReady;
  const ready = new Promise((resolve) => {
    sourceReady = resolve;
  });
  const pending = invoke(
    kernel,
    async () => {
      await query();
      sourceReady();
      return new Promise(() => {});
    },
    queryCall,
    { signal: abort.signal },
  );
  const rejected = assert.rejects(pending, /G03_NATIVE/u);
  await ready;
  abort.abort();
  await rejected;
  assert.equal(kernel.snapshot().searchRequests, 1);
  assert.equal(kernel.snapshot().detailRequests, 6);
  let rendered = false;
  await assert.rejects(
    invoke(
      kernel,
      () => {
        rendered = true;
      },
      renderCall,
    ),
    /G03_NATIVE/u,
  );
  assert.equal(rendered, false);
  const next = fixture();
  await assert.rejects(
    invoke(
      next.kernel,
      () => {
        rendered = true;
      },
      queryCall,
      { signal: AbortSignal.abort() },
    ),
    /G03_NATIVE/u,
  );
  assert.equal(rendered, false);
});

test(
  'closing during native rendering drains work before artifact cleanup',
  { timeout: 15000 },
  async () => {
    const host = await createG03NativeMcpServer();
    const client = new Client({ name: 'g03-close-during-render', version: '1.0.0' });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    try {
      await host.server.connect(st);
      await client.connect(ct);
      await client.callTool({ name: queryCall.toolName, arguments: queryCall.arguments });
      const pending = client.callTool({
        name: renderCall.toolName,
        arguments: renderCall.arguments,
      });
      const settled = pending.catch(() => undefined);
      for (let attempt = 0; !host.snapshot().renderStarted && attempt < 100; attempt++)
        await delay(5);
      assert.equal(host.snapshot().renderStarted, true);
      await host.close();
      await settled;
      assert.equal(host.snapshot().phase, 'FAILED');
      assert.equal(host.snapshot().image, null);
      assert.throws(() => host.verifiedPng(), /G03_NATIVE/u);
    } finally {
      await client.close();
      await host.close();
    }
  },
);

test(
  'native SDK stdio query and PNG use fourteen fixture requests and remove temporary output',
  { timeout: 15000 },
  async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [new URL('fixtures/g03-native-discovery-worker.mjs', import.meta.url).pathname],
      stderr: 'pipe',
      env: { PATH: process.env.PATH },
    });
    let stderr = '';
    transport.stderr.setEncoding('utf8').on('data', (part) => {
      stderr += part;
    });
    const client = new Client({ name: 'g03-native-stdio', version: '1.0.0' });
    try {
      await client.connect(transport);
      const result = await client.callTool({
        name: queryCall.toolName,
        arguments: queryCall.arguments,
      });
      assert.deepEqual(
        result.structuredContent.items.map(({ id, date }) => ({ id, date: date ?? null })),
        G03_NATIVE_ROWS,
      );
      const image = await client.callTool({
        name: renderCall.toolName,
        arguments: renderCall.arguments,
      });
      assert.notEqual(image.isError, true);
      const artifact = JSON.parse(image.content[0].text).artifact;
      assert.equal(artifact.width, 720);
      assert.equal(artifact.height, imageFacts.height);
    } finally {
      await client.close();
    }
    const summary = JSON.parse(stderr.trim());
    assert.equal(summary.phase, 'COMPLETE');
    assert.equal(summary.searchRequests, 2);
    assert.equal(summary.detailRequests, 12);
    assert.equal(summary.denied, 0);
    assert.equal(summary.forbiddenServices, 0);
    assert.equal(summary.closed, true);
  },
);
