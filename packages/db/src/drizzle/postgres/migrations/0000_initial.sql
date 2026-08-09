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
  principal_id TEXT NOT NULL REFERENCES external_principals(id) ON DELETE CASCADE,
  bangumi_account_id TEXT NOT NULL REFERENCES bangumi_accounts(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT account_bindings_principal_account_unique UNIQUE (principal_id, bangumi_account_id)
);

CREATE INDEX IF NOT EXISTS account_bindings_principal_id_idx ON account_bindings (principal_id);
CREATE UNIQUE INDEX IF NOT EXISTS account_bindings_active_principal_idx ON account_bindings (principal_id) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS access_credentials (
  id TEXT PRIMARY KEY,
  bangumi_account_id TEXT NOT NULL UNIQUE REFERENCES bangumi_accounts(id) ON DELETE CASCADE,
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
