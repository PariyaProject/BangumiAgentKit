import crypto from 'node:crypto';
import {
  BotInstanceRecord,
  ExternalPrincipalRecord,
  BangumiAccountRecord,
  AccountBindingRecord,
  AccessCredentialRecord,
  OAuthSessionRecord,
  ConversationContextRecord,
  PendingActionRecord,
  AuditEventRecord,
  SUBJECT_STATS_OBSERVATION_MAX_ROWS,
  SubjectStatsObservationRecord,
  SubjectStatsObservationSummary,
  SubjectStatsObservationStoreOptions,
  SubjectStatsObservationQuery,
} from './schema.js';
import { Storage, FindOrCreatePrincipalInput, ClaimPendingActionInput } from './storage.js';

export class MemoryStorage implements Storage {
  private botInstances = new Map<string, BotInstanceRecord>();
  private externalPrincipals = new Map<string, ExternalPrincipalRecord>();
  private bangumiAccounts = new Map<string, BangumiAccountRecord>();
  private accountBindings = new Map<string, AccountBindingRecord>();
  private accessCredentials = new Map<string, AccessCredentialRecord>();
  private oauthSessions = new Map<string, OAuthSessionRecord>();
  private conversationContexts = new Map<string, ConversationContextRecord>();
  private pendingActions = new Map<string, PendingActionRecord>();
  private auditEvents: AuditEventRecord[] = [];
  private subjectStatsObservations = new Map<number, SubjectStatsObservationRecord[]>();
  private subjectStatsObservationMeta = new Map<number, SubjectStatsObservationSummary>();
  private subjectStatsObservationLocks = new Map<number, Promise<void>>();
  private subjectStatsObservationHostLock: Promise<void> = Promise.resolve();
  private subjectStatsObservationHostBackoffUntil = 0;
  private credentialLocks = new Map<string, Promise<void>>();

  async findOrCreatePrincipal(input: FindOrCreatePrincipalInput): Promise<ExternalPrincipalRecord> {
    const key = `${input.provider}:${input.botInstanceId}:${input.externalUserId}`;
    let rec = this.externalPrincipals.get(key);
    if (!rec) {
      const now = new Date();
      rec = {
        id: `prc_${crypto.randomUUID()}`,
        provider: input.provider,
        botInstanceId: input.botInstanceId,
        externalUserId: input.externalUserId,
        displayName: input.displayName,
        createdAt: now,
        updatedAt: now,
      };
      this.externalPrincipals.set(key, rec);
    }
    return { ...rec };
  }

  async getPrincipal(id: string): Promise<ExternalPrincipalRecord | null> {
    for (const p of this.externalPrincipals.values()) {
      if (p.id === id) return { ...p };
    }
    return null;
  }

  async getBangumiAccount(id: string): Promise<BangumiAccountRecord | null> {
    const acc = this.bangumiAccounts.get(id);
    return acc ? { ...acc } : null;
  }

  async upsertBangumiAccount(
    input: Omit<BangumiAccountRecord, 'createdAt' | 'updatedAt'> &
      Partial<Pick<BangumiAccountRecord, 'createdAt' | 'updatedAt'>>,
  ): Promise<BangumiAccountRecord> {
    const now = new Date();
    const existing = this.bangumiAccounts.get(input.id);
    const rec: BangumiAccountRecord = {
      ...input,
      createdAt: existing ? existing.createdAt : input.createdAt || now,
      updatedAt: now,
    };
    this.bangumiAccounts.set(input.id, rec);
    return { ...rec };
  }

  async getActiveBinding(principalId: string): Promise<AccountBindingRecord | null> {
    for (const b of this.accountBindings.values()) {
      if (b.principalId === principalId && b.isActive) {
        return { ...b };
      }
    }
    return null;
  }

  async replaceActiveBinding(
    principalId: string,
    bangumiAccountId: string,
  ): Promise<AccountBindingRecord> {
    await this.deactivateBindings(principalId);
    const now = new Date();
    const binding: AccountBindingRecord = {
      id: `bnd_${crypto.randomUUID()}`,
      principalId,
      bangumiAccountId,
      isActive: true,
      createdAt: now,
    };
    this.accountBindings.set(binding.id, binding);
    return { ...binding };
  }

  async listBindings(principalId: string): Promise<AccountBindingRecord[]> {
    const list: AccountBindingRecord[] = [];
    for (const b of this.accountBindings.values()) {
      if (b.principalId === principalId) {
        list.push({ ...b });
      }
    }
    return list;
  }

  async bindAccount(
    principalId: string,
    bangumiAccountId: string,
    activate = true,
  ): Promise<AccountBindingRecord> {
    if (activate) {
      await this.deactivateBindings(principalId);
    }
    const now = new Date();
    // Check if binding already exists
    for (const b of this.accountBindings.values()) {
      if (b.principalId === principalId && b.bangumiAccountId === bangumiAccountId) {
        b.isActive = activate;
        return { ...b };
      }
    }
    const binding: AccountBindingRecord = {
      id: `bnd_${crypto.randomUUID()}`,
      principalId,
      bangumiAccountId,
      isActive: activate,
      createdAt: now,
    };
    this.accountBindings.set(binding.id, binding);
    return { ...binding };
  }

  async setActiveBinding(
    principalId: string,
    bangumiAccountId: string,
  ): Promise<AccountBindingRecord> {
    let found = false;
    for (const b of this.accountBindings.values()) {
      if (b.principalId === principalId && b.bangumiAccountId === bangumiAccountId) {
        found = true;
        break;
      }
    }
    if (!found) {
      throw new Error(
        `BINDING_NOT_FOUND: Account ${bangumiAccountId} is not bound to principal ${principalId}`,
      );
    }

    await this.deactivateBindings(principalId);
    for (const b of this.accountBindings.values()) {
      if (b.principalId === principalId && b.bangumiAccountId === bangumiAccountId) {
        b.isActive = true;
        return { ...b };
      }
    }
    throw new Error(
      `BINDING_NOT_FOUND: Account ${bangumiAccountId} is not bound to principal ${principalId}`,
    );
  }

  async removeBinding(principalId: string, bangumiAccountId: string): Promise<void> {
    for (const [id, b] of this.accountBindings.entries()) {
      if (b.principalId === principalId && b.bangumiAccountId === bangumiAccountId) {
        this.accountBindings.delete(id);
        break;
      }
    }
  }

  async deactivateBindings(principalId: string): Promise<void> {
    for (const b of this.accountBindings.values()) {
      if (b.principalId === principalId && b.isActive) {
        b.isActive = false;
      }
    }
  }

  async getCredential(accountId: string): Promise<AccessCredentialRecord | null> {
    const cred = this.accessCredentials.get(accountId);
    return cred ? { ...cred } : null;
  }

  async upsertCredential(record: AccessCredentialRecord): Promise<void> {
    this.accessCredentials.set(record.bangumiAccountId, { ...record });
  }

  async deleteCredential(accountId: string): Promise<void> {
    this.accessCredentials.delete(accountId);
  }

  async createOAuthSession(session: OAuthSessionRecord): Promise<void> {
    this.oauthSessions.set(session.id, { ...session });
  }

  async consumeOAuthSession(
    stateHash: string,
    now: Date = new Date(),
  ): Promise<OAuthSessionRecord> {
    let target: OAuthSessionRecord | null = null;
    for (const s of this.oauthSessions.values()) {
      if (s.stateHash === stateHash) {
        target = s;
        break;
      }
    }

    if (!target) {
      throw new Error('INVALID_OAUTH_STATE: OAuth state not found');
    }

    if (target.usedAt) {
      throw new Error('OAUTH_STATE_REUSED: OAuth state has already been used');
    }

    if (now > target.expiresAt) {
      throw new Error('OAUTH_STATE_EXPIRED: OAuth state has expired');
    }

    target.usedAt = now;
    return { ...target };
  }

  async createPendingAction(action: PendingActionRecord): Promise<void> {
    this.pendingActions.set(action.id, { ...action });
  }

  async claimPendingAction(input: ClaimPendingActionInput): Promise<PendingActionRecord> {
    const now = input.now || new Date();
    const action = this.pendingActions.get(input.confirmationId);

    if (!action) {
      throw new Error(`CONFIRMATION_INVALID: Invalid confirmationId "${input.confirmationId}"`);
    }

    if (action.status !== 'pending') {
      throw new Error(
        `CONFIRMATION_INVALID: Action status is "${action.status}", expected "pending"`,
      );
    }

    if (action.principalId !== input.principalId) {
      throw new Error('CONFIRMATION_INVALID: Confirmation ID does not belong to current user');
    }

    if (action.botInstanceId !== input.botInstanceId) {
      throw new Error('CONFIRMATION_INVALID: Confirmation ID does not match current bot instance');
    }

    if (action.conversationKey !== input.conversationId) {
      throw new Error('CONFIRMATION_INVALID: Confirmation ID does not match current conversation');
    }

    if (now > action.expiresAt) {
      action.status = 'expired';
      throw new Error('CONFIRMATION_EXPIRED: Confirmation has expired');
    }

    if (action.payloadHash !== input.payloadHash) {
      throw new Error(
        'CONFIRMATION_INVALID: Action payload hash does not match original confirmation',
      );
    }

    action.status = 'executing';
    action.confirmedAt = now;
    action.executionStartedAt = now;
    action.updatedAt = now;

    return { ...action };
  }

  async markPendingActionSucceeded(id: string): Promise<void> {
    const action = this.pendingActions.get(id);
    if (action) {
      action.status = 'succeeded';
      action.executedAt = new Date();
      action.updatedAt = new Date();
    }
  }

  async markPendingActionFailed(id: string, reason: string, failureCode?: string): Promise<void> {
    const action = this.pendingActions.get(id);
    if (action) {
      action.status = 'failed';
      action.failureMessageSafe = reason;
      action.failureCode = failureCode || 'EXECUTION_FAILED';
      action.updatedAt = new Date();
    }
  }

  async markPendingActionUnknown(id: string, reason: string): Promise<void> {
    const action = this.pendingActions.get(id);
    if (action) {
      action.status = 'unknown';
      action.failureMessageSafe = reason;
      action.failureCode = 'WRITE_RESULT_UNKNOWN';
      action.updatedAt = new Date();
    }
  }

  async appendAuditEvent(event: AuditEventRecord): Promise<void> {
    this.auditEvents.push({ ...event });
  }

  async appendSubjectStatsObservation(
    record: SubjectStatsObservationRecord,
    options: SubjectStatsObservationStoreOptions,
  ): Promise<void> {
    const now = options.now || new Date();
    const existing = this.subjectStatsObservations.get(record.subjectId) || [];
    const live = existing.filter((item) => item.retentionUntil > now);
    const meta = this.subjectStatsObservationMeta.get(record.subjectId) || {
      recordedCount: 0,
      retainedCount: 0,
      expiredCount: 0,
      prunedCount: 0,
    };
    meta.firstObservedAt = meta.firstObservedAt
      ? new Date(Math.min(meta.firstObservedAt.getTime(), record.observedAt.getTime()))
      : new Date(record.observedAt);
    meta.recordedCount += 1;
    meta.expiredCount += existing.length - live.length;
    live.push(cloneSubjectStatsObservation(record));
    live.sort(compareSubjectStatsObservation);
    const maxObservations = Math.min(
      SUBJECT_STATS_OBSERVATION_MAX_ROWS,
      Math.max(1, Math.trunc(options.maxObservations)),
    );
    const prunedCount = Math.max(0, live.length - maxObservations);
    meta.prunedCount += prunedCount;
    const bounded = live.slice(-maxObservations);
    meta.retainedCount = bounded.length;
    this.subjectStatsObservations.set(record.subjectId, bounded);
    this.subjectStatsObservationMeta.set(record.subjectId, meta);
  }

  async listSubjectStatsObservations(
    query: SubjectStatsObservationQuery,
  ): Promise<SubjectStatsObservationRecord[]> {
    const now = query.now || new Date();
    const existing = this.subjectStatsObservations.get(query.subjectId) || [];
    const live = existing.filter((item) => item.retentionUntil > now);
    const meta = this.subjectStatsObservationMeta.get(query.subjectId);
    if (meta) {
      meta.expiredCount += existing.length - live.length;
      meta.retainedCount = live.length;
    }
    const bounded = live.slice(-query.limit).map(cloneSubjectStatsObservation);
    if (live.length === 0) this.subjectStatsObservations.delete(query.subjectId);
    else this.subjectStatsObservations.set(query.subjectId, live);
    if (meta) this.subjectStatsObservationMeta.set(query.subjectId, meta);
    return bounded;
  }

  async getSubjectStatsObservationSummary(
    subjectId: number,
    now = new Date(),
  ): Promise<SubjectStatsObservationSummary> {
    await this.listSubjectStatsObservations({ subjectId, limit: 1, now });
    const live = this.subjectStatsObservations.get(subjectId) || [];
    const meta = this.subjectStatsObservationMeta.get(subjectId) || {
      recordedCount: 0,
      retainedCount: live.length,
      expiredCount: 0,
      prunedCount: 0,
    };
    meta.retainedCount = live.length;
    const retention = live.map((item) => item.retentionUntil.getTime());
    return {
      ...meta,
      ...(meta.firstObservedAt ? { firstObservedAt: new Date(meta.firstObservedAt) } : {}),
      ...(retention.length > 0
        ? {
            retentionUntilEarliest: new Date(Math.min(...retention)),
            retentionUntilLatest: new Date(Math.max(...retention)),
          }
        : {}),
    };
  }

  async getSubjectStatsObservationSubjectCount(): Promise<number> {
    return this.subjectStatsObservations.size;
  }

  async getSubjectStatsObservationHostBackoff(now = new Date()): Promise<Date | undefined> {
    return this.subjectStatsObservationHostBackoffUntil > now.getTime()
      ? new Date(this.subjectStatsObservationHostBackoffUntil)
      : undefined;
  }

  async setSubjectStatsObservationHostBackoff(until: Date): Promise<void> {
    this.subjectStatsObservationHostBackoffUntil = Math.max(
      this.subjectStatsObservationHostBackoffUntil,
      until.getTime(),
    );
  }

  async withSubjectStatsObservationLock<T>(subjectId: number, fn: () => Promise<T>): Promise<T> {
    const previous = this.subjectStatsObservationLocks.get(subjectId) || Promise.resolve();
    let release: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.subjectStatsObservationLocks.set(
      subjectId,
      previous.then(() => next),
    );

    try {
      await previous;
      return await fn();
    } finally {
      release!();
    }
  }

  async withSubjectStatsObservationHostLock<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.subjectStatsObservationHostLock;
    let release: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.subjectStatsObservationHostLock = previous.then(() => next);

    try {
      await previous;
      return await fn();
    } finally {
      release!();
    }
  }

  async withCredentialLock<T>(accountId: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.credentialLocks.get(accountId) || Promise.resolve();
    let release: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.credentialLocks.set(
      accountId,
      previous.then(() => next),
    );

    try {
      await previous;
      return await fn();
    } finally {
      release!();
    }
  }

  async close(): Promise<void> {
    this.clear();
  }

  clear(): void {
    this.botInstances.clear();
    this.externalPrincipals.clear();
    this.bangumiAccounts.clear();
    this.accountBindings.clear();
    this.accessCredentials.clear();
    this.oauthSessions.clear();
    this.conversationContexts.clear();
    this.pendingActions.clear();
    this.auditEvents = [];
    this.subjectStatsObservations.clear();
    this.subjectStatsObservationMeta.clear();
    this.subjectStatsObservationLocks.clear();
    this.subjectStatsObservationHostLock = Promise.resolve();
    this.subjectStatsObservationHostBackoffUntil = 0;
    this.credentialLocks.clear();
  }

  // Debug/Test inspection helpers
  getAuditEvents(): AuditEventRecord[] {
    return [...this.auditEvents];
  }

  getPendingActions(): PendingActionRecord[] {
    return Array.from(this.pendingActions.values());
  }
}

function compareSubjectStatsObservation(
  left: SubjectStatsObservationRecord,
  right: SubjectStatsObservationRecord,
): number {
  const byTime = left.observedAt.getTime() - right.observedAt.getTime();
  return byTime || left.id.localeCompare(right.id);
}

function cloneSubjectStatsObservation(
  record: SubjectStatsObservationRecord,
): SubjectStatsObservationRecord {
  return {
    ...record,
    observedAt: new Date(record.observedAt),
    retrievedAt: record.retrievedAt ? new Date(record.retrievedAt) : record.retrievedAt,
    retentionUntil: new Date(record.retentionUntil),
  };
}
