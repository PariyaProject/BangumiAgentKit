# Multi-Account & Principal Identity Security

BangumiAgentKit supports binding multiple Bangumi accounts to a single platform principal (e.g. QQ user), while maintaining strict identity isolation across different platform principals.

## Core Concepts

- **Principal**: Unique platform user identity, identified by `(provider, botInstanceId, externalUserId)`.
- **Bangumi Account**: Authoritative user account on Bangumi (bgm.tv).
- **Active Binding**: Each principal has at most one active Bangumi account binding at a given time. All subsequent read/write tool executions act on behalf of the active bound account.

## Multi-Account Operations & Semantic Tools

1. **`bangumi.auth_status`**:
   Returns current principal's auth status (`bound: boolean`, `accountCount: number`, active account summary). Never exposes access or refresh tokens.

2. **`bangumi.auth_list_accounts`**:
   Lists all Bangumi accounts bound to current principal (`accountId`, `username`, `nickname`, `avatarUrl`, `active`). Safe for model consumption.

3. **`bangumi.auth_switch_account`**:
   Input: `{ accountId: string }`.
   Switches the active account for the current principal. Throws `PERMISSION_DENIED` if the target account is not bound to current principal.

4. **`bangumi.auth_remove_account`**:
   Input: `{ accountId: string }`.
   Unbinds specified account from current principal. Destructive action requiring confirmation.

5. **`bangumi.auth_disconnect`**:
   Unbinds active account for current principal. Destructive action requiring confirmation.
