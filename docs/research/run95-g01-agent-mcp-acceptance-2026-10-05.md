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

## Scope and outcome

The selected claim is limited to rows visible in one current official-v0 query. Candidate A `c0e493fdba15784cf44410318f6dcb017917275c` passed exact-SHA CI run 37273268463 (7/7) and Harness `candidate:check` against base `4c0e08bd488484f4443aefbea36a4219ef1ad2f4`. Three isolated image layers carried the exact Candidate revision; the Agent image ran Antigravity CLI 1.2.14. The catalog lock contained 96 tools and the QA profile exposed only the public-read `bangumi.query_subjects` tool with the exact `G01_QUERY_ARGUMENTS`.

Exactly one Agent/MCP invocation completed successfully. It made one allowed Bangumi tool call with matching arguments, returned 14 visible rows in a 3,523-byte text projection, omitted zero rows, and reported an estimated total plus the experimental-source warning. The v4 checker matched all 14 answer rows to the visible source rows in order with no missing, mismatched, unmatched, or duplicate rows. It rejected answer acceptance because `nonExhaustiveDisclosurePresent` was false and `unsupportedScopeClausesCount` was 4. Exact tag, month, anime, bounded coverage, experimental-source, and estimated-total disclosure flags were present. The event stream did not expose a separate structuredContent field.

The sanitized report is `docs/research/run95-g01-agent-mcp-canary-2026-10-05.json`. It stores identities only for the Candidate/catalog/images, not returned items; it contains no prompt, answer text, or raw MCP result. Because the raw answer was intentionally not retained, the flags cannot distinguish a missing user-facing caveat from a checker parsing mismatch. This call was not retried. G01 remains `PARTIAL`; the failed answer and estimated total do not support a complete-list claim.

## Remaining scope

This Epoch records the bounded Agent/MCP outcome and its truthful failure state. QQ/TIM display, authentication, personal collection data, community HTML, private APIs, and broader source coverage remain outside scope with separate evidence requirements. Continue with another independent actionable frontier after integrating this record; do not retry the Run #95 G01 query.
