# Run #95 Codex CLI MCP result event shape

Recorded: 2026-10-22 UTC.

## Diagnostic

Codex CLI `0.163.0-alpha.10.2` was called once with a temporary local-only MCP server that returned a fixed synthetic result. The completed `mcp_tool_call` JSON event contained `result.content` and `result.structured_content`; the model answer matched the synthetic result. The diagnostic made no Bangumi request, used no registered acceptance profile, created no Harness claim, and did not access accounts, OAuth, community sources, QQ, or TIM. Raw event output and the synthetic answer were not retained.

## A01 v2 disposition

PR #252's runner required `result.structuredContent`, while this Codex CLI event uses `result.structured_content`. Its sanitized one-shot outcome remains Harness-terminal `INCONCLUSIVE`, no report, `retryAllowed=false`: one offline MCP call returned server `SUCCESS`, but `structuredResultReadback` failed. This diagnosis explains the parser mismatch; it does not recover or replace the discarded A01 event stream, authorize a retry, or create an acceptance report. Preserve the claim and terminal labels and keep A01 `UNASSESSED`.

## Correction

The shared Codex event summarizer now normalizes the observed snake_case result field before profile-specific validation. It also normalizes the MCP error flag alias and fails closed if camelCase and snake_case values conflict. Focused regressions cover snake_case success, snake_case error, and conflicting result fields. This is parser compatibility evidence only; it adds no Agent/MCP matrix credit.
