# SQLite Distribution & Storage Architecture

BangumiAgentKit v0.1 defaults to **SQLite** (`better-sqlite3`) as its primary zero-dependency storage engine for single-machine deployments.

## Path Resolution

The SQLite database file is automatically stored in standard user home configuration path:
```
~/.bangumi-agent-kit/bangumi-agent-kit.sqlite
```
- Custom path override: `BANGUMI_SQLITE_PATH` environment variable.
- Custom base directory override: `BANGUMI_DATA_DIR` environment variable (defaults to `~/.bangumi-agent-kit`).
- **Never defaults to `process.cwd()`**.

## Driver Selection

BangumiAgentKit automatically selects storage driver via environment variables:
- **SQLite (Default)**: Used when `BANGUMI_DB_DRIVER=sqlite` OR when `BANGUMI_DB_DRIVER` is unset and `DATABASE_URL` is unset.
- **PostgreSQL**: Used when `BANGUMI_DB_DRIVER=postgres` OR when `DATABASE_URL` is configured.

## Concurrency & Locking

1. **WAL Mode**: Executed with `PRAGMA journal_mode = WAL;`, `PRAGMA busy_timeout = 5000;`, `PRAGMA foreign_keys = ON;`, `PRAGMA synchronous = NORMAL;`.
2. **Lease Locking**: Cross-process OAuth token refresh uses atomic lease locks in the `storage_locks` table (`withCredentialLock`) to guarantee safe single-writer semantics under concurrent token refresh attempts.
3. **Atomic Consumption**: OAuth state consumption (`consumeOAuthSession`) and PendingAction claims (`claimPendingAction`) execute atomically.

## Security & Permissions

- Database directory permissions: `0700` (user read/write/execute only).
- Database file permissions: `0600` (user read/write only).
