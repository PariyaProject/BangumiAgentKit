# PR-3 Verification Matrix: Identity, OAuth & Write Security Foundation

| ID | Requirement | Implementation | Test | Status |
|----|-------------|----------------|------|--------|
| P3-01 | Storage interface | `packages/db/src/storage.ts` (`Storage` interface) | `tests/contract/storage-contract.test.ts` | VERIFIED |
| P3-02 | MemoryStorage | `packages/db/src/memory-db.ts` | `tests/contract/storage-contract.test.ts` | VERIFIED |
| P3-03 | PostgresStorage | `packages/db/src/postgres-storage.ts` | `tests/contract/storage-contract.test.ts` | VERIFIED |
| P3-04 | Drizzle migrations | `packages/db/src/drizzle/migrations/0000_initial.sql` | `tests/contract/storage-contract.test.ts` | VERIFIED |
| P3-05 | Storage contract test | `tests/contract/storage-contract.test.ts` | `tests/contract/storage-contract.test.ts` | VERIFIED |
| P3-06 | Shared RuntimeDependencies | `packages/tools/src/registry.ts` (`createRuntimeDependencies`) | `tests/integration/mcp-api-shared-postgres.test.ts` | VERIFIED |
| P3-07 | Remove ToolContext.accessToken | `packages/tools/src/define-tool.ts` | `tests/contract/compile-negative.test.ts` | VERIFIED |
| P3-08 | TokenBroker client boundary | `packages/auth/src/token-broker.ts` | `tests/unit/auth.test.ts` | VERIFIED |
| P3-09 | Optional/public/authenticated client | `TokenBroker.getPublicClient`, `getOptionalAuthenticatedClient`, `requireAuthenticatedClient` | `tests/unit/auth.test.ts` | VERIFIED |
| P3-10 | OAuth requested capability != granted scope | `packages/auth/src/oauth-service.ts` (`reportedScopes`, `scopeEvidence`) | `tests/unit/auth.test.ts` | VERIFIED |
| P3-11 | OAuth state atomic single use | `packages/auth/src/state-store.ts` | `tests/unit/oauth-state-concurrency.test.ts` | VERIFIED |
| P3-12 | OAuth token exchange client | `packages/auth/src/oauth-service.ts` / `BangumiOAuthClient` | `tests/unit/auth.test.ts` | VERIFIED |
| P3-13 | Refresh token implementation | `TokenBroker.requireAuthenticatedClient` | `tests/unit/token-refresh-concurrency.test.ts` | VERIFIED |
| P3-14 | Concurrent refresh deduplication | `TokenBroker.withCredentialLock` | `tests/unit/token-refresh-concurrency.test.ts` | VERIFIED |
| P3-15 | AES-GCM key version | `packages/auth/src/token-crypto.ts` (`encryptToken`, `decryptToken`) | `tests/unit/auth.test.ts` | VERIFIED |
| P3-16 | Actual Fastify OAuth callback | `apps/api/src/routes/oauth.ts` (`/oauth/bangumi/callback` & `/oauth/callback`) | `tests/integration/mcp-api-shared-postgres.test.ts` | VERIFIED |
| P3-17 | auth_status | `packages/tools/src/definitions/auth-tools.ts` (`bangumi.auth_status`) | `tests/integration/mcp-api-shared-postgres.test.ts` | VERIFIED |
| P3-18 | auth_start | `packages/tools/src/definitions/auth-tools.ts` (`bangumi.auth_start`) | `tests/unit/auth.test.ts` | VERIFIED |
| P3-19 | auth_disconnect | `packages/tools/src/definitions/auth-tools.ts` (`bangumi.auth_disconnect`) | `tests/unit/auth.test.ts` | VERIFIED |
| P3-20 | Dynamic ResolvedToolPolicy | `packages/tools/src/policy.ts` / `defineTool.resolvePolicy` | `tests/unit/raw-write-gate.test.ts` | VERIFIED |
| P3-21 | Raw Write Gate | `BANGUMI_ALLOW_RAW_WRITES` check in `packages/tools/src/definitions/raw-operation-tools.ts` | `tests/unit/raw-write-gate.test.ts` | VERIFIED |
| P3-22 | PendingAction state machine | `packages/tools/src/confirmation.ts` (`pending` -> `executing` -> `succeeded` / `failed` / `unknown`) | `tests/unit/pending-action-state-machine.test.ts` | VERIFIED |
| P3-23 | Canonical payload hash | `packages/tools/src/confirmation.ts` (`computeCanonicalPayloadHash`) | `tests/unit/pending-action-state-machine.test.ts` | VERIFIED |
| P3-24 | Atomic confirmation claim | `packages/db/src/postgres-storage.ts` & `memory-db.ts` (`claimPendingAction`) | `tests/contract/storage-contract.test.ts` | VERIFIED |
| P3-25 | Write audit | `packages/bangumi-core/src/services/audit-service.ts` | `tests/unit/writes.test.ts` | VERIFIED |
| P3-26 | Generated client for authenticated writes | `CollectionService` & `IndexWriteService` use `GeneratedBangumiOpenApiClient` | `tests/unit/writes.test.ts` | VERIFIED |
| P3-27 | Correct character endpoint | `/v0/characters/{id}/collect` | `tests/unit/character-person-endpoint.test.ts` | VERIFIED |
| P3-28 | Correct person endpoint | `/v0/persons/{id}/collect` | `tests/unit/character-person-endpoint.test.ts` | VERIFIED |
| P3-29 | manage_index six actions | `bangumi.manage_index` (`create`, `edit`, `add_subject`, `remove_subject`, `collect`, `uncollect`) | `tests/unit/manage-index-actions.test.ts` | VERIFIED |
| P3-30 | Index create workflow | `newIndex()` -> `editIndexById()` if title/desc | `tests/unit/manage-index-actions.test.ts` | VERIFIED |
| P3-31 | No automatic write retry | `HttpClient` default idempotent-only retry logic | `tests/unit/transport.test.ts` | VERIFIED |
| P3-32 | Shared PostgreSQL API/MCP integration | `tests/integration/mcp-api-shared-postgres.test.ts` | `tests/integration/mcp-api-shared-postgres.test.ts` | VERIFIED |
| P3-33 | Config validation | `createRuntimeDependencies` fail-fast in production mode | `tests/unit/auth.test.ts` | VERIFIED |
| P3-34 | PostgreSQL CI service | `.github/workflows/ci.yml` postgres service container | GitHub Actions Workflow | VERIFIED |
