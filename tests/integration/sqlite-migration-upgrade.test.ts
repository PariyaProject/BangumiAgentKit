import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { SQLiteStorage, runSqliteMigrations } from '../../packages/db/src/index.js';

const Database = require('better-sqlite3');

describe('SQLite migration upgrade safety', () => {
  it('upgrades the d10cb48 schema without losing principals, bindings, or credentials', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgm-sqlite-upgrade-'));
    const dbPath = path.join(tmpDir, 'legacy.sqlite');
    const fixturePath = path.resolve(process.cwd(), 'tests/fixtures/sqlite-d10cb48.sql');
    const now = Date.now();
    const db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
    db.exec(fs.readFileSync(fixturePath, 'utf8'));
    db.exec(`
      CREATE TABLE _schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at INTEGER NOT NULL
      );
      INSERT INTO _schema_migrations (id, applied_at) VALUES ('0000_initial.sql', ${now});
    `);
    db.prepare(
      'INSERT INTO external_principals (id, provider, bot_instance_id, external_user_id, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run('principal-legacy', 'qq', 'bot-legacy', 'user-legacy', 'Legacy User', now, now);
    db.prepare(
      'INSERT INTO bangumi_accounts (id, bangumi_user_id, username, nickname, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('account-legacy', 9001, 'legacy-user', 'Legacy User', now, now);
    db.prepare(
      'INSERT INTO account_bindings (id, principal_id, bangumi_account_id, is_active, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run('binding-legacy', 'principal-legacy', 'account-legacy', 1, now);
    db.prepare(
      'INSERT INTO access_credentials (id, bangumi_account_id, encrypted_access_token, expires_at, requested_capabilities, scope_evidence, key_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      'credential-legacy',
      'account-legacy',
      JSON.stringify({ ciphertext: 'cipher', iv: 'iv', authTag: 'tag' }),
      now + 60000,
      JSON.stringify(['read']),
      'unknown',
      'v1',
      now,
      now,
    );
    await runSqliteMigrations(db);

    const migrations = db.prepare('SELECT id FROM _schema_migrations ORDER BY id').all() as Array<{
      id: string;
    }>;
    expect(migrations.map((row) => row.id)).toEqual([
      '0000_initial.sql',
      '0001_integrity_constraints.sql',
    ]);

    const bindings = db.prepare('SELECT * FROM account_bindings').all() as Array<
      Record<string, unknown>
    >;
    expect(bindings).toHaveLength(1);
    expect(bindings[0]!.id).toBe('binding-legacy');
    const credentials = db.prepare('SELECT * FROM access_credentials').all() as Array<
      Record<string, unknown>
    >;
    expect(credentials).toHaveLength(1);
    expect(credentials[0]!.id).toBe('credential-legacy');

    const bindingForeignKeys = db.pragma('foreign_key_list(account_bindings)') as Array<{
      table: string;
    }>;
    expect(bindingForeignKeys.map((key) => key.table).sort()).toEqual([
      'bangumi_accounts',
      'external_principals',
    ]);
    const credentialForeignKeys = db.pragma('foreign_key_list(access_credentials)') as Array<{
      table: string;
    }>;
    expect(credentialForeignKeys.map((key) => key.table)).toEqual(['bangumi_accounts']);
    const indexes = db.pragma('index_list(account_bindings)') as Array<{
      name: string;
      unique: number;
    }>;
    expect(
      indexes.some(
        (index) => index.name === 'account_bindings_active_principal_idx' && index.unique === 1,
      ),
    ).toBe(true);
    db.close();

    const storage = await SQLiteStorage.create({ dbPath });
    const credential = await storage.getCredential('account-legacy');
    expect(credential?.id).toBe('credential-legacy');
    await storage.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }, 30000);
});
