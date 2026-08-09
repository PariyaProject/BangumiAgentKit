import * as fs from 'node:fs';
import * as path from 'node:path';
import type Database from 'better-sqlite3';
import type pg from 'pg';

export function getMigrationDir(dialect: 'sqlite' | 'postgres'): string {
  const possibleDirs = [
    path.join(__dirname, 'drizzle', dialect, 'migrations'),
    path.join(__dirname, '..', 'src', 'drizzle', dialect, 'migrations'),
    path.join(__dirname, '..', 'drizzle', dialect, 'migrations'),
    path.join(process.cwd(), 'packages', 'db', 'src', 'drizzle', dialect, 'migrations'),
  ];
  for (const dir of possibleDirs) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }
  throw new Error(
    `Migration directory for ${dialect} not found in expected paths: ${possibleDirs.join(', ')}`,
  );
}

export async function runSqliteMigrations(sqliteDb: Database.Database): Promise<void> {
  sqliteDb.pragma('busy_timeout = 5000');
  const migrationDir = getMigrationDir('sqlite');
  const files = fs
    .readdirSync(migrationDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  // The write transaction covers migration-table bootstrap, the applied check,
  // every migration body, and the history writes. This serializes initialization
  // across independent processes sharing the same SQLite file.
  sqliteDb.exec('BEGIN IMMEDIATE');
  try {
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at INTEGER NOT NULL
      );
    `);

    for (const file of files) {
      const existing = sqliteDb.prepare('SELECT id FROM _schema_migrations WHERE id = ?').get(file);
      if (!existing) {
        const sqlPath = path.join(migrationDir, file);
        const sql = fs.readFileSync(sqlPath, 'utf-8');
        sqliteDb.exec(sql);
        sqliteDb
          .prepare('INSERT INTO _schema_migrations (id, applied_at) VALUES (?, ?)')
          .run(file, Date.now());
      }
    }
    sqliteDb.exec('COMMIT');
  } catch (err) {
    try {
      sqliteDb.exec('ROLLBACK');
    } catch {
      // Preserve the original migration error.
    }
    throw err;
  }
}

export async function runPostgresMigrations(client: pg.Client | pg.PoolClient): Promise<void> {
  const migrationLockKey = '684176019664311';
  await client.query('SELECT pg_advisory_lock($1::bigint)', [migrationLockKey]);

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    const migrationDir = getMigrationDir('postgres');
    const files = fs
      .readdirSync(migrationDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      await client.query('BEGIN');
      try {
        const res = await client.query('SELECT id FROM _schema_migrations WHERE id = $1', [file]);
        if (res.rows.length === 0) {
          const sqlPath = path.join(migrationDir, file);
          const sql = fs.readFileSync(sqlPath, 'utf-8');
          await client.query(sql);
          await client.query('INSERT INTO _schema_migrations (id, applied_at) VALUES ($1, NOW())', [
            file,
          ]);
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1::bigint)', [migrationLockKey]);
  }
}
