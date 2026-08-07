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
} from './schema.js';

export class DatabaseStore {
  botInstances = new Map<string, BotInstanceRecord>();
  externalPrincipals = new Map<string, ExternalPrincipalRecord>();
  bangumiAccounts = new Map<string, BangumiAccountRecord>();
  accountBindings = new Map<string, AccountBindingRecord>();
  accessCredentials = new Map<string, AccessCredentialRecord>();
  oauthSessions = new Map<string, OAuthSessionRecord>();
  conversationContexts = new Map<string, ConversationContextRecord>();
  pendingActions = new Map<string, PendingActionRecord>();
  auditEvents: AuditEventRecord[] = [];

  // External Principal Helpers
  findOrCreatePrincipal(provider: string, botInstanceId: string, externalUserId: string, displayName?: string): ExternalPrincipalRecord {
    const key = `${provider}:${botInstanceId}:${externalUserId}`;
    let rec = this.externalPrincipals.get(key);
    if (!rec) {
      rec = {
        id: `prc_${Math.random().toString(36).slice(2, 10)}`,
        provider,
        botInstanceId,
        externalUserId,
        displayName,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.externalPrincipals.set(key, rec);
    }
    return rec;
  }

  // Binding Helpers
  getActiveBinding(principalId: string): AccountBindingRecord | undefined {
    for (const b of this.accountBindings.values()) {
      if (b.principalId === principalId && b.isActive) {
        return b;
      }
    }
    return undefined;
  }

  // OAuth Sessions
  getOAuthSessionByHash(stateHash: string): OAuthSessionRecord | undefined {
    for (const s of this.oauthSessions.values()) {
      if (s.stateHash === stateHash) {
        return s;
      }
    }
    return undefined;
  }

  // Credentials
  getCredentialByAccountId(bangumiAccountId: string): AccessCredentialRecord | undefined {
    return this.accessCredentials.get(bangumiAccountId);
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
  }
}
