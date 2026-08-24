export interface BotInstanceRecord {
  id: string;
  provider: 'qq-official' | 'onebot' | 'local-mcp';
  externalBotId: string;
  encryptedConfig?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExternalPrincipalRecord {
  id: string;
  provider: string;
  botInstanceId: string;
  externalUserId: string;
  displayName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BangumiAccountRecord {
  id: string;
  bangumiUserId: number;
  username: string;
  nickname: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccountBindingRecord {
  id: string;
  principalId: string;
  bangumiAccountId: string;
  isActive: boolean;
  createdAt: Date;
}

export interface AccessCredentialRecord {
  id: string;
  bangumiAccountId: string;
  encryptedAccessToken: {
    ciphertext: string;
    iv: string;
    authTag: string;
    keyVersion?: string;
  };
  encryptedRefreshToken?: {
    ciphertext: string;
    iv: string;
    authTag: string;
    keyVersion?: string;
  };
  expiresAt: Date;
  requestedCapabilities: string[];
  reportedScopes: string[] | null;
  scopeEvidence: 'reported' | 'unknown';
  keyVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OAuthSessionRecord {
  id: string;
  stateHash: string;
  principalId: string;
  botInstanceId?: string;
  conversationId?: string;
  requestedCapabilities: string[];
  expiresAt: Date;
  usedAt?: Date | null;
  createdAt: Date;
}

export interface ConversationContextRecord {
  principalId: string;
  conversationKey: string;
  lastSubjectId?: number;
  lastCharacterId?: number;
  lastPersonId?: number;
  searchCandidatesJson?: string;
  preferredOutputMode?: string;
  locale?: string;
  timezone?: string;
  expiresAt: Date;
}

export type PendingActionStatus =
  'pending' | 'executing' | 'succeeded' | 'failed' | 'cancelled' | 'expired' | 'unknown';

export interface PendingActionRecord {
  id: string;
  principalId: string;
  botInstanceId: string;
  conversationKey: string;
  actionType: string;
  summary: string;
  normalizedPayloadJson: string;
  payloadHash: string;
  status: PendingActionStatus;
  expiresAt: Date;
  confirmedAt?: Date | null;
  executionStartedAt?: Date | null;
  executedAt?: Date | null;
  failureCode?: string;
  failureMessageSafe?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditEventRecord {
  id: string;
  principalId: string;
  bangumiAccountId?: string;
  operationId: string;
  riskLevel: 'read' | 'write' | 'destructive';
  resourceType: string;
  resourceId: string;
  changeSummaryJson: string;
  confirmationId?: string;
  result: 'success' | 'failed' | 'cancelled' | 'unknown';
  requestId?: string;
  createdAt: Date;
}

export type SubjectStatsObservationState =
  | 'complete'
  | 'ok'
  | 'partial'
  | 'stale'
  | 'conflict'
  | 'auth_required'
  | 'permission_denied'
  | 'unavailable'
  | 'not_computable'
  | 'unsupported'
  | 'not_found'
  | 'upstream_error';

export const SUBJECT_STATS_OBSERVATION_MAX_ROWS = 120;
export const SUBJECT_STATS_OBSERVATION_MAX_CLEANUP_ROWS = 120;

/**
 * An immutable public-statistics snapshot. It intentionally has no principal,
 * account, credential, or Bangumi-write relationship.
 */
export interface SubjectStatsObservationRecord {
  id: string;
  subjectId: number;
  observedAt: Date;
  retrievedAt?: Date | null;
  state: SubjectStatsObservationState;
  resultJson: string;
  methodologyVersion: string;
  retentionUntil: Date;
}

export interface SubjectStatsObservationStoreOptions {
  maxObservations: number;
  now?: Date;
}

export interface SubjectStatsObservationSummary {
  firstObservedAt?: Date;
  recordedCount: number;
  retainedCount: number;
  expiredCount: number;
  prunedCount: number;
  retentionUntilEarliest?: Date;
  retentionUntilLatest?: Date;
}

export interface SubjectStatsObservationQuery {
  subjectId: number;
  limit: number;
  now?: Date;
}
