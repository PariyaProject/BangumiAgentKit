import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { ToolRegistry, createPendingAction, createRuntimeDependencies } from '@bangumi-agent-kit/tools';
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
    const deps = createRuntimeDependencies({ storage, publicHttpClient: client, secretKey: SECRET_KEY });
    const registry = new ToolRegistry(deps);

    await expect(
      registry.executeTool(
        'bangumi.update_collection',
        { subjectId: 226998, status: 'doing', rating: 9 },
        { principalId: 'user_qq_1', botInstanceId: 'bot_1', conversationId: 'conv_1' }
      )
    ).rejects.toThrow('AUTH_REQUIRED');
  });

  it('updates collection and records audit event when authenticated', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          subject_id: 226998,
          type: 3,
          rate: 9,
          comment: '神作收藏',
          updated_at: '2026-08-06T23:00:00Z',
        }),
        { status: 200 }
      )
    );
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

    const deps = createRuntimeDependencies({ storage, publicHttpClient: client, secretKey: SECRET_KEY });
    const registry = new ToolRegistry(deps);

    const res = (await registry.executeTool(
      'bangumi.update_collection',
      { subjectId: 226998, status: 'doing', rating: 9, comment: '神作收藏' },
      {
        principalId: principal.id,
        botInstanceId: 'bot_1',
        conversationId: 'conv_1',
      }
    )) as any;

    expect(res.subjectId).toBe(226998);
    expect(res.status).toBe('doing');
    expect(res.rating).toBe(9);

    // Verify Audit Event was recorded in Storage
    const events = storage.getAuditEvents();
    expect(events.length).toBe(1);
    expect(events[0]?.operationId).toBe('bangumi.update_collection');
    expect(events[0]?.riskLevel).toBe('write');
    expect(events[0]?.principalId).toBe(principal.id);
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

    const deps = createRuntimeDependencies({ storage, publicHttpClient: client, secretKey: SECRET_KEY });
    const registry = new ToolRegistry(deps);
    const episodeIds = Array.from({ length: 25 }, (_, i) => i + 1);

    // Initial attempt without confirmationId -> Throws CONFIRMATION_REQUIRED
    await expect(
      registry.executeTool(
        'bangumi.update_episode_progress',
        { subjectId: 226998, episodeIds },
        {
          principalId: principal.id,
          botInstanceId: 'bot_1',
          conversationId: 'conv_1',
        }
      )
    ).rejects.toThrow('CONFIRMATION_REQUIRED');

    // Create valid Pending Action
    const pending = await createPendingAction(
      storage,
      { principalId: principal.id, botInstanceId: 'bot_1', conversationId: 'conv_1' },
      'updateEpisodeProgress',
      '更新 25 集进度',
      { subjectId: 226998, episodeIds, type: 2 }
    );

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'ok' }), { status: 200 })
    );
    vi.stubGlobal('fetch', mockFetch);

    // Attempt with confirmationId -> Succeeds
    const res = (await registry.executeTool(
      'bangumi.update_episode_progress',
      { subjectId: 226998, episodeIds },
      {
        principalId: principal.id,
        botInstanceId: 'bot_1',
        conversationId: 'conv_1',
        confirmationId: pending.confirmationId,
      }
    )) as any;

    expect(res.count).toBe(25);
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

    const deps = createRuntimeDependencies({ storage, publicHttpClient: client, secretKey: SECRET_KEY });
    const registry = new ToolRegistry(deps);

    // Attempt uncollect without confirmationId -> Throws CONFIRMATION_REQUIRED
    await expect(
      registry.executeTool(
        'bangumi.manage_character_collection',
        { characterId: 1001, action: 'uncollect' },
        {
          principalId: principal.id,
          botInstanceId: 'bot_1',
          conversationId: 'conv_1',
        }
      )
    ).rejects.toThrow('CONFIRMATION_REQUIRED');

    // Pending Action
    const pending = await createPendingAction(
      storage,
      { principalId: principal.id, botInstanceId: 'bot_1', conversationId: 'conv_1' },
      'manageCharacterCollection',
      '取消收藏角色 1001',
      { characterId: 1001, action: 'uncollect' }
    );

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const res = (await registry.executeTool(
      'bangumi.manage_character_collection',
      { characterId: 1001, action: 'uncollect' },
      {
        principalId: principal.id,
        botInstanceId: 'bot_1',
        conversationId: 'conv_1',
        confirmationId: pending.confirmationId,
      }
    )) as any;

    expect(res.success).toBe(true);
    expect(res.action).toBe('uncollect');
  });
});
