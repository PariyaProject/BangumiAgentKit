import { describe, it, expect, vi } from 'vitest';
import { PostgresStorage } from '@bangumi-agent-kit/db';
import { TokenBroker, BangumiOAuthClient, encryptToken } from '@bangumi-agent-kit/auth';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';

describe('A. PostgreSQL Refresh Concurrency Test', () => {
  it(
    'ensures concurrent refresh calls across independent storage & token broker instances issue only 1 upstream OAuth request',
    async () => {
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        throw new Error('DATABASE_URL environment variable is required for integration tests');
      }

      const secretKey = 'test-secret-key-123456789012345678901234';
      const accountId = `bgm_concurrency_${Date.now()}`;

      // 1. Storage Instance A & Broker Instance A setup
      const storageA = new PostgresStorage(dbUrl);
      await storageA.init();

      const principal = await storageA.findOrCreatePrincipal({
        provider: 'test-platform',
        botInstanceId: 'bot-1',
        externalUserId: `usr_${Date.now()}`,
      });

      const account = await storageA.upsertBangumiAccount({
        id: accountId,
        bangumiUserId: Math.floor(Math.random() * 1000000),
        username: 'concurrency_user',
        nickname: 'Concurrency User',
      });

      await storageA.replaceActiveBinding(principal.id, account.id);

      // Save an expired credential with refresh token
      await storageA.upsertCredential({
        bangumiAccountId: account.id,
        encryptedAccessToken: encryptToken('old-expired-access-token', secretKey, 'v1'),
        encryptedRefreshToken: encryptToken('valid-refresh-token', secretKey, 'v1'),
        expiresAt: new Date(Date.now() - 60000), // Expired 1 min ago
        requestedCapabilities: ['read:collection'],
        reportedScopes: ['read:collection'],
        scopeEvidence: 'reported',
        keyVersion: 'v1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 2. Storage Instance B
      const storageB = new PostgresStorage(dbUrl);

      // Mock OAuth Client
      let refreshCallCount = 0;
      const mockOAuthClient = new BangumiOAuthClient();
      vi.spyOn(mockOAuthClient, 'refreshToken').mockImplementation(async () => {
        refreshCallCount++;
        // Simulate network latency
        await new Promise((resolve) => setTimeout(resolve, 100));
        return {
          access_token: `new-refreshed-token-${Date.now()}`,
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'read:collection',
        };
      });

      const config = {
        secretKey,
        clientId: 'mock-client-id',
        clientSecret: 'mock-client-secret',
        redirectUri: 'http://localhost:3000/oauth/callback',
      };

      const brokerA = new TokenBroker(storageA, config, new HttpClient(), mockOAuthClient);
      const brokerB = new TokenBroker(storageB, config, new HttpClient(), mockOAuthClient);

      const startTime = Date.now();

      // Execute 5 concurrent calls alternating brokers
      const tasks = [
        brokerA.requireAuthenticatedClient(principal.id),
        brokerB.requireAuthenticatedClient(principal.id),
        brokerA.requireAuthenticatedClient(principal.id),
        brokerB.requireAuthenticatedClient(principal.id),
        brokerA.requireAuthenticatedClient(principal.id),
      ];

      const results = await Promise.all(tasks);
      const elapsedTime = Date.now() - startTime;

      expect(results).toHaveLength(5);
      for (const res of results) {
        expect(res.account.id).toBe(account.id);
        expect(res.client).toBeDefined();
      }

      // Exact DB & upstream call check
      expect(refreshCallCount).toBe(1);
      expect(elapsedTime).toBeLessThan(5000);

      await storageA.close();
      await storageB.close();
    },
    5000 // 5 seconds timeout guarantee
  );
});
