import * as fs from 'node:fs';
import * as path from 'node:path';
import { Client } from 'pg';

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  const migrationPath = path.join(
    __dirname,
    '..',
    'packages',
    'db',
    'src',
    'drizzle',
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
    console.log('Successfully executed migrations from 0000_initial.sql.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
