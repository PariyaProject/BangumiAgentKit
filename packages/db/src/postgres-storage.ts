import crypto from 'node:crypto';
import pg from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gt, isNull } from 'drizzle-orm';
import {
  ExternalPrincipalRecord,
  BangumiAccountRecord,
  AccountBindingRecord,
  AccessCredentialRecord,
  OAuthSessionRecord,
  PendingActionRecord,
  PendingActionStatus,
  AuditEventRecord,
} from './schema.js';
import { Storage, FindOrCreatePrincipalInput, ClaimPendingActionInput } from './storage.js';
import * as schema from './drizzle/schema.js';

export class PostgresStorage implements Storage {
  private pool: pg.Pool;
  private db: NodePgDatabase<typeof schema>;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString });
    this.db = drizzle(this.pool, { schema });
  }

  static async create(connectionString: string): Promise<PostgresStorage> {
    const storage = new PostgresStorage(connectionString);
    await storage.init();
    return storage;
  }

  async init(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS bot_instances (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL,
          external_bot_id TEXT NOT NULL,
          encrypted_config TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS external_principals (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL,
          bot_instance_id TEXT NOT NULL,
          external_user_id TEXT NOT NULL,
          display_name TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          CONSTRAINT external_principals_unique UNIQUE (provider, bot_instance_id, external_user_id)
        );

        CREATE TABLE IF NOT EXISTS bangumi_accounts (
          id TEXT PRIMARY KEY,
          bangumi_user_id INTEGER NOT NULL UNIQUE,
          username TEXT NOT NULL,
          nickname TEXT NOT NULL,
          avatar_url TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS account_bindings (
          id TEXT PRIMARY KEY,
          principal_id TEXT NOT NULL,
          bangumi_account_id TEXT NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS account_bindings_principal_id_idx ON account_bindings (principal_id);

        CREATE TABLE IF NOT EXISTS access_credentials (
          id TEXT PRIMARY KEY,
          bangumi_account_id TEXT NOT NULL UNIQUE,
          encrypted_access_token JSONB NOT NULL,
          encrypted_refresh_token JSONB,
          expires_at TIMESTAMP NOT NULL,
          requested_capabilities JSONB NOT NULL,
          reported_scopes JSONB,
          scope_evidence TEXT NOT NULL DEFAULT 'unknown',
          key_version TEXT NOT NULL DEFAULT 'v1',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS oauth_sessions (
          id TEXT PRIMARY KEY,
          state_hash TEXT NOT NULL UNIQUE,
          principal_id TEXT NOT NULL,
          bot_instance_id TEXT,
          conversation_id TEXT,
          requested_capabilities JSONB NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          used_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS conversation_contexts (
          principal_id TEXT NOT NULL,
          conversation_key TEXT NOT NULL,
          last_subject_id INTEGER,
          last_character_id INTEGER,
          last_person_id INTEGER,
          search_candidates_json TEXT,
          preferred_output_mode TEXT,
          locale TEXT,
          timezone TEXT,
          expires_at TIMESTAMP NOT NULL,
          PRIMARY KEY (principal_id, conversation_key)
        );

        CREATE TABLE IF NOT EXISTS pending_actions (
          id TEXT PRIMARY KEY,
          principal_id TEXT NOT NULL,
          bot_instance_id TEXT NOT NULL,
          conversation_key TEXT NOT NULL,
          action_type TEXT NOT NULL,
          summary TEXT NOT NULL,
          normalized_payload_json TEXT NOT NULL,
          payload_hash TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          expires_at TIMESTAMP NOT NULL,
          confirmed_at TIMESTAMP,
          execution_started_at TIMESTAMP,
          executed_at TIMESTAMP,
          failure_code TEXT,
          failure_message_safe TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS pending_actions_principal_expires_idx ON pending_actions (principal_id, expires_at);

        CREATE TABLE IF NOT EXISTS audit_events (
          id TEXT PRIMARY KEY,
          principal_id TEXT NOT NULL,
          bangumi_account_id TEXT,
          operation_id TEXT NOT NULL,
          risk_level TEXT NOT NULL,
          resource_type TEXT NOT NULL,
          resource_id TEXT NOT NULL,
          change_summary_json TEXT NOT NULL,
          confirmation_id TEXT,
          result TEXT NOT NULL,
          request_id TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS audit_events_principal_created_idx ON audit_events (principal_id, created_at);
      `);
    } finally {
      client.release();
    }
  }

  async findOrCreatePrincipal(input: FindOrCreatePrincipalInput): Promise<ExternalPrincipalRecord> {
    const existing = await this.db.query.externalPrincipals.findFirst({
      where: and(
        eq(schema.externalPrincipals.provider, input.provider),
        eq(schema.externalPrincipals.botInstanceId, input.botInstanceId),
        eq(schema.externalPrincipals.externalUserId, input.externalUserId)
      ),
    });

    if (existing) {
      return {
        id: existing.id,
        provider: existing.provider,
        botInstanceId: existing.botInstanceId,
        externalUserId: existing.externalUserId,
        displayName: existing.displayName || undefined,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      };
    }

    const now = new Date();
    const id = `prc_${crypto.randomUUID()}`;
    await this.db.insert(schema.externalPrincipals).values({
      id,
      provider: input.provider,
      botInstanceId: input.botInstanceId,
      externalUserId: input.externalUserId,
      displayName: input.displayName,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    const result = await this.db.query.externalPrincipals.findFirst({
      where: and(
        eq(schema.externalPrincipals.provider, input.provider),
        eq(schema.externalPrincipals.botInstanceId, input.botInstanceId),
        eq(schema.externalPrincipals.externalUserId, input.externalUserId)
      ),
    });

    return {
      id: result!.id,
      provider: result!.provider,
      botInstanceId: result!.botInstanceId,
      externalUserId: result!.externalUserId,
      displayName: result!.displayName || undefined,
      createdAt: result!.createdAt,
      updatedAt: result!.updatedAt,
    };
  }

  async getPrincipal(id: string): Promise<ExternalPrincipalRecord | null> {
    const res = await this.db.query.externalPrincipals.findFirst({
      where: eq(schema.externalPrincipals.id, id),
    });
    if (!res) return null;
    return {
      id: res.id,
      provider: res.provider,
      botInstanceId: res.botInstanceId,
      externalUserId: res.externalUserId,
      displayName: res.displayName || undefined,
      createdAt: res.createdAt,
      updatedAt: res.updatedAt,
    };
  }

  async getBangumiAccount(id: string): Promise<BangumiAccountRecord | null> {
    const res = await this.db.query.bangumiAccounts.findFirst({
      where: eq(schema.bangumiAccounts.id, id),
    });
    if (!res) return null;
    return {
      id: res.id,
      bangumiUserId: res.bangumiUserId,
      username: res.username,
      nickname: res.nickname,
      avatarUrl: res.avatarUrl || undefined,
      createdAt: res.createdAt,
      updatedAt: res.updatedAt,
    };
  }

  async upsertBangumiAccount(
    input: Omit<BangumiAccountRecord, 'createdAt' | 'updatedAt'> &
      Partial<Pick<BangumiAccountRecord, 'createdAt' | 'updatedAt'>>
  ): Promise<BangumiAccountRecord> {
    const now = new Date();
    const createdAt = input.createdAt || now;
    await this.db.insert(schema.bangumiAccounts).values({
      id: input.id,
      bangumiUserId: input.bangumiUserId,
      username: input.username,
      nickname: input.nickname,
      avatarUrl: input.avatarUrl,
      createdAt,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: schema.bangumiAccounts.id,
      set: {
        username: input.username,
        nickname: input.nickname,
        avatarUrl: input.avatarUrl,
        updatedAt: now,
      },
    });

    return {
      id: input.id,
      bangumiUserId: input.bangumiUserId,
      username: input.username,
      nickname: input.nickname,
      avatarUrl: input.avatarUrl,
      createdAt,
      updatedAt: now,
    };
  }

  async getActiveBinding(principalId: string): Promise<AccountBindingRecord | null> {
    const res = await this.db.query.accountBindings.findFirst({
      where: and(
        eq(schema.accountBindings.principalId, principalId),
        eq(schema.accountBindings.isActive, true)
      ),
    });
    if (!res) return null;
    return {
      id: res.id,
      principalId: res.principalId,
      bangumiAccountId: res.bangumiAccountId,
      isActive: res.isActive,
      createdAt: res.createdAt,
    };
  }

  async replaceActiveBinding(principalId: string, bangumiAccountId: string): Promise<AccountBindingRecord> {
    await this.deactivateBindings(principalId);
    const now = new Date();
    const id = `bnd_${crypto.randomUUID()}`;
    await this.db.insert(schema.accountBindings).values({
      id,
      principalId,
      bangumiAccountId,
      isActive: true,
      createdAt: now,
    });
    return {
      id,
      principalId,
      bangumiAccountId,
      isActive: true,
      createdAt: now,
    };
  }

  async deactivateBindings(principalId: string): Promise<void> {
    await this.db.update(schema.accountBindings)
      .set({ isActive: false })
      .where(and(
        eq(schema.accountBindings.principalId, principalId),
        eq(schema.accountBindings.isActive, true)
      ));
  }

  async getCredential(accountId: string): Promise<AccessCredentialRecord | null> {
    const res = await this.db.query.accessCredentials.findFirst({
      where: eq(schema.accessCredentials.bangumiAccountId, accountId),
    });
    if (!res) return null;
    return {
      id: res.id,
      bangumiAccountId: res.bangumiAccountId,
      encryptedAccessToken: typeof res.encryptedAccessToken === 'string' ? JSON.parse(res.encryptedAccessToken) : (res.encryptedAccessToken as unknown),
      encryptedRefreshToken: res.encryptedRefreshToken ? (typeof res.encryptedRefreshToken === 'string' ? JSON.parse(res.encryptedRefreshToken) : (res.encryptedRefreshToken as unknown)) : undefined,
      expiresAt: res.expiresAt,
      requestedCapabilities: (res.requestedCapabilities as string[] | null) || [],
      reportedScopes: res.reportedScopes as string[] | null,
      scopeEvidence: (res.scopeEvidence as 'reported' | 'unknown') || 'unknown',
      keyVersion: res.keyVersion,
      createdAt: res.createdAt,
      updatedAt: res.updatedAt,
    };
  }

  async upsertCredential(record: AccessCredentialRecord): Promise<void> {
    await this.db.insert(schema.accessCredentials).values({
      id: record.id,
      bangumiAccountId: record.bangumiAccountId,
      encryptedAccessToken: record.encryptedAccessToken as unknown as string,
      encryptedRefreshToken: record.encryptedRefreshToken ? (record.encryptedRefreshToken as unknown as string) : null,
      expiresAt: record.expiresAt,
      requestedCapabilities: record.requestedCapabilities as unknown as string[],
      reportedScopes: record.reportedScopes as unknown as string[],
      scopeEvidence: record.scopeEvidence,
      keyVersion: record.keyVersion,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }).onConflictDoUpdate({
      target: schema.accessCredentials.bangumiAccountId,
      set: {
        encryptedAccessToken: record.encryptedAccessToken as unknown as string,
        encryptedRefreshToken: record.encryptedRefreshToken ? (record.encryptedRefreshToken as unknown as string) : null,
        expiresAt: record.expiresAt,
        requestedCapabilities: record.requestedCapabilities as unknown as string[],
        reportedScopes: record.reportedScopes as unknown as string[],
        scopeEvidence: record.scopeEvidence,
        keyVersion: record.keyVersion,
        updatedAt: record.updatedAt,
      },
    });
  }

  async deleteCredential(accountId: string): Promise<void> {
    await this.db.delete(schema.accessCredentials)
      .where(eq(schema.accessCredentials.bangumiAccountId, accountId));
  }

  async createOAuthSession(session: OAuthSessionRecord): Promise<void> {
    await this.db.insert(schema.oauthSessions).values({
      id: session.id,
      stateHash: session.stateHash,
      principalId: session.principalId,
      botInstanceId: session.botInstanceId,
      conversationId: session.conversationId,
      requestedCapabilities: session.requestedCapabilities as unknown as string[],
      expiresAt: session.expiresAt,
      usedAt: session.usedAt,
      createdAt: session.createdAt,
    });
  }

  async consumeOAuthSession(stateHash: string, now: Date = new Date()): Promise<OAuthSessionRecord> {
    const updated = await this.db.update(schema.oauthSessions)
      .set({ usedAt: now })
      .where(and(
        eq(schema.oauthSessions.stateHash, stateHash),
        isNull(schema.oauthSessions.usedAt),
        gt(schema.oauthSessions.expiresAt, now)
      ))
      .returning();

    if (updated.length > 0 && updated[0]) {
      const rec = updated[0];
      return {
        id: rec.id,
        stateHash: rec.stateHash,
        principalId: rec.principalId,
        botInstanceId: rec.botInstanceId || undefined,
        conversationId: rec.conversationId || undefined,
        requestedCapabilities: rec.requestedCapabilities as string[],
        expiresAt: rec.expiresAt,
        usedAt: rec.usedAt,
        createdAt: rec.createdAt,
      };
    }

    const existing = await this.db.query.oauthSessions.findFirst({
      where: eq(schema.oauthSessions.stateHash, stateHash),
    });

    if (!existing) {
      throw new Error('INVALID_OAUTH_STATE: OAuth state not found');
    }
    if (existing.usedAt) {
      throw new Error('OAUTH_STATE_REUSED: OAuth state has already been used');
    }
    if (now > existing.expiresAt) {
      throw new Error('OAUTH_STATE_EXPIRED: OAuth state has expired');
    }
    throw new Error('INVALID_OAUTH_STATE: Cannot consume OAuth state');
  }

  async createPendingAction(action: PendingActionRecord): Promise<void> {
    await this.db.insert(schema.pendingActions).values({
      id: action.id,
      principalId: action.principalId,
      botInstanceId: action.botInstanceId,
      conversationKey: action.conversationKey,
      actionType: action.actionType,
      summary: action.summary,
      normalizedPayloadJson: action.normalizedPayloadJson,
      payloadHash: action.payloadHash,
      status: action.status,
      expiresAt: action.expiresAt,
      confirmedAt: action.confirmedAt,
      executionStartedAt: action.executionStartedAt,
      executedAt: action.executedAt,
      failureCode: action.failureCode,
      failureMessageSafe: action.failureMessageSafe,
      createdAt: action.createdAt,
      updatedAt: action.updatedAt,
    });
  }

  async claimPendingAction(input: ClaimPendingActionInput): Promise<PendingActionRecord> {
    const now = input.now || new Date();

    const updated = await this.db.update(schema.pendingActions)
      .set({
        status: 'executing',
        confirmedAt: now,
        executionStartedAt: now,
        updatedAt: now,
      })
      .where(and(
        eq(schema.pendingActions.id, input.confirmationId),
        eq(schema.pendingActions.status, 'pending'),
        eq(schema.pendingActions.principalId, input.principalId),
        eq(schema.pendingActions.botInstanceId, input.botInstanceId),
        eq(schema.pendingActions.conversationKey, input.conversationId),
        eq(schema.pendingActions.payloadHash, input.payloadHash),
        gt(schema.pendingActions.expiresAt, now)
      ))
      .returning();

    if (updated.length > 0 && updated[0]) {
      const rec = updated[0];
      return {
        id: rec.id,
        principalId: rec.principalId,
        botInstanceId: rec.botInstanceId,
        conversationKey: rec.conversationKey,
        actionType: rec.actionType,
        summary: rec.summary,
        normalizedPayloadJson: rec.normalizedPayloadJson,
        payloadHash: rec.payloadHash,
        status: rec.status as PendingActionStatus,
        expiresAt: rec.expiresAt,
        confirmedAt: rec.confirmedAt,
        executionStartedAt: rec.executionStartedAt,
        executedAt: rec.executedAt,
        failureCode: rec.failureCode || undefined,
        failureMessageSafe: rec.failureMessageSafe || undefined,
        createdAt: rec.createdAt,
        updatedAt: rec.updatedAt,
      };
    }

    const existing = await this.db.query.pendingActions.findFirst({
      where: eq(schema.pendingActions.id, input.confirmationId),
    });

    if (!existing) {
      throw new Error(`CONFIRMATION_INVALID: Invalid confirmationId "${input.confirmationId}"`);
    }
    if (existing.status !== 'pending') {
      throw new Error(`CONFIRMATION_INVALID: Action status is "${existing.status}", expected "pending"`);
    }
    if (existing.principalId !== input.principalId) {
      throw new Error('CONFIRMATION_INVALID: Confirmation ID does not belong to current user');
    }
    if (existing.botInstanceId !== input.botInstanceId) {
      throw new Error('CONFIRMATION_INVALID: Confirmation ID does not match current bot instance');
    }
    if (existing.conversationKey !== input.conversationId) {
      throw new Error('CONFIRMATION_INVALID: Confirmation ID does not match current conversation');
    }
    if (now > existing.expiresAt) {
      await this.db.update(schema.pendingActions)
        .set({ status: 'expired', updatedAt: now })
        .where(eq(schema.pendingActions.id, input.confirmationId));
      throw new Error('CONFIRMATION_EXPIRED: Confirmation has expired');
    }
    if (existing.payloadHash !== input.payloadHash) {
      throw new Error('CONFIRMATION_INVALID: Action payload hash does not match original confirmation');
    }

    throw new Error('CONFIRMATION_INVALID: Failed to claim pending action');
  }

  async markPendingActionSucceeded(id: string): Promise<void> {
    const now = new Date();
    await this.db.update(schema.pendingActions)
      .set({
        status: 'succeeded',
        executedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.pendingActions.id, id));
  }

  async markPendingActionFailed(id: string, reason: string, failureCode?: string): Promise<void> {
    const now = new Date();
    await this.db.update(schema.pendingActions)
      .set({
        status: 'failed',
        failureMessageSafe: reason,
        failureCode: failureCode || 'EXECUTION_FAILED',
        updatedAt: now,
      })
      .where(eq(schema.pendingActions.id, id));
  }

  async markPendingActionUnknown(id: string, reason: string): Promise<void> {
    const now = new Date();
    await this.db.update(schema.pendingActions)
      .set({
        status: 'unknown',
        failureMessageSafe: reason,
        failureCode: 'WRITE_RESULT_UNKNOWN',
        updatedAt: now,
      })
      .where(eq(schema.pendingActions.id, id));
  }

  async appendAuditEvent(event: AuditEventRecord): Promise<void> {
    await this.db.insert(schema.auditEvents).values({
      id: event.id,
      principalId: event.principalId,
      bangumiAccountId: event.bangumiAccountId,
      operationId: event.operationId,
      riskLevel: event.riskLevel,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      changeSummaryJson: event.changeSummaryJson,
      confirmationId: event.confirmationId,
      result: event.result,
      requestId: event.requestId,
      createdAt: event.createdAt,
    });
  }

  async withCredentialLock<T>(accountId: string, fn: () => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM access_credentials WHERE bangumi_account_id = $1 FOR UPDATE', [accountId]);
      const res = await fn();
      await client.query('COMMIT');
      return res;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
