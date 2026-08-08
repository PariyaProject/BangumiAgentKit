import { describe, it, expect } from 'vitest';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { ToolRegistry, createRuntimeDependencies } from '@bangumi-agent-kit/tools';
import { encryptToken } from '@bangumi-agent-kit/auth';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';

describe('I. Audit Account ID Test', () => {
  const secretKey = 'test-secret-key-123456789012345678901234';

  it('records bangumiAccountId in audit events for both semantic writes and raw developer writes', async () => {
    const storage = new MemoryStorage();

    // Mock public client that returns success for API calls
    const mockHttpClient = new HttpClient({
      fetchFn: async () => new Response(JSON.stringify({ success: true }), { status: 200 }),
    });

    const deps = createRuntimeDependencies({
      storage,
      secretKey,
      publicHttpClient: mockHttpClient,
    });

    const registry = new ToolRegistry(deps);

    // Setup bound user
    const principal = await storage.findOrCreatePrincipal({
      provider: 'test-platform',
      botInstanceId: 'bot-audit',
      externalUserId: 'usr-audit-100',
    });

    const account = await storage.upsertBangumiAccount({
      id: 'bgm-acc-audit-99',
      bangumiUserId: 8888,
      username: 'audit_user',
      nickname: 'Audit User',
    });

    await storage.replaceActiveBinding(principal.id, account.id);

    await storage.upsertCredential({
      id: 'c-audit-1',
      bangumiAccountId: account.id,
      encryptedAccessToken: encryptToken('valid-token', secretKey, 'v1'),
      expiresAt: new Date(Date.now() + 3600000),
      requestedCapabilities: ['write:collection', 'write:indices'],
      reportedScopes: ['write:collection', 'write:indices'],
      scopeEvidence: 'reported',
      keyVersion: 'v1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const context = {
      principalId: principal.id,
      botInstanceId: 'bot-audit',
      conversationId: 'c-audit',
    };

    // 1. Semantic write execution: bangumi.update_collection
    await registry.executeTool(
      'bangumi.update_collection',
      { subjectId: 1001, status: 'doing' },
      context,
    );

    const auditEventsAfterSemantic = storage.getAuditEvents();
    expect(auditEventsAfterSemantic).toHaveLength(1);
    expect(auditEventsAfterSemantic[0]?.principalId).toBe(principal.id);
    expect(auditEventsAfterSemantic[0]?.bangumiAccountId).toBe(account.id);
    expect(auditEventsAfterSemantic[0]?.operationId).toBe('bangumi.update_collection');

    // 2. Raw developer write execution: bangumi.call_operation
    process.env.BANGUMI_ALLOW_RAW_WRITES = 'true';
    try {
      await registry.executeTool(
        'bangumi.call_operation',
        { operationId: 'patchUserCollection', pathParams: { subject_id: 1001 } },
        context,
      );

      const auditEventsAfterRaw = storage.getAuditEvents();
      expect(auditEventsAfterRaw).toHaveLength(2);
      const lastAudit = auditEventsAfterRaw[1];
      expect(lastAudit?.principalId).toBe(principal.id);
      expect(lastAudit?.bangumiAccountId).toBe(account.id);
      expect(lastAudit?.operationId).toBe('bangumi.call_operation');
    } finally {
      process.env.BANGUMI_ALLOW_RAW_WRITES = 'false';
    }
  });
});
