import { describe, it, expect, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { BangumiMcpServer } from '../../apps/mcp/src/server.js';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { createRuntimeDependencies } from '@bangumi-agent-kit/tools';

describe('C. Trusted MCP Identity Boundary Regression Test', () => {
  it('strictly ignores or rejects _principalId argument passed in callTool to prevent user impersonation', async () => {
    const storage = new MemoryStorage();
    const deps = createRuntimeDependencies({
      storage,
      secretKey: 'test-secret-key-123456789012345678901234',
    });

    // Custom identity provider locking server identity to 'server-assigned-principal'
    const customIdentityProvider = {
      async resolveContext() {
        return {
          principalId: 'server-assigned-principal',
          botInstanceId: 'local-mcp',
          conversationId: 'server-session-123',
        };
      },
    };

    const mcpApp = new BangumiMcpServer({
      dependencies: deps,
      storage,
      identityProvider: customIdentityProvider,
    });

    const server = mcpApp.getMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client({ name: 'test-client', version: '1.0' }, { capabilities: {} });
    await client.connect(clientTransport);

    // Spy on registry executeTool to inspect the context passed into the tool execution
    const registry = mcpApp.getRegistry();
    const executeSpy = vi.spyOn(registry, 'executeTool').mockResolvedValue({ status: 'ok' });

    // Attempt impersonation attack by passing _principalId = 'victim'
    await client.callTool({
      name: 'bangumi.search_subjects',
      arguments: {
        _principalId: 'victim',
        query: '少女終末旅行',
      },
    });

    expect(executeSpy).toHaveBeenCalled();
    const passedContext = executeSpy.mock.calls[0]![2];
    const passedArgs = executeSpy.mock.calls[0]![1] as any;

    // Verify _principalId in args was NOT used to overwrite server context
    expect(passedContext?.principalId).toBe('server-assigned-principal');
    expect(passedContext?.principalId).not.toBe('victim');
    expect(passedArgs._principalId).toBeUndefined();

    await client.close();
  });

  it('does not allow any model-supplied identity field to override trusted context', async () => {
    const storage = new MemoryStorage();
    const deps = createRuntimeDependencies({
      storage,
      secretKey: 'test-secret-key-123456789012345678901234',
    });
    const mcpApp = new BangumiMcpServer({
      dependencies: deps,
      storage,
      identityProvider: {
        async resolveContext() {
          return {
            principalId: 'trusted-principal',
            botInstanceId: 'trusted-bot',
            conversationId: 'trusted-conversation',
          };
        },
      },
    });
    const server = mcpApp.getMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'identity-fields-client', version: '1.0' }, { capabilities: {} });
    await client.connect(clientTransport);

    const executeSpy = vi.spyOn(mcpApp.getRegistry(), 'executeTool').mockResolvedValue({ ok: true });
    await client.callTool({
      name: 'bangumi.search_subjects',
      arguments: {
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
        query: '少女终末旅行',
      },
    });

    const passedContext = executeSpy.mock.calls[0]![2];
    const passedArgs = executeSpy.mock.calls[0]![1] as Record<string, unknown>;
    expect(passedContext).toMatchObject({
      principalId: 'trusted-principal',
      botInstanceId: 'trusted-bot',
      conversationId: 'trusted-conversation',
    });
    expect(passedContext.requestId).toMatch(/^req_/);
    for (const key of [
      'principalId',
      '_principalId',
      'botInstanceId',
      '_botInstanceId',
      'externalUserId',
      '_externalUserId',
      'conversationId',
      '_conversationId',
      'requestId',
      '_requestId',
    ]) {
      expect(passedArgs[key]).toBeUndefined();
    }
    expect(passedArgs.query).toBe('少女终末旅行');
    await client.close();
  });

  it('MCP server suppresses raw unknown error details and returns safe generic message', async () => {
    const storage = new MemoryStorage();
    const deps = createRuntimeDependencies({
      storage,
      secretKey: 'test-secret-key-123456789012345678901234',
    });

    const mcpApp = new BangumiMcpServer({ dependencies: deps, storage });
    const server = mcpApp.getMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client({ name: 'test-client-err', version: '1.0' }, { capabilities: {} });
    await client.connect(clientTransport);

    const registry = mcpApp.getRegistry();
    vi.spyOn(registry, 'executeTool').mockRejectedValue(
      new Error('password authentication failed'),
    );

    const res = await client.callTool({
      name: 'bangumi.search_subjects',
      arguments: { query: 'test' },
    });

    const textContent = (res.content as Array<{ type: string; text: string }>)[0]!.text;
    expect(textContent).not.toContain('password authentication failed');
    const parsed = JSON.parse(textContent);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe('INTERNAL_ERROR');
    expect(parsed.error.message).toBe('内部服务发生错误');

    await client.close();
  });
});
