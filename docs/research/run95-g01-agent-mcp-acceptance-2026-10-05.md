# Run 95 — G01 current-source Agent/MCP v4 acceptance

- Selection base: `4c0e08bd488484f4443aefbea36a4219ef1ad2f4`
- Frontier hash at selection: `256c018a810f03c8e302c2778d8e057c3be1bf75a135b4e49e1f4fb5ef53fdf2`
- Selected frontier: G01, `PARTIAL`
- Selected Epoch: `g01-v4-current-agent-answer`

## Six-lane discovery

1. **Recorded opportunities and deferred work.** G01 is the first actionable scenario in the current ledger. OP-003 and `SOURCE-COMMUNITY-STRUCTURED-WEB` remain `RESEARCH_READY` and require a separate capability-specific source contract before product requests. OP-012 remains `PARTIAL`; authentication and personal-collection work remains externally gated. The selected query does not consume those source or account paths.
2. **Capability maturity and user journeys.** G01 asks which anime were returned for July 2026 under Bangumi's exact `后宫` tag. `bangumi.query_subjects` already supports the typed query and the Renderer has a bounded discovery card. An earlier Candidate A returned a 14-row observation, but the total is estimated and cannot establish an exhaustive catalog.
3. **Agent UX and orchestration.** The 96/96 catalog/Agent-MCP matrix proves tool availability, not that the Agent submits the exact query or faithfully reports every visible row, ID, date, order, and limitation. The prior G01 checker-v2 pass is superseded by findings R93-01 through R93-04. Current master contains checker v4 and synthetic regressions; the historical raw answer/result is unavailable for reassessment.
4. **Renderer and Standalone.** Existing `DiscoveryResultsCard` and mobile browser fixtures cover 320, 360, and 520 CSS px and explain bounded results and estimated totals. This Epoch changes no Renderer or Standalone behavior and does not repeat that visual work.
5. **Correctness, evidence, and resources.** Official-v0 search is experimental and returns estimated totals. The checker binds the exact anime/year/month/tag query to `searchSubjects`, checks every visible row in source order against the MCP result, validates any explicit count, and rejects unsupported completeness or absence claims. If MCP text omits rows, the answer must state the exact omitted count and that omission is not evidence of absence. One current bounded result cannot prove all-site coverage.
6. **Architecture, maintenance, and testability.** The current checker v4 and its false-positive regressions already exist on master. The remaining increment is exact-Candidate answer evidence plus durable sanitized reporting and a regression that labels Candidate A's v2 result historical; no provider, endpoint, source policy, tool schema, or Renderer change is needed.

## Scope and run plan

The selected claim is limited to the rows visible in one current official-v0 query. After this Candidate passes exact-SHA CI and Harness gates, one read-only Antigravity CLI 1.2.14 invocation will expose only `bangumi.query_subjects`, using the exact `G01_QUERY_ARGUMENTS`. Checker v4 will validate the Agent answer against the returned MCP text and result. Only Candidate/catalog/image/CLI identities, text bytes, call counts, result state, and checker counters/flags are retained; no prompt, answer, item identities, or raw MCP result is saved. The call will not be retried if v4 rejects the answer.

G01 remains `PARTIAL` regardless of a passing single answer because search totals are estimates. QQ/TIM display, authentication, personal collection data, community HTML, private APIs, and broader source coverage remain outside scope.
