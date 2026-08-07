import { describe, it, expect } from 'vitest';
import { PostgresStorage } from '@bangumi-agent-kit/db';

describe('G. Binding Concurrency Test', () => {
  it('guarantees exactly 1 active binding after concurrent replacement requests for the same principal', async () => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable is required for integration tests');
    }

    const storage = new PostgresStorage(dbUrl);
    await storage.init();

    const principal = await storage.findOrCreatePrincipal({
      provider: 'concurrency-test',
      botInstanceId: 'bot-1',
      externalUserId: `usr_bnd_${Date.now()}`,
    });

    const account1 = await storage.upsertBangumiAccount({
      id: `bgm_bnd_1_${Date.now()}`,
      bangumiUserId: Math.floor(Math.random() * 1000000),
      username: 'bnd_user_1',
      nickname: 'Binding User 1',
    });

    const account2 = await storage.upsertBangumiAccount({
      id: `bgm_bnd_2_${Date.now()}`,
      bangumiUserId: Math.floor(Math.random() * 1000000),
      username: 'bnd_user_2',
      nickname: 'Binding User 2',
    });

    // Execute concurrent replaceActiveBinding calls
    await Promise.allSettled([
      storage.replaceActiveBinding(principal.id, account1.id),
      storage.replaceActiveBinding(principal.id, account2.id),
    ]);

    // Inspect active bindings directly from DB
    const client = (storage as any).pool;
    const res = await client.query(
      'SELECT COUNT(*)::int as count FROM account_bindings WHERE principal_id = $1 AND is_active = true',
      [principal.id]
    );

    expect(res.rows[0].count).toBe(1);

    await storage.close();
  });
});
