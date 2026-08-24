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
  SubjectStatsObservationRecord,
  SubjectStatsObservationStoreOptions,
  SubjectStatsObservationQuery,
} from './schema.js';
import { Storage, FindOrCreatePrincipalInput, ClaimPendingActionInput } from './storage.js';
import * as schema from './drizzle/schema.js';

import { runPostgresMigrations } from './migrator.js';

function stringToTwoInt32(str: string): [number, number] {
  const hash = crypto.createHash('sha256').update(str).digest();
  return [hash.readInt32BE(0), hash.readInt32BE(4)];
}

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
      await runPostgresMigrations(client);
    } finally {
      client.release();
    }
  }

  async findOrCreatePrincipal(input: FindOrCreatePrincipalInput): Promise<ExternalPrincipalRecord> {
    const existing = await this.db.query.externalPrincipals.findFirst({
      where: and(
        eq(schema.externalPrincipals.provider, input.provider),
        eq(schema.externalPrincipals.botInstanceId, input.botInstanceId),
        eq(schema.externalPrincipals.externalUserId, input.externalUserId),
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
    await this.db
      .insert(schema.externalPrincipals)
      .values({
        id,
        provider: input.provider,
        botInstanceId: input.botInstanceId,
        externalUserId: input.externalUserId,
        displayName: input.displayName,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();

    const result = await this.db.query.externalPrincipals.findFirst({
      where: and(
        eq(schema.externalPrincipals.provider, input.provider),
        eq(schema.externalPrincipals.botInstanceId, input.botInstanceId),
        eq(schema.externalPrincipals.externalUserId, input.externalUserId),
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
    input: Partial<Pick<BangumiAccountRecord, 'bangumiUserId'>> &
      Omit<BangumiAccountRecord, 'createdAt' | 'updatedAt' | 'bangumiUserId'> &
      Partial<Pick<BangumiAccountRecord, 'createdAt' | 'updatedAt'>>,
  ): Promise<BangumiAccountRecord> {
    const now = new Date();
    const createdAt = input.createdAt || now;
    const bangumiUserId =
      input.bangumiUserId ??
      Math.abs(input.id.split('').reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0));

    await this.db
      .insert(schema.bangumiAccounts)
      .values({
        id: input.id,
        bangumiUserId,
        username: input.username,
        nickname: input.nickname,
        avatarUrl: input.avatarUrl,
        createdAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
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
      bangumiUserId,
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
        eq(schema.accountBindings.isActive, true),
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

  async replaceActiveBinding(
    principalId: string,
    bangumiAccountId: string,
  ): Promise<AccountBindingRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const [key1, key2] = stringToTwoInt32(`bnd_${principalId}`);
      await client.query('SELECT pg_advisory_xact_lock($1, $2)', [key1, key2]);
      await client.query(
        'UPDATE account_bindings SET is_active = false WHERE principal_id = $1 AND is_active = true',
        [principalId],
      );
      const now = new Date();
      const id = `bnd_${crypto.randomUUID()}`;
      await client.query(
        'INSERT INTO account_bindings (id, principal_id, bangumi_account_id, is_active, created_at) VALUES ($1, $2, $3, $4, $5)',
        [id, principalId, bangumiAccountId, true, now],
      );
      await client.query('COMMIT');
      return {
        id,
        principalId,
        bangumiAccountId,
        isActive: true,
        createdAt: now,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listBindings(principalId: string): Promise<AccountBindingRecord[]> {
    const rows = await this.db.query.accountBindings.findMany({
      where: eq(schema.accountBindings.principalId, principalId),
    });
    return rows.map((res) => ({
      id: res.id,
      principalId: res.principalId,
      bangumiAccountId: res.bangumiAccountId,
      isActive: res.isActive,
      createdAt: res.createdAt,
    }));
  }

  async bindAccount(
    principalId: string,
    bangumiAccountId: string,
    activate = true,
  ): Promise<AccountBindingRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      if (activate) {
        await client.query(
          'UPDATE account_bindings SET is_active = false WHERE principal_id = $1 AND is_active = true',
          [principalId],
        );
      }
      const existing = await client.query(
        'SELECT id FROM account_bindings WHERE principal_id = $1 AND bangumi_account_id = $2',
        [principalId, bangumiAccountId],
      );
      const now = new Date();
      if (existing.rows.length > 0) {
        const id = existing.rows[0].id;
        await client.query(
          'UPDATE account_bindings SET is_active = $1 WHERE id = $2',
          [activate, id],
        );
        await client.query('COMMIT');
        return { id, principalId, bangumiAccountId, isActive: activate, createdAt: now };
      }
      const id = `bnd_${crypto.randomUUID()}`;
      await client.query(
        'INSERT INTO account_bindings (id, principal_id, bangumi_account_id, is_active, created_at) VALUES ($1, $2, $3, $4, $5)',
        [id, principalId, bangumiAccountId, activate, now],
      );
      await client.query('COMMIT');
      return { id, principalId, bangumiAccountId, isActive: activate, createdAt: now };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async setActiveBinding(
    principalId: string,
    bangumiAccountId: string,
  ): Promise<AccountBindingRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query(
        'SELECT id FROM account_bindings WHERE principal_id = $1 AND bangumi_account_id = $2',
        [principalId, bangumiAccountId],
      );
      if (existing.rows.length === 0) {
        throw new Error(`BINDING_NOT_FOUND: Account ${bangumiAccountId} is not bound to principal ${principalId}`);
      }
      await client.query(
        'UPDATE account_bindings SET is_active = false WHERE principal_id = $1',
        [principalId],
      );
      await client.query(
        'UPDATE account_bindings SET is_active = true WHERE principal_id = $1 AND bangumi_account_id = $2',
        [principalId, bangumiAccountId],
      );
      await client.query('COMMIT');
      return {
        id: existing.rows[0].id,
        principalId,
        bangumiAccountId,
        isActive: true,
        createdAt: new Date(),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async removeBinding(principalId: string, bangumiAccountId: string): Promise<void> {
    await this.db
      .delete(schema.accountBindings)
      .where(
        and(
          eq(schema.accountBindings.principalId, principalId),
          eq(schema.accountBindings.bangumiAccountId, bangumiAccountId),
        ),
      );
  }

  async deactivateBindings(principalId: string): Promise<void> {
    await this.db
      .update(schema.accountBindings)
      .set({ isActive: false })
      .where(
        and(
          eq(schema.accountBindings.principalId, principalId),
          eq(schema.accountBindings.isActive, true),
        ),
      );
  }

  async getCredential(accountId: string): Promise<AccessCredentialRecord | null> {
    const res = await this.db.query.accessCredentials.findFirst({
      where: eq(schema.accessCredentials.bangumiAccountId, accountId),
    });
    if (!res) return null;

    let encryptedAccessToken: unknown = res.encryptedAccessToken;
    if (typeof res.encryptedAccessToken === 'string') {
      try {
        encryptedAccessToken = JSON.parse(res.encryptedAccessToken);
      } catch {
        encryptedAccessToken = res.encryptedAccessToken;
      }
    }

    let encryptedRefreshToken: unknown = undefined;
    if (res.encryptedRefreshToken) {
      if (typeof res.encryptedRefreshToken === 'string') {
        try {
          encryptedRefreshToken = JSON.parse(res.encryptedRefreshToken);
        } catch {
          encryptedRefreshToken = res.encryptedRefreshToken;
        }
      } else {
        encryptedRefreshToken = res.encryptedRefreshToken;
      }
    }

    return {
      id: res.id,
      bangumiAccountId: res.bangumiAccountId,
      encryptedAccessToken: encryptedAccessToken as AccessCredentialRecord['encryptedAccessToken'],
      encryptedRefreshToken:
        encryptedRefreshToken as AccessCredentialRecord['encryptedRefreshToken'],
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
    const id = record.id || `cred_${crypto.randomUUID()}`;
    const requestedCapabilities = record.requestedCapabilities || [];
    const createdAt = record.createdAt || new Date();
    const updatedAt = record.updatedAt || new Date();

    await this.db
      .insert(schema.accessCredentials)
      .values({
        id,
        bangumiAccountId: record.bangumiAccountId,
        encryptedAccessToken: record.encryptedAccessToken as unknown as string,
        encryptedRefreshToken: record.encryptedRefreshToken
          ? (record.encryptedRefreshToken as unknown as string)
          : null,
        expiresAt: record.expiresAt,
        requestedCapabilities: requestedCapabilities as unknown as string[],
        reportedScopes: record.reportedScopes as unknown as string[],
        scopeEvidence: record.scopeEvidence || 'unknown',
        keyVersion: record.keyVersion || 'v1',
        createdAt,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: schema.accessCredentials.bangumiAccountId,
        set: {
          encryptedAccessToken: record.encryptedAccessToken as unknown as string,
          encryptedRefreshToken: record.encryptedRefreshToken
            ? (record.encryptedRefreshToken as unknown as string)
            : null,
          expiresAt: record.expiresAt,
          requestedCapabilities: requestedCapabilities as unknown as string[],
          reportedScopes: record.reportedScopes as unknown as string[],
          scopeEvidence: record.scopeEvidence || 'unknown',
          keyVersion: record.keyVersion || 'v1',
          updatedAt,
        },
      });
  }

  async deleteCredential(accountId: string): Promise<void> {
    await this.db
      .delete(schema.accessCredentials)
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

  async consumeOAuthSession(
    stateHash: string,
    now: Date = new Date(),
  ): Promise<OAuthSessionRecord> {
    const updated = await this.db
      .update(schema.oauthSessions)
      .set({ usedAt: now })
      .where(
        and(
          eq(schema.oauthSessions.stateHash, stateHash),
          isNull(schema.oauthSessions.usedAt),
          gt(schema.oauthSessions.expiresAt, now),
        ),
      )
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

    const updated = await this.db
      .update(schema.pendingActions)
      .set({
        status: 'executing',
        confirmedAt: now,
        executionStartedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.pendingActions.id, input.confirmationId),
          eq(schema.pendingActions.status, 'pending'),
          eq(schema.pendingActions.principalId, input.principalId),
          eq(schema.pendingActions.botInstanceId, input.botInstanceId),
          eq(schema.pendingActions.conversationKey, input.conversationId),
          eq(schema.pendingActions.payloadHash, input.payloadHash),
          gt(schema.pendingActions.expiresAt, now),
        ),
      )
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
      throw new Error(
        `CONFIRMATION_INVALID: Action status is "${existing.status}", expected "pending"`,
      );
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
      await this.db
        .update(schema.pendingActions)
        .set({ status: 'expired', updatedAt: now })
        .where(eq(schema.pendingActions.id, input.confirmationId));
      throw new Error('CONFIRMATION_EXPIRED: Confirmation has expired');
    }
    if (existing.payloadHash !== input.payloadHash) {
      throw new Error(
        'CONFIRMATION_INVALID: Action payload hash does not match original confirmation',
      );
    }

    throw new Error('CONFIRMATION_INVALID: Failed to claim pending action');
  }

  async markPendingActionSucceeded(id: string): Promise<void> {
    const now = new Date();
    await this.db
      .update(schema.pendingActions)
      .set({
        status: 'succeeded',
        executedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.pendingActions.id, id));
  }

  async markPendingActionFailed(id: string, reason: string, failureCode?: string): Promise<void> {
    const now = new Date();
    await this.db
      .update(schema.pendingActions)
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
    await this.db
      .update(schema.pendingActions)
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

  async appendSubjectStatsObservation(
    record: SubjectStatsObservationRecord,
    options: SubjectStatsObservationStoreOptions,
  ): Promise<void> {
    const now = options.now || new Date();
    const maxObservations = Math.max(1, Math.trunc(options.maxObservations));
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `
        INSERT INTO subject_stats_observations (
          id, subject_id, observed_at, retrieved_at, state, result_json,
          methodology_version, retention_until
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
        [
          record.id,
          record.subjectId,
          record.observedAt,
          record.retrievedAt || null,
          record.state,
          record.resultJson,
          record.methodologyVersion,
          record.retentionUntil,
        ],
      );
      await client.query('DELETE FROM subject_stats_observations WHERE retention_until <= $1', [
        now,
      ]);
      await client.query(
        `
        DELETE FROM subject_stats_observations
        WHERE subject_id = $1
          AND id NOT IN (
            SELECT id
            FROM subject_stats_observations
            WHERE subject_id = $1
            ORDER BY observed_at DESC, id DESC
            LIMIT $2
          )
      `,
        [record.subjectId, maxObservations],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listSubjectStatsObservations(
    query: SubjectStatsObservationQuery,
  ): Promise<SubjectStatsObservationRecord[]> {
    const now = query.now || new Date();
    const limit = Math.max(1, Math.trunc(query.limit));
    await this.pool.query(
      'DELETE FROM subject_stats_observations WHERE subject_id = $1 AND retention_until <= $2',
      [query.subjectId, now],
    );
    const result = await this.pool.query<{
      id: string;
      subject_id: number;
      observed_at: Date;
      retrieved_at: Date | null;
      state: SubjectStatsObservationRecord['state'];
      result_json: string;
      methodology_version: string;
      retention_until: Date;
    }>(
      `
      SELECT id, subject_id, observed_at, retrieved_at, state, result_json,
             methodology_version, retention_until
      FROM subject_stats_observations
      WHERE subject_id = $1 AND retention_until > $2
      ORDER BY observed_at DESC, id DESC
      LIMIT $3
    `,
      [query.subjectId, now, limit],
    );

    return result.rows.reverse().map((row) => ({
      id: row.id,
      subjectId: row.subject_id,
      observedAt: new Date(row.observed_at),
      retrievedAt: row.retrieved_at ? new Date(row.retrieved_at) : null,
      state: row.state,
      resultJson: row.result_json,
      methodologyVersion: row.methodology_version,
      retentionUntil: new Date(row.retention_until),
    }));
  }

  async withCredentialLock<T>(accountId: string, fn: () => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    const [key1, key2] = stringToTwoInt32(accountId);
    let lockAcquired = false;
    try {
      await client.query('SELECT pg_advisory_lock($1, $2)', [key1, key2]);
      lockAcquired = true;
      return await fn();
    } finally {
      if (lockAcquired) {
        try {
          await client.query('SELECT pg_advisory_unlock($1, $2)', [key1, key2]);
        } catch {
          // ignore unlock error if connection closed
        }
      }
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
