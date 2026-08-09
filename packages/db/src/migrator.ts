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
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  const migrationDir = getMigrationDir('sqlite');
  const files = fs
    .readdirSync(migrationDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const stmt = sqliteDb.prepare('SELECT id FROM _schema_migrations WHERE id = ?');
    const existing = stmt.get(file);
    if (!existing) {
      const sqlPath = path.join(migrationDir, file);
      const sql = fs.readFileSync(sqlPath, 'utf-8');
      sqliteDb.transaction(() => {
        sqliteDb.exec(sql);
        sqliteDb
          .prepare('INSERT INTO _schema_migrations (id, applied_at) VALUES (?, ?)')
          .run(file, Date.now());
      })();
    }
  }
}

export async function runPostgresMigrations(client: pg.Client | pg.PoolClient): Promise<void> {
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
    const res = await client.query('SELECT id FROM _schema_migrations WHERE id = $1', [file]);
    if (res.rows.length === 0) {
      const sqlPath = path.join(migrationDir, file);
      const sql = fs.readFileSync(sqlPath, 'utf-8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _schema_migrations (id, applied_at) VALUES ($1, NOW())', [
          file,
        ]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  }
}
