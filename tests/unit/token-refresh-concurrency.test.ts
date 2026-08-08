import { describe, it, expect, vi } from 'vitest';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { TokenBroker, encryptToken, BangumiOAuthClient } from '@bangumi-agent-kit/auth';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';

describe('Token Refresh Concurrency Locking Tests', () => {
  it('deduplicates concurrent refresh calls using credential lock', async () => {
    const storage = new MemoryStorage();
    const secretKey = 'test-secret-key-123456789012345678901234';

    const principal = await storage.findOrCreatePrincipal({
      provider: 'test',
      botInstanceId: 'bot-1',
      externalUserId: 'user-1',
    });

    const account = await storage.upsertBangumiAccount({
      id: 'bgm-100',
      bangumiUserId: 100,
      username: 'spike',
      nickname: 'Spike',
    });

    await storage.replaceActiveBinding(principal.id, account.id);

    // Initial credential: expired access token, valid refresh token
    const oldAccessToken = 'old-access-token';
    const oldRefreshToken = 'old-refresh-token';
    await storage.upsertCredential({
      id: 'c-100',
      bangumiAccountId: account.id,
      encryptedAccessToken: encryptToken(oldAccessToken, secretKey, 'v1'),
      encryptedRefreshToken: encryptToken(oldRefreshToken, secretKey, 'v1'),
      expiresAt: new Date(Date.now() - 10000), // expired
      requestedCapabilities: ['read'],
      reportedScopes: ['read'],
      scopeEvidence: 'reported',
      keyVersion: 'v1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    let refreshCallCount = 0;
    const mockOAuthClient = {
      refreshToken: vi.fn().mockImplementation(async () => {
        refreshCallCount++;
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        };
      }),
    } as unknown as BangumiOAuthClient;

    const mockFetch = vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const publicHttpClient = new HttpClient({ fetchFn: mockFetch });

    const broker = new TokenBroker(
      storage,
      {
        secretKey,
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'http://localhost/callback',
      },
      publicHttpClient,
      mockOAuthClient,
    );

    // Fire 5 concurrent requireAuthenticatedClient requests
    const promises = Array.from({ length: 5 }).map(() =>
      broker.requireAuthenticatedClient(principal.id),
    );

    const results = await Promise.all(promises);

    expect(results.length).toBe(5);
    expect(refreshCallCount).toBe(1);

    // Verify credential in storage updated
    const updatedCred = await storage.getCredential(account.id);
    expect(updatedCred?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
