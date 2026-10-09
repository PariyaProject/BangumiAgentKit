# G10 discussion heat scope disposition — PARTIAL

**As of:** 2026-10-09. Official documentation review and local schema inspection only; no Bangumi runtime, community content, account, QQ, or TIM request was made.

## Official source contract

The current [Bangumi v0 OpenAPI](https://github.com/bangumi/server/blob/master/openapi/v0.yaml) describes `/v0/search/subjects` sorting as `match`, `heat`, `rank`, and `score`; it explicitly defines `heat` as 收藏人数. That supports ranking by current collection count, not by topic count, reply volume, or discussion activity.

Bangumi's [official developer documentation](https://github.com/bangumi/dev-docs/blob/master/README.md) classifies `/p1` as a private API built for the new-site frontend, using cookie-session authentication, still under development, without compatibility guarantees or cross-origin support. This Epoch does not use `/p1` or HTML community scraping.

No supported public subject-level discussion ranking contract was found in the official materials reviewed. The available collection sort cannot satisfy G10's “当前讨论热度最高的10部动画” question.

## Product clarification

The supported `bangumi.query_subjects` MCP description already states that `heat` means current collection count, not discussion heat or historical trend. This Epoch adds an MCP schema regression that keeps this meaning visible. The legacy `bangumi.search_subjects` keyword tool remains unchanged and is not treated as a discussion-ranking source.

This is a schema-regression and scope-disposition change only. No G10 live query or direct API evidence was produced, the generated catalog is unchanged, and no acceptance counts change. G10 remains **PARTIAL**; do not present collection heat or private `/p1` topic ranking as the requested discussion leaderboard. Reopen when Bangumi offers a supported public subject-level discussion source and its metric, time window, coverage, and pagination contract can be verified.
