# Review Known Issues & Technical Debt

This document tracks known architectural technical debt deferred from foundational freeze PRs.

## Resolved Items in PR-3

- [x] **remove accessToken from ToolContext**: Completely removed `accessToken` from `ToolContext`. Authentication and identity resolution are now handled via `TokenBroker` and `BangumiClientProvider`.
- [x] **integrate TokenBroker into execution services**: Unified token retrieval, AES-256-GCM token encryption, token rotation, and proxied HTTP Bearer injection into `TokenBroker`.
- [x] **shared persistent Storage**: Implemented unified `Storage` interface with both `MemoryStorage` and PostgreSQL (`PostgresStorage` via Drizzle ORM) for shared persistence between Fastify API and MCP Server.
- [x] **protect raw operation writes**: Raw operation tool `bangumi.call_operation` enforces `BANGUMI_ALLOW_RAW_WRITES` (default `false`) and policy checks before executing write/destructive operations.
- [x] **fix PendingAction lifecycle**: Standardized PendingAction state machine (`pending` -> `executing` -> `succeeded` / `failed` / `unknown`), `computeCanonicalPayloadHash`, and claim validation.

## Future Roadmap / Low Priority Notes

- **Multi-region Key Rotation**: Future PR can introduce automated key rotation background workers for AES-256-GCM keys across multiple active key versions.
- **Web UI Auth Dashboard**: Optional standalone web frontend for visual management of connected Bangumi accounts.
