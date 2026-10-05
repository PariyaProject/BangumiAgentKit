# Run #95 — G09 series watch-order MCP text projection

Base: `6e812f77a2c681f5c0f8b732401f04d0ac16be54` (synchronized master). Scenario: G09, `少女终末旅行系列观看顺序。`

## Confirmed problem

A deterministic offline replay of the bounded G09 relation fixture produced 12,582 UTF-8 bytes of pretty JSON. Before the change, `presentMcpToolResult("bangumi.get_series_watch_order", result)` returned that full string and no separate `structuredContent`. The replay used mocked HTTP responses from the existing root/derivative fixture; it made no network request and used no account.

## Change and checks

The MCP presenter now compacts oversized series watch-order results to at most 3,600 UTF-8 bytes. The text view carries ordered item IDs and positions, raw relation labels and path evidence, bounded coverage, retrieval time, exclusions, truncation state, warnings, limitations, and explicit omission/clipping counts. The exact full source object is returned as `structuredContent`. A final minimum projection keeps ordered IDs and explicit row counts if pathological text still exceeds the first projection.

The G09 answer checker verifies one exact public `bangumi.get_series_watch_order` call, its fixed arguments, the requested root as the first step, every visible ordered row, source title and raw relation label, exact depth/node/media bounds, non-anime exclusion count, and the noncanonical-order caveat. It requires an omission caveat whenever relation rows are hidden or truncated. Its CLI prints counters and booleans only; it does not print titles or answer text.

Validation so far:

- `pnpm exec vitest run tests/integration/mcp-result-presenter.test.ts tests/unit/g09-series-watch-order-answer-check.test.ts` — 23/23 passed.
- `pnpm typecheck` — passed.
- `pnpm acceptance:check` — 37/37 acceptance evidence checks passed; catalog/direct 96/96, public 65/65, Agent/MCP matrix 96/96, QQ/TIM 0/96 each, and auth pending 33.
- `pnpm harness guard:legacy-paths --product-epoch` — passed.
- `pnpm harness frontier:check` — `FRONTIER_LEDGER_VALID`, 121 records / 99 actionable.
- The presenter integration fixture asserts the full source object remains equal in MCP `structuredContent`, the G09 text stays within 3,600 bytes, and high-cardinality Unicode data has explicit row and clipping counts.

## Remaining boundary

The exact-current-source Agent/MCP G09 canary has not been run yet. It must happen only after the exact Candidate CI and Harness gates, and the sanitized outcome belongs in the Run #95 control plane. No raw answer/result is retained. G09 stays PARTIAL because the bounded sample does not establish an exhaustive franchise graph or unique official order; QQ/TIM remains a separate client gate.
