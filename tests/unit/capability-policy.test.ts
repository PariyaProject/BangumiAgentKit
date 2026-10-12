import { describe, it, expect } from 'vitest';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { TokenBroker, encryptToken } from '@bangumi-agent-kit/auth';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';

describe('F. Capability Policy Test', () => {
  const secretKey = 'test-secret-key-123456789012345678901234';

  it('rejects with PERMISSION_DENIED when scopeEvidence is reported and required capabilities are missing', async () => {
    const storage = new MemoryStorage();
    const broker = new TokenBroker(storage, { secretKey }, new HttpClient());

    const principal = await storage.findOrCreatePrincipal({
      provider: 'test',
      botInstanceId: 'bot-1',
      externalUserId: 'usr-1',
    });

    const account = await storage.upsertBangumiAccount({
      id: 'bgm-cap-1',
      bangumiUserId: 1001,
      username: 'cap_user',
      nickname: 'Cap User',
    });

    await storage.replaceActiveBinding(principal.id, account.id);

    // Official reported provider scopes contain only write:indices; write:collection is absent.
    await storage.upsertCredential({
      id: 'c-cap-1',
      bangumiAccountId: account.id,
      encryptedAccessToken: encryptToken('access-token-123', secretKey, 'v1'),
      expiresAt: new Date(Date.now() + 3600000),
      requestedCapabilities: ['read:collection', 'write:collection'],
      reportedScopes: ['write:indices'],
      scopeEvidence: 'reported',
      keyVersion: 'v1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      broker.requireAuthenticatedClient(principal.id, ['write:collection']),
    ).rejects.toThrow('PERMISSION_DENIED');
  });

  it('does not treat the local read:collection capability as a provider OAuth scope', async () => {
    const storage = new MemoryStorage();
    const broker = new TokenBroker(storage, { secretKey }, new HttpClient());
    const principal = await storage.findOrCreatePrincipal({
      provider: 'test',
      botInstanceId: 'bot-1',
      externalUserId: 'usr-3',
    });
    const account = await storage.upsertBangumiAccount({
      id: 'bgm-cap-3',
      bangumiUserId: 1003,
      username: 'read_scope_user',
      nickname: 'Read Scope User',
    });
    await storage.replaceActiveBinding(principal.id, account.id);
    await storage.upsertCredential({
      id: 'c-cap-3',
      bangumiAccountId: account.id,
      encryptedAccessToken: encryptToken('access-token-789', secretKey, 'v1'),
      expiresAt: new Date(Date.now() + 3600000),
      requestedCapabilities: ['read:collection'],
      reportedScopes: [],
      scopeEvidence: 'reported',
      keyVersion: 'v1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const authed = await broker.requireAuthenticatedClient(principal.id, ['read:collection']);
    expect(authed.account.id).toBe(account.id);
    await expect(
      broker.requireAuthenticatedClient(principal.id, ['write:indices']),
    ).rejects.toThrow('PERMISSION_DENIED');
  });

  it('does NOT reject locally when scopeEvidence is unknown, deferring enforcement to upstream API', async () => {
    const storage = new MemoryStorage();
    const broker = new TokenBroker(storage, { secretKey }, new HttpClient());

    const principal = await storage.findOrCreatePrincipal({
      provider: 'test',
      botInstanceId: 'bot-1',
      externalUserId: 'usr-2',
    });

    const account = await storage.upsertBangumiAccount({
      id: 'bgm-cap-2',
      bangumiUserId: 1002,
      username: 'unknown_scope_user',
      nickname: 'Unknown Scope User',
    });

    await storage.replaceActiveBinding(principal.id, account.id);

    // Save credential with scopeEvidence: 'unknown'
    await storage.upsertCredential({
      id: 'c-cap-2',
      bangumiAccountId: account.id,
      encryptedAccessToken: encryptToken('access-token-456', secretKey, 'v1'),
      expiresAt: new Date(Date.now() + 3600000),
      requestedCapabilities: ['write:collection'],
      reportedScopes: null,
      scopeEvidence: 'unknown',
      keyVersion: 'v1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const authed = await broker.requireAuthenticatedClient(principal.id, ['write:collection']);
    expect(authed.account.id).toBe(account.id);
    expect(authed.client).toBeDefined();
  });
});
