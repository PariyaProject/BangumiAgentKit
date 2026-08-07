import { describe, it, expect, vi, afterEach } from 'vitest';
import { DatabaseStore } from '../../packages/db/src/index.js';
import { HttpClient } from '../../packages/bangumi-transport/src/index.js';
import { ToolRegistry, createPendingAction } from '../../packages/tools/src/index.js';

describe('Phase 6: Write Operations, Confirmation Policy & Audit Tests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('fails with AUTH_REQUIRED if user is not authenticated', async () => {
    const db = new DatabaseStore();
    const client = new HttpClient();
    const registry = new ToolRegistry(client, db);

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

    const db = new DatabaseStore();
    const client = new HttpClient();
    const registry = new ToolRegistry(client, db);

    const res = (await registry.executeTool(
      'bangumi.update_collection',
      { subjectId: 226998, status: 'doing', rating: 9, comment: '神作收藏' },
      {
        principalId: 'user_qq_1',
        botInstanceId: 'bot_1',
        conversationId: 'conv_1',
        accessToken: 'valid_access_token',
      }
    )) as any;

    expect(res.subjectId).toBe(226998);
    expect(res.status).toBe('doing');
    expect(res.rating).toBe(9);

    // Verify Audit Event was recorded
    expect(db.auditEvents.length).toBe(1);
    expect(db.auditEvents[0]?.operationId).toBe('patchUserCollection');
    expect(db.auditEvents[0]?.riskLevel).toBe('write');
    expect(db.auditEvents[0]?.principalId).toBe('user_qq_1');
  });

  it('requires confirmation for bulk episode updates (>20 episodes)', async () => {
    const db = new DatabaseStore();
    const client = new HttpClient();
    const registry = new ToolRegistry(client, db);

    const episodeIds = Array.from({ length: 25 }, (_, i) => i + 1);

    // Initial attempt without confirmationId -> Throws CONFIRMATION_REQUIRED
    await expect(
      registry.executeTool(
        'bangumi.update_episode_progress',
        { subjectId: 226998, episodeIds },
        {
          principalId: 'user_qq_1',
          botInstanceId: 'bot_1',
          conversationId: 'conv_1',
          accessToken: 'valid_access_token',
        }
      )
    ).rejects.toThrow('CONFIRMATION_REQUIRED');

    // Create valid Pending Action
    const pending = createPendingAction(
      db,
      { principalId: 'user_qq_1', botInstanceId: 'bot_1', conversationId: 'conv_1' },
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
        principalId: 'user_qq_1',
        botInstanceId: 'bot_1',
        conversationId: 'conv_1',
        accessToken: 'valid_access_token',
        confirmationId: pending.confirmationId,
      }
    )) as any;

    expect(res.count).toBe(25);
    expect(db.auditEvents.length).toBe(1);
  });

  it('requires confirmation for destructive uncollect character action', async () => {
    const db = new DatabaseStore();
    const client = new HttpClient();
    const registry = new ToolRegistry(client, db);

    // Attempt uncollect without confirmationId -> Throws CONFIRMATION_REQUIRED
    await expect(
      registry.executeTool(
        'bangumi.manage_character_collection',
        { characterId: 1001, action: 'uncollect' },
        {
          principalId: 'user_qq_1',
          botInstanceId: 'bot_1',
          conversationId: 'conv_1',
          accessToken: 'valid_access_token',
        }
      )
    ).rejects.toThrow('CONFIRMATION_REQUIRED');

    // Pending Action
    const pending = createPendingAction(
      db,
      { principalId: 'user_qq_1', botInstanceId: 'bot_1', conversationId: 'conv_1' },
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
        principalId: 'user_qq_1',
        botInstanceId: 'bot_1',
        conversationId: 'conv_1',
        accessToken: 'valid_access_token',
        confirmationId: pending.confirmationId,
      }
    )) as any;

    expect(res.success).toBe(true);
    expect(res.action).toBe('uncollect');
  });
});
