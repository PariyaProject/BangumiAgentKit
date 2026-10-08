# Run #95 D05: current-season multi-tag heat discovery source contract

Observed: 2026-10-08. This is a source-contract note, not a live query result.

## Scenario

> 本季同时满足“校园”和“恋爱”标签的动画有哪些？按当前收藏人数排序。

D05 is the current-season anime discovery scenario in `docs/product/frontier-ledger.json`. Its bounded interpretation is an anime-only official search for both exact tag values, constrained to the current Bangumi calendar quarter, sorted by current collection count. A returned page is an observed result set, not a complete seasonal catalog.

## Official source contract

The official [`bangumi/api` v0 OpenAPI definition](https://github.com/bangumi/api/blob/master/open-api/v0.yaml) documents `POST /v0/search/subjects` as experimental and warns that both its schema and runtime behavior may change. The operation documents:

- `filter.type` as a set of subject types;
- repeated `filter.tag` values as an AND condition;
- `filter.air_date` date predicates as AND conditions;
- `sort=heat` as sorting by 收藏人数.

The source does not accept a relative value such as `season=current`; it accepts explicit air-date constraints. The product therefore resolves `current` locally at invocation time, converts the selected season to a half-open date interval, and sends only explicit `air_date` predicates. The current season is determined using the `Asia/Tokyo` calendar date, consistent with Bangumi's quarterly season naming: Jan–Mar winter, Apr–Jun spring, Jul–Sep summer, and Oct–Dec autumn.

For the verified clock instant `2026-10-08` in Tokyo, the resolved label is `2026-autumn`, with the source filter `>=2026-10-01` and `<2027-01-01`. This does not imply the source has returned every anime that satisfies those conditions.

## Product boundary

- Both tags are exact requested facets. No synonym, concept, or tag-family expansion is implied.
- `heat` means current collection count, not recent discussion, change over time, or historical popularity.
- Search remains experimental and the result's total kind remains estimated. Product coverage, page/candidate budgets, output caps, unresolved hydration, and text projection omissions remain visible.
- A matching returned row can support a positive statement about that row and this query. A missing/unreturned row does not prove the title lacks a tag or is absent from the season.
- Account/OAuth, community pages, QQ, and TIM are outside this anonymous read-only scenario.

## Verification plan

Offline tests must pin Tokyo quarter boundaries (including winter year rollover), preserve explicit `YYYY-season`, and assert the exact anime/type, two-tag AND, half-open air-date, heat sort, and descending order in the official-v0 request. MCP and Renderer output must surface the resolved season/date range, heat meaning, experimental-source caveat, and bounded/estimated coverage. Any post-review live attempt must be a single exact-Candidate anonymous `bangumi.query_subjects` call with sanitized answer/result counters; an inconclusive attempt is consumed and is not retried.
