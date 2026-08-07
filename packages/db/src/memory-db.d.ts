import { BotInstanceRecord, ExternalPrincipalRecord, BangumiAccountRecord, AccountBindingRecord, AccessCredentialRecord, OAuthSessionRecord, ConversationContextRecord, PendingActionRecord, AuditEventRecord } from './schema.js';
export declare class DatabaseStore {
    botInstances: Map<string, BotInstanceRecord>;
    externalPrincipals: Map<string, ExternalPrincipalRecord>;
    bangumiAccounts: Map<string, BangumiAccountRecord>;
    accountBindings: Map<string, AccountBindingRecord>;
    accessCredentials: Map<string, AccessCredentialRecord>;
    oauthSessions: Map<string, OAuthSessionRecord>;
    conversationContexts: Map<string, ConversationContextRecord>;
    pendingActions: Map<string, PendingActionRecord>;
    auditEvents: AuditEventRecord[];
    findOrCreatePrincipal(provider: string, botInstanceId: string, externalUserId: string, displayName?: string): ExternalPrincipalRecord;
    getActiveBinding(principalId: string): AccountBindingRecord | undefined;
    getOAuthSessionByHash(stateHash: string): OAuthSessionRecord | undefined;
    getCredentialByAccountId(bangumiAccountId: string): AccessCredentialRecord | undefined;
    clear(): void;
}
//# sourceMappingURL=memory-db.d.ts.map