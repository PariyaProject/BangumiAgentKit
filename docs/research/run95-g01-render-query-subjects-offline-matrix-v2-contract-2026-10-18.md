# Run #95 G01 offline render query Agent/MCP matrix v2 contract

This document records the selection contract for one fresh, synthetic, offline `bangumi.render_query_subjects` Agent/MCP matrix profile. It does not claim that the profile has been invoked or that the G01 scenario has passed.

## Scope and fixed identity

- Profile: `g01-render-query-subjects-offline-agent-mcp-v2`
- Implementation Epoch: `run95-g01-render-query-offline-matrix-v2-20261018` (PR #216; no claim or invocation)
- Invocation Epoch: `run95-g01-render-query-offline-matrix-v2-call-20261018` (the v2 profile's `epochId`, selected only after PR #216 integrates)
- Tool: one `bangumi.render_query_subjects` call
- Input keyword: `run95 g01 fresh synthetic render query offline 20261018`
- Synthetic subject ID: `991111`
- Network mode: `run95-g01-render-query-subjects-synthetic-offline-v2`
- Acceptance scope: the single Agent/MCP matrix row only
- Acknowledgement: `G01_RENDER_QUERY_SYNTHETIC_OFFLINE_V2_OK`

The input, profile ID, epoch, claim label, evidence kind, report path, selection path, and network mode are distinct from v1. The v1 profile and its historical terminal disposition remain immutable. A consumed profile must never be retried.

## Offline execution boundary

The closed fixture accepts exactly one anonymous search request using the registered keyword and one anonymous detail request for synthetic subject `991111`. It rejects duplicate, changed, authenticated, write, wrong-origin, and unregistered requests. Renderer asset resolution remains disabled. Fixture rows, raw tool output, prompt, answer, credentials, and image bytes are not persisted.

Failure dispositions may include only allowlisted booleans and bounded counters. The diagnostics may count Codex error items and MCP tool-result errors; they must not include raw event JSONL, error text, prompts, answers, arguments, fixture rows, credentials, or image bytes.

## Review and acceptance gates

PR #216 is implementation-only. After it integrates, select the separately registered Invocation Epoch `run95-g01-render-query-offline-matrix-v2-call-20261018` and keep its PR active. Do not claim or invoke the profile before that PR's exact Candidate passes all seven required CI checks, the Harness Candidate gate, and the same-identity GPT-6 Luna Max first review. Harness claims are bound to an active Epoch, so invoke the v2 profile exactly once after those gates and before that Invocation Epoch merges. Then commit the sanitized report and matrix/frontier evidence, refresh the Candidate, rerun exact CI and same-identity review, and merge through Harness. Reconcile only from the exact registered v2 claim, report, and profile status; an inconclusive run is terminal and must never be retried.

A successful report may credit only the `bangumi.render_query_subjects` Agent/MCP matrix cell. It does not answer the July 2026 G01 scenario, prove Bangumi-wide search completeness, add public API coverage, or change the public target. G01 remains `PARTIAL` until separate scenario evidence meets its own contract.
