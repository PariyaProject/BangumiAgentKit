# OP-002 watch-order capability reconciliation — 2026-10-17

Checked against BangumiAgentKit master Base `c228f3cbaaab8e1bf7d5f21f6fa29358c44699bc` (2026-10-16 20:13 UTC). This is a source-only reconciliation of the shipped feature and the OP-002 frontier. No Bangumi API request, ToolRegistry/MCP call, model run, account access, QQ/TIM action, or one-shot claim occurred.

## Why the two current statuses differ

`docs/product/opportunity-log.md` records OP-002 as `DELIVERED_IN_PR-7G_RECOVERY`: the bounded watch-order capability was implemented and merged. The current `docs/product/frontier-ledger.json` keeps OP-002 `PARTIAL`, which tracks whether the broader user question is supported by current evidence. These statuses describe different things and should not be collapsed.

## Shipped bounded behavior

`SeriesService.getSeriesWatchOrder` starts from one selected subject and its visible relation records. The service clamps `depth` to 0–2 (default 1) and `maxNodes` to 1–16 (default 8). It recognizes configured relation labels, places direct prequels before the root, and places recognized sequels, recaps, and side stories after it. It derives placements only along bounded compatible paths and orders ties deterministically using relation/depth priority, date when available, and subject ID. The result retains coverage, warnings, exclusions, and limitations. See `packages/bangumi-core/src/services/series-service.ts` (`SeriesWatchOrderOptions` at 38–44; limits at 272–279; `getSeriesWatchOrder` at 677 onward; placement at 564–625; watch-order assembly at 972–1023 and coverage construction below).

The read tool exposes this as a finite deterministic recommendation around a supplied root. It does not label that recommendation as a canonical or uniquely correct franchise order. Existing unit, render, and result-presentation tests cover calculation and projection behavior: `tests/unit/series-watch-order.test.ts`, `tests/render/series-watch-order-g09.test.ts`, and `tests/integration/mcp-result-presenter.test.ts`. This Candidate adds a focused unit regression asserting the explicit `bounded_recommendation` state and the two limitations that disclaim an official or unique order.

## Source limits

The official v0 `GET /v0/subjects/{subject_id}/subjects` operation returns an array of relation records. The declared record contains `id`, `type`, names, optional images, and a free-text `relation`; the schema does not declare a total, completeness marker, pagination, canonical order, or watch-order slot. The current server repository query filters relation rows by the requested source `SubjectID` and internally orders them, but that order is not part of the returned schema; this is directed relation evidence, not an exhaustive reverse lookup. The current service also does not classify anime TV versus Movie when assigning a before-root/after-root recommendation.

Therefore the capability can help a user navigate the visible, bounded relations around one chosen anime. It cannot prove an exhaustive franchise list, an official/canonical chronology, or that a specific theatrical film is mandatory or belongs between two TV entries. “No relation returned” is not evidence that no related work exists.

Primary sources: [official Bangumi v0 OpenAPI relation operation and schema](https://github.com/bangumi/server/blob/master/openapi/v0.yaml#L459-L489), [relation item fields](https://github.com/bangumi/server/blob/master/openapi/v0.yaml#L3260-L3286), and [server repository query](https://github.com/bangumi/server/blob/master/internal/subject/mysql_repository.go#L167-L186). These current upstream sources were read on 2026-10-16.

## Acceptance and next step

Keep OP-002 `PARTIAL`. The shipped implementation delivers the bounded recommendation described by the opportunity log; the broader “how should I watch this franchise?” question still needs a narrower user-visible scope and accepted current-source scenario evidence before a complete claim. The tool-level Agent/MCP cells for `get_series_watch_order` and `render_series_watch_order` remain unchecked. Their registered Run #95 R04 profiles are terminal `INCONCLUSIVE/no-report`; this source report adds no matrix credit and does not authorize a repeat.

Reopen or advance the frontier only when a distinct, supported, unspent profile is available for a bounded user journey, or when the source contract gains explicit canonical/completeness/order semantics. Keep public matrix 65/65, Agent/MCP 81/96, and QQ/TIM 0/96 unchanged.
