# Run 95 M07 `manage_index` no-account source contract

## Selected matrix cell

This profile covers exactly one Agent/MCP interaction for `bangumi.manage_index`, using the registered arguments `{ "action": "create", "title": "Run95 no-account gate check" }` and an isolated principal with no Bangumi account binding. It is matrix-only evidence for the Agent/MCP cell. The M07 scenario remains UNASSESSED.

## Source-backed boundary

The catalog classifies `bangumi.manage_index` as `auth=required` and `risk=write`. `ToolRegistry.executeTool` resolves the tool policy and requires an authenticated client before invoking the tool implementation. The unbound principal therefore receives `AUTH_REQUIRED` before the index create action can execute. The isolated runner installs an HTTP client that counts and rejects every request; acceptance requires the count to remain zero. Its ephemeral `MemoryStorage` is inspected to confirm that no account binding was created.

The profile does not bind an account, start OAuth, read account data, read or write index data, or access community content. It does not exercise QQ or TIM. The synthetic principal and in-memory store exist only for the local run and are not persisted in the report.

## Evidence and acceptance boundary

The dedicated MCP server exposes only `bangumi.manage_index`, allows exactly the registered argument object once, and converts only the expected `AUTH_REQUIRED` with zero HTTP requests into a non-error MCP result. Any other tool, arguments, repeated call, request, or unexpected registry result fails closed. The report retains the reviewed Candidate, Base, CI, reviewer, bundle, registry, catalog, claim, and receipt hashes plus sanitized counters. It does not retain the prompt, answer text, raw tool arguments, credentials, or account identifiers.

The Agent/MCP matrix may count this single interaction only after the exact Candidate passes the Harness review and CI gates, the one-shot claim is durably latched, the Codex stream has exactly one successful tool call and no error/non-MCP/shell events, the result is `AUTH_REQUIRED`, and the HTTP/write counters remain zero. This evidence does not establish that index management succeeds for an authenticated account and does not change M07 scenario status.
