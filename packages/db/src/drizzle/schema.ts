import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  unique,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';

export const botInstances = pgTable('bot_instances', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  externalBotId: text('external_bot_id').notNull(),
  encryptedConfig: text('encrypted_config'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const externalPrincipals = pgTable(
  'external_principals',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull(),
    botInstanceId: text('bot_instance_id').notNull(),
    externalUserId: text('external_user_id').notNull(),
    displayName: text('display_name'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    uniquePrincipal: unique().on(table.provider, table.botInstanceId, table.externalUserId),
  }),
);

export const bangumiAccounts = pgTable('bangumi_accounts', {
  id: text('id').primaryKey(),
  bangumiUserId: integer('bangumi_user_id').notNull().unique(),
  username: text('username').notNull(),
  nickname: text('nickname').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const accountBindings = pgTable(
  'account_bindings',
  {
    id: text('id').primaryKey(),
    principalId: text('principal_id').notNull(),
    bangumiAccountId: text('bangumi_account_id').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    principalIdx: index('account_bindings_principal_id_idx').on(table.principalId),
  }),
);

export const accessCredentials = pgTable('access_credentials', {
  id: text('id').primaryKey(),
  bangumiAccountId: text('bangumi_account_id').notNull().unique(),
  encryptedAccessToken: jsonb('encrypted_access_token').notNull(),
  encryptedRefreshToken: jsonb('encrypted_refresh_token'),
  expiresAt: timestamp('expires_at').notNull(),
  requestedCapabilities: jsonb('requested_capabilities').notNull(),
  reportedScopes: jsonb('reported_scopes'),
  scopeEvidence: text('scope_evidence').notNull().default('unknown'),
  keyVersion: text('key_version').notNull().default('v1'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const oauthSessions = pgTable('oauth_sessions', {
  id: text('id').primaryKey(),
  stateHash: text('state_hash').notNull().unique(),
  principalId: text('principal_id').notNull(),
  botInstanceId: text('bot_instance_id'),
  conversationId: text('conversation_id'),
  requestedCapabilities: jsonb('requested_capabilities').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const conversationContexts = pgTable(
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
    expiresAt: timestamp('expires_at').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.principalId, table.conversationKey] }),
  }),
);

export const pendingActions = pgTable(
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
    expiresAt: timestamp('expires_at').notNull(),
    confirmedAt: timestamp('confirmed_at'),
    executionStartedAt: timestamp('execution_started_at'),
    executedAt: timestamp('executed_at'),
    failureCode: text('failure_code'),
    failureMessageSafe: text('failure_message_safe'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    pendingActionIdx: index('pending_actions_principal_expires_idx').on(
      table.principalId,
      table.expiresAt,
    ),
  }),
);

export const auditEvents = pgTable(
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
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    auditIdx: index('audit_events_principal_created_idx').on(table.principalId, table.createdAt),
  }),
);
