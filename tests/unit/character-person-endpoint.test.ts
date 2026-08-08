import { describe, it, expect, vi } from 'vitest';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { TokenBroker, encryptToken } from '@bangumi-agent-kit/auth';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createWriteTools } from '@bangumi-agent-kit/tools';

describe('Character & Person Collection Endpoints', () => {
  it('calls correct /v0/characters/{id}/collect endpoint for manage_character_collection tool', async () => {
    let capturedUrl = '';
    let capturedMethod = '';

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method || 'GET';
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
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
      bangumiUserId: 1,
      username: 'spike',
      nickname: 'Spike',
    });

    await storage.replaceActiveBinding(principal.id, account.id);

    await storage.upsertCredential({
      id: 'c-1',
      bangumiAccountId: account.id,
      encryptedAccessToken: encryptToken('test-access-token', secretKey, 'v1'),
      expiresAt: new Date(Date.now() + 3600000),
      requestedCapabilities: ['write:collection'],
      reportedScopes: ['write:collection'],
      scopeEvidence: 'reported',
      keyVersion: 'v1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const publicHttpClient = new HttpClient({ fetchFn: mockFetch });
    const tokenBroker = new TokenBroker(storage, { secretKey }, publicHttpClient);

    const writeTools = createWriteTools(tokenBroker);
    const collectCharTool = writeTools.find(
      (t) => t.name === 'bangumi.manage_character_collection',
    )!;

    const context = {
      principalId: principal.id,
      botInstanceId: 'bot-1',
      conversationId: 'c-1',
    };

    await (collectCharTool.execute as any)({ characterId: 100, action: 'collect' }, context, {
      clientProvider: tokenBroker,
    } as any);

    expect(capturedUrl).toContain('/v0/characters/100/collect');
    expect(capturedMethod).toBe('POST');
  });

  it('calls correct /v0/persons/{id}/collect endpoint for manage_person_collection tool', async () => {
    let capturedUrl = '';
    let capturedMethod = '';

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method || 'GET';
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
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
      bangumiUserId: 1,
      username: 'spike',
      nickname: 'Spike',
    });

    await storage.replaceActiveBinding(principal.id, account.id);

    await storage.upsertCredential({
      id: 'c-1',
      bangumiAccountId: account.id,
      encryptedAccessToken: encryptToken('test-access-token', secretKey, 'v1'),
      expiresAt: new Date(Date.now() + 3600000),
      requestedCapabilities: ['write:collection'],
      reportedScopes: ['write:collection'],
      scopeEvidence: 'reported',
      keyVersion: 'v1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const publicHttpClient = new HttpClient({ fetchFn: mockFetch });
    const tokenBroker = new TokenBroker(storage, { secretKey }, publicHttpClient);

    const writeTools = createWriteTools(tokenBroker);
    const collectPersonTool = writeTools.find(
      (t) => t.name === 'bangumi.manage_person_collection',
    )!;

    const context = {
      principalId: principal.id,
      botInstanceId: 'bot-1',
      conversationId: 'c-1',
    };

    await (collectPersonTool.execute as any)({ personId: 200, action: 'collect' }, context, {
      clientProvider: tokenBroker,
    } as any);

    expect(capturedUrl).toContain('/v0/persons/200/collect');
    expect(capturedMethod).toBe('POST');
  });
});
