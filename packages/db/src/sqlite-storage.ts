import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import * as sqliteSchema from './drizzle/sqlite/schema.js';
import {
  ExternalPrincipalRecord,
  BangumiAccountRecord,
  AccountBindingRecord,
  AccessCredentialRecord,
  OAuthSessionRecord,
  PendingActionRecord,
  PendingActionStatus,
  AuditEventRecord,
  SUBJECT_STATS_OBSERVATION_MAX_CLEANUP_ROWS,
  SUBJECT_STATS_OBSERVATION_MAX_ROWS,
  SubjectStatsObservationRecord,
  SubjectStatsObservationSummary,
  SubjectStatsObservationStoreOptions,
  SubjectStatsObservationQuery,
} from './schema.js';
import { Storage, FindOrCreatePrincipalInput, ClaimPendingActionInput } from './storage.js';
import { runSqliteMigrations } from './migrator.js';

const SQLITE_JOURNAL_RETRY_DELAYS_MS = [25, 50, 100, 200, 400, 800, 1600, 3200];

function isSqliteBusyError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return (
    code === 'SQLITE_BUSY' || code === 'SQLITE_LOCKED' || /database is locked/i.test(String(error))
  );
}

async function enableWalMode(sqliteDb: Database.Database): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      sqliteDb.pragma('journal_mode = WAL');
      return;
    } catch (error) {
      const delay = SQLITE_JOURNAL_RETRY_DELAYS_MS[attempt];
      if (!isSqliteBusyError(error) || delay === undefined) {
        throw error;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
  }
}

export function resolveSqlitePath(dbPath?: string, dataDir?: string): string {
  if (dbPath) return dbPath;
  if (process.env.BANGUMI_SQLITE_PATH) return process.env.BANGUMI_SQLITE_PATH;

  const resolvedDataDir =
    dataDir || process.env.BANGUMI_DATA_DIR || path.join(os.homedir(), '.bangumi-agent-kit');

  return path.join(resolvedDataDir, 'bangumi-agent-kit.sqlite');
}

export interface SQLiteStorageOptions {
  dbPath?: string;
  dataDir?: string;
}

interface SqliteAccountBindingRow {
  id: string;
  principal_id: string;
  bangumi_account_id: string;
  is_active: number;
  created_at: number;
}

interface SqliteAccessCredentialRow {
  id: string;
  bangumi_account_id: string;
  encrypted_access_token: string;
  encrypted_refresh_token?: string | null;
  expires_at: number;
  requested_capabilities: string;
  reported_scopes?: string | null;
  scope_evidence: string;
  key_version: string;
  created_at: number;
  updated_at: number;
}

interface SqliteOAuthSessionRow {
  id: string;
  state_hash: string;
  principal_id: string;
  bot_instance_id?: string | null;
  conversation_id?: string | null;
  requested_capabilities: string;
  expires_at: number;
  used_at?: number | null;
  created_at: number;
}

interface SqlitePendingActionRow {
  id: string;
  principal_id: string;
  bot_instance_id: string;
  conversation_key: string;
  action_type: string;
  summary: string;
  normalized_payload_json: string;
  payload_hash: string;
  status: string;
  expires_at: number;
  confirmed_at?: number | null;
  execution_started_at?: number | null;
  executed_at?: number | null;
  failure_code?: string | null;
  failure_message_safe?: string | null;
  created_at: number;
  updated_at: number;
}

export class SQLiteStorage implements Storage {
  private sqliteDb: Database.Database;
  private db: BetterSQLite3Database<typeof sqliteSchema>;

  private constructor(sqliteDb: Database.Database) {
    this.sqliteDb = sqliteDb;
    this.db = drizzle(sqliteDb, { schema: sqliteSchema });
  }

  static async create(options: SQLiteStorageOptions = {}): Promise<SQLiteStorage> {
    const resolvedPath = resolveSqlitePath(options.dbPath, options.dataDir);
    const dir = path.dirname(resolvedPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    } else {
      try {
        fs.chmodSync(dir, 0o700);
      } catch {
        // best effort on supported OS
      }
    }

    const sqliteDb = new Database(resolvedPath);
    sqliteDb.pragma('busy_timeout = 5000');
    sqliteDb.pragma('foreign_keys = ON');
    await enableWalMode(sqliteDb);
    sqliteDb.pragma('synchronous = NORMAL');

    try {
      fs.chmodSync(resolvedPath, 0o600);
    } catch {
      // best effort
    }

    // Run versioned migrations
    await runSqliteMigrations(sqliteDb);

    return new SQLiteStorage(sqliteDb);
  }

  async findOrCreatePrincipal(input: FindOrCreatePrincipalInput): Promise<ExternalPrincipalRecord> {
    const now = new Date();
    const id = `prc_${crypto.randomUUID()}`;
    this.sqliteDb
      .prepare(
        `
        INSERT INTO external_principals (
          id, provider, bot_instance_id, external_user_id, display_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(provider, bot_instance_id, external_user_id) DO NOTHING
      `,
      )
      .run(
        id,
        input.provider,
        input.botInstanceId,
        input.externalUserId,
        input.displayName || null,
        now.getTime(),
        now.getTime(),
      );

    const stored = this.sqliteDb
      .prepare(
        `
        SELECT id, provider, bot_instance_id, external_user_id, display_name, created_at, updated_at
        FROM external_principals
        WHERE provider = ? AND bot_instance_id = ? AND external_user_id = ?
      `,
      )
      .get(input.provider, input.botInstanceId, input.externalUserId) as
      | {
          id: string;
          provider: string;
          bot_instance_id: string;
          external_user_id: string;
          display_name?: string | null;
          created_at: number;
          updated_at: number;
        }
      | undefined;

    if (!stored) {
      throw new Error('STORAGE_ERROR: Principal insert succeeded but canonical row was not found');
    }

    return {
      id: stored.id,
      provider: stored.provider,
      botInstanceId: stored.bot_instance_id,
      externalUserId: stored.external_user_id,
      displayName: stored.display_name || undefined,
      createdAt: new Date(stored.created_at),
      updatedAt: new Date(stored.updated_at),
    };
  }

  async getPrincipal(id: string): Promise<ExternalPrincipalRecord | null> {
    const res = await this.db.query.externalPrincipals.findFirst({
      where: eq(sqliteSchema.externalPrincipals.id, id),
    });
    if (!res) return null;
    return {
      id: res.id,
      provider: res.provider,
      botInstanceId: res.botInstanceId,
      externalUserId: res.externalUserId,
      displayName: res.displayName || undefined,
      createdAt: new Date(res.createdAt),
      updatedAt: new Date(res.updatedAt),
    };
  }

  async getBangumiAccount(id: string): Promise<BangumiAccountRecord | null> {
    const res = await this.db.query.bangumiAccounts.findFirst({
      where: eq(sqliteSchema.bangumiAccounts.id, id),
    });
    if (!res) return null;
    return {
      id: res.id,
      bangumiUserId: res.bangumiUserId,
      username: res.username,
      nickname: res.nickname,
      avatarUrl: res.avatarUrl || undefined,
      createdAt: new Date(res.createdAt),
      updatedAt: new Date(res.updatedAt),
    };
  }

  async upsertBangumiAccount(
    input: Omit<BangumiAccountRecord, 'createdAt' | 'updatedAt'> &
      Partial<Pick<BangumiAccountRecord, 'createdAt' | 'updatedAt'>>,
  ): Promise<BangumiAccountRecord> {
    const now = new Date();
    const createdAt = input.createdAt || now;
    const bangumiUserId =
      input.bangumiUserId ??
      Math.abs(input.id.split('').reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0));

    const stmt = this.sqliteDb.prepare(`
      INSERT INTO bangumi_accounts (id, bangumi_user_id, username, nickname, avatar_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        username = excluded.username,
        nickname = excluded.nickname,
        avatar_url = excluded.avatar_url,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      input.id,
      bangumiUserId,
      input.username,
      input.nickname,
      input.avatarUrl || null,
      createdAt.getTime(),
      now.getTime(),
    );

    return {
      id: input.id,
      bangumiUserId,
      username: input.username,
      nickname: input.nickname,
      avatarUrl: input.avatarUrl,
      createdAt,
      updatedAt: now,
    };
  }

  async getActiveBinding(principalId: string): Promise<AccountBindingRecord | null> {
    const stmt = this.sqliteDb.prepare(`
      SELECT * FROM account_bindings WHERE principal_id = ? AND is_active = 1
    `);
    const row = stmt.get(principalId) as SqliteAccountBindingRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      principalId: row.principal_id,
      bangumiAccountId: row.bangumi_account_id,
      isActive: Boolean(row.is_active),
      createdAt: new Date(row.created_at),
    };
  }

  async listBindings(principalId: string): Promise<AccountBindingRecord[]> {
    const stmt = this.sqliteDb.prepare(`
      SELECT * FROM account_bindings WHERE principal_id = ?
    `);
    const rows = stmt.all(principalId) as SqliteAccountBindingRow[];
    return rows.map((row) => ({
      id: row.id,
      principalId: row.principal_id,
      bangumiAccountId: row.bangumi_account_id,
      isActive: Boolean(row.is_active),
      createdAt: new Date(row.created_at),
    }));
  }

  async bindAccount(
    principalId: string,
    bangumiAccountId: string,
    activate = true,
  ): Promise<AccountBindingRecord> {
    const now = new Date();
    const nowMs = now.getTime();

    this.sqliteDb.transaction(() => {
      if (activate) {
        this.sqliteDb
          .prepare(`UPDATE account_bindings SET is_active = 0 WHERE principal_id = ?`)
          .run(principalId);
      }
      const existingStmt = this.sqliteDb.prepare(
        `SELECT id FROM account_bindings WHERE principal_id = ? AND bangumi_account_id = ?`,
      );
      const existing = existingStmt.get(principalId, bangumiAccountId) as
        { id: string } | undefined;
      if (existing) {
        this.sqliteDb
          .prepare(`UPDATE account_bindings SET is_active = ? WHERE id = ?`)
          .run(activate ? 1 : 0, existing.id);
      } else {
        const id = `bnd_${crypto.randomUUID()}`;
        this.sqliteDb
          .prepare(
            `INSERT INTO account_bindings (id, principal_id, bangumi_account_id, is_active, created_at) VALUES (?, ?, ?, ?, ?)`,
          )
          .run(id, principalId, bangumiAccountId, activate ? 1 : 0, nowMs);
      }
    })();

    const activeStmt = this.sqliteDb.prepare(
      `SELECT * FROM account_bindings WHERE principal_id = ? AND bangumi_account_id = ?`,
    );
    const row = activeStmt.get(principalId, bangumiAccountId) as SqliteAccountBindingRow;

    return {
      id: row.id,
      principalId: row.principal_id,
      bangumiAccountId: row.bangumi_account_id,
      isActive: Boolean(row.is_active),
      createdAt: new Date(row.created_at),
    };
  }

  async setActiveBinding(
    principalId: string,
    bangumiAccountId: string,
  ): Promise<AccountBindingRecord> {
    const checkStmt = this.sqliteDb.prepare(
      `SELECT id FROM account_bindings WHERE principal_id = ? AND bangumi_account_id = ?`,
    );
    const existing = checkStmt.get(principalId, bangumiAccountId) as { id: string } | undefined;
    if (!existing) {
      throw new Error(
        `BINDING_NOT_FOUND: Account ${bangumiAccountId} is not bound to principal ${principalId}`,
      );
    }

    this.sqliteDb.transaction(() => {
      this.sqliteDb
        .prepare(`UPDATE account_bindings SET is_active = 0 WHERE principal_id = ?`)
        .run(principalId);
      this.sqliteDb
        .prepare(`UPDATE account_bindings SET is_active = 1 WHERE id = ?`)
        .run(existing.id);
    })();

    const activeStmt = this.sqliteDb.prepare(`SELECT * FROM account_bindings WHERE id = ?`);
    const row = activeStmt.get(existing.id) as SqliteAccountBindingRow;

    return {
      id: row.id,
      principalId: row.principal_id,
      bangumiAccountId: row.bangumi_account_id,
      isActive: true,
      createdAt: new Date(row.created_at),
    };
  }

  async removeBinding(principalId: string, bangumiAccountId: string): Promise<void> {
    const stmt = this.sqliteDb.prepare(
      `DELETE FROM account_bindings WHERE principal_id = ? AND bangumi_account_id = ?`,
    );
    stmt.run(principalId, bangumiAccountId);
  }

  async replaceActiveBinding(
    principalId: string,
    bangumiAccountId: string,
  ): Promise<AccountBindingRecord> {
    return this.bindAccount(principalId, bangumiAccountId, true);
  }

  async deactivateBindings(principalId: string): Promise<void> {
    const stmt = this.sqliteDb.prepare(
      `UPDATE account_bindings SET is_active = 0 WHERE principal_id = ?`,
    );
    stmt.run(principalId);
  }

  async getCredential(accountId: string): Promise<AccessCredentialRecord | null> {
    const stmt = this.sqliteDb.prepare(
      `SELECT * FROM access_credentials WHERE bangumi_account_id = ?`,
    );
    const res = stmt.get(accountId) as SqliteAccessCredentialRow | undefined;
    if (!res) return null;

    return {
      id: res.id,
      bangumiAccountId: res.bangumi_account_id,
      encryptedAccessToken: JSON.parse(res.encrypted_access_token),
      encryptedRefreshToken: res.encrypted_refresh_token
        ? JSON.parse(res.encrypted_refresh_token)
        : undefined,
      expiresAt: new Date(res.expires_at),
      requestedCapabilities: JSON.parse(res.requested_capabilities),
      reportedScopes: res.reported_scopes ? JSON.parse(res.reported_scopes) : null,
      scopeEvidence: res.scope_evidence as 'reported' | 'unknown',
      keyVersion: res.key_version,
      createdAt: new Date(res.created_at),
      updatedAt: new Date(res.updated_at),
    };
  }

  async upsertCredential(record: AccessCredentialRecord): Promise<void> {
    const id = record.id || `cred_${crypto.randomUUID()}`;
    const now = new Date();
    const createdAt = record.createdAt || now;
    const updatedAt = record.updatedAt || now;

    const stmt = this.sqliteDb.prepare(`
      INSERT INTO access_credentials (
        id, bangumi_account_id, encrypted_access_token, encrypted_refresh_token,
        expires_at, requested_capabilities, reported_scopes, scope_evidence, key_version,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(bangumi_account_id) DO UPDATE SET
        encrypted_access_token = excluded.encrypted_access_token,
        encrypted_refresh_token = excluded.encrypted_refresh_token,
        expires_at = excluded.expires_at,
        requested_capabilities = excluded.requested_capabilities,
        reported_scopes = excluded.reported_scopes,
        scope_evidence = excluded.scope_evidence,
        key_version = excluded.key_version,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      id,
      record.bangumiAccountId,
      JSON.stringify(record.encryptedAccessToken),
      record.encryptedRefreshToken ? JSON.stringify(record.encryptedRefreshToken) : null,
      record.expiresAt.getTime(),
      JSON.stringify(record.requestedCapabilities || []),
      record.reportedScopes ? JSON.stringify(record.reportedScopes) : null,
      record.scopeEvidence || 'unknown',
      record.keyVersion || 'v1',
      createdAt.getTime(),
      updatedAt.getTime(),
    );
  }

  async deleteCredential(accountId: string): Promise<void> {
    const stmt = this.sqliteDb.prepare(
      `DELETE FROM access_credentials WHERE bangumi_account_id = ?`,
    );
    stmt.run(accountId);
  }

  async createOAuthSession(session: OAuthSessionRecord): Promise<void> {
    const stmt = this.sqliteDb.prepare(`
      INSERT INTO oauth_sessions (
        id, state_hash, principal_id, bot_instance_id, conversation_id,
        requested_capabilities, expires_at, used_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.id,
      session.stateHash,
      session.principalId,
      session.botInstanceId || null,
      session.conversationId || null,
      JSON.stringify(session.requestedCapabilities || []),
      session.expiresAt.getTime(),
      session.usedAt ? session.usedAt.getTime() : null,
      session.createdAt.getTime(),
    );
  }

  async consumeOAuthSession(
    stateHash: string,
    now: Date = new Date(),
  ): Promise<OAuthSessionRecord> {
    const nowMs = now.getTime();
    const updateStmt = this.sqliteDb.prepare(`
      UPDATE oauth_sessions
      SET used_at = ?
      WHERE state_hash = ?
        AND used_at IS NULL
        AND expires_at > ?
    `);
    const result = updateStmt.run(nowMs, stateHash, nowMs);

    if (result.changes > 0) {
      const getStmt = this.sqliteDb.prepare(`SELECT * FROM oauth_sessions WHERE state_hash = ?`);
      const row = getStmt.get(stateHash) as SqliteOAuthSessionRow;
      return {
        id: row.id,
        stateHash: row.state_hash,
        principalId: row.principal_id,
        botInstanceId: row.bot_instance_id || undefined,
        conversationId: row.conversation_id || undefined,
        requestedCapabilities: JSON.parse(row.requested_capabilities),
        expiresAt: new Date(row.expires_at),
        usedAt: row.used_at ? new Date(row.used_at) : undefined,
        createdAt: new Date(row.created_at),
      };
    }

    const checkStmt = this.sqliteDb.prepare(`SELECT * FROM oauth_sessions WHERE state_hash = ?`);
    const existing = checkStmt.get(stateHash) as SqliteOAuthSessionRow | undefined;
    if (!existing) {
      throw new Error('INVALID_OAUTH_STATE: OAuth state not found');
    }
    if (existing.used_at) {
      throw new Error('OAUTH_STATE_REUSED: OAuth state has already been used');
    }
    if (nowMs > existing.expires_at) {
      throw new Error('OAUTH_STATE_EXPIRED: OAuth state has expired');
    }
    throw new Error('INVALID_OAUTH_STATE: Cannot consume OAuth state');
  }

  async createPendingAction(action: PendingActionRecord): Promise<void> {
    const stmt = this.sqliteDb.prepare(`
      INSERT INTO pending_actions (
        id, principal_id, bot_instance_id, conversation_key, action_type,
        summary, normalized_payload_json, payload_hash, status, expires_at,
        confirmed_at, execution_started_at, executed_at, failure_code,
        failure_message_safe, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      action.id,
      action.principalId,
      action.botInstanceId,
      action.conversationKey,
      action.actionType,
      action.summary,
      action.normalizedPayloadJson,
      action.payloadHash,
      action.status,
      action.expiresAt.getTime(),
      action.confirmedAt ? action.confirmedAt.getTime() : null,
      action.executionStartedAt ? action.executionStartedAt.getTime() : null,
      action.executedAt ? action.executedAt.getTime() : null,
      action.failureCode || null,
      action.failureMessageSafe || null,
      action.createdAt.getTime(),
      action.updatedAt.getTime(),
    );
  }

  async claimPendingAction(input: ClaimPendingActionInput): Promise<PendingActionRecord> {
    const now = input.now || new Date();
    const nowMs = now.getTime();

    const updateStmt = this.sqliteDb.prepare(`
      UPDATE pending_actions
      SET status = 'executing',
          confirmed_at = ?,
          execution_started_at = ?,
          updated_at = ?
      WHERE id = ?
        AND status = 'pending'
        AND principal_id = ?
        AND bot_instance_id = ?
        AND conversation_key = ?
        AND payload_hash = ?
        AND expires_at > ?
    `);
    const result = updateStmt.run(
      nowMs,
      nowMs,
      nowMs,
      input.confirmationId,
      input.principalId,
      input.botInstanceId,
      input.conversationId,
      input.payloadHash,
      nowMs,
    );

    if (result.changes > 0) {
      const getStmt = this.sqliteDb.prepare(`SELECT * FROM pending_actions WHERE id = ?`);
      const row = getStmt.get(input.confirmationId) as SqlitePendingActionRow;
      return {
        id: row.id,
        principalId: row.principal_id,
        botInstanceId: row.bot_instance_id,
        conversationKey: row.conversation_key,
        actionType: row.action_type,
        summary: row.summary,
        normalizedPayloadJson: row.normalized_payload_json,
        payloadHash: row.payload_hash,
        status: row.status as PendingActionStatus,
        expiresAt: new Date(row.expires_at),
        confirmedAt: row.confirmed_at ? new Date(row.confirmed_at) : null,
        executionStartedAt: row.execution_started_at ? new Date(row.execution_started_at) : null,
        executedAt: row.executed_at ? new Date(row.executed_at) : null,
        failureCode: row.failure_code || undefined,
        failureMessageSafe: row.failure_message_safe || undefined,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      };
    }

    const checkStmt = this.sqliteDb.prepare(`SELECT * FROM pending_actions WHERE id = ?`);
    const existing = checkStmt.get(input.confirmationId) as SqlitePendingActionRow | undefined;

    if (!existing) {
      throw new Error(`CONFIRMATION_INVALID: Invalid confirmationId "${input.confirmationId}"`);
    }
    if (existing.status !== 'pending') {
      throw new Error(
        `CONFIRMATION_INVALID: Action status is "${existing.status}", expected "pending"`,
      );
    }
    if (existing.principal_id !== input.principalId) {
      throw new Error('CONFIRMATION_INVALID: Confirmation ID does not belong to current user');
    }
    if (existing.bot_instance_id !== input.botInstanceId) {
      throw new Error('CONFIRMATION_INVALID: Confirmation ID does not match current bot instance');
    }
    if (existing.conversation_key !== input.conversationId) {
      throw new Error('CONFIRMATION_INVALID: Confirmation ID does not match current conversation');
    }
    if (nowMs > existing.expires_at) {
      const expStmt = this.sqliteDb.prepare(
        `UPDATE pending_actions SET status = 'expired', updated_at = ? WHERE id = ?`,
      );
      expStmt.run(nowMs, input.confirmationId);
      throw new Error('CONFIRMATION_EXPIRED: Confirmation has expired');
    }
    if (existing.payload_hash !== input.payloadHash) {
      throw new Error(
        'CONFIRMATION_INVALID: Action payload hash does not match original confirmation',
      );
    }

    throw new Error('CONFIRMATION_INVALID: Failed to claim pending action');
  }

  async markPendingActionSucceeded(id: string): Promise<void> {
    const nowMs = Date.now();
    const stmt = this.sqliteDb.prepare(`
      UPDATE pending_actions
      SET status = 'succeeded', executed_at = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(nowMs, nowMs, id);
  }

  async markPendingActionFailed(id: string, reason: string, failureCode?: string): Promise<void> {
    const nowMs = Date.now();
    const stmt = this.sqliteDb.prepare(`
      UPDATE pending_actions
      SET status = 'failed', failure_message_safe = ?, failure_code = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(reason, failureCode || 'EXECUTION_FAILED', nowMs, id);
  }

  async markPendingActionUnknown(id: string, reason: string): Promise<void> {
    const nowMs = Date.now();
    const stmt = this.sqliteDb.prepare(`
      UPDATE pending_actions
      SET status = 'unknown', failure_message_safe = ?, failure_code = 'WRITE_RESULT_UNKNOWN', updated_at = ?
      WHERE id = ?
    `);
    stmt.run(reason, nowMs, id);
  }

  async appendAuditEvent(event: AuditEventRecord): Promise<void> {
    const stmt = this.sqliteDb.prepare(`
      INSERT INTO audit_events (
        id, principal_id, bangumi_account_id, operation_id, risk_level,
        resource_type, resource_id, change_summary_json, confirmation_id,
        result, request_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.id,
      event.principalId,
      event.bangumiAccountId || null,
      event.operationId,
      event.riskLevel,
      event.resourceType,
      event.resourceId,
      event.changeSummaryJson,
      event.confirmationId || null,
      event.result,
      event.requestId || null,
      event.createdAt.getTime(),
    );
  }

  async appendSubjectStatsObservation(
    record: SubjectStatsObservationRecord,
    options: SubjectStatsObservationStoreOptions,
  ): Promise<void> {
    const nowMs = (options.now || new Date()).getTime();
    const maxObservations = Math.min(
      SUBJECT_STATS_OBSERVATION_MAX_ROWS,
      Math.max(1, Math.trunc(options.maxObservations)),
    );
    const append = this.sqliteDb.transaction(() => {
      const expired = this.sqliteDb
        .prepare(
          'SELECT COUNT(*) AS count FROM subject_stats_observations WHERE subject_id = ? AND retention_until <= ?',
        )
        .get(record.subjectId, nowMs) as { count: number };
      this.sqliteDb
        .prepare(
          `DELETE FROM subject_stats_observations
           WHERE rowid IN (
             SELECT rowid FROM subject_stats_observations
             WHERE subject_id = ? AND retention_until <= ?
             ORDER BY retention_until ASC, rowid ASC
             LIMIT ?
           )`,
        )
        .run(record.subjectId, nowMs, SUBJECT_STATS_OBSERVATION_MAX_CLEANUP_ROWS);

      const existingMeta = this.sqliteDb
        .prepare(
          'SELECT subject_id, first_observed_at, recorded_count, expired_count, pruned_count FROM subject_stats_observation_meta WHERE subject_id = ?',
        )
        .get(record.subjectId) as
        | {
            subject_id: number;
            first_observed_at: number;
            recorded_count: number;
            expired_count: number;
            pruned_count: number;
          }
        | undefined;
      if (!existingMeta) {
        this.sqliteDb
          .prepare(
            `INSERT INTO subject_stats_observation_meta
              (subject_id, first_observed_at, recorded_count, expired_count, pruned_count, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(
            record.subjectId,
            record.observedAt.getTime(),
            1,
            Math.min(expired.count, SUBJECT_STATS_OBSERVATION_MAX_CLEANUP_ROWS),
            0,
            nowMs,
          );
      } else {
        this.sqliteDb
          .prepare(
            `UPDATE subject_stats_observation_meta
             SET first_observed_at = MIN(first_observed_at, ?),
                 recorded_count = recorded_count + 1,
                 expired_count = expired_count + ?,
                 updated_at = ?
             WHERE subject_id = ?`,
          )
          .run(
            record.observedAt.getTime(),
            Math.min(expired.count, SUBJECT_STATS_OBSERVATION_MAX_CLEANUP_ROWS),
            nowMs,
            record.subjectId,
          );
      }

      this.sqliteDb
        .prepare(
          `
          INSERT INTO subject_stats_observations (
            id, subject_id, observed_at, retrieved_at, state, result_json,
            methodology_version, retention_until
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        )
        .run(
          record.id,
          record.subjectId,
          record.observedAt.getTime(),
          record.retrievedAt ? record.retrievedAt.getTime() : null,
          record.state,
          record.resultJson,
          record.methodologyVersion,
          record.retentionUntil.getTime(),
        );

      const beforePrune = this.sqliteDb
        .prepare('SELECT COUNT(*) AS count FROM subject_stats_observations WHERE subject_id = ?')
        .get(record.subjectId) as { count: number };
      if (beforePrune.count > maxObservations) {
        this.sqliteDb
          .prepare(
            `
            DELETE FROM subject_stats_observations
            WHERE subject_id = ?
              AND id NOT IN (
                SELECT id
                FROM subject_stats_observations
                WHERE subject_id = ?
                ORDER BY observed_at DESC, id DESC
                LIMIT ?
              )
          `,
          )
          .run(record.subjectId, record.subjectId, maxObservations);
        this.sqliteDb
          .prepare(
            'UPDATE subject_stats_observation_meta SET pruned_count = pruned_count + ?, updated_at = ? WHERE subject_id = ?',
          )
          .run(beforePrune.count - maxObservations, nowMs, record.subjectId);
      }
    });
    append();
  }

  async listSubjectStatsObservations(
    query: SubjectStatsObservationQuery,
  ): Promise<SubjectStatsObservationRecord[]> {
    const nowMs = (query.now || new Date()).getTime();
    const limit = Math.max(1, Math.trunc(query.limit));
    const read = this.sqliteDb.transaction(() => {
      const expired = this.sqliteDb
        .prepare(
          'SELECT COUNT(*) AS count FROM subject_stats_observations WHERE subject_id = ? AND retention_until <= ?',
        )
        .get(query.subjectId, nowMs) as { count: number };
      this.sqliteDb
        .prepare(
          `DELETE FROM subject_stats_observations
           WHERE rowid IN (
             SELECT rowid FROM subject_stats_observations
             WHERE subject_id = ? AND retention_until <= ?
             ORDER BY retention_until ASC, rowid ASC
             LIMIT ?
           )`,
        )
        .run(query.subjectId, nowMs, SUBJECT_STATS_OBSERVATION_MAX_CLEANUP_ROWS);
      if (expired.count > 0) {
        this.sqliteDb
          .prepare(
            'UPDATE subject_stats_observation_meta SET expired_count = expired_count + ?, updated_at = ? WHERE subject_id = ?',
          )
          .run(
            Math.min(expired.count, SUBJECT_STATS_OBSERVATION_MAX_CLEANUP_ROWS),
            nowMs,
            query.subjectId,
          );
      }
      return this.sqliteDb
        .prepare(
          `
          SELECT id, subject_id, observed_at, retrieved_at, state, result_json,
                 methodology_version, retention_until
          FROM subject_stats_observations
          WHERE subject_id = ? AND retention_until > ?
          ORDER BY observed_at DESC, id DESC
          LIMIT ?
        `,
        )
        .all(query.subjectId, nowMs, limit) as Array<{
        id: string;
        subject_id: number;
        observed_at: number;
        retrieved_at?: number | null;
        state: SubjectStatsObservationRecord['state'];
        result_json: string;
        methodology_version: string;
        retention_until: number;
      }>;
    });

    return read()
      .reverse()
      .map((row) => ({
        id: row.id,
        subjectId: row.subject_id,
        observedAt: new Date(row.observed_at),
        retrievedAt: row.retrieved_at == null ? null : new Date(row.retrieved_at),
        state: row.state,
        resultJson: row.result_json,
        methodologyVersion: row.methodology_version,
        retentionUntil: new Date(row.retention_until),
      }));
  }

  async getSubjectStatsObservationSummary(
    subjectId: number,
    now = new Date(),
  ): Promise<SubjectStatsObservationSummary> {
    await this.listSubjectStatsObservations({ subjectId, limit: 1, now });
    const meta = this.sqliteDb
      .prepare(
        'SELECT first_observed_at, recorded_count, expired_count, pruned_count FROM subject_stats_observation_meta WHERE subject_id = ?',
      )
      .get(subjectId) as
      | {
          first_observed_at: number;
          recorded_count: number;
          expired_count: number;
          pruned_count: number;
        }
      | undefined;
    const counts = this.sqliteDb
      .prepare(
        `SELECT COUNT(*) AS retained_count,
                MIN(retention_until) AS retention_until_earliest,
                MAX(retention_until) AS retention_until_latest
         FROM subject_stats_observations
         WHERE subject_id = ? AND retention_until > ?`,
      )
      .get(subjectId, now.getTime()) as {
      retained_count: number;
      retention_until_earliest?: number | null;
      retention_until_latest?: number | null;
    };
    return {
      firstObservedAt: meta ? new Date(meta.first_observed_at) : undefined,
      recordedCount: meta?.recorded_count || 0,
      retainedCount: counts.retained_count,
      expiredCount: meta?.expired_count || 0,
      prunedCount: meta?.pruned_count || 0,
      ...(counts.retention_until_earliest == null
        ? {}
        : { retentionUntilEarliest: new Date(counts.retention_until_earliest) }),
      ...(counts.retention_until_latest == null
        ? {}
        : { retentionUntilLatest: new Date(counts.retention_until_latest) }),
    };
  }

  async withSubjectStatsObservationLock<T>(subjectId: number, fn: () => Promise<T>): Promise<T> {
    return this.withStorageLock(
      `subject_stats_lock:${subjectId}`,
      fn,
      `subject ${subjectId} observation lock`,
    );
  }

  private async withStorageLock<T>(
    lockKey: string,
    fn: () => Promise<T>,
    description: string,
  ): Promise<T> {
    const ownerId = `owner_${crypto.randomUUID()}`;
    const timeoutMs = parseInt(process.env.BANGUMI_SQLITE_LOCK_TIMEOUT_MS || '10000', 10);
    const leaseMs = parseInt(process.env.BANGUMI_SQLITE_LOCK_LEASE_MS || '30000', 10);
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const nowMs = Date.now();
      const expiresAt = nowMs + leaseMs;
      let acquired = false;
      try {
        const result = this.sqliteDb
          .prepare(
            `
            INSERT INTO storage_locks (lock_key, owner_id, expires_at, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(lock_key) DO UPDATE SET
              owner_id = excluded.owner_id,
              expires_at = excluded.expires_at,
              updated_at = excluded.updated_at
            WHERE storage_locks.expires_at < ?
          `,
          )
          .run(lockKey, ownerId, expiresAt, nowMs, nowMs);
        acquired = result.changes > 0;
      } catch {
        // Retry on database lock contention.
      }

      if (acquired) {
        try {
          return await fn();
        } finally {
          this.sqliteDb
            .prepare('DELETE FROM storage_locks WHERE lock_key = ? AND owner_id = ?')
            .run(lockKey, ownerId);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(
      `LOCK_TIMEOUT: Failed to acquire ${description} observation lock within ${timeoutMs}ms`,
    );
  }

  async withCredentialLock<T>(accountId: string, fn: () => Promise<T>): Promise<T> {
    return this.withStorageLock(
      `cred_lock:${accountId}`,
      fn,
      `credential lock for account ${accountId}`,
    );
  }

  async close(): Promise<void> {
    this.sqliteDb.close();
  }
}
