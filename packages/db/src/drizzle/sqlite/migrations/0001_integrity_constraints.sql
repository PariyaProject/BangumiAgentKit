CREATE TABLE account_bindings__new (
  id TEXT PRIMARY KEY,
  principal_id TEXT NOT NULL REFERENCES external_principals(id) ON DELETE CASCADE,
  bangumi_account_id TEXT NOT NULL REFERENCES bangumi_accounts(id) ON DELETE CASCADE,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  UNIQUE(principal_id, bangumi_account_id)
);

INSERT INTO account_bindings__new (
  id, principal_id, bangumi_account_id, is_active, created_at
)
SELECT id, principal_id, bangumi_account_id, is_active, created_at
FROM account_bindings;

DROP TABLE account_bindings;
ALTER TABLE account_bindings__new RENAME TO account_bindings;

CREATE INDEX account_bindings_principal_id_idx ON account_bindings (principal_id);
CREATE UNIQUE INDEX account_bindings_active_principal_idx
  ON account_bindings (principal_id)
  WHERE is_active = 1;

CREATE TABLE access_credentials__new (
  id TEXT PRIMARY KEY,
  bangumi_account_id TEXT NOT NULL UNIQUE REFERENCES bangumi_accounts(id) ON DELETE CASCADE,
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT,
  expires_at INTEGER NOT NULL,
  requested_capabilities TEXT NOT NULL,
  reported_scopes TEXT,
  scope_evidence TEXT NOT NULL DEFAULT 'unknown',
  key_version TEXT NOT NULL DEFAULT 'v1',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO access_credentials__new (
  id, bangumi_account_id, encrypted_access_token, encrypted_refresh_token,
  expires_at, requested_capabilities, reported_scopes, scope_evidence,
  key_version, created_at, updated_at
)
SELECT id, bangumi_account_id, encrypted_access_token, encrypted_refresh_token,
  expires_at, requested_capabilities, reported_scopes, scope_evidence,
  key_version, created_at, updated_at
FROM access_credentials;

DROP TABLE access_credentials;
ALTER TABLE access_credentials__new RENAME TO access_credentials;
