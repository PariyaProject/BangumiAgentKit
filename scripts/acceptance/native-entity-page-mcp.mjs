// Construction only. There is deliberately no executable/native-fetch default.
// A future claim-bound runner must supply its reviewed fetch adapter explicitly.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { MemoryStorage } from '../../packages/db/dist/index.js';
import { GeneratedBangumiOpenApiClient } from '../../packages/bangumi-openapi/dist/index.js';
import { HttpClient } from '../../packages/bangumi-transport/dist/index.js';
import { ToolRegistry } from '../../packages/tools/dist/index.js';
import { toMcpTool } from '../../apps/mcp/dist/catalog.js';
import { createNativeEntityPageVerification, NATIVE_PAGE_CALLS } from '../lib/native-entity-page-verification.mjs';

export function createNativeEntityPageMcpServer({ fetchImpl } = {}) {
  const observation = createNativeEntityPageVerification({ fetchImpl });
  const storage = new MemoryStorage();
  const publicHttpClient = new HttpClient({ fetchFn: observation.fetchFn });
  const publicClient = new GeneratedBangumiOpenApiClient(publicHttpClient);
  let forbiddenServiceAttempts = 0;
  const refuse = async () => {
    forbiddenServiceAttempts++;
    throw new Error('NATIVE_PAGE_ACCOUNT_OR_WRITE_SERVICE_DISABLED');
  };
  const disabled = new Proxy({}, { get: () => refuse });
  const registry = new ToolRegistry({
    storage, publicHttpClient,
    clientProvider: {
      getPublicClient: async () => publicClient,
      getOptionalAuthenticatedClient: refuse,
      requireAuthenticatedClient: refuse,
    },
    tokenBroker: disabled, oauthService: disabled, auditService: disabled,
  }, { profile: 'full' });
  const context = Object.freeze({
    principalId: 'native-page-anonymous-observation',
    botInstanceId: 'native-page-observation',
    conversationId: 'native-page-observation',
  });
  const descriptors = NATIVE_PAGE_CALLS.map(({ toolName }) => {
    const tool = registry.getTool(toolName);
    if (!tool || tool.auth !== 'optional' || tool.risk !== 'read')
      throw new Error('NATIVE_PAGE_CATALOG_INVALID');
    // Keep the actual optional-auth catalog and schema. Only the kernel's exact
    // explicit-target inputs resolve public; all other arguments fail before
    // registry invocation. No generic catalog or auth exception is modified.
    return { ...toMcpTool(tool), annotations: {
      readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true,
    } };
  });
  const server = new Server({ name: 'bgk_native_entity_pages', version: '1.0.0' }, {
    capabilities: { tools: {} },
  });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: structuredClone(descriptors) }));
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    try {
      const projection = await observation.call(
        (name, args) => registry.executeTool(name, args, context),
        request.params.name, request.params.arguments, { signal: extra.signal },
      );
      return { content: [{ type: 'text', text: JSON.stringify(projection) }],
        structuredContent: { observation: projection }, isError: false };
    } catch {
      // No provider exception text, source rows or tool arguments cross MCP.
      return { content: [{ type: 'text', text: 'NATIVE_PAGE_OBSERVATION_FAILED' }],
        structuredContent: { errorCode: 'NATIVE_PAGE_OBSERVATION_FAILED' }, isError: true };
    }
  });
  return {
    server,
    snapshot: () => ({ ...observation.snapshot(), forbiddenServiceAttempts }),
    async close() {
      observation.stop();
      await server.close();
      await registry.close();
      await storage.close();
    },
  };
}
