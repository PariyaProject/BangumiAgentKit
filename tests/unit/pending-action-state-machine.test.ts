import { describe, it, expect } from 'vitest';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { PolicyManager, computeCanonicalPayloadHash } from '@bangumi-agent-kit/tools';

describe('PendingAction State Machine & Canonical Hashing Tests', () => {
  it('computes canonical payload hash invariant to key order', () => {
    const payload1 = { z: 1, a: 'test', sub: { y: 2, x: 3 } };
    const payload2 = { a: 'test', sub: { x: 3, y: 2 }, z: 1 };

    const hash1 = computeCanonicalPayloadHash(payload1);
    const hash2 = computeCanonicalPayloadHash(payload2);

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 hex string
  });

  it('handles write confirmation flow state transitions', async () => {
    const storage = new MemoryStorage();
    const context = {
      principalId: 'p-1',
      botInstanceId: 'bot-1',
      conversationId: 'c-1',
    };

    const policy = {
      auth: 'required' as const,
      requiredCapabilities: ['write:collection'],
      risk: 'destructive' as const,
      actionType: 'patch_collection',
      summary: 'Update collection status',
    };

    const payload = { subjectId: 100, rate: 5 };

    // 1. First execution without confirmationId throws CONFIRMATION_REQUIRED
    let confirmationId = '';
    try {
      await PolicyManager.assertAndClaimWritePolicy({
        storage,
        context,
        actionType: policy.actionType,
        summary: policy.summary,
        policy,
        payload,
      });
      expect.fail('Should have thrown CONFIRMATION_REQUIRED');
    } catch (err: any) {
      expect(err.code).toBe('CONFIRMATION_REQUIRED');
      const match = err.message.match(/Confirmation ID: (\S+)/);
      confirmationId = match?.[1] || '';
      expect(confirmationId).toBeDefined();
      expect(confirmationId.length).toBeGreaterThan(0);
    }

    // 2. Claiming with mismatched payload throws CONFIRMATION_PAYLOAD_MISMATCH
    const tamperedPayload = { subjectId: 100, rate: 10 };
    await expect(
      PolicyManager.assertAndClaimWritePolicy({
        storage,
        context: { ...context, confirmationId },
        actionType: policy.actionType,
        summary: policy.summary,
        policy,
        payload: tamperedPayload,
      })
    ).rejects.toThrow();

    // 3. Claiming with valid confirmationId & payload succeeds
    const { confirmationId: claimedConfId, pendingActionId } = await PolicyManager.assertAndClaimWritePolicy({
      storage,
      context: { ...context, confirmationId },
      actionType: policy.actionType,
      summary: policy.summary,
      policy,
      payload,
    });

    expect(claimedConfId).toBe(confirmationId);
    expect(pendingActionId).toBeDefined();

    // 4. Attempting to claim the same confirmationId again throws CONFIRMATION_INVALID
    await expect(
      PolicyManager.assertAndClaimWritePolicy({
        storage,
        context: { ...context, confirmationId },
        actionType: policy.actionType,
        summary: policy.summary,
        policy,
        payload,
      })
    ).rejects.toThrow();
  });
});
