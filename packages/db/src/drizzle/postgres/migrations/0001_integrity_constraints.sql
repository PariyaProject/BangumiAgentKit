CREATE UNIQUE INDEX IF NOT EXISTS account_bindings_active_principal_idx
  ON account_bindings (principal_id)
  WHERE is_active = true;
