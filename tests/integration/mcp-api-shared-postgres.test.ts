import { describe, it, expect } from 'vitest';
import { MemoryStorage, PostgresStorage, Storage } from '@bangumi-agent-kit/db';
import { createRuntimeDependencies } from '@bangumi-agent-kit/tools';
import { BangumiMcpServer } from '../../apps/mcp/src/server.js';
import { createApiApp } from '../../apps/api/src/app.js';
import { encryptToken } from '@bangumi-agent-kit/auth';

function testSharedStorageIntegration(name: string, createStorage: () => Promise<Storage | null>) {
  describe(`Shared Storage Integration (API & MCP Server): ${name}`, () => {
    it('shares principal, binding, and credentials between API app and MCP server', async () => {
      const storage = await createStorage();
      if (!storage) return;

      const secretKey = 'test-secret-key-123456789012345678901234';
      const deps = createRuntimeDependencies({
        storage,
        secretKey,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/oauth/callback',
      });

      const apiApp = createApiApp({ dependencies: deps, storage });
      const mcpServer = new BangumiMcpServer({ dependencies: deps, storage });

      // 1. API Health Check
      const healthRes = await apiApp.handleHealthReady();
      expect(healthRes.status).toBe('ready');

      // 2. Pre-populate account & credential into storage via API / storage
      const principal = await storage.findOrCreatePrincipal({
        provider: 'shared-test',
        botInstanceId: 'bot-1',
        externalUserId: 'user-shared-1',
      });

      const account = await storage.upsertBangumiAccount({
        id: 'bgm-shared-1',
        username: 'shared_user',
        nickname: 'Shared User',
      });

      await storage.replaceActiveBinding(principal.id, account.id);

      await storage.upsertCredential({
        bangumiAccountId: account.id,
        encryptedAccessToken: encryptToken('shared-access-token', secretKey, 'v1'),
        expiresAt: new Date(Date.now() + 3600000),
        keyVersion: 'v1',
        updatedAt: new Date(),
      });

      // 3. Query auth status via MCP Tool Registry initialized with shared deps
      const registry = mcpServer.getRegistry();
      const authStatusTool = registry.getTools().find((t) => t.name === 'bangumi.auth_status')!;

      const statusResult: any = await authStatusTool.execute(
        {},
        { principalId: principal.id, botInstanceId: 'bot-1', conversationId: 'c-1' },
        deps
      );

      expect(statusResult.bound).toBe(true);
      expect(statusResult.account.username).toBe('shared_user');

      await storage.close();
    });
  });
}

testSharedStorageIntegration('MemoryStorage', async () => new MemoryStorage());

testSharedStorageIntegration('PostgresStorage', async () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;
  try {
    const storage = new PostgresStorage(dbUrl);
    return storage;
  } catch {
    return null;
  }
});
