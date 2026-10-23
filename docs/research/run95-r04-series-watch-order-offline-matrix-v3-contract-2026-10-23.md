# R04 v3 bounded multi-node offline matrix contract

- Checked: 2026-10-23
- Profile: `r04-series-watch-order-offline-agent-mcp-v3`
- Scope: one anonymous, synthetic Agent/MCP execution of `bangumi.get_series_watch_order`
- Frontier boundary: R04 remains `UNASSESSED`.

## Why this is a distinct matrix check

The earlier R04 Agent/MCP profiles v1 and v2 used one root and at most one selected relation node. Their claims are terminal `INCONCLUSIVE` with no report and no retry. This v3 profile checks the distinct bounded multi-node path with a synthetic root `991404`, direct prequel `991405`, and direct sequel `991406`, using `depth=1`, `maxNodes=2`, and `media=anime`.

The fixture provides exactly six local GET operations: the root detail and relation list, each selected child’s relation list, and each selected child’s detail. It allows no other origin or path, method, request body, authorization header, duplicate operation, or network fallback. The expected bounded summary is prequel, root, sequel, with two observed relation rows and three relation-list reads.

## Evidence limit

These identifiers and relation rows are synthetic. The result verifies one exact registered profile, its bounded service behavior, and the closed local fixture. It does not establish that any real Bangumi relation exists, that a theatrical film is mandatory, that the visible relation set is complete, or that the suggested order is canonical.

The official relation operation and item schema expose relation data but no pagination, completeness marker, canonical watch-order field, or response-order contract. The [OpenAPI operation](https://github.com/bangumi/server/blob/master/openapi/v0.yaml#L459-L489), [relation item schema](https://github.com/bangumi/server/blob/master/openapi/v0.yaml#L3260-L3286), and [handler mapping](https://github.com/bangumi/server/blob/master/web/handler/subject/related_subjects.go#L34-L63) support that limit. The existing R04 source-contract assessment contains the fuller field-by-field analysis in the PariyaAgent workspace at `docs/research/run95-r04-theatrical-film-tv-watch-order-source-contract-2026-10-14.md`. The tool itself returns a bounded deterministic recommendation, not a proof of franchise completeness or a uniquely correct order. This synthetic profile cannot establish canonical order or completeness.

## Acceptance boundary

A valid signed report may credit only the `bangumi.get_series_watch_order` Agent/MCP matrix cell. It must bind the exact profile, six fixture operations, source revision, Base, seven required exact-SHA checks, assigned Luna Max reviewer, built bundle, and privacy counters. It must preserve `scenarioId: null` and leave R04 `UNASSESSED`.

No live Bangumi API or HTML, OAuth/account, community, write, QQ, or TIM path is part of this profile. No prior terminal profile is retried.
