import { describe, it, expect, vi, afterEach } from 'vitest';
import { BangumiError, toPublicError } from '@bangumi-agent-kit/bangumi-transport';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  ToolRegistry,
  createPendingAction,
  createRuntimeDependencies,
} from '@bangumi-agent-kit/tools';
import { encryptToken } from '@bangumi-agent-kit/auth';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { BangumiMcpServer } from '../../apps/mcp/src/server.js';

describe('Safe Error Policy & Control-Flow Regression Tests', () => {
  const SECRET_KEY = 'default-test-secret-key-123456';

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('1. Unknown DB error ("relation access_credentials does not exist") -> INTERNAL_ERROR, no table name', () => {
    const err = new Error('relation access_credentials does not exist');
    const publicErr = toPublicError(err);

    expect(publicErr.code).toBe('INTERNAL_ERROR');
    expect(publicErr.message).toBe('内部服务发生错误');
    expect(publicErr.message).not.toContain('access_credentials');
    expect(publicErr.retryable).toBe(false);
  });

  it('2. Unknown Auth error ("password authentication failed") -> INTERNAL_ERROR, no raw text', () => {
    const err = new Error('password authentication failed');
    const publicErr = toPublicError(err);

    expect(publicErr.code).toBe('INTERNAL_ERROR');
    expect(publicErr.message).toBe('内部服务发生错误');
    expect(publicErr.message).not.toContain('password authentication failed');
    expect(publicErr.retryable).toBe(false);
  });

  it('3. WRITE_RESULT_UNKNOWN with internal diagnostic -> code WRITE_RESULT_UNKNOWN, sanitized message, no raw diagnostic, tells Agent not to retry', () => {
    const internalDiag = 'POST https://api.bgm.tv/v0/users/collections timeout after TCP handshake';
    const err = new BangumiError('WRITE_RESULT_UNKNOWN', internalDiag, false);
    const publicErr = toPublicError(err);

    expect(publicErr.code).toBe('WRITE_RESULT_UNKNOWN');
    expect(publicErr.message).toBe('写入结果未知，请先查询当前状态，不要自动重试。');
    expect(publicErr.message).not.toContain(internalDiag);
    expect(publicErr.message).toContain('不要自动重试');
    expect(publicErr.retryable).toBe(false);
  });

  it('4. NETWORK_ERROR -> NETWORK_ERROR, sanitized retryable message', () => {
    const err = new BangumiError('NETWORK_ERROR', 'ECONNREFUSED 127.0.0.1:8080', true);
    const publicErr = toPublicError(err);

    expect(publicErr.code).toBe('NETWORK_ERROR');
    expect(publicErr.message).toBe('网络请求失败，请稍后重试。');
    expect(publicErr.message).not.toContain('127.0.0.1');
    expect(publicErr.retryable).toBe(true);
  });

  it('5. UPSTREAM_UNAVAILABLE -> UPSTREAM_UNAVAILABLE, sanitized retryable message', () => {
    const err = new BangumiError(
      'UPSTREAM_UNAVAILABLE',
      '502 Bad Gateway from NGINX upstream 10.0.1.5',
      true,
      502,
    );
    const publicErr = toPublicError(err);

    expect(publicErr.code).toBe('UPSTREAM_UNAVAILABLE');
    expect(publicErr.message).toBe('Bangumi 上游服务暂不可用，请稍后重试。');
    expect(publicErr.message).not.toContain('10.0.1.5');
    expect(publicErr.retryable).toBe(true);
  });

  it('6. KEY_VERSION_UNAVAILABLE -> safe auth/rebind guidance, no key/version secret details', () => {
    const secretDetail = 'Secret key v2 decrypt failed: bad hmac key_hex=0x9f821...';
    const err = new BangumiError('KEY_VERSION_UNAVAILABLE', secretDetail, false);
    const publicErr = toPublicError(err);

    expect(publicErr.code).toBe('KEY_VERSION_UNAVAILABLE');
    expect(publicErr.message).toBe('密钥版本不可用，请重新绑定或更新凭据。');
    expect(publicErr.message).not.toContain(secretDetail);
    expect(publicErr.retryable).toBe(false);
  });

  it('7. PendingAction remains unknown with sanitized message when ToolRegistry catches WRITE_RESULT_UNKNOWN', async () => {
    const storage = new MemoryStorage();
    const client = new HttpClient();
    const principal = await storage.findOrCreatePrincipal({
      provider: 'qq-official',
      botInstanceId: 'bot_1',
      externalUserId: 'user_unknown_test',
    });
    const account = await storage.upsertBangumiAccount({
      id: 'bgm_acc_unk',
      bangumiUserId: 999,
      username: 'unk_user',
      nickname: 'Unknown User',
    });
    await storage.replaceActiveBinding(principal.id, account.id);
    await storage.upsertCredential({
      id: 'cred_unk_1',
      bangumiAccountId: account.id,
      encryptedAccessToken: encryptToken('access-token', SECRET_KEY, 'v1'),
      expiresAt: new Date(Date.now() + 3600000),
      requestedCapabilities: ['write:collection'],
      reportedScopes: ['write:collection'],
      scopeEvidence: 'reported',
      keyVersion: 'v1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const deps = createRuntimeDependencies({
      storage,
      publicHttpClient: client,
      secretKey: SECRET_KEY,
    });
    const registry = new ToolRegistry(deps);

    const pending = await createPendingAction(
      storage,
      { principalId: principal.id, botInstanceId: 'bot_1', conversationId: 'conv_1' },
      'manageCharacterCollection',
      '取消收藏角色 1001',
      { characterId: 1001, action: 'uncollect' },
    );

    // Mock tool execution to throw WRITE_RESULT_UNKNOWN with internal diagnostic message
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE' || String(url).includes('/characters/1001')) {
          throw new BangumiError('WRITE_RESULT_UNKNOWN', 'Socket closed prematurely by peer', false);
        }
        return new Response(JSON.stringify({}), { status: 200 });
      }),
    );

    await expect(
      registry.executeTool(
        'bangumi.manage_character_collection',
        { characterId: 1001, action: 'uncollect' },
        {
          principalId: principal.id,
          botInstanceId: 'bot_1',
          conversationId: 'conv_1',
          confirmationId: pending.confirmationId,
        },
      ),
    ).rejects.toThrow('WRITE_RESULT_UNKNOWN');

    const actions = storage.getPendingActions();
    const action = actions.find((a) => a.id === pending.pendingAction.id);
    expect(action?.status).toBe('unknown');
    expect(action?.failureMessageSafe).toBe('写入结果未知，请先查询当前状态，不要自动重试。');
    expect(action?.failureMessageSafe).not.toBe('内部服务发生错误');
    expect(action?.failureMessageSafe).not.toContain('Socket closed');
  });

  it('8. MCP returns structured JSON error response for WRITE_RESULT_UNKNOWN', async () => {
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
      new BangumiError('WRITE_RESULT_UNKNOWN', 'TCP RST packet received', false),
    );

    const res = await client.callTool({
      name: 'bangumi.search_subjects',
      arguments: { query: 'test' },
    });

    const textContent = (res.content as Array<{ type: string; text: string }>)[0]!.text;
    expect(textContent).not.toContain('TCP RST packet received');
    const parsed = JSON.parse(textContent);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe('WRITE_RESULT_UNKNOWN');
    expect(parsed.error.message).toBe('写入结果未知，请先查询当前状态，不要自动重试。');
    expect(parsed.error.retryable).toBe(false);

    await client.close();
  });
});
