import { loadRuntimeEnv } from '@bangumi-agent-kit/config';
import { Client } from 'pg';
import { SQLiteStorage, resolveSqlitePath, runPostgresMigrations } from '@bangumi-agent-kit/db';

async function runMigrations() {
  loadRuntimeEnv();

  const isPostgres =
    process.env.BANGUMI_DB_DRIVER === 'postgres' ||
    (!process.env.BANGUMI_DB_DRIVER && process.env.DATABASE_URL);

  if (isPostgres) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.error('ERROR: DATABASE_URL environment variable is required for postgres migration.');
      process.exit(1);
    }

    const client = new Client({ connectionString: databaseUrl });

    try {
      await client.connect();
      console.log('Connected to PostgreSQL database for migration.');
      await runPostgresMigrations(client);
      console.log('Successfully executed PostgreSQL migrations.');
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
