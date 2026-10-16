import { describe, it, expect, vi, afterEach } from 'vitest';
import { BangumiError, toPublicError } from '@bangumi-agent-kit/bangumi-transport';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { ToolRegistry, createRuntimeDependencies } from '@bangumi-agent-kit/tools';
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

  it('CONFIRMATION_PREVIEW_UNAVAILABLE stops safely without exposing private preview details', () => {
    const err = new BangumiError(
      'CONFIRMATION_PREVIEW_UNAVAILABLE',
      'private collection preview failed for account fixture_a',
      false,
      409,
      '重新读取当前状态后再发起写入。',
    );
    const publicErr = toPublicError(err);

    expect(publicErr.code).toBe('CONFIRMATION_PREVIEW_UNAVAILABLE');
    expect(publicErr.message).toBe('无法安全核对当前账号状态，操作已停止且没有写入。');
    expect(publicErr.message).not.toContain('fixture_a');
    expect(publicErr.nextAction).toBe('重新读取当前状态后再发起写入。');
    expect(publicErr.retryable).toBe(false);
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

  it('7. OAUTH_NOT_CONFIGURED -> clear setup guidance without exposing configuration values', () => {
    const err = new BangumiError(
      'OAUTH_NOT_CONFIGURED',
      'missing client_secret=private-value',
      false,
      undefined,
      '配置 Bangumi OAuth 客户端 ID、密钥和回调地址后重试。',
    );
    const publicErr = toPublicError(err);

    expect(publicErr.code).toBe('OAUTH_NOT_CONFIGURED');
    expect(publicErr.message).toBe('Bangumi 账号授权暂不可用，服务尚未配置 OAuth 应用。');
    expect(publicErr.message).not.toContain('private-value');
    expect(publicErr.nextAction).toBe('配置 Bangumi OAuth 客户端 ID、密钥和回调地址后重试。');
    expect(publicErr.retryable).toBe(false);
  });

  it('8. PendingAction remains unknown with sanitized message when ToolRegistry catches WRITE_RESULT_UNKNOWN', async () => {
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

    // The two preview reads succeed; only the confirmed DELETE has an unknown result.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          throw new BangumiError(
            'WRITE_RESULT_UNKNOWN',
            'Socket closed prematurely by peer',
            false,
          );
        }
        return new Response(
          JSON.stringify({
            id: 1001,
            name: 'Synthetic Character',
            type: 1,
            created_at: '2026-01-01',
          }),
          { status: 200 },
        );
      }),
    );

    let previewError: (Error & { code?: string }) | undefined;
    try {
      await registry.executeTool(
        'bangumi.manage_character_collection',
        { characterId: 1001, action: 'uncollect' },
        { principalId: principal.id, botInstanceId: 'bot_1', conversationId: 'conv_1' },
      );
    } catch (error) {
      previewError = error as Error & { code?: string };
    }
    expect(previewError?.code).toBe('CONFIRMATION_REQUIRED');
    const confirmationId = previewError?.message.match(/Confirmation ID: (\S+)/u)?.[1];
    expect(confirmationId).toMatch(/^cfm_/u);

    await expect(
      registry.executeTool(
        'bangumi.manage_character_collection',
        { characterId: 1001, action: 'uncollect' },
        {
          principalId: principal.id,
          botInstanceId: 'bot_1',
          conversationId: 'conv_1',
          confirmationId,
        },
      ),
    ).rejects.toThrow('WRITE_RESULT_UNKNOWN');

    const actions = storage.getPendingActions();
    const action = actions.find((a) => a.id === confirmationId);
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

  it('9. Forged BangumiError object does not leak raw internal message at public error boundary', () => {
    const forged = {
      name: 'BangumiError',
      code: 'AUTH_REQUIRED',
      message: 'database password = secret',
      retryable: false,
    };
    const publicErr = toPublicError(forged);

    expect(publicErr.code).toBe('AUTH_REQUIRED');
    expect(publicErr.message).toBe('需要先绑定 Bangumi 账号。');
    expect(publicErr.message).not.toContain('database password');
    expect(publicErr.message).not.toContain('secret');
  });
});
