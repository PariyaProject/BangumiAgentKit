# ADR 0001: PostgreSQL Schema Integrity & Key Constraints

## Status
Accepted

## Context
PR-3 established the PostgreSQL storage backend for multi-tenant Bangumi agent identity and authentication credentials. However, earlier iterations lacked database-level guarantees for single-active bindings and explicit foreign keys between relational entities.

## Decision
1. **Single-Active Binding Guarantee**:
   We add a partial unique index on `account_bindings`:
   `UNIQUE(principal_id) WHERE is_active = true`
   This ensures PostgreSQL natively enforces that a principal can have at most one active binding at any given moment, avoiding race conditions during OAuth callback or binding replacement.

2. **Foreign Key Strategy**:
   - `account_bindings.principal_id` -> `external_principals(id) ON DELETE CASCADE`
   - `account_bindings.bangumi_account_id` -> `bangumi_accounts(id) ON DELETE CASCADE`
   - `access_credentials.bangumi_account_id` -> `bangumi_accounts(id) ON DELETE CASCADE`

   Audit events (`audit_events`) and historical pending actions (`pending_actions`) retain string reference IDs without cascading foreign keys to preserve immutable audit trails and diagnostic histories even if an external principal or binding is unlinked or purged.
