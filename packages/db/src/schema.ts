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
  };
  encryptedRefreshToken?: {
    ciphertext: string;
    iv: string;
    authTag: string;
  };
  expiresAt: Date;
  scopes: string[];
  keyVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OAuthSessionRecord {
  id: string;
  stateHash: string;
  principalId: string;
  requestedScopes: string[];
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

export interface PendingActionRecord {
  id: string;
  principalId: string;
  conversationKey: string;
  actionType: string;
  normalizedPayloadJson: string;
  payloadHash: string;
  expiresAt: Date;
  confirmedAt?: Date | null;
  executedAt?: Date | null;
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
  result: 'success' | 'failed' | 'cancelled';
  requestId?: string;
  createdAt: Date;
}
