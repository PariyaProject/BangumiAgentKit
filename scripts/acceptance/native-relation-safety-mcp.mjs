import { isDeepStrictEqual } from 'node:util';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { MemoryStorage } from '../../packages/db/dist/index.js';
import { GeneratedBangumiOpenApiClient } from '../../packages/bangumi-openapi/dist/index.js';
import { HttpClient } from '../../packages/bangumi-transport/dist/index.js';
import { ToolRegistry } from '../../packages/tools/dist/index.js';
import { toMcpTool } from '../../apps/mcp/dist/catalog.js';
import { presentMcpToolResult } from '../../apps/mcp/dist/result-presenter.js';
import {
  RELATION_SAFETY_CALLS,
  RELATION_SAFETY_RESPONSES,
  verifyRelationSafetyResult,
} from '../lib/native-relation-safety-contract.mjs';

/** Construction only: no model, live HTTP, process, file or control-plane dispatch. */
export function createRelationSafetyMcpServer({ timeoutMs = 20000 } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20000)
    throw new TypeError('A bounded native observation deadline is required.');
  let phase = 'READY',
    nextCall = 0,
    reads = 0,
    denied = 0,
    closed = false;
  let active = null,
    closePromise,
    failure = null;
  const observations = [];
  const pending = new Set();
  const refuse = (stage = 'request') => {
    denied++;
    failure ??= { code: 'NATIVE_RELATION_OPERATION_DENIED', stage };
    phase = 'FAILED';
    active?.abort();
    throw new Error('NATIVE_RELATION_OPERATION_DENIED');
  };
  const fetchFn = async (input, init = {}) => {
    try {
      if (!active || closed || phase !== 'RUNNING') throw new Error('INACTIVE');
      const url = new URL(String(input));
      const expected = RELATION_SAFETY_RESPONSES[reads];
      const headers = new Headers(init.headers);
      if (
        !expected ||
        url.origin !== 'https://api.bgm.tv' ||
        url.pathname !== expected.path ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        init.method !== 'GET' ||
        init.body != null ||
        init.signal?.aborted ||
        Object.keys(init).some((key) => !['method', 'headers', 'body', 'signal'].includes(key)) ||
        [...headers.keys()].some(
          (key) => !['accept', 'content-type', 'user-agent'].includes(key),
        ) ||
        (nextCall === 0 && reads !== 0) ||
        (nextCall === 1 && reads < 1)
      )
        throw new Error('INVALID_REQUEST');
      reads++;
      return Response.json(expected.body);
    } catch {
      return refuse('source');
    }
  };
  const forbiddenService = () => refuse('service');
  const disabled = new Proxy({}, { get: () => forbiddenService });
  const storage = new MemoryStorage();
  const http = new HttpClient({ fetchFn });
  const provider = new GeneratedBangumiOpenApiClient(http);
  const registry = new ToolRegistry(
    {
      storage,
      publicHttpClient: http,
      clientProvider: {
        getPublicClient: async () => provider,
        getOptionalAuthenticatedClient: forbiddenService,
        requireAuthenticatedClient: forbiddenService,
      },
      tokenBroker: disabled,
      oauthService: disabled,
      auditService: disabled,
      renderService: { close: async () => {} },
      artifactStore: disabled,
    },
    { profile: 'full' },
  );
  const context = Object.freeze({
    principalId: 'relation-synthetic-observation',
    botInstanceId: 'relation-synthetic-observation',
    conversationId: 'relation-synthetic-observation',
  });
  const tools = RELATION_SAFETY_CALLS.map(({ toolName }) => {
    const tool = registry.getTool(toolName);
    if (!tool || tool.auth !== 'none' || tool.risk !== 'read') return refuse();
    return toMcpTool(tool);
  });
  const server = new Server(
    { name: 'bgk_native_relation_safety', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: structuredClone(tools) }));
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    let timer;
    let stage = 'request';
    const controller = new AbortController();
    const abort = (reason) => {
      failure ??= {
        code: 'NATIVE_RELATION_INTERRUPTED',
        stage: reason === 'deadline' ? 'deadline' : 'cancellation',
      };
      controller.abort();
    };
    try {
      const expected = RELATION_SAFETY_CALLS[nextCall];
      if (
        closed ||
        active ||
        phase === 'FAILED' ||
        !expected ||
        extra.signal.aborted ||
        request.params.name !== expected.toolName ||
        !isDeepStrictEqual(request.params.arguments, expected.arguments)
      )
        return refuse();
      active = controller;
      phase = 'RUNNING';
      stage = 'execution';
      const interrupted = new Promise((_, reject) => {
        controller.signal.addEventListener(
          'abort',
          () => reject(new Error('NATIVE_RELATION_INTERRUPTED')),
          { once: true },
        );
      });
      extra.signal.addEventListener('abort', abort, { once: true });
      timer = setTimeout(() => abort('deadline'), timeoutMs);
      const work = registry.executeTool(
        expected.toolName,
        structuredClone(expected.arguments),
        context,
      );
      pending.add(work);
      void work.then(
        () => pending.delete(work),
        () => pending.delete(work),
      );
      const result = await Promise.race([work, interrupted]);
      if (
        closed ||
        phase !== 'RUNNING' ||
        controller.signal.aborted ||
        reads !== (nextCall === 0 ? 1 : 5)
      )
        return refuse();
      stage = 'verification';
      const facts = verifyRelationSafetyResult(nextCall, result);
      stage = 'presentation';
      const presented = presentMcpToolResult(expected.toolName, result);
      if (Buffer.byteLength(presented.text, 'utf8') > 3600) return refuse();
      // Compaction must be lossless in structuredContent. Small responses may be text-only.
      if (!isDeepStrictEqual(presented.structuredContent ?? JSON.parse(presented.text), result))
        return refuse();
      observations.push(facts);
      nextCall++;
      phase = nextCall === 1 ? 'DIRECT_VERIFIED' : 'COMPLETE';
      return {
        content: [{ type: 'text', text: presented.text }],
        ...(presented.structuredContent ? { structuredContent: presented.structuredContent } : {}),
      };
    } catch {
      failure ??= { code: 'NATIVE_RELATION_OBSERVATION_FAILED', stage };
      phase = 'FAILED';
      return {
        content: [{ type: 'text', text: 'NATIVE_RELATION_OBSERVATION_FAILED' }],
        structuredContent: { errorCode: 'NATIVE_RELATION_OBSERVATION_FAILED' },
        isError: true,
      };
    } finally {
      clearTimeout(timer);
      extra.signal.removeEventListener('abort', abort);
      if (active === controller) active = null;
    }
  });
  return {
    server,
    snapshot: () =>
      structuredClone({
        contract: 'native-relation-safety-v1',
        phase,
        completedCalls: nextCall,
        fixtureReads: reads,
        maxFixtureReads: 5,
        denied,
        failure,
        deadlineMs: timeoutMs,
        observations,
        closed,
        syntheticSource: true,
        liveRequests: 0,
        modelEvidence: false,
        acceptanceCredit: false,
        retryAllowed: false,
      }),
    close() {
      closePromise ??= (async () => {
        closed = true;
        if (active) failure ??= { code: 'NATIVE_RELATION_INTERRUPTED', stage: 'cleanup' };
        active?.abort();
        const results = await Promise.allSettled([server.close()]);
        await Promise.allSettled([...pending]);
        results.push(...(await Promise.allSettled([registry.close(), storage.close()])));
        if (results.some((result) => result.status === 'rejected'))
          throw new Error('NATIVE_RELATION_CLOSE_FAILED');
      })();
      return closePromise;
    },
  };
}
