import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryStorage } from '../../packages/db/src/index.js';
import {
  StdioMcpExecutionIdentityProvider,
  validateTrustedExternalIdentity,
} from '../../apps/mcp/src/identity.js';

describe('Trusted MCP external identity', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    for (const key of [
      'BANGUMI_MCP_IDENTITY_PROVIDER',
      'BANGUMI_MCP_EXTERNAL_USER_ID',
      'BANGUMI_MCP_BOT_INSTANCE_ID',
      'BANGUMI_MCP_CONVERSATION_ID',
      'BANGUMI_MCP_DISPLAY_NAME',
      'BANGUMI_MCP_CONFIRMATION_GRANT',
      'BANGUMI_MCP_PRINCIPAL_ID',
      'BANGUMI_MCP_ALLOW_INTERNAL_PRINCIPAL_ID',
    ]) {
      delete process.env[key];
    }
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function setIdentity(userId: string, conversationId: string, botInstanceId = 'qq:10001') {
    process.env.BANGUMI_MCP_IDENTITY_PROVIDER = 'qq';
    process.env.BANGUMI_MCP_EXTERNAL_USER_ID = userId;
    process.env.BANGUMI_MCP_BOT_INSTANCE_ID = botInstanceId;
    process.env.BANGUMI_MCP_CONVERSATION_ID = conversationId;
  }

  it('resolves external identity through Storage.findOrCreatePrincipal', async () => {
    const storage = new MemoryStorage();
    setIdentity('30001', 'qq:10001:group:20001:user:30001');
    process.env.BANGUMI_MCP_DISPLAY_NAME = 'User A';

    const provider = new StdioMcpExecutionIdentityProvider(storage);
    const first = await provider.resolveContext({});
    const second = await provider.resolveContext({});

    expect(first.principalId).toMatch(/^prc_/);
    expect(second.principalId).toBe(first.principalId);
    expect(first.botInstanceId).toBe('qq:10001');
    expect(first.conversationId).toBe('qq:10001:group:20001:user:30001');
    expect(await storage.getPrincipal(first.principalId)).toMatchObject({
      provider: 'qq',
      botInstanceId: 'qq:10001',
      externalUserId: '30001',
      displayName: 'User A',
    });
    await storage.close();
  });

  it('isolates users in one group, while preserving principal across conversations', async () => {
    const storage = new MemoryStorage();

    setIdentity('30001', 'qq:10001:group:20001:user:30001');
    const userA = await new StdioMcpExecutionIdentityProvider(storage).resolveContext({});

    setIdentity('30002', 'qq:10001:group:20001:user:30002');
    const userB = await new StdioMcpExecutionIdentityProvider(storage).resolveContext({});

    setIdentity('30001', 'qq:10001:group:20002:user:30001');
    const userAOtherGroup = await new StdioMcpExecutionIdentityProvider(storage).resolveContext({});

    setIdentity('30001', 'qq:10001:private:30001');
    const userAPrivate = await new StdioMcpExecutionIdentityProvider(storage).resolveContext({});

    expect(userA.principalId).not.toBe(userB.principalId);
    expect(userA.conversationId).not.toBe(userB.conversationId);
    expect(userA.principalId).toBe(userAOtherGroup.principalId);
    expect(userA.principalId).toBe(userAPrivate.principalId);
    expect(userAOtherGroup.conversationId).not.toBe(userAPrivate.conversationId);
    await storage.close();
  });

  it('scopes the same external user to different bot instances', async () => {
    const storage = new MemoryStorage();

    setIdentity('30001', 'qq:10001:private:30001', 'qq:10001');
    const firstBot = await new StdioMcpExecutionIdentityProvider(storage).resolveContext({});

    setIdentity('30001', 'qq:10002:private:30001', 'qq:10002');
    const secondBot = await new StdioMcpExecutionIdentityProvider(storage).resolveContext({});

    expect(firstBot.principalId).not.toBe(secondBot.principalId);
    await storage.close();
  });

  it('rejects direct internal principal injection in production', async () => {
    const storage = new MemoryStorage();
    process.env.NODE_ENV = 'production';
    process.env.BANGUMI_MCP_PRINCIPAL_ID = 'prc_other_user';

    await expect(new StdioMcpExecutionIdentityProvider(storage).resolveContext({})).rejects.toThrow(
      'BANGUMI_MCP_PRINCIPAL_ID is forbidden in production',
    );
    await storage.close();
  });

  it('allows legacy internal principal only behind an explicit non-production flag', async () => {
    const storage = new MemoryStorage();
    process.env.BANGUMI_MCP_PRINCIPAL_ID = 'prc_test_user';
    process.env.BANGUMI_MCP_ALLOW_INTERNAL_PRINCIPAL_ID = 'true';

    const context = await new StdioMcpExecutionIdentityProvider(storage).resolveContext({});

    expect(context.principalId).toBe('prc_test_user');
    await storage.close();
  });

  it('enforces trusted identity bounds', () => {
    expect(() =>
      validateTrustedExternalIdentity({
        provider: 'qq',
        botInstanceId: 'bot',
        externalUserId: 'user',
        conversationId: 'conversation',
        displayName: 'x'.repeat(129),
      }),
    ).toThrow('displayName exceeds');
  });
});
