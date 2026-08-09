import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from 'zod';
import { MemoryStorage } from '../../packages/db/src/index.js';
import { HttpClient } from '../../packages/bangumi-transport/src/index.js';
import {
  ToolRegistry,
  createRuntimeDependencies,
  defineTool,
} from '../../packages/tools/src/index.js';
import { BangumiMcpServer } from '../../apps/mcp/src/server.js';

const trustedIdentity = {
  async resolveContext() {
    return {
      principalId: 'principal-a',
      botInstanceId: 'qq:10001',
      conversationId: 'qq:10001:group:20001:user:30001',
    };
  },
};

function fixedGrant(grant: string | undefined) {
  return {
    getGrant: () => grant,
  };
}

async function connectClient(app: BangumiMcpServer, name: string) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await app.getMcpServer().connect(serverTransport);
  const client = new Client({ name, version: '1.0' }, { capabilities: {} });
  await client.connect(clientTransport);
  return client;
}

function parseMcpError(response: unknown) {
  const responseRecord = response as { content?: unknown };
  const text = (responseRecord.content as Array<{ type: string; text: string }>)[0]!.text;
  return JSON.parse(text) as {
    ok: boolean;
    error: { code: string; nextAction?: string };
  };
}

describe('MCP host confirmation contract', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('advertises _confirmationId only on write tools', async () => {
    const app = new BangumiMcpServer({
      storage: new MemoryStorage(),
      identityProvider: trustedIdentity,
      confirmationGrantProvider: fixedGrant('cfm_valid'),
    });
    const client = await connectClient(app, 'schema-contract');
    const tools = await client.listTools();
    const writeTool = tools.tools.find((tool) => tool.name === 'bangumi.auth_switch_account');
    const readTool = tools.tools.find((tool) => tool.name === 'bangumi.search_subjects');

    expect(writeTool?.inputSchema.properties?._confirmationId).toMatchObject({
      type: 'string',
      pattern: '^cfm_[A-Za-z0-9_-]+$',
    });
    expect(readTool?.inputSchema.properties?._confirmationId).toBeUndefined();
    await client.close();
  });

  it('removes reserved fields and forwards only the valid confirmation control', async () => {
    const app = new BangumiMcpServer({
      storage: new MemoryStorage(),
      identityProvider: trustedIdentity,
      confirmationGrantProvider: fixedGrant('cfm_valid'),
    });
    const executeSpy = vi.spyOn(app.getRegistry(), 'executeTool').mockResolvedValue({ ok: true });
    const client = await connectClient(app, 'reserved-fields-contract');

    await client.callTool({
      name: 'bangumi.auth_switch_account',
      arguments: {
        accountId: 'account-a',
        _confirmationId: 'cfm_valid',
        confirmationId: 'cfm_valid',
        principalId: 'forged-principal',
        _principalId: 'forged-principal',
        botInstanceId: 'forged-bot',
        _botInstanceId: 'forged-bot',
        externalUserId: 'forged-user',
        _externalUserId: 'forged-user',
        conversationId: 'forged-conversation',
        _conversationId: 'forged-conversation',
        requestId: 'forged-request',
        _requestId: 'forged-request',
        confirmationGrant: 'forged-grant',
        _confirmationGrant: 'forged-grant',
        BANGUMI_MCP_CONFIRMATION_GRANT: 'forged-grant',
      },
    });

    const passedArgs = executeSpy.mock.calls[0]![1] as Record<string, unknown>;
    const passedContext = executeSpy.mock.calls[0]![2];
    expect(passedArgs).toEqual({ accountId: 'account-a' });
    expect(passedContext.confirmationId).toBe('cfm_valid');
    expect(passedContext.requestId).toMatch(/^req_/);
    expect(passedContext.principalId).toBe('principal-a');
    await client.close();
  });

  it('rejects conflicting legacy and reserved confirmation IDs safely', async () => {
    const app = new BangumiMcpServer({
      storage: new MemoryStorage(),
      identityProvider: trustedIdentity,
    });
    const executeSpy = vi.spyOn(app.getRegistry(), 'executeTool');
    const client = await connectClient(app, 'confirmation-conflict');

    const response = await client.callTool({
      name: 'bangumi.auth_switch_account',
      arguments: {
        accountId: 'account-a',
        _confirmationId: 'cfm_one',
        confirmationId: 'cfm_two',
      },
    });

    expect(response.isError).toBe(true);
    expect(parseMcpError(response).error.code).toBe('CONFIRMATION_INVALID');
    expect(executeSpy).not.toHaveBeenCalled();
    await client.close();
  });

  it('completes one confirmation lifecycle and rejects wrong context, payload, and replay', async () => {
    const storage = new MemoryStorage();
    const dependencies = createRuntimeDependencies({
      storage,
      publicHttpClient: new HttpClient(),
      secretKey: 'test-secret-key-123456789012345678901234',
    });
    const registry = new ToolRegistry(dependencies);
    let executionCount = 0;
    const grantState: { value?: string } = {};
    registry.registerTool(
      defineTool({
        name: 'test.destructive_write',
        description: 'Test destructive write',
        input: z.object({ value: z.string() }),
        auth: 'none',
        scopes: [],
        risk: 'destructive',
        execute: async () => {
          executionCount += 1;
          return { success: true };
        },
      }),
    );

    const app = new BangumiMcpServer({
      dependencies,
      registry,
      identityProvider: trustedIdentity,
      confirmationGrantProvider: {
        getGrant: () => grantState.value,
      },
    });
    const client = await connectClient(app, 'confirmation-lifecycle');
    const first = await client.callTool({
      name: 'test.destructive_write',
      arguments: { value: 'same-payload' },
    });
    const firstError = parseMcpError(first);
    const confirmationId = firstError.error.nextAction?.match(/cfm_[A-Za-z0-9_-]+/)?.[0];

    expect(first.isError).toBe(true);
    expect(firstError.error.code).toBe('CONFIRMATION_REQUIRED');
    expect(confirmationId).toMatch(/^cfm_/);
    grantState.value = confirmationId;

    const noGrantApp = new BangumiMcpServer({
      dependencies,
      registry,
      identityProvider: trustedIdentity,
      confirmationGrantProvider: fixedGrant(undefined),
    });
    const noGrantClient = await connectClient(noGrantApp, 'remembered-id-without-grant');
    const rememberedWithoutGrant = await noGrantClient.callTool({
      name: 'test.destructive_write',
      arguments: { value: 'same-payload', _confirmationId: confirmationId },
    });
    expect(parseMcpError(rememberedWithoutGrant).error.code).toBe('CONFIRMATION_INVALID');
    expect(executionCount).toBe(0);

    const mismatchedGrantApp = new BangumiMcpServer({
      dependencies,
      registry,
      identityProvider: trustedIdentity,
      confirmationGrantProvider: fixedGrant('cfm_other'),
    });
    const mismatchedGrantClient = await connectClient(mismatchedGrantApp, 'mismatched-grant');
    const mismatchedGrant = await mismatchedGrantClient.callTool({
      name: 'test.destructive_write',
      arguments: { value: 'same-payload', _confirmationId: confirmationId },
    });
    expect(parseMcpError(mismatchedGrant).error.code).toBe('CONFIRMATION_INVALID');

    const wrongContextApp = new BangumiMcpServer({
      dependencies,
      registry,
      identityProvider: {
        async resolveContext() {
          return {
            principalId: 'principal-b',
            botInstanceId: 'qq:10001',
            conversationId: 'qq:10001:group:20001:user:30002',
          };
        },
      },
      confirmationGrantProvider: {
        getGrant: () => grantState.value,
      },
    });
    const wrongContextClient = await connectClient(wrongContextApp, 'wrong-context');
    const wrongContext = await wrongContextClient.callTool({
      name: 'test.destructive_write',
      arguments: { value: 'same-payload', _confirmationId: confirmationId },
    });
    expect(parseMcpError(wrongContext).error.code).toBe('CONFIRMATION_INVALID');

    const wrongConversationApp = new BangumiMcpServer({
      dependencies,
      registry,
      identityProvider: {
        async resolveContext() {
          return {
            principalId: 'principal-a',
            botInstanceId: 'qq:10001',
            conversationId: 'qq:10001:group:20001:user:other-conversation',
          };
        },
      },
      confirmationGrantProvider: {
        getGrant: () => grantState.value,
      },
    });
    const wrongConversationClient = await connectClient(wrongConversationApp, 'wrong-conversation');
    const wrongConversation = await wrongConversationClient.callTool({
      name: 'test.destructive_write',
      arguments: { value: 'same-payload', _confirmationId: confirmationId },
    });
    expect(parseMcpError(wrongConversation).error.code).toBe('CONFIRMATION_INVALID');

    const changedPayload = await client.callTool({
      name: 'test.destructive_write',
      arguments: { value: 'changed-payload', _confirmationId: confirmationId },
    });
    expect(parseMcpError(changedPayload).error.code).toBe('CONFIRMATION_INVALID');

    const confirmed = await client.callTool({
      name: 'test.destructive_write',
      arguments: { value: 'same-payload', _confirmationId: confirmationId },
    });
    expect(confirmed.isError).toBeUndefined();
    expect(executionCount).toBe(1);

    const replay = await client.callTool({
      name: 'test.destructive_write',
      arguments: { value: 'same-payload', _confirmationId: confirmationId },
    });
    expect(parseMcpError(replay).error.code).toBe('CONFIRMATION_INVALID');
    await wrongContextClient.close();
    await wrongConversationClient.close();
    await mismatchedGrantClient.close();
    await noGrantClient.close();
    await client.close();
    await storage.close();
  });
});
