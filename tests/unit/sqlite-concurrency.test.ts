import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { SQLiteStorage } from '@bangumi-agent-kit/db';
import { TokenBroker, encryptToken, resolveTokenEncryptionConfig } from '@bangumi-agent-kit/auth';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';

describe('PR-6A: SQLite Concurrency & Lock Tests', () => {
  it('6A-12: Token refresh concurrency with 2 independent SQLite storage instances on SAME database file', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgm-sqlite-concurrency-'));
    const dbPath = path.join(tmpDir, 'test.sqlite');

    const storage1 = await SQLiteStorage.create({ dbPath });
    const storage2 = await SQLiteStorage.create({ dbPath });

    const key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const encConfig = resolveTokenEncryptionConfig({ secretKey: key });

    // Create principal & account
    const principal = await storage1.findOrCreatePrincipal({
      provider: 'qq',
      botInstanceId: 'qq:10001',
      externalUserId: 'user-1',
    });

    const account = await storage1.upsertBangumiAccount({
      id: 'bgm-user-1',
      bangumiUserId: 12345,
      username: 'testuser',
      nickname: 'Test User',
    });

    await storage1.bindAccount(principal.id, account.id, true);

    // Initial expired credential with valid encrypted refresh token
    const now = new Date();
    const encAccess = encryptToken('old_access_token', encConfig.keyring, 'v1');
    const encRefresh = encryptToken('old_refresh_token', encConfig.keyring, 'v1');

    await storage1.upsertCredential({
      id: 'cred-1',
      bangumiAccountId: account.id,
      encryptedAccessToken: encAccess,
      encryptedRefreshToken: encRefresh,
      expiresAt: new Date(now.getTime() - 3600000), // Expired 1 hour ago
      requestedCapabilities: ['read', 'write'],
      reportedScopes: ['read', 'write'],
      scopeEvidence: 'reported',
      keyVersion: 'v1',
      createdAt: now,
      updatedAt: now,
    });

    let refreshCallCount = 0;
    const mockOAuthClient = {
      async refreshToken() {
        refreshCallCount++;
        await new Promise((r) => setTimeout(r, 100));
        return {
          access_token: 'new_refreshed_access_token',
          refresh_token: 'new_refreshed_refresh_token',
          expires_in: 604800,
          user_id: 12345,
        };
      },
    } as any;

    const mockHttpClient = {
      async request<T>() {
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          data: {},
        } as unknown as T;
      },
    } as unknown as HttpClient;

    const config = {
      secretKey: key,
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'http://localhost/callback',
    };

    const broker1 = new TokenBroker(storage1, config, mockHttpClient, mockOAuthClient);
    const broker2 = new TokenBroker(storage2, config, mockHttpClient, mockOAuthClient);

    // Launch 5 concurrent refresh attempts across broker1 and broker2
    const promises = [
      broker1.requireAuthenticatedClient(principal.id),
      broker2.requireAuthenticatedClient(principal.id),
      broker1.requireAuthenticatedClient(principal.id),
      broker2.requireAuthenticatedClient(principal.id),
      broker1.requireAuthenticatedClient(principal.id),
    ];

    const results = await Promise.all(promises);

    expect(results).toHaveLength(5);
    expect(refreshCallCount).toBe(1);

    await storage1.close();
    await storage2.close();
  });

  it('6A-13: Atomic OAuth state consumption across 2 SQLite instances', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgm-sqlite-oauth-'));
    const dbPath = path.join(tmpDir, 'test.sqlite');

    const storage1 = await SQLiteStorage.create({ dbPath });
    const storage2 = await SQLiteStorage.create({ dbPath });

    const session = {
      id: 'sess-1',
      stateHash: 'state-hash-unique-123',
      principalId: 'p-1',
      requestedCapabilities: ['read'],
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 600000),
    };

    await storage1.createOAuthSession(session);

    // Concurrently consume from both instances
    const p1 = storage1.consumeOAuthSession(session.stateHash);
    const p2 = storage2.consumeOAuthSession(session.stateHash);

    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('OAUTH_STATE_REUSED');

    await storage1.close();
    await storage2.close();
  });

  it('6A-14: Atomic PendingAction claim across 2 SQLite instances', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgm-sqlite-pending-'));
    const dbPath = path.join(tmpDir, 'test.sqlite');

    const storage1 = await SQLiteStorage.create({ dbPath });
    const storage2 = await SQLiteStorage.create({ dbPath });

    const now = new Date();
    const action = {
      id: 'conf-100',
      confirmationId: 'conf-100',
      principalId: 'p-1',
      botInstanceId: 'bot-1',
      conversationKey: 'conv-1',
      actionType: 'manage_index_create',
      summary: 'Create index',
      normalizedPayloadJson: '{"title":"Test"}',
      payloadHash: 'hash-abc',
      status: 'pending' as const,
      expiresAt: new Date(now.getTime() + 600000),
      createdAt: now,
      updatedAt: now,
    };

    await storage1.createPendingAction(action);

    const input = {
      confirmationId: action.id,
      principalId: action.principalId,
      botInstanceId: action.botInstanceId,
      conversationId: action.conversationKey,
      payloadHash: action.payloadHash,
    };

    const p1 = storage1.claimPendingAction(input);
    const p2 = storage2.claimPendingAction(input);

    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    await storage1.close();
    await storage2.close();
  });

  it('6A-15: Active binding unique invariant across 2 SQLite instances', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgm-sqlite-binding-'));
    const dbPath = path.join(tmpDir, 'test.sqlite');

    const storage1 = await SQLiteStorage.create({ dbPath });
    const storage2 = await SQLiteStorage.create({ dbPath });

    const principal = await storage1.findOrCreatePrincipal({
      provider: 'qq',
      botInstanceId: 'bot-1',
      externalUserId: 'user-binding-1',
    });

    await storage1.upsertBangumiAccount({
      id: 'bgm-acc-1',
      bangumiUserId: 1,
      username: 'acc1',
      nickname: 'Acc 1',
    });
    await storage1.upsertBangumiAccount({
      id: 'bgm-acc-2',
      bangumiUserId: 2,
      username: 'acc2',
      nickname: 'Acc 2',
    });

    await storage1.bindAccount(principal.id, 'bgm-acc-1', true);
    await storage2.bindAccount(principal.id, 'bgm-acc-2', true);

    const active1 = await storage1.getActiveBinding(principal.id);
    const active2 = await storage2.getActiveBinding(principal.id);

    expect(active1?.bangumiAccountId).toBe(active2?.bangumiAccountId);
    expect(active1?.bangumiAccountId).toBe('bgm-acc-2');

    const allBindings = await storage1.listBindings(principal.id);
    const activeCount = allBindings.filter((b) => b.isActive).length;
    expect(activeCount).toBe(1);

    await storage1.close();
    await storage2.close();
  });
});
