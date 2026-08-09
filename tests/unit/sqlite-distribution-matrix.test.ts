import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
const Database = require('better-sqlite3');
import {
  SQLiteStorage,
  PostgresStorage,
  createStorageFromConfig,
  runSqliteMigrations,
  resolveSqlitePath,
} from '../../packages/db/src/index.js';
import { createApiApp } from '../../apps/api/src/app.js';
import { TokenBroker, encryptToken } from '../../packages/auth/src/index.js';
import { BangumiMcpServer } from '../../apps/mcp/src/server.js';
import { BANGUMI_OAUTH_CALLBACK_PATH, loadRuntimeEnv } from '../../packages/config/src/index.js';
import { setupLocal } from '../../scripts/setup-local.js';

describe('PR-6R-A SQLite Distribution & Concurrency Matrix', () => {
  let origEnv: NodeJS.ProcessEnv;
  let tmpDir: string;

  beforeEach(() => {
    origEnv = { ...process.env };
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgm-matrix-test-'));
  });

  afterEach(() => {
    process.env = origEnv;
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  // R6A-01
  it('R6A-01: NODE_ENV=production without DATABASE_URL defaults to SQLite', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.DATABASE_URL;
    delete process.env.BANGUMI_DB_DRIVER;

    const dbPath = path.join(tmpDir, 'prod.sqlite');
    const storage = await createStorageFromConfig({ sqliteOptions: { dbPath } });
    expect(storage).toBeInstanceOf(SQLiteStorage);
    await storage.close();
  });

  // R6A-02
  it('R6A-02: explicit sqlite driver overrides DATABASE_URL', async () => {
    process.env.BANGUMI_DB_DRIVER = 'sqlite';
    process.env.DATABASE_URL = 'postgres://invalid:5432/bogus_db';

    const dbPath = path.join(tmpDir, 'override.sqlite');
    const storage = await createStorageFromConfig({ sqliteOptions: { dbPath } });
    expect(storage).toBeInstanceOf(SQLiteStorage);
    await storage.close();
  });

  // R6A-03
  it('R6A-03: legacy DATABASE_URL selects Postgres', async () => {
    delete process.env.BANGUMI_DB_DRIVER;
    const createSpy = vi.spyOn(PostgresStorage, 'create').mockResolvedValue({
      close: async () => {},
    } as unknown as PostgresStorage);

    await createStorageFromConfig({ databaseUrl: 'postgres://user:pass@localhost:5432/db' });
    expect(createSpy).toHaveBeenCalledWith('postgres://user:pass@localhost:5432/db');
    createSpy.mockRestore();
  });

  // R6A-04
  it('R6A-04: postgres driver without DATABASE_URL throws CONFIG_ERROR', async () => {
    process.env.BANGUMI_DB_DRIVER = 'postgres';
    delete process.env.DATABASE_URL;

    await expect(createStorageFromConfig({})).rejects.toThrow(
      'CONFIG_ERROR: DATABASE_URL is required when BANGUMI_DB_DRIVER=postgres',
    );
  });

  // R6A-05
  it('R6A-05: API runtime state is visible to an independently initialized MCP runtime', async () => {
    const dbPath = path.join(tmpDir, 'shared.sqlite');
    process.env.BANGUMI_DB_DRIVER = 'sqlite';
    process.env.BANGUMI_SQLITE_PATH = dbPath;
    delete process.env.DATABASE_URL;

    const apiRuntime = await createApiApp();
    const principal = await apiRuntime.storage.findOrCreatePrincipal({
      provider: 'qq',
      botInstanceId: 'api-bot',
      externalUserId: 'api-user',
    });
    const accountA = await apiRuntime.storage.upsertBangumiAccount({
      id: 'bgm-shared-1',
      bangumiUserId: 8888,
      username: 'shared_user',
      nickname: 'Shared User',
    });
    await apiRuntime.storage.bindAccount(principal.id, accountA.id, true);

    const mcpRuntime = await BangumiMcpServer.create();
    const status = await mcpRuntime
      .getRegistry()
      .executeTool(
        'bangumi.auth_status',
        {},
        { principalId: principal.id, botInstanceId: 'api-bot', conversationId: 'api-conversation' },
      );
    expect(status).toMatchObject({
      bound: true,
      account: { username: 'shared_user' },
    });

    await mcpRuntime.close();
    await apiRuntime.storage.close();
  });

  // R6A-06 & R6A-07
  it('R6A-06 & R6A-07: loadRuntimeEnv loads .env.local with correct precedence', () => {
    delete process.env.TEST_VAR_LOCAL;
    delete process.env.TEST_VAR_DEFAULT;
    delete process.env.TEST_VAR_PREEXISTING;

    process.env.TEST_VAR_PREEXISTING = 'original';

    fs.writeFileSync(
      path.join(tmpDir, '.env.local'),
      'TEST_VAR_LOCAL=from_local\nTEST_VAR_PREEXISTING=local_override\n',
    );
    fs.writeFileSync(
      path.join(tmpDir, '.env'),
      'TEST_VAR_LOCAL=from_env\nTEST_VAR_DEFAULT=from_env\n',
    );

    loadRuntimeEnv(tmpDir);

    expect(process.env.TEST_VAR_PREEXISTING).toBe('original');
    expect(process.env.TEST_VAR_LOCAL).toBe('from_local');
    expect(process.env.TEST_VAR_DEFAULT).toBe('from_env');
  });

  // R6A-08
  it('R6A-08: setup OAuth callback redirect URI matches Fastify route', async () => {
    const dataDir = path.join(tmpDir, 'oauth-data');
    await setupLocal({ cwd: tmpDir, dataDir });
    const envContent = fs.readFileSync(path.join(tmpDir, '.env.local'), 'utf8');
    const redirectUri = envContent
      .split('\n')
      .find((line) => line.startsWith('BANGUMI_OAUTH_REDIRECT_URI='))
      ?.slice('BANGUMI_OAUTH_REDIRECT_URI='.length);
    expect(redirectUri?.endsWith(BANGUMI_OAUTH_CALLBACK_PATH)).toBe(true);

    const storage = await SQLiteStorage.create({ dbPath: resolveSqlitePath(undefined, dataDir) });
    const { app } = await createApiApp({ storage });
    expect(app.hasRoute({ method: 'GET', url: BANGUMI_OAUTH_CALLBACK_PATH })).toBe(true);

    const res = await app.inject({
      method: 'GET',
      url: BANGUMI_OAUTH_CALLBACK_PATH,
    });

    // Should reach handler (400 due to missing code/state), proving route exists
    expect(res.statusCode).toBe(400);
    expect(res.payload).toContain('code');
    await storage.close();
  });

  // R6A-09
  it('R6A-09: fresh setup functions without dist dependencies', async () => {
    const dbPath = resolveSqlitePath(path.join(tmpDir, 'fresh.sqlite'));
    const storage = await SQLiteStorage.create({ dbPath });
    expect(fs.existsSync(dbPath)).toBe(true);
    await storage.close();
  });

  // R6A-10
  it('R6A-10: migration runner is idempotent', async () => {
    const dbPath = path.join(tmpDir, 'idempotent.sqlite');
    const sqliteDb = new Database(dbPath);

    await runSqliteMigrations(sqliteDb);
    await runSqliteMigrations(sqliteDb);

    const stmt = sqliteDb.prepare('SELECT count(*) as cnt FROM _schema_migrations');
    const row = stmt.get() as { cnt: number };
    expect(row.cnt).toBeGreaterThan(0);
    sqliteDb.close();
  });

  // R6A-11
  it('R6A-11: migration history records applied versions', async () => {
    const dbPath = path.join(tmpDir, 'history.sqlite');
    const sqliteDb = new Database(dbPath);

    await runSqliteMigrations(sqliteDb);

    const stmt = sqliteDb.prepare('SELECT id FROM _schema_migrations');
    const rows = stmt.all() as { id: string }[];
    expect(rows.some((r) => r.id === '0000_initial.sql')).toBe(true);
    sqliteDb.close();
  });

  // R6A-12
  it('R6A-12: SQLite foreign key constraint blocks invalid binding', async () => {
    const dbPath = path.join(tmpDir, 'fk.sqlite');
    const storage = await SQLiteStorage.create({ dbPath });

    await expect(
      storage.bindAccount('non-existent-principal', 'non-existent-account'),
    ).rejects.toThrow();

    await storage.close();
  });

  // R6A-13
  it('R6A-13: DB enforces max one active binding per principal via unique index', async () => {
    const dbPath = path.join(tmpDir, 'unique_active.sqlite');
    const storage = await SQLiteStorage.create({ dbPath });

    const p = await storage.findOrCreatePrincipal({
      provider: 'test',
      botInstanceId: 'b1',
      externalUserId: 'u13',
    });
    const a1 = await storage.upsertBangumiAccount({
      id: 'bgm-13a',
      bangumiUserId: 1301,
      username: 'u13a',
      nickname: 'User 13A',
    });
    const a2 = await storage.upsertBangumiAccount({
      id: 'bgm-13b',
      bangumiUserId: 1302,
      username: 'u13b',
      nickname: 'User 13B',
    });

    await storage.bindAccount(p.id, a1.id, true);

    // Directly attempt to insert a second active binding for the same principal
    const rawDb = new Database(dbPath);
    expect(() => {
      rawDb
        .prepare(
          'INSERT INTO account_bindings (id, principal_id, bangumi_account_id, is_active, created_at) VALUES (?, ?, ?, 1, ?)',
        )
        .run('bnd_manual_dup', p.id, a2.id, Date.now());
    }).toThrow();

    rawDb.close();
    await storage.close();
  });

  // R6A-14
  it('R6A-14: DB active invariant under independent connections', async () => {
    const dbPath = path.join(tmpDir, 'concurrent_active.sqlite');
    const storageInit = await SQLiteStorage.create({ dbPath });

    const p = await storageInit.findOrCreatePrincipal({
      provider: 'test',
      botInstanceId: 'b1',
      externalUserId: 'u14',
    });
    const a1 = await storageInit.upsertBangumiAccount({
      id: 'bgm-14a',
      bangumiUserId: 1401,
      username: 'u14a',
      nickname: 'User 14A',
    });
    const a2 = await storageInit.upsertBangumiAccount({
      id: 'bgm-14b',
      bangumiUserId: 1402,
      username: 'u14b',
      nickname: 'User 14B',
    });

    await storageInit.bindAccount(p.id, a1.id, false);
    await storageInit.bindAccount(p.id, a2.id, false);
    await storageInit.close();

    const storage1 = await SQLiteStorage.create({ dbPath });
    const storage2 = await SQLiteStorage.create({ dbPath });

    await Promise.allSettled([
      storage1.setActiveBinding(p.id, a1.id),
      storage2.setActiveBinding(p.id, a2.id),
    ]);

    const rawDb = new Database(dbPath);
    const row = rawDb
      .prepare(
        'SELECT COUNT(*) as count FROM account_bindings WHERE principal_id = ? AND is_active = 1',
      )
      .get(p.id) as { count: number };

    expect(row.count).toBe(1);

    rawDb.close();
    await storage1.close();
    await storage2.close();
  });

  // R6A-15
  it('R6A-15: token refresh concurrency remains single refresh', async () => {
    const dbPath = path.join(tmpDir, 'token_refresh.sqlite');
    const storage = await SQLiteStorage.create({ dbPath });

    const account = await storage.upsertBangumiAccount({
      id: 'bgm-15',
      bangumiUserId: 1501,
      username: 'u15',
      nickname: 'User 15',
    });

    const secretKey = 'test-secret-key-123456789012345678901234';
    const encToken = encryptToken('old-access', secretKey, 'v1');
    const encRefresh = encryptToken('old-refresh', secretKey, 'v1');

    await storage.upsertCredential({
      id: 'cred-15',
      bangumiAccountId: account.id,
      encryptedAccessToken: encToken,
      encryptedRefreshToken: encRefresh,
      expiresAt: new Date(Date.now() - 1000), // Expired!
      requestedCapabilities: ['read'],
      reportedScopes: ['read'],
      scopeEvidence: 'reported',
      keyVersion: 'v1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    let mockRefreshCallCount = 0;
    const mockFetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes('/oauth/access_token')) {
        mockRefreshCallCount++;
        return new Response(
          JSON.stringify({
            access_token: 'new_access_token',
            refresh_token: 'new_refresh_token',
            expires_in: 604800,
            token_type: 'Bearer',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });
    vi.stubGlobal('fetch', mockFetch);

    const tokenBroker = new TokenBroker(storage, {
      secretKey: 'test-secret-key-123456789012345678901234',
      clientId: 'cid',
      clientSecret: 'csec',
      redirectUri: 'http://localhost:3000/oauth/bangumi/callback',
    });

    // Call resolveAccessToken concurrently 5 times
    const results = await Promise.all(
      Array.from({ length: 5 }).map(() => tokenBroker.resolveAccessToken(account.id)),
    );

    for (const res of results) {
      expect(res).toBe('new_access_token');
    }
    expect(mockRefreshCallCount).toBe(1);

    await storage.close();
  });

  // R6A-16
  it('R6A-16: OAuth session consumption remains atomic', async () => {
    const dbPath = path.join(tmpDir, 'oauth_atomic.sqlite');
    const storage1 = await SQLiteStorage.create({ dbPath });
    const storage2 = await SQLiteStorage.create({ dbPath });

    const p = await storage1.findOrCreatePrincipal({
      provider: 'test',
      botInstanceId: 'b1',
      externalUserId: 'u16',
    });

    const stateHash = 'atomic-state-hash-16';
    await storage1.createOAuthSession({
      id: 'sess-16',
      stateHash,
      principalId: p.id,
      requestedCapabilities: ['read'],
      expiresAt: new Date(Date.now() + 60000),
      createdAt: new Date(),
    });

    const outcomes = await Promise.allSettled([
      storage1.consumeOAuthSession(stateHash),
      storage2.consumeOAuthSession(stateHash),
    ]);

    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
    const rejected = outcomes.filter((o) => o.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    await storage1.close();
    await storage2.close();
  });

  // R6A-17
  it('R6A-17: PendingAction claim remains atomic', async () => {
    const dbPath = path.join(tmpDir, 'pending_atomic.sqlite');
    const storage1 = await SQLiteStorage.create({ dbPath });
    const storage2 = await SQLiteStorage.create({ dbPath });

    const p = await storage1.findOrCreatePrincipal({
      provider: 'test',
      botInstanceId: 'b1',
      externalUserId: 'u17',
    });

    const now = new Date();
    const action = {
      id: 'conf-17',
      principalId: p.id,
      botInstanceId: 'b1',
      conversationKey: 'c17',
      actionType: 'test_action',
      summary: 'Test Action',
      normalizedPayloadJson: '{}',
      payloadHash: 'hash17',
      status: 'pending' as const,
      expiresAt: new Date(now.getTime() + 60000),
      createdAt: now,
      updatedAt: now,
    };

    await storage1.createPendingAction(action);

    const claimInput = {
      confirmationId: action.id,
      principalId: p.id,
      botInstanceId: 'b1',
      conversationId: 'c17',
      payloadHash: 'hash17',
    };

    const outcomes = await Promise.allSettled([
      storage1.claimPendingAction(claimInput),
      storage2.claimPendingAction(claimInput),
    ]);

    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
    const rejected = outcomes.filter((o) => o.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    await storage1.close();
    await storage2.close();
  });

  // R6A-18
  it('R6A-18: actual setupLocal preserves existing encryption key on repeated execution', async () => {
    const dataDir = path.join(tmpDir, 'setup-data');
    await setupLocal({ cwd: tmpDir, dataDir });
    const envLocalPath = path.join(tmpDir, '.env.local');
    const firstKey = fs
      .readFileSync(envLocalPath, 'utf8')
      .split('\n')
      .find((line) => line.startsWith('BANGUMI_TOKEN_ENCRYPTION_KEY='));

    await setupLocal({ cwd: tmpDir, dataDir });
    const secondKey = fs
      .readFileSync(envLocalPath, 'utf8')
      .split('\n')
      .find((line) => line.startsWith('BANGUMI_TOKEN_ENCRYPTION_KEY='));

    expect(firstKey).toBeDefined();
    expect(secondKey).toBe(firstKey);
  });
});
