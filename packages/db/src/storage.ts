import {
  ExternalPrincipalRecord,
  BangumiAccountRecord,
  AccountBindingRecord,
  AccessCredentialRecord,
  OAuthSessionRecord,
  PendingActionRecord,
  AuditEventRecord,
  SubjectStatsObservationRecord,
  SubjectStatsObservationStoreOptions,
  SubjectStatsObservationQuery,
} from './schema.js';

export interface FindOrCreatePrincipalInput {
  provider: string;
  botInstanceId: string;
  externalUserId: string;
  displayName?: string;
}

export interface ClaimPendingActionInput {
  confirmationId: string;
  principalId: string;
  botInstanceId: string;
  conversationId: string;
  payloadHash: string;
  now?: Date;
}

export interface Storage {
  findOrCreatePrincipal(input: FindOrCreatePrincipalInput): Promise<ExternalPrincipalRecord>;
  getPrincipal(id: string): Promise<ExternalPrincipalRecord | null>;
  getBangumiAccount(id: string): Promise<BangumiAccountRecord | null>;
  upsertBangumiAccount(
    input: Omit<BangumiAccountRecord, 'createdAt' | 'updatedAt'> &
      Partial<Pick<BangumiAccountRecord, 'createdAt' | 'updatedAt'>>,
  ): Promise<BangumiAccountRecord>;
  getActiveBinding(principalId: string): Promise<AccountBindingRecord | null>;
  listBindings(principalId: string): Promise<AccountBindingRecord[]>;
  bindAccount(
    principalId: string,
    bangumiAccountId: string,
    activate?: boolean,
  ): Promise<AccountBindingRecord>;
  setActiveBinding(
    principalId: string,
    bangumiAccountId: string,
  ): Promise<AccountBindingRecord>;
  removeBinding(principalId: string, bangumiAccountId: string): Promise<void>;
  replaceActiveBinding(
    principalId: string,
    bangumiAccountId: string,
  ): Promise<AccountBindingRecord>;
  deactivateBindings(principalId: string): Promise<void>;
  getCredential(accountId: string): Promise<AccessCredentialRecord | null>;
  upsertCredential(record: AccessCredentialRecord): Promise<void>;
  deleteCredential(accountId: string): Promise<void>;
  createOAuthSession(session: OAuthSessionRecord): Promise<void>;
  consumeOAuthSession(stateHash: string, now?: Date): Promise<OAuthSessionRecord>;
  createPendingAction(action: PendingActionRecord): Promise<void>;
  claimPendingAction(input: ClaimPendingActionInput): Promise<PendingActionRecord>;
  markPendingActionSucceeded(id: string): Promise<void>;
  markPendingActionFailed(id: string, reason: string, failureCode?: string): Promise<void>;
  markPendingActionUnknown(id: string, reason: string): Promise<void>;
  appendAuditEvent(event: AuditEventRecord): Promise<void>;
  appendSubjectStatsObservation(
    record: SubjectStatsObservationRecord,
    options: SubjectStatsObservationStoreOptions,
  ): Promise<void>;
  listSubjectStatsObservations(
    query: SubjectStatsObservationQuery,
  ): Promise<SubjectStatsObservationRecord[]>;
  withCredentialLock<T>(accountId: string, fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
