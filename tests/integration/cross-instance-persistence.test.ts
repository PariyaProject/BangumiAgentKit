import { describe, it, expect } from 'vitest';
import { PostgresStorage } from '@bangumi-agent-kit/db';
import { createRuntimeDependencies } from '@bangumi-agent-kit/tools';
import { BangumiMcpServer } from '../../apps/mcp/src/server.js';
import { encryptToken } from '@bangumi-agent-kit/auth';

describe('B. Cross-Instance PostgreSQL Persistence Test', () => {
  it('verifies data written by Instance A is readable by a completely fresh Instance B after closing A', async () => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.warn('Skipping Postgres integration test: DATABASE_URL not set');
      return;
    }

    const secretKey = 'test-secret-key-123456789012345678901234';
    const userId = `usr_persist_${Date.now()}`;
    const bangumiId = Math.floor(Math.random() * 1000000);
    const username = `persist_user_${Date.now()}`;

    // 1. Initialize Storage A and Runtime A
    const storageA = new PostgresStorage(dbUrl);
    await storageA.init();

    const principalA = await storageA.findOrCreatePrincipal({
      provider: 'cross-instance-test',
      botInstanceId: 'bot-instance-a',
      externalUserId: userId,
    });

    const accountA = await storageA.upsertBangumiAccount({
      id: `bgm_${bangumiId}`,
      bangumiUserId: bangumiId,
      username,
      nickname: 'Cross Instance User',
    });

    await storageA.replaceActiveBinding(principalA.id, accountA.id);

    await storageA.upsertCredential({
      id: `cred_cross_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      bangumiAccountId: accountA.id,
      encryptedAccessToken: encryptToken('persisted-access-token', secretKey, 'v1'),
      expiresAt: new Date(Date.now() + 3600000),
      requestedCapabilities: ['read:collection'],
      reportedScopes: ['read:collection'],
      scopeEvidence: 'reported',
      keyVersion: 'v1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Close Storage A completely
    await storageA.close();

    // 2. Initialize fresh Storage B and fresh Runtime B (No shared JS objects with A)
    const storageB = new PostgresStorage(dbUrl);
    await storageB.init();

    const depsB = createRuntimeDependencies({
      storage: storageB,
      secretKey,
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/oauth/callback',
    });

    const mcpServerB = new BangumiMcpServer({ dependencies: depsB, storage: storageB });
    const registryB = mcpServerB.getRegistry();

    const authStatusTool = registryB.getTools().find((t) => t.name === 'bangumi.auth_status');
    expect(authStatusTool).toBeDefined();

    const statusResult: any = await authStatusTool!.execute(
      {},
      {
        principalId: principalA.id,
        botInstanceId: 'bot-instance-a',
        conversationId: 'c-session-b',
      },
      depsB,
    );

    expect(statusResult.bound).toBe(true);
    expect(statusResult.account.username).toBe(username);
    expect(statusResult.account.nickname).toBe('Cross Instance User');

    await storageB.close();
  });
});
