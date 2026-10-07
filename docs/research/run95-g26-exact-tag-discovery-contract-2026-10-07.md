# Run #95 G26 exact-tag discovery contract

**Date:** 2026-10-07

**Source revision reviewed:** `26a8cd23d9ebb0b7c06282da86c2ee88c6d043d6`

**Scenario:** “找出 2019–2024 年评分人数超过 1 万的女性向 TV 动画。”

## Status and operational meaning

G26 remains **UNASSESSED** until a current-candidate Agent/MCP query has readable answer evidence. This change defines one deliberately narrow search operation: exact Bangumi public `tag=女性向`. That literal tag is the operation’s query boundary; it is not an official audience classification and cannot support a complete list of works aimed at women.

The user request compiles to `media=anime`, air date `[2019-01-01, 2025-01-01)`, `ratingCount >= 10001`, `tags=["女性向"]`, and a local TV platform post-filter. It uses `resultMode=all` and returns at most 100 rows. No `metaTags` substitution, synonym expansion, or second query is in scope.

## Official source limits

Bangumi marks `POST /v0/search/subjects` experimental. Its operation description explicitly lists `type`, `tag`, `air_date`, `rating`, `rating_count`, `rank`, and `nsfw`; the `meta_tags` request property exists in the schema but is not in that explicit supported-filter list. This scenario therefore uses the documented literal `tag` field and does not rely on `meta_tags` behavior. [Official search schema](https://github.com/bangumi/server/blob/master/openapi/v0.yaml#L22-L138)

The official source has no female-audience ontology. TV is checked locally from the subject platform field, not as a subject-search filter. Rating-count comparisons use an integer lower bound of 10001 to represent “more than 10,000.” [Official Subject schema](https://github.com/bangumi/server/blob/master/openapi/components/subject_v0.yaml#L485-L771)

Search totals are estimated. The query is bounded to 10 pages, 500 candidates, 120 shared detail hydrations, and 100 output rows. The engine hydrates only when candidate fields are missing; unresolved candidates, exhausted budgets, or output clipping must remain visible as partial coverage. A complete attempt over the observed search result set is not proof of database-wide completeness.

## Acceptance procedure

The one-shot public Agent/MCP call runs only after exact-candidate CI and Harness gates pass. The answer must list only rows read back from the result, disclose the exact-tag operation, TV/date/rating filters, experimental source, estimated total, observed coverage, and that the tag does not define all female-audience works. The sanitized report stores counters and hashes only; it omits the raw prompt, answer, row names, and source payload.

If the MCP event, text projection, or structured result cannot be read back consistently, G26 stays UNASSESSED and the query is not repeated. If every gate passes, G26 becomes PARTIAL with measured counts and observed limitations; it never becomes exhaustive or DELIVERED from this scenario.
