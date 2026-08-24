import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MemoryStorage, PostgresStorage, SQLiteStorage, Storage } from '@bangumi-agent-kit/db';

function testStorageContract(name: string, createStorage: () => Promise<Storage | null>) {
  describe(`Storage Contract: ${name}`, () => {
    it('manages principal, binding, and credentials', async () => {
      const storage = await createStorage();
      if (!storage) return;

      const principal = await storage.findOrCreatePrincipal({
        provider: 'test-platform',
        botInstanceId: 'bot-1',
        externalUserId: 'user-100',
        displayName: 'Test User',
      });

      expect(principal.id).toBeDefined();
      expect(principal.provider).toBe('test-platform');

      const foundPrincipal = await storage.getPrincipal(principal.id);
      expect(foundPrincipal?.id).toBe(principal.id);

      const account = await storage.upsertBangumiAccount({
        id: 'bgm-1001',
        bangumiUserId: 1001,
        username: 'spike',
        nickname: 'Spike Spiegel',
        avatarUrl: 'https://example.com/avatar.jpg',
      });
      expect(account.id).toBe('bgm-1001');

      const binding = await storage.replaceActiveBinding(principal.id, account.id);
      expect(binding.principalId).toBe(principal.id);
      expect(binding.bangumiAccountId).toBe(account.id);
      expect(binding.isActive).toBe(true);

      const activeBinding = await storage.getActiveBinding(principal.id);
      expect(activeBinding?.bangumiAccountId).toBe(account.id);

      const encToken = {
        ciphertext: 'encrypted-access-token-bytes',
        iv: 'iv',
        authTag: 'tag',
        keyVersion: 'v1',
      };
      const encRefresh = {
        ciphertext: 'encrypted-refresh-token-bytes',
        iv: 'iv',
        authTag: 'tag',
        keyVersion: 'v1',
      };

      await storage.upsertCredential({
        id: 'c-1001',
        bangumiAccountId: account.id,
        encryptedAccessToken: encToken,
        encryptedRefreshToken: encRefresh,
        expiresAt: new Date(Date.now() + 3600000),
        requestedCapabilities: ['read'],
        reportedScopes: ['read'],
        scopeEvidence: 'reported',
        keyVersion: 'v1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const cred = await storage.getCredential(account.id);
      expect(cred?.encryptedAccessToken.ciphertext).toBe('encrypted-access-token-bytes');

      await storage.deactivateBindings(principal.id);
      const deactivated = await storage.getActiveBinding(principal.id);
      expect(deactivated).toBeNull();

      await storage.deleteCredential(account.id);
      const deletedCred = await storage.getCredential(account.id);
      expect(deletedCred).toBeNull();

      await storage.close();
    });

    it('handles oauth session lifecycle single-use state', async () => {
      const storage = await createStorage();
      if (!storage) return;

      const principal = await storage.findOrCreatePrincipal({
        provider: 'test-platform',
        botInstanceId: 'bot-1',
        externalUserId: 'user-p1',
      });

      const session = {
        id: `sess_${Date.now()}`,
        stateHash: `state-hash-abc-${Date.now()}`,
        principalId: principal.id,
        botInstanceId: 'bot-1',
        conversationId: 'c-1',
        requestedCapabilities: ['read:collection'],
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 600000),
      };

      await storage.createOAuthSession(session);

      const consumed = await storage.consumeOAuthSession(session.stateHash);
      expect(consumed.principalId).toBe(principal.id);

      await expect(storage.consumeOAuthSession(session.stateHash)).rejects.toThrow(
        'OAUTH_STATE_REUSED',
      );

      await storage.close();
    });

    it('handles pending action state machine', async () => {
      const storage = await createStorage();
      if (!storage) return;

      const principal = await storage.findOrCreatePrincipal({
        provider: 'test-platform',
        botInstanceId: 'b-1',
        externalUserId: 'user-p2',
      });

      const now = new Date();
      const action = {
        id: `conf-${Date.now()}`,
        confirmationId: `conf-${Date.now()}`,
        principalId: principal.id,
        botInstanceId: 'b-1',
        conversationKey: 'c-1',
        actionType: 'manage_index_create',
        summary: 'Create index',
        normalizedPayloadJson: JSON.stringify({ title: 'New Index' }),
        payloadHash: 'hash-xyz',
        payload: { title: 'New Index' },
        status: 'pending' as const,
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date(now.getTime() + 600000),
      };

      await storage.createPendingAction(action);

      const claimed = await storage.claimPendingAction({
        confirmationId: action.id,
        principalId: principal.id,
        botInstanceId: 'b-1',
        conversationId: 'c-1',
        payloadHash: 'hash-xyz',
      });

      expect(claimed.id).toBe(action.id);
      expect(claimed.status).toBe('executing');

      await storage.markPendingActionSucceeded(action.id);

      await storage.close();
    });

    it('stores immutable bounded subject statistics observations independently of identity', async () => {
      const storage = await createStorage();
      if (!storage) return;

      const base = new Date('2026-08-24T00:00:00.000Z');
      for (let index = 0; index < 3; index += 1) {
        const observedAt = new Date(base.getTime() + index * 60_000);
        await storage.appendSubjectStatsObservation(
          {
            id: `stats-observation-${index}`,
            subjectId: 123,
            observedAt,
            retrievedAt: observedAt,
            state: 'complete',
            resultJson: JSON.stringify({ score: 8 + index / 10 }),
            methodologyVersion: 'bangumi.subject.stats.observation-history.v1',
            retentionUntil: new Date(base.getTime() + 86_400_000),
          },
          { maxObservations: 2, now: observedAt },
        );
      }

      const observations = await storage.listSubjectStatsObservations({
        subjectId: 123,
        limit: 10,
        now: base,
      });
      expect(observations.map((item) => item.id)).toEqual([
        'stats-observation-1',
        'stats-observation-2',
      ]);
      expect(observations[0]?.resultJson).toContain('8.1');

      const beforeExpiry = await storage.getSubjectStatsObservationSummary(123, base);
      expect(beforeExpiry.recordedCount).toBe(3);
      expect(beforeExpiry.retainedCount).toBe(2);
      expect(beforeExpiry.prunedCount).toBe(1);
      expect(beforeExpiry.firstObservedAt?.toISOString()).toBe(base.toISOString());

      const expired = await storage.listSubjectStatsObservations({
        subjectId: 123,
        limit: 10,
        now: new Date(base.getTime() + 86_400_000),
      });
      expect(expired).toEqual([]);
      const afterExpiry = await storage.getSubjectStatsObservationSummary(
        123,
        new Date(base.getTime() + 86_400_000),
      );
      expect(afterExpiry.recordedCount).toBe(3);
      expect(afterExpiry.retainedCount).toBe(0);
      expect(afterExpiry.expiredCount).toBe(2);

      let active = 0;
      let peak = 0;
      await Promise.all([
        storage.withSubjectStatsObservationLock(123, async () => {
          active += 1;
          peak = Math.max(peak, active);
          await new Promise((resolve) => setTimeout(resolve, 5));
          active -= 1;
        }),
        storage.withSubjectStatsObservationLock(123, async () => {
          active += 1;
          peak = Math.max(peak, active);
          await new Promise((resolve) => setTimeout(resolve, 5));
          active -= 1;
        }),
      ]);
      expect(peak).toBe(1);

      expect(await storage.getSubjectStatsObservationSubjectCount()).toBe(0);
      const hostBackoffUntil = new Date(Date.now() + 60_000);
      await storage.setSubjectStatsObservationHostBackoff(hostBackoffUntil);
      const activeBackoff = await storage.getSubjectStatsObservationHostBackoff(new Date());
      expect(activeBackoff?.getTime()).toBe(hostBackoffUntil.getTime());

      let hostActive = 0;
      let hostPeak = 0;
      await Promise.all([
        storage.withSubjectStatsObservationHostLock(async () => {
          hostActive += 1;
          hostPeak = Math.max(hostPeak, hostActive);
          await new Promise((resolve) => setTimeout(resolve, 5));
          hostActive -= 1;
        }),
        storage.withSubjectStatsObservationHostLock(async () => {
          hostActive += 1;
          hostPeak = Math.max(hostPeak, hostActive);
          await new Promise((resolve) => setTimeout(resolve, 5));
          hostActive -= 1;
        }),
      ]);
      expect(hostPeak).toBe(1);
      await storage.close();
    });
  });
}

testStorageContract('MemoryStorage', async () => new MemoryStorage());

testStorageContract('SQLiteStorage', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgm-sqlite-contract-'));
  const dbPath = path.join(tmpDir, 'test.sqlite');
  return SQLiteStorage.create({ dbPath });
});

testStorageContract('PostgresStorage', async () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;
  try {
    const storage = await PostgresStorage.create(dbUrl);
    return storage;
  } catch {
    return null;
  }
});
