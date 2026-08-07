import { describe, it, expect } from 'vitest';
import { PostgresStorage } from '@bangumi-agent-kit/db';

describe('G. Binding Concurrency Test', () => {
  it(
    'guarantees exactly 1 active binding after concurrent replacement requests for the same principal',
    async () => {
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        throw new Error('DATABASE_URL environment variable is required for integration tests');
      }

      const storageA = new PostgresStorage(dbUrl);
      const storageB = new PostgresStorage(dbUrl);
      await storageA.init();
      await storageB.init();

      try {
        const principal = await storageA.findOrCreatePrincipal({
          provider: 'concurrency-test',
          botInstanceId: 'bot-1',
          externalUserId: `usr_bnd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        });

        const accountA = await storageA.upsertBangumiAccount({
          id: `bgm_bnd_a_${Date.now()}`,
          bangumiUserId: Math.floor(Math.random() * 1000000),
          username: 'bnd_user_a',
          nickname: 'Binding User A',
        });

        const accountB = await storageB.upsertBangumiAccount({
          id: `bgm_bnd_b_${Date.now()}`,
          bangumiUserId: Math.floor(Math.random() * 1000000),
          username: 'bnd_user_b',
          nickname: 'Binding User B',
        });

        // Execute concurrent replaceActiveBinding calls using storageA and storageB
        await Promise.allSettled([
          storageA.replaceActiveBinding(principal.id, accountA.id),
          storageB.replaceActiveBinding(principal.id, accountB.id),
        ]);

        // Inspect active bindings directly from DB
        const pool = (storageA as any).pool;
        const res = await pool.query(
          'SELECT COUNT(*)::int as count FROM account_bindings WHERE principal_id = $1 AND is_active = true',
          [principal.id]
        );

        expect(res.rows[0].count).toBe(1);

        const activeBinding = await storageA.getActiveBinding(principal.id);
        expect(activeBinding).not.toBeNull();
        expect([accountA.id, accountB.id]).toContain(activeBinding!.bangumiAccountId);
      } finally {
        await storageA.close();
        await storageB.close();
      }
    },
    5000
  );
});
