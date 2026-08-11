# PR-7H Evidence-Bearing Subject Discovery Presentation

Status: `REVIEW_READY_FOR_SOL_2`

This is one bounded milestone inside the active
`AUTONOMOUS_EVOLUTION_TIER2` outer Goal. Completion, parking, or review-budget
exhaustion for this milestone returns the outer Goal to discovery; it does not
complete the outer Goal.

## Objective

Make the existing bounded `bangumi.query_subjects` capability useful to both an
Agent and a human reader in one handoff: preserve its controlled query intent,
result facts, plan classification, evidence boundary, coverage, warnings, and
limitations in a mobile-readable renderer card and expose that path through a
read-only presentation tool.

## Product gap and evidence

The repository already has a deterministic `DiscoveryEngine` and the semantic
tool `bangumi.query_subjects`. Its input supports media, category, date, tag,
meta-tag, exact concept, rating, rating-count, rank, collection-count, NSFW,
sort, result mode, limit, and explain controls. The engine returns a compiled
official-v0 plan, bounded pagination and hydration coverage, warnings,
field-level evidence, and optional explanation.

The renderer currently exposes only the legacy keyword `search-list` card and
`bangumi.render_search`. That path cannot present advanced query conditions,
pushdown versus local filtering, estimated totals, hydration uncertainty,
partial/unsupported state, or the evidence boundary. This milestone therefore
integrates an existing semantic capability with a truthful human-facing output;
it does not expand the provider or query contract.

## Representative questions

1. 今年七月有哪些后宫动画？
2. 2024 年最热门的异世界动画有哪些？
3. 评分 8 分以上且评分人数超过 5000 的原创动画有哪些？
4. 结果是完整枚举、估计总数，还是受预算限制的部分样本？
5. 哪些条件由官方搜索接口直接支持，哪些是本地验证或派生条件？
6. 为什么某个结果的评分、标签或排名显示为未知？
7. Agent 能否把结构化查询结果交给人类而不丢失证据与限制？

## Scope

In scope:

- Renderer view model/template `discovery-results`, built from the existing
  `DiscoveryResult` plus the validated query input.
- A controlled query summary with bounded criteria labels; no raw untrusted
  markup or evidence URLs are rendered.
- A bounded result grid/list showing display name, media/category, date,
  score, rank, rating count, collection total, and safe image fallback when
  those fields are present. Missing values remain explicit unknowns.
- Plan transparency: official-v0 operation, pushdown filters, post-filters,
  derived filters, plan quality, and the engine's own limitations.
- Coverage transparency: scanned/matched/returned counts, pages, hydration
  counts, total semantics, output/budget truncation, and upstream exhaustion.
- Warning and state presentation for `partial`, `unsupported`, `unavailable`,
  and upstream failure results, including empty-result states.
- New read-only presentation tool `bangumi.render_query_subjects`, reusing the
  existing discovery input schema and `ProviderRegistry` seam. It requests
  compact explanation by default for the card, while honoring explicit
  `explain: "none"`.
- Tool catalog generation, MCP/registry visibility, focused renderer/tool
  contract tests, and representative 640px/960px visual QA.

Explicitly out of scope:

- changing `DiscoveryEngine` query semantics, provider mappings, source policy,
  pagination, hydration budgets, or concept vocabulary;
- adding HTML, Structured Web, community, snapshot, authentication, OAuth,
  credentials, personal data, write authority, database migrations, release,
  package, or tag publication;
- adding unbounded result pagination, new persistence, trend claims, or a
  completeness claim beyond the engine's coverage contract;
- reopening or modifying parked PR-7G watch-order implementation;
- changing the legacy `bangumi.search_subjects` or `bangumi.render_search`
  compatibility contracts.

## Semantic and rendering contract

The renderer consumes the engine result without rewriting its state. It must:

- preserve `ok`, `partial`, `unsupported`, `unavailable`, `upstream_error`, and
  `not_computable` distinctions in the view model;
- show `estimated` versus `exact` total semantics and the engine's bounded
  coverage reason when available;
- show plan filters by classification, not claim every condition was pushed to
  the upstream API;
- display only derived human-readable source labels and operation names from
  evidence, never trust evidence as HTML, and never expose secret fields;
- cap rendered items deterministically (12 maximum) and state how many are
  hidden; the tool remains bounded by the existing discovery engine and
  renderer asset limits;
- keep unknown/absent score, rank, date, image, and collection values visible
  as unknown or omitted rather than fabricated.

## Agent UX

`bangumi.render_query_subjects` uses the same model-facing bounded criteria as
`bangumi.query_subjects`, so an Agent does not learn a second query language.
It is read-only, requires no authentication, and returns an `ArtifactRef` for
the image. The rendered card carries enough context to explain what the Agent
asked, what the engine observed, and what remains uncertain; structured
`bangumi.query_subjects` remains the machine-facing path.

## Resource and security bounds

- No new network call is introduced beyond the existing `DiscoveryEngine` call
  and its documented provider/page/hydration budgets.
- No raw budget fields are added to the model-facing schema; engine defaults
  remain authoritative.
- At most 12 result images are exposed to the existing SSRF-constrained asset
  resolver; renderer timeout, output, and concurrency bounds remain in force.
- The new tool is `auth: none`, `risk: read`, and uses only the public official
  provider registry. No credentials, cookies, principal data, or writes are
  consulted.

## Acceptance criteria

- An Agent can discover and call `bangumi.render_query_subjects` with the same
  filters as `bangumi.query_subjects` and receive a valid artifact reference.
- The view model and card show criteria, result facts, plan classification,
  evidence source/operation, coverage, warnings, limitations, and state for
  complete, partial, empty, unsupported, and unavailable fixtures.
- The card remains readable at 640px and 960px with long CJK names, missing
  images, missing numeric fields, dense results, and partial coverage.
- The card never claims estimated or budget-bounded discovery is complete and
  never turns missing values into certainty.
- Existing legacy search, provider, discovery, contract, MCP, Standalone, and
  renderer behavior remains compatible.
- Focused tests plus the repository validation suites and generated catalog
  verification pass before review readiness.
- A clean exact Candidate receives mandatory remote CI before any Sol launch.
- The milestone uses the explicit self-evolution TIER_2 review budget: at most
  two sequential `sol_milestone_reviewer` launches, no generic subagents, and
  no third launch. A final blocking result parks PR-7H and returns the outer
  Goal to discovery.

## Validation and QA plan

1. Unit-test the builder's state mapping, bounded item cap, query labels,
   filter classifications, evidence-source derivation, unknown fields, and
   warning/coverage summaries.
2. Test the new tool's schema/metadata, shared schema parity, provider-registry
   requirement, compact explanation default, explicit `explain: "none"`, and
   read-only/no-auth classification with injected fixtures.
3. Test template registration, safe HTML rendering, no raw evidence markup,
   and PNG output at 640px and 960px for complete/partial/unsupported/
   unavailable/empty/long-CJK cases.
4. Run focused tests, then `pnpm build`, `pnpm typecheck`, `pnpm lint`,
   `pnpm test`, contract/semantic/provider/discovery/standalone/integration
   suites, `pnpm test:render`, and `pnpm openapi:verify` as appropriate for the
   final Candidate. Record exact results in the review-readiness artifact.
5. Inspect representative PNGs for information density, Chinese typography,
   mobile readability, missing-image fallback, and partial-state legibility.

## Review and integration ledger

- Review tier: `TIER_2` (selected by the explicit self-evolution profile).
- Milestone Sol budget: `2 authorized / 1 consumed` at selection; sequential
  comprehensive `sol_milestone_reviewer`; no third launch.
- Generic subagents: `0 authorized / 0 consumed`.
- Outer Sol budget at selection: `4 authorized / 3 consumed`; `1 remaining`.
- Feature branch: `codex/pr-7h-discovery-renderer`.
- Target base: `master` at recorded Base SHA
  `23f960ce3a8a8ac3841b791061a648037a53ab19`.
- Pull Request: `#3 — https://github.com/PariyaProject/BangumiAgentKit/pull/3`.
- Integration policy: `AUTO_MERGE_AFTER_FREEZE`.
- Merge strategy: `MERGE_COMMIT` by default.
- Branch cleanup: retire local/remote feature branch only after verified
  frozen-SHA ancestry and synchronized `master`.
- Previous Candidate SHA: `8dd069a0e700161d5a484af378b0ec9eb10e395c`.
- Corrected Candidate SHA: `3f46a97010fff829ab6cfec132bae07359b34e2c`.
- Exact CI: run `31486111752`, all six mandatory jobs green on the exact
  corrected Candidate.
- Readiness record: `docs/product/reviews/PR-7H/review-readiness.md`.
- Sol #1 reviewer: `019ff073-7b21-79b3-ae85-6e10676edb96` (`Russell`),
  `CORRECTIVE_REQUIRED`; record:
  `docs/product/reviews/PR-7H/sol-1-corrective.md`.
- Freeze SHA and merge SHA: `N/A` until those gates are reached.

## Verifiable stopping condition

This Cycle Plan stops at a truthful inner state such as `FROZEN`,
`CORRECTED_AWAITING_REVIEW_AUTHORIZATION`, `PARKED_REVIEW_LIMIT`,
`PARKED_FOR_HUMAN`, or an integration blocker. The outer Goal must persist the
checkpoint and resume discovery; no PR-7H terminal state completes the outer
Goal.
