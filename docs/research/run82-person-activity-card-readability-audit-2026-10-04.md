# Run 82 independent Epoch audit: person-activity mobile card readability

- Audited base: `496f66b2578c0148842aeb648ad341c5d8b91ec6`
- Audit time: 2026-10-04T03:12Z
- Frontier hash: `b5f0d778f8b94a5bcc6aa94b47ae8efa4078c007927fe939424e1e753fa29162`
- Inventory: 121 records; 99 actionable.
- Master acceptance at base: direct execute 96/96; public evidence 65/65; Agent/MCP 93/96; real OAuth/account 33 pending; QQ/TIM 0/96.
- Run #82 PR #83 is separately parked for human input at 95/96 Agent/MCP and remains unmerged. This Epoch starts from master `496f66b`; it does not import PR #83 changes or claim its evidence as merged.

This is a bounded selection audit, not a frontier-exhaustion claim. The outer Run #82 is ACTIVE, and Harness explicitly permits an independent safe Epoch while PR #83 remains `PARKED_FOR_HUMAN`.

## Six discovery lanes

### 1. Recorded opportunities and deferred work

- `G04` and `OP-001` remain PARTIAL. Official-v0 relations plus bounded subject details support release-date observations, not complete career totals, actual workload, labor time, or historical person snapshots.
- `OP-003` / `SOURCE-COMMUNITY-STRUCTURED-WEB` remains closed to implementation until a safe, attributed, bounded source contract exists. No HTML or community content is needed for this Epoch.
- The parked SubjectOverview Agent/MCP gap is separate and remains on PR #83. It is not the reason to change the card.

### 2. Capability maturity and complete user journeys

The user question is “水濑祈最近半年是不是特别忙？” The shipped tool can return a bounded current-relation comparison with state, window, counts, exclusions, warnings, and source coverage. Its answer must continue to distinguish release-date observations from actual workload. This Epoch advances only the human-facing image hierarchy for `G04` / `OP-001`; source semantics and frontier statuses remain unchanged.

### 3. Agent UX, discoverability, and orchestration

No schema, tool description, Agent routing, or MCP result changes are proposed. The complete structured `PersonActivityResult` remains available to the Agent, including source operations, byte bounds, selection/omission counts, formulas, and warning detail. The goal is to keep implementation diagnostics out of the default image while the Agent can still use them when explaining evidence.

### 4. Renderer and Standalone information quality

At the audited source, `PersonActivityCard` displays four primary counts, then detailed relation/ID selection, detail request/success/failure, dropped IDs, concurrency, missing IDs, byte limits, origin-tag counters, source-operation paths and per-request counts. It also expands every row in the supplied view model; the tool permits up to 60 rows. These details are useful in structured evidence but crowd the mobile card and make a high-cardinality render tall. A previous isolated render measured 1920x2096 and called out internal resource numbers, formulas and endpoints as a presentation problem.

The adjacent G01 discovery card already localizes the experimental-source warning, estimated totals, candidate/page bounds and 12-row display cap; existing regression covers that work, so it is not repeated here.

### 5. Correctness, evidence, degraded states, and resource bounds

The existing service semantics are sound and remain frozen for this Epoch: partial aggregates stay labeled as observations; unavailable/not-computable values do not become zero; role and `subject.meta_tags` evidence remains raw; `not_observed` and `unknown` do not mean adaptation; release dates do not prove work dates or workload. A 12-row image cap must distinguish rows hidden only by the Renderer from rows omitted by the bounded service result. No data, coverage, formulas, or tool schema may be dropped from the structured result.

### 6. Architecture, maintenance, and testability

This is a focused Renderer-template/ViewModel presentation change with existing semantic and render seams. No new source provider, service abstraction, database, tool, or dependency is justified. Regression tests will cover partial, complete, unavailable/not-computable, comparison, high-row-count and narrow-width cases; the actual 360 CSS px / 2x artifact will be visually inspected.

## Selection and scope salvage

Selected `IMPLEMENTATION_READY`: improve the public `PersonActivityCard` mobile hierarchy and bound the amount expanded into a static image. Preserve a concise observed-coverage statement, the key result rows and raw relation/origin labels, while keeping low-level transport diagnostics in the structured result. Keep `G04` and `OP-001` PARTIAL because source completeness, workload, historical snapshots, Agent/MCP answer verification, and real-client display remain distinct.

### Why this work was not reviewed earlier

Earlier G04 work correctly repaired the data contract and labeled partial counts as observations. The current template still exposes low-level counters and request details directly in the image, and it expands the full view-model row list. This is an independent readability and output-bound issue discovered while checking the remaining offline reply-quality work for UX-001.

### Why the scope does not extend further

This Epoch does not change public API calls, calculations, tool schemas, Agent behavior, OAuth, authenticated data, writes, HTML/community access, or QQ/TIM client configuration. It does not change the 96-tool acceptance matrix or count PR #83 as merged.

## Acceptance boundaries

- Source revision and catalog are unchanged: BangumiAgentKit `496f66b2578c0148842aeb648ad341c5d8b91ec6`, catalog SHA-256 `26672c59d62f41910457fcee14f7925c615b17ff6ff658cac0e3ca053a02e08e`.
- Display at most 12 returned row details; distinguish eligible relations included in aggregates but absent from the bounded row-detail array from returned row details hidden by the image cap.
- The visual card should show the person, window, media, state, observed summary, concise coverage context, and readable row evidence. Remove endpoint paths, concurrency values, raw byte limits, and internal omission counters from the default image.
- Preserve the full structured result and all existing state/coverage calculations. Keep `G04` and `OP-001` PARTIAL.
- No real account/OAuth, QQ/TIM, upstream network probe, write, or destructive action is part of this work.

## Implementation and verification outcome

- Implemented in `packages/renderer/src/templates/PersonActivityCard.tsx`: a summary-first card, a 12-row image cap, concise relation/detail and origin coverage, and a date-only retrieval label. Endpoint paths, concurrency and byte limits, internal omission counters, and sample subject IDs no longer appear in the default image. Full `sourceOperations`, coverage, row evidence, and source timestamps remain in the structured ViewModel/result.
- Added regressions in `tests/render/person-activity.test.ts` for partial, complete, unavailable, not-computable, and comparison states; hidden transport details; retained structured operations; eligible relations without returned row details vs. returned details hidden by the Renderer; and the 360 CSS px / 2x height bound.
- Applied the two Sol High corrective findings: the card now says “未观察到原创标签”, and it distinguishes relations included in aggregates but lacking row details from returned details hidden by the image cap. Regressions cover manga-tagged not-observed rows and exact counts for both boundaries.
- A synthetic 22-row partial result rendered to 720x5680 (828598 bytes) after the wording corrections and was visually reviewed. The temporary preview was not committed. This is fixture-only visual evidence; no new live API, Agent/MCP, account, QQ, or TIM evidence is claimed.
- Validation passed after correcting the Sol findings: `pnpm build`; `pnpm typecheck`; `pnpm lint`; `pnpm test` (74 files / 473 tests); focused person-activity semantic/Standalone tests (2 files / 7 tests); focused Renderer tests (6 tests); `pnpm acceptance:check` (37 evidence tests, current 96-row table); `pnpm harness frontier:check` (121 records / 99 actionable, final ledger hash `eaffada8eee20d5765fe0d3b4f9b398e4118a8867d2fb928421f6f41d3fb1866`); `pnpm harness guard:legacy-paths --product-epoch`.
- Acceptance remains direct execute 96/96, public 65/65, Agent/MCP 93/96, real auth 33 pending, QQ/TIM 0/96. G04 and OP-001 remain PARTIAL. PR #83 remains separately parked for human input at 95/96 Agent/MCP.
