# G11 and G21 — public discussion-source boundary

**As of:** 2026-10-09. This is a source-contract review only. No Bangumi runtime, topic, reply, community, account, OAuth, QQ, or TIM request was made.

## Questions

- **G11:** Which anime have the fastest discussion growth over the past seven days?
- **G21:** For one anime, how many discussion topics and replies were added in the last week?

Neither question is currently computable from the supported public v0 contract reviewed here. G11 needs subject-level comparable activity measurements across at least two windows (or an explicit growth value); a current hot-topic list is not growth. G21 needs a defined seven-day window and complete subject-linked topic creation data plus per-reply timestamps, or comparable snapshots under a stable counting contract. A topic's cumulative `replyCount` or last-activity timestamp does not reveal how many replies were added during the week.

## Official public-source boundary

The current [Bangumi server v0 OpenAPI](https://github.com/bangumi/server/blob/master/openapi/v0.yaml) contains public subject search/detail and relation operations, but no subject-topic, comment, reply, or discussion-history operation or response contract. A search of the current specification found no `topic`, `comment`, or `reply` field/route. Its subject search `heat` sort means collection count; that value cannot stand in for discussion activity. The existing [G10 source-contract report](./run95-g10-discussion-heat-contract-2026-10-09.md) records the collection-count distinction and the limitations of that sort.

Bangumi's [official developer documentation](https://github.com/bangumi/dev-docs/blob/master/README.md#L223-L245) distinguishes the supported public API from `/p1`, describing `/p1` as a private API for the new-site frontend that uses cookie sessions, remains in development, has no compatibility guarantee, and does not support cross-origin access. The private route schemas and any implementation details do not grant third-party authorization, a public compatibility contract, or accepted coverage. This review made no `/p1` or HTML request.

The 96-tool `docs/tool-catalog.json` contains no tool whose name or description exposes subject discussion topics, replies, or discussion history. This catalog scan is descriptive only; it is not runtime evidence and does not turn episode-level discussion metadata or subject collection counts into a subject-level discussion metric.

## Disposition

G11 and G21 move from **UNASSESSED** to **PARTIAL** to record this bounded source audit. This does not mean either user question is answered, and it adds no public API, Agent/MCP, QQ, or TIM evidence. Do not report discussion rankings, weekly topic totals, weekly reply totals, or inferred growth. Keep both non-computable under the reviewed supported sources.

Reopen only when Bangumi provides a supported third-party public source and a verifiable contract for subject mapping, activity timestamps/window boundaries, counting semantics, pagination/completeness, and any historical retention needed for growth. Until then, keep private `/p1`, community HTML, and historical scraping out of product execution.
