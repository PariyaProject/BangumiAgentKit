import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { CollectionService } from '@bangumi-agent-kit/bangumi-core';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { ToolRegistry, createRuntimeDependencies } from '@bangumi-agent-kit/tools';
import { encryptToken } from '@bangumi-agent-kit/auth';

describe('Phase 6: Write Operations, Confirmation Policy & Audit Tests', () => {
  const SECRET_KEY = 'default-test-secret-key-123456';

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('fails with AUTH_REQUIRED if user is not authenticated', async () => {
    const storage = new MemoryStorage();
    const client = new HttpClient();
    const deps = createRuntimeDependencies({
      storage,
      publicHttpClient: client,
      secretKey: SECRET_KEY,
    });
    const registry = new ToolRegistry(deps);

    await expect(
      registry.executeTool(
        'bangumi.update_collection',
        { subjectId: 226998, status: 'doing', rating: 9 },
        { principalId: 'user_qq_1', botInstanceId: 'bot_1', conversationId: 'conv_1' },
      ),
    ).rejects.toThrow('AUTH_REQUIRED');
  });

  it('updates the bound user collection with an exact current-user payload, reads it back, and records audit', async () => {
    const requests: Array<{
      url: string;
      method: string;
      body?: unknown;
      authorization: string | null;
    }> = [];
    let writeApplied = false;
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      requests.push({
        url,
        method: init?.method || 'GET',
        body: init?.body ? JSON.parse(init.body as string) : undefined,
        authorization: new Headers(init?.headers).get('authorization'),
      });
      if (init?.method === 'POST') {
        writeApplied = true;
        return new Response(null, { status: 204 });
      }
      return new Response(
        JSON.stringify({
          subject_id: 226998,
          type: writeApplied ? 3 : 2,
          rate: writeApplied ? 8 : 7,
          comment: writeApplied ? '神作收藏' : '旧评价',
          tags: writeApplied ? ['new'] : ['old'],
          updated_at: '2026-08-06T23:00:00Z',
          subject: { name: '少女終末旅行', type: 2 },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', mockFetch);

    const storage = new MemoryStorage();
    const client = new HttpClient();

    // Bind User
    const principal = await storage.findOrCreatePrincipal({
      provider: 'qq-official',
      botInstanceId: 'bot_1',
      externalUserId: 'user_qq_1',
    });
    const acc = await storage.upsertBangumiAccount({
      id: 'acc_1',
      bangumiUserId: 100,
      username: 'test_user',
      nickname: 'Test User',
    });
    await storage.replaceActiveBinding(principal.id, acc.id);
    await storage.upsertCredential({
      id: 'crd_1',
      bangumiAccountId: acc.id,
      encryptedAccessToken: encryptToken('valid_access_token', SECRET_KEY),
      expiresAt: new Date(Date.now() + 3600000),
      requestedCapabilities: ['write:collection'],
      reportedScopes: null,
      scopeEvidence: 'unknown',
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
    const input = { subjectId: 226998, status: 'doing' as const, rating: 8, comment: '神作收藏' };
    const context = {
      principalId: principal.id,
      botInstanceId: 'bot_1',
      conversationId: 'conv_1',
    };
    let previewError: (Error & { code?: string }) | undefined;
    try {
      await registry.executeTool('bangumi.update_collection', input, context);
    } catch (error) {
      previewError = error as Error & { code?: string };
    }
    expect(previewError?.code).toBe('CONFIRMATION_REQUIRED');
    expect(previewError?.message).toContain('test_user');
    expect(previewError?.message).toContain('旧评价');
    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('GET');
    expect(requests.some((request) => request.method === 'POST')).toBe(false);
    const confirmationId = previewError?.message.match(/Confirmation ID: (\S+)/u)?.[1];
    expect(confirmationId).toMatch(/^cfm_/u);

    const res = (await registry.executeTool('bangumi.update_collection', input, {
      ...context,
      confirmationId,
    })) as any;

    expect(res.collection.subjectId).toBe(226998);
    expect(res.collection.status).toBe('doing');
    expect(res.collection.rating).toBe(8);
    expect(requests).toHaveLength(4);
    expect(requests[0]?.method).toBe('GET');
    expect(requests[1]?.method).toBe('GET');
    expect(requests[2]?.method).toBe('POST');
    expect(requests[3]?.method).toBe('GET');
    expect(new URL(requests[2]!.url).pathname).toBe('/v0/users/-/collections/226998');
    expect(requests[2]).toMatchObject({
      method: 'POST',
      body: { type: 3, rate: 8, comment: '神作收藏' },
      authorization: 'Bearer valid_access_token',
    });
    expect(new URL(requests[0]!.url).pathname).toBe('/v0/users/test_user/collections/226998');
    expect(new URL(requests[1]!.url).pathname).toBe('/v0/users/test_user/collections/226998');
    expect(new URL(requests[3]!.url).pathname).toBe('/v0/users/test_user/collections/226998');
    expect(requests[3]).toMatchObject({
      method: 'GET',
      authorization: 'Bearer valid_access_token',
    });

    // Verify Audit Event was recorded in Storage
    const events = storage.getAuditEvents();
    expect(events.length).toBe(1);
    expect(events[0]?.operationId).toBe('bangumi.update_collection');
    expect(events[0]?.riskLevel).toBe('write');
    expect(events[0]?.principalId).toBe(principal.id);
    expect(events[0]?.confirmationId).toBe(confirmationId);
  });

  it('reports a successful write as unverified when canonical collection refresh fails', async () => {
    const requests: Array<{ url: string; method: string }> = [];
    const fetchFn: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      requests.push({ url: `${url.origin}${url.pathname}`, method: init?.method || 'GET' });
      if (init?.method === 'POST') return new Response(null, { status: 204 });
      return new Response('{}', { status: 503 });
    };
    const service = new CollectionService(new HttpClient({ fetchFn }));

    const result = await service.updateCollection(
      { subjectId: 226998, status: 'doing', rating: 8 },
      'synthetic-owner',
      async () => {
        throw new Error('synthetic canonical read failure');
      },
    );

    expect(result).toMatchObject({
      success: true,
      status: 'updated_but_refresh_failed',
      applied: { subjectId: 226998, status: 'doing', rating: 8 },
    });
    expect(requests).toHaveLength(1);
    expect(new URL(requests[0]!.url).pathname).toBe('/v0/users/-/collections/226998');
  });

  it('requires confirmation for bulk episode updates (>20 episodes)', async () => {
    const storage = new MemoryStorage();
    const client = new HttpClient();

    const principal = await storage.findOrCreatePrincipal({
      provider: 'qq-official',
      botInstanceId: 'bot_1',
      externalUserId: 'user_qq_1',
    });
    const acc = await storage.upsertBangumiAccount({
      id: 'acc_1',
      bangumiUserId: 100,
      username: 'test_user',
      nickname: 'Test User',
    });
    await storage.replaceActiveBinding(principal.id, acc.id);
    await storage.upsertCredential({
      id: 'crd_1',
      bangumiAccountId: acc.id,
      encryptedAccessToken: encryptToken('valid_access_token', SECRET_KEY),
      expiresAt: new Date(Date.now() + 3600000),
      requestedCapabilities: ['write:collection'],
      reportedScopes: null,
      scopeEvidence: 'unknown',
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
    const episodeIds = Array.from({ length: 25 }, (_, i) => i + 1);
    const calls: Array<{ url: string; method: string }> = [];
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method || 'GET' });
      return new Response(JSON.stringify({ type: 0, message: 'ok' }), { status: 200 });
    });
    vi.stubGlobal('fetch', mockFetch);
    const input = { subjectId: 226998, episodeIds };
    const context = {
      principalId: principal.id,
      botInstanceId: 'bot_1',
      conversationId: 'conv_1',
    };

    let previewError: (Error & { code?: string }) | undefined;
    try {
      await registry.executeTool('bangumi.update_episode_progress', input, context);
    } catch (error) {
      previewError = error as Error & { code?: string };
    }
    expect(previewError?.code).toBe('CONFIRMATION_REQUIRED');
    expect(calls).toHaveLength(25);
    expect(calls.every((call) => call.method === 'GET')).toBe(true);
    const confirmationId = previewError?.message.match(/Confirmation ID: (\S+)/u)?.[1];
    expect(confirmationId).toMatch(/^cfm_/u);

    const res = (await registry.executeTool('bangumi.update_episode_progress', input, {
      ...context,
      confirmationId,
    })) as any;

    expect(res.count).toBe(25);
    expect(calls.filter((call) => call.method === 'PATCH')).toHaveLength(1);
    expect(calls).toHaveLength(51);
    expect(storage.getAuditEvents().length).toBeGreaterThanOrEqual(1);
  });

  it('requires confirmation for destructive uncollect character action', async () => {
    const storage = new MemoryStorage();
    const client = new HttpClient();

    const principal = await storage.findOrCreatePrincipal({
      provider: 'qq-official',
      botInstanceId: 'bot_1',
      externalUserId: 'user_qq_1',
    });
    const acc = await storage.upsertBangumiAccount({
      id: 'acc_1',
      bangumiUserId: 100,
      username: 'test_user',
      nickname: 'Test User',
    });
    await storage.replaceActiveBinding(principal.id, acc.id);
    await storage.upsertCredential({
      id: 'crd_1',
      bangumiAccountId: acc.id,
      encryptedAccessToken: encryptToken('valid_access_token', SECRET_KEY),
      expiresAt: new Date(Date.now() + 3600000),
      requestedCapabilities: ['write:collection'],
      reportedScopes: null,
      scopeEvidence: 'unknown',
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
    const calls: Array<{ url: string; method: string }> = [];
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method || 'GET' });
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      return new Response(
        JSON.stringify({
          id: 1001,
          name: 'Synthetic Character',
          type: 1,
          created_at: '2026-01-01',
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', mockFetch);
    const input = { characterId: 1001, action: 'uncollect' as const };
    const context = {
      principalId: principal.id,
      botInstanceId: 'bot_1',
      conversationId: 'conv_1',
    };
    let previewError: (Error & { code?: string }) | undefined;
    try {
      await registry.executeTool('bangumi.manage_character_collection', input, context);
    } catch (error) {
      previewError = error as Error & { code?: string };
    }
    expect(previewError?.code).toBe('CONFIRMATION_REQUIRED');
    expect(previewError?.message).toContain('Synthetic Character');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe('GET');
    const confirmationId = previewError?.message.match(/Confirmation ID: (\S+)/u)?.[1];
    expect(confirmationId).toMatch(/^cfm_/u);

    const res = (await registry.executeTool('bangumi.manage_character_collection', input, {
      ...context,
      confirmationId,
    })) as any;

    expect(res.success).toBe(true);
    expect(res.action).toBe('uncollect');
    expect(calls.map((call) => call.method)).toEqual(['GET', 'GET', 'DELETE']);
  });

  it('PendingAction unknown failure sets failureMessageSafe to generic message', async () => {
    const storage = new MemoryStorage();
    const client = new HttpClient();
    const principal = await storage.findOrCreatePrincipal({
      provider: 'qq-official',
      botInstanceId: 'bot_1',
      externalUserId: 'user_fail_test',
    });
    const account = await storage.upsertBangumiAccount({
      id: 'bgm_acc_fail',
      bangumiUserId: 888,
      username: 'fail_user',
      nickname: 'Fail User',
    });
    await storage.replaceActiveBinding(principal.id, account.id);
    await storage.upsertCredential({
      id: 'cred_fail_1',
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
    let callCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        callCount += 1;
        if (init?.method === 'DELETE') {
          throw new Error('relation access_credentials does not exist');
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
    const input = { characterId: 1001, action: 'uncollect' as const };
    const context = {
      principalId: principal.id,
      botInstanceId: 'bot_1',
      conversationId: 'conv_1',
    };
    let previewError: (Error & { code?: string }) | undefined;
    try {
      await registry.executeTool('bangumi.manage_character_collection', input, context);
    } catch (error) {
      previewError = error as Error & { code?: string };
    }
    expect(previewError?.code).toBe('CONFIRMATION_REQUIRED');
    const confirmationId = previewError?.message.match(/Confirmation ID: (\S+)/u)?.[1];
    expect(confirmationId).toMatch(/^cfm_/u);

    await expect(
      registry.executeTool('bangumi.manage_character_collection', input, {
        ...context,
        confirmationId,
      }),
    ).rejects.toThrow();

    const action = (storage as any).pendingActions.get(confirmationId);
    expect(action?.status).toBe('failed');
    expect(action?.failureMessageSafe).toBe('网络请求失败，请稍后重试。');
    expect(action?.failureMessageSafe).not.toContain('access_credentials');
    expect(callCount).toBe(3);
  });
});
