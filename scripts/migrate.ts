import * as fs from 'node:fs';
import * as path from 'node:path';
import { Client } from 'pg';
import { SQLiteStorage, resolveSqlitePath } from '../packages/db/dist/index.js';

async function runMigrations() {
  const isPostgres =
    process.env.BANGUMI_DB_DRIVER === 'postgres' ||
    (!process.env.BANGUMI_DB_DRIVER && process.env.DATABASE_URL);

  if (isPostgres) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.error('ERROR: DATABASE_URL environment variable is required for postgres migration.');
      process.exit(1);
    }

    const migrationPath = path.join(
      __dirname,
      '..',
      'packages',
      'db',
      'src',
      'drizzle',
      'postgres',
      'migrations',
      '0000_initial.sql',
    );
    if (!fs.existsSync(migrationPath)) {
      console.error(`ERROR: Migration file not found at ${migrationPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf-8');
    const client = new Client({ connectionString: databaseUrl });

    try {
      await client.connect();
      console.log('Connected to PostgreSQL database for migration.');
      await client.query(sql);
      console.log('Successfully executed PostgreSQL migrations from 0000_initial.sql.');
    } catch (err) {
      console.error('PostgreSQL migration failed:', err);
      process.exit(1);
    } finally {
      await client.end();
    }
  } else {
    const dbPath = resolveSqlitePath();
    console.log(`Initializing SQLite database at: ${dbPath}`);
    const storage = await SQLiteStorage.create();
    await storage.close();
    console.log('Successfully initialized SQLite schema and pragmas.');
  }
}

runMigrations();
