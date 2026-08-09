import { Storage } from './storage.js';
import { SQLiteStorage, SQLiteStorageOptions } from './sqlite-storage.js';
import { PostgresStorage } from './postgres-storage.js';

export type StorageDriver = 'sqlite' | 'postgres';

export interface StorageConfig {
  driver?: StorageDriver;
  sqliteOptions?: SQLiteStorageOptions;
  databaseUrl?: string;
}

export async function createStorageFromConfig(config: StorageConfig = {}): Promise<Storage> {
  let driver: StorageDriver;

  if (config.driver) {
    driver = config.driver;
  } else if (!process.env.BANGUMI_DB_DRIVER && (config.databaseUrl || process.env.DATABASE_URL)) {
    driver = 'postgres';
    console.info('Using PostgreSQL because DATABASE_URL is configured.');
  } else if (process.env.BANGUMI_DB_DRIVER === 'postgres') {
    driver = 'postgres';
  } else {
    driver = 'sqlite';
  }

  if (driver === 'postgres') {
    const dbUrl = config.databaseUrl || process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('CONFIG_ERROR: DATABASE_URL is required when BANGUMI_DB_DRIVER=postgres');
    }
    return PostgresStorage.create(dbUrl);
  }

  return SQLiteStorage.create(config.sqliteOptions);
}

export async function createStorageFromEnv(): Promise<Storage> {
  return createStorageFromConfig({});
}
