import { describe, it, expect, vi } from 'vitest';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { TokenBroker, encryptToken } from '@bangumi-agent-kit/auth';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createWriteTools } from '@bangumi-agent-kit/tools';

describe('Manage Index 6 Actions Unit Tests', () => {
  async function setupTestEnvironment() {
    const capturedRequests: { url: string; method: string; body: any }[] = [];

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedRequests.push({
        url,
        method: init?.method || 'GET',
        body: init?.body ? JSON.parse(init.body as string) : undefined,
      });
      return new Response(JSON.stringify({ id: 50, title: 'My Index' }), { status: 200 });
    });

    const storage = new MemoryStorage();
    const secretKey = 'test-secret-key-123456789012345678901234';

    const principal = await storage.findOrCreatePrincipal({
      provider: 'test',
      botInstanceId: 'bot-1',
      externalUserId: 'user-1',
    });

    const account = await storage.upsertBangumiAccount({
      id: 'bgm-1',
      username: 'spike',
      nickname: 'Spike',
    });

    await storage.replaceActiveBinding(principal.id, account.id);

    await storage.upsertCredential({
      bangumiAccountId: account.id,
      encryptedAccessToken: encryptToken('test-access-token', secretKey, 'v1'),
      expiresAt: new Date(Date.now() + 3600000),
      keyVersion: 'v1',
      updatedAt: new Date(),
    });

    const publicHttpClient = new HttpClient({ fetchFn: mockFetch });
    const tokenBroker = new TokenBroker(storage, { secretKey }, publicHttpClient);
    const writeTools = createWriteTools(tokenBroker);
    const manageIndexTool = writeTools.find((t) => t.name === 'bangumi.manage_index')!;
    const context = { principalId: principal.id, botInstanceId: 'bot-1', conversationId: 'c-1' };

    return {
      manageIndexTool,
      context,
      tokenBroker,
      capturedRequests,
    };
  }

  it('handles action="create"', async () => {
    const { manageIndexTool, context, tokenBroker, capturedRequests } = await setupTestEnvironment();

    await manageIndexTool.execute(
      { action: 'create', title: 'Top Anime', desc: 'Best anime' },
      context,
      { clientProvider: tokenBroker } as any
    );

    expect(capturedRequests.length).toBe(2);
    expect(capturedRequests[0].url).toContain('/v0/indices');
    expect(capturedRequests[0].method).toBe('POST');

    expect(capturedRequests[1].url).toContain('/v0/indices/50');
    expect(capturedRequests[1].method).toBe('PUT');
  });

  it('handles action="edit"', async () => {
    const { manageIndexTool, context, tokenBroker, capturedRequests } = await setupTestEnvironment();

    await manageIndexTool.execute(
      { action: 'edit', indexId: 50, title: 'Updated Title' },
      context,
      { clientProvider: tokenBroker } as any
    );

    expect(capturedRequests.length).toBe(1);
    expect(capturedRequests[0].url).toContain('/v0/indices/50');
    expect(capturedRequests[0].method).toBe('PUT');
  });

  it('handles action="add_subject"', async () => {
    const { manageIndexTool, context, tokenBroker, capturedRequests } = await setupTestEnvironment();

    await manageIndexTool.execute(
      { action: 'add_subject', indexId: 50, subjectId: 101, comment: 'Must watch' },
      context,
      { clientProvider: tokenBroker } as any
    );

    expect(capturedRequests.length).toBe(1);
    expect(capturedRequests[0].url).toContain('/v0/indices/50/subjects');
    expect(capturedRequests[0].method).toBe('POST');
    expect(capturedRequests[0].body).toEqual({ subject_id: 101, comment: 'Must watch' });
  });

  it('handles action="remove_subject"', async () => {
    const { manageIndexTool, context, tokenBroker, capturedRequests } = await setupTestEnvironment();

    await manageIndexTool.execute(
      { action: 'remove_subject', indexId: 50, subjectId: 101 },
      context,
      { clientProvider: tokenBroker } as any
    );

    expect(capturedRequests.length).toBe(1);
    expect(capturedRequests[0].url).toContain('/v0/indices/50/subjects');
    expect(capturedRequests[0].method).toBe('DELETE');
  });

  it('handles action="collect"', async () => {
    const { manageIndexTool, context, tokenBroker, capturedRequests } = await setupTestEnvironment();

    await manageIndexTool.execute(
      { action: 'collect', indexId: 50 },
      context,
      { clientProvider: tokenBroker } as any
    );

    expect(capturedRequests.length).toBe(1);
    expect(capturedRequests[0].url).toContain('/v0/indices/50/collect');
    expect(capturedRequests[0].method).toBe('POST');
  });

  it('handles action="uncollect"', async () => {
    const { manageIndexTool, context, tokenBroker, capturedRequests } = await setupTestEnvironment();

    await manageIndexTool.execute(
      { action: 'uncollect', indexId: 50 },
      context,
      { clientProvider: tokenBroker } as any
    );

    expect(capturedRequests.length).toBe(1);
    expect(capturedRequests[0].url).toContain('/v0/indices/50/collect');
    expect(capturedRequests[0].method).toBe('DELETE');
  });
});
