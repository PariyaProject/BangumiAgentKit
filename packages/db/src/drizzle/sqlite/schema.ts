import {
  sqliteTable,
  text,
  integer,
  unique,
  index,
  primaryKey,
} from 'drizzle-orm/sqlite-core';

export const botInstances = sqliteTable('bot_instances', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  externalBotId: text('external_bot_id').notNull(),
  encryptedConfig: text('encrypted_config'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const externalPrincipals = sqliteTable(
  'external_principals',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull(),
    botInstanceId: text('bot_instance_id').notNull(),
    externalUserId: text('external_user_id').notNull(),
    displayName: text('display_name'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => ({
    uniquePrincipal: unique().on(table.provider, table.botInstanceId, table.externalUserId),
  }),
);

export const bangumiAccounts = sqliteTable('bangumi_accounts', {
  id: text('id').primaryKey(),
  bangumiUserId: integer('bangumi_user_id').notNull().unique(),
  username: text('username').notNull(),
  nickname: text('nickname').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const accountBindings = sqliteTable(
  'account_bindings',
  {
    id: text('id').primaryKey(),
    principalId: text('principal_id').notNull(),
    bangumiAccountId: text('bangumi_account_id').notNull(),
    isActive: integer('is_active').notNull().default(1),
    createdAt: integer('created_at').notNull(),
  },
  (table) => ({
    uniqueBinding: unique().on(table.principalId, table.bangumiAccountId),
    principalIdx: index('account_bindings_principal_id_idx').on(table.principalId),
  }),
);

export const accessCredentials = sqliteTable('access_credentials', {
  id: text('id').primaryKey(),
  bangumiAccountId: text('bangumi_account_id').notNull().unique(),
  encryptedAccessToken: text('encrypted_access_token').notNull(),
  encryptedRefreshToken: text('encrypted_refresh_token'),
  expiresAt: integer('expires_at').notNull(),
  requestedCapabilities: text('requested_capabilities').notNull(),
  reportedScopes: text('reported_scopes'),
  scopeEvidence: text('scope_evidence').notNull().default('unknown'),
  keyVersion: text('key_version').notNull().default('v1'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const oauthSessions = sqliteTable('oauth_sessions', {
  id: text('id').primaryKey(),
  stateHash: text('state_hash').notNull().unique(),
  principalId: text('principal_id').notNull(),
  botInstanceId: text('bot_instance_id'),
  conversationId: text('conversation_id'),
  requestedCapabilities: text('requested_capabilities').notNull(),
  expiresAt: integer('expires_at').notNull(),
  usedAt: integer('used_at'),
  createdAt: integer('created_at').notNull(),
});

export const conversationContexts = sqliteTable(
  'conversation_contexts',
  {
    principalId: text('principal_id').notNull(),
    conversationKey: text('conversation_key').notNull(),
    lastSubjectId: integer('last_subject_id'),
    lastCharacterId: integer('last_character_id'),
    lastPersonId: integer('last_person_id'),
    searchCandidatesJson: text('search_candidates_json'),
    preferredOutputMode: text('preferred_output_mode'),
    locale: text('locale'),
    timezone: text('timezone'),
    expiresAt: integer('expires_at').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.principalId, table.conversationKey] }),
  }),
);

export const pendingActions = sqliteTable(
  'pending_actions',
  {
    id: text('id').primaryKey(),
    principalId: text('principal_id').notNull(),
    botInstanceId: text('bot_instance_id').notNull(),
    conversationKey: text('conversation_key').notNull(),
    actionType: text('action_type').notNull(),
    summary: text('summary').notNull(),
    normalizedPayloadJson: text('normalized_payload_json').notNull(),
    payloadHash: text('payload_hash').notNull(),
    status: text('status').notNull().default('pending'),
    expiresAt: integer('expires_at').notNull(),
    confirmedAt: integer('confirmed_at'),
    executionStartedAt: integer('execution_started_at'),
    executedAt: integer('executed_at'),
    failureCode: text('failure_code'),
    failureMessageSafe: text('failure_message_safe'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => ({
    pendingActionIdx: index('pending_actions_principal_expires_idx').on(
      table.principalId,
      table.expiresAt,
    ),
  }),
);

export const auditEvents = sqliteTable(
  'audit_events',
  {
    id: text('id').primaryKey(),
    principalId: text('principal_id').notNull(),
    bangumiAccountId: text('bangumi_account_id'),
    operationId: text('operation_id').notNull(),
    riskLevel: text('risk_level').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    changeSummaryJson: text('change_summary_json').notNull(),
    confirmationId: text('confirmation_id'),
    result: text('result').notNull(),
    requestId: text('request_id'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => ({
    auditIdx: index('audit_events_principal_created_idx').on(table.principalId, table.createdAt),
  }),
);

export const storageLocks = sqliteTable('storage_locks', {
  lockKey: text('lock_key').primaryKey(),
  ownerId: text('owner_id').notNull(),
  expiresAt: integer('expires_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const subjectStatsObservations = sqliteTable(
  'subject_stats_observations',
  {
    id: text('id').primaryKey(),
    subjectId: integer('subject_id').notNull(),
    observedAt: integer('observed_at').notNull(),
    retrievedAt: integer('retrieved_at'),
    state: text('state').notNull(),
    resultJson: text('result_json').notNull(),
    methodologyVersion: text('methodology_version').notNull(),
    retentionUntil: integer('retention_until').notNull(),
  },
  (table) => ({
    subjectObservedIdx: index('subject_stats_observations_subject_observed_idx').on(
      table.subjectId,
      table.observedAt,
    ),
    retentionIdx: index('subject_stats_observations_retention_idx').on(table.retentionUntil),
  }),
);
