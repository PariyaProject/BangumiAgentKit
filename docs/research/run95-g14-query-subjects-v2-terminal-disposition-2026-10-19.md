# Run #95 G14 `query_subjects` v2 terminal disposition

Date: 2026-10-19. This is a sanitized reconciliation of the current Harness state after PR #233 merged.

## Verified disposition

- PR #233 Candidate `9932d80317124ca622a0c98a953dd9489202cd57` was reviewed against Base `e9b137bfc7cd095bd22bef0a717c279582b6f106`; exact CI run `39183678392` passed all 7 required checks, and the same-identity round-4 Luna Max review passed. Harness merged it at `7be6675d097ac8e080d1f05dd65d0b4cba42c019`.
- Read-only Harness profile status for the PR #233 v2 claim is terminal `INCONCLUSIVE`: `call_count=1`, `report_written=false`, `retry_allowed=false`, reason `MCP_TOOL_EVENT_NOT_DONE`. No report was produced, so it earns no Agent/MCP matrix credit.
- The earlier PR #232 v1 query profile is also terminal `INCONCLUSIVE`, no-report, and non-retryable.
- Merged-master acceptance remains Agent/MCP 83/96 and public 65/65. G14 remains `PARTIAL`; the bounded query does not establish the full annual ranking or catalog completeness.

## Required handling

Never invoke either consumed query profile or claim again. The classifier fix merged in PR #233 does not change the terminal disposition or authorize a second call. Continue with a different safe, genuinely unspent frontier after checking current Harness status. Keep the 65/65 public target and all account/OAuth/community/QQ/TIM boundaries unchanged.

This note contains no prompt, answer text, raw tool output, subject result rows, credential, or account data. No API/MCP call was made while reconciling the disposition.

## Source-level runner defect confirmed on 2026-10-22

The v2 terminal disposition remains unchanged: call_count=1, report_written=false,
retry_allowed=false, and no Agent/MCP matrix credit. A source-level comparison
now identifies a deterministic false-negative in both the v1 and v2 runners:
the shared summarizeCodexEvents function emits each entry in toolCalls as
{name, arguments, state}, with successful calls marked state DONE, while
both query runners checked event.tool. The v2 terminal reason
MCP_TOOL_EVENT_NOT_DONE matches that mismatch. The original temporary event
stream was deleted, so its raw event values remain unavailable.

A separate G14 remediation corrects both predicates through the shared exact
completed-call helper and adds synthetic JSONL regressions for the canonical
event plus wrong-name, non-DONE, MCP-error, and multiple-call rejection. This is
a code/test correction only: it does not alter either terminal latch, replay a
claim, make a Bangumi request, or add matrix credit. A future query_subjects
observation requires a genuinely distinct profile and one-shot claim. The correction and regression live in
scripts/acceptance/run-query-subjects-fresh-public-agent-mcp.mjs,
scripts/acceptance/run-query-subjects-fresh-public-agent-mcp-v2.mjs, and
tests/harness/query-subjects-mcp-tool-event-contract.test.mjs.
