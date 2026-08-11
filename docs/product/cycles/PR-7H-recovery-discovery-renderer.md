# PR-7H Recovery — Evidence-Bearing Subject Discovery Presentation

Status: `REVIEW_AUTHORIZED`

This is exactly one execute-only Product Review Epoch. It reconstructs the
meaningful PR-7H product capability on current `master`; it does not reopen or
reuse the historical PR-7H runtime state.

## Recovery provenance

- Recovery Base: `be89a2699ed7ccc85cf2e23718319bc57e1e16b6`
- Historical source branch (read-only): `codex/pr-7h-discovery-renderer`
- Historical source tip (read-only): `3ea9ae6521d5cbf35cf955d5f65fe7d950970ebf`
- Historical initial Candidate: `8dd069a0e700161d5a484af378b0ec9eb10e395c`
- Historical corrected Candidate: `3f46a97010fff829ab6cfec132bae07359b34e2c`
- Historical PR: `#3`; it is source material only and will be closed as
  `SUPERSEDED` after successful recovery integration.

The historical implementation and Sol #1 corrective findings are consulted
for meaningful product behavior and tests. Historical governance, outer-goal
ledger, reviewer waits, Candidate/readiness state, and persisted `RUNNING`
state are not imported.

## Epoch objective

Make the existing bounded `bangumi.query_subjects` capability useful to both an
Agent and a human reader in one handoff: preserve its controlled query intent,
result facts, plan classification, evidence boundary, coverage, warnings, and
limitations in a mobile-readable renderer card and expose that path through a
read-only presentation tool.

## Representative user and Agent questions

1. 今年七月有哪些后宫动画？
2. 2024 年最热门的异世界动画有哪些？
3. 评分 8 分以上且评分人数超过 5000 的原创动画有哪些？
4. 结果是完整枚举、估计总数，还是受预算限制的部分样本？
5. 哪些条件由官方搜索接口直接支持，哪些是本地验证或派生条件？
6. 为什么某个结果的评分、标签或排名显示为未知？
7. Agent 能否把结构化查询结果交给人类而不丢失证据与限制？

## Work Packages

1. **Evidence-bearing ViewModel** — map the existing discovery result and
   validated query into bounded criteria, item facts, plan/evidence, coverage,
   warning, limitation, and state sections without changing query semantics.
2. **Discovery Results Renderer** — add and register the `discovery-results`
   card with deterministic item/export caps, safe image handling, explicit
   unknowns, and complete/partial/unsupported/unavailable/empty states.
3. **Agent presentation path** — add `bangumi.render_query_subjects`, reusing
   the existing query schema, engine, and ProviderRegistry seam with compact
   explanation by default and explicit `explain: "none"` support.
4. **Product surface verification** — update generated catalog/renderer/tool
   documentation and focused discovery, renderer, and tool tests, including
   corrected semantics and current-master compatibility.

## Scope

In scope:

- the evidence-bearing `discovery-results` renderer ViewModel and card;
- bounded criteria/filter/warning/limitation presentation;
- matched/observed/returned/rendered distinctions and truthful coverage;
- plan classification, evidence source/operation labels, and total semantics;
- complete, partial, unsupported, unavailable, upstream-error, and empty states;
- deterministic exported-item cap semantics (12 maximum) and existing renderer
  security/resource ceilings;
- `bangumi.render_query_subjects`, registration, catalog visibility, docs, and
  focused tests;
- compatibility fixes required by current `master`.

## Explicit non-scope

- discovery query semantics, provider/source policy, or source expansion;
- Structured Web / HTML policy, authentication, authorization, credentials,
  cookies, writes, persistence, migrations, releases, packages, or tags;
- unbounded result pagination, aggressive crawling, new trend claims, or a
  completeness claim beyond the engine coverage contract;
- PR-7G watch-order functionality or any unrelated backlog opportunity;
- changes to frozen foundational contracts unless a genuine blocker requires a
  separately recorded human/governance escalation;
- modifying, merging, rebasing, rewriting, deleting, or importing historical
  PR-7H branch governance state.

## Semantic and rendering contract

The renderer consumes the existing semantic result without rewriting it. It
must:

- preserve matched, observed, returned, and rendered candidate distinctions;
- preserve `ok`, `partial`, `unsupported`, `unavailable`, `upstream_error`, and
  `not_computable` distinctions where present;
- show exact versus estimated totals and bounded coverage reasons;
- classify pushdown, post-filter, and derived criteria without claiming all
  criteria were handled upstream;
- render only controlled human-readable source/operation labels from evidence;
- cap criteria groups and values deterministically, disclose omitted criteria,
  and cap rendered/exported items at 12;
- keep missing score, rank, date, image, and collection values unknown/absent,
  never fabricated.

## Agent UX, resource, and security bounds

`bangumi.render_query_subjects` reuses the model-facing bounded query schema,
requires no authentication, is read-only, and returns an `ArtifactRef`. The
existing `DiscoveryEngine` and public official ProviderRegistry remain the only
semantic/data seams. No new network call, budget field, credential path, or
write authority is introduced. At most 12 result images reach the existing
SSRF-constrained asset resolver; existing timeout, output, concurrency, and
asset limits remain authoritative. Raw evidence URLs, untrusted markup, secret
fields, and internal budget controls are not rendered or exposed.

## Acceptance criteria

- An Agent can discover and call `bangumi.render_query_subjects` with the same
  filters as `bangumi.query_subjects` and receive a valid artifact reference.
- The ViewModel/card shows criteria, result facts, plan classification,
  evidence source/operation, coverage, warnings, limitations, and state for
  complete, partial, empty, unsupported, and unavailable fixtures.
- The card truthfully distinguishes matched/observed/returned/rendered values,
  estimated/exact totals, output caps, and bounded limitations.
- The card remains readable at 640px and 960px with long CJK names, missing
  images/numeric fields, dense results, maximum valid criteria, and degraded
  states.
- Existing legacy search, discovery, provider, renderer, MCP, standalone, and
  contract behavior remains compatible.
- Focused tests, affected/full required validation, generated catalog checks,
  and exact-SHA mandatory remote CI pass before review.
- Luna completes a consolidated Base..Candidate self-review with no known
  in-scope P0/P1 blocker before the first Sol launch.

## Validation and visual QA plan

- During implementation: focused discovery, renderer, tool, type/build, and
  regression tests.
- Before review: `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm test:contract`, `pnpm test:semantic`, `pnpm test:provider`,
  `pnpm test:discovery`, `pnpm test:standalone`,
  `pnpm test:integration:sqlite`, `pnpm test:render`, and
  `pnpm openapi:verify`, plus focused PR-7H tests as appropriate for current
  scripts.
- Generate and inspect deterministic representative PNGs at 640px and 960px
  for complete, partial, unsupported, unavailable, empty, long-CJK, maximum
  bounded input, missing/limited information, and missing-image cases.
- Perform user QA, Agent/tool QA, renderer QA, `git diff --check`, and a
  consolidated Base..Candidate self-review.

## Review Boundary Rationale

- Why these Work Packages belong together: they complete one vertical journey
  from the existing semantic discovery query to an evidence-bearing human
  presentation and its Agent-facing presentation tool. The ViewModel, card,
  registration, catalog, docs, and focused tests are tightly coupled contract
  surfaces of that same capability.
- User / Agent journey completed: an Agent asks a bounded discovery question,
  receives structured results, and hands the same evidence/coverage-aware
  answer to a human as a readable artifact without a second query language.
- Related work intentionally included: current-master compatibility fixes,
  generated catalog visibility, state/coverage tests, and representative
  renderer QA are required for the journey to be trustworthy and discoverable.
- Adjacent work intentionally deferred: query/provider semantics, source-policy
  expansion, PR-7G watch order, persistence, personal/authenticated features,
  and unrelated renderer/product opportunities remain out of scope.
- Why reviewing now has higher value than reviewing earlier: the capability is
  only meaningful as a complete ViewModel-to-tool-to-card system; earlier
  review would duplicate work across coupled contracts and could not validate
  truthful evidence or degraded-state presentation.
- Why extending further would reduce coherence or reviewability: additional
  discovery semantics, sources, or unrelated renderer cards would create
  separate product domains and dilute review of this bounded presentation
  contract.

## Review Economics

- Review Tier: `TIER_2`
- Expected Sol: `1`
- Automatic Maximum: `2`
- Outer Remaining Sol: `N/A` (execute-only; no outer self-evolution ledger)
- Generic Subagents: `0`
- Reviewer order: Sol #1 `sol_milestone_reviewer`; if and only if Sol #1 is
  `CORRECTIVE_REQUIRED`, Luna may correct and launch the same comprehensive
  reviewer as Sol #2. Sol #3 is prohibited.
- Reviewer overall wall-clock limit: 120 minutes from each launch.

## Integration and freeze contract

- Integration Policy: `AUTO_MERGE_AFTER_FREEZE`
- Target Base Branch: `master`
- Recorded Base SHA: `be89a2699ed7ccc85cf2e23718319bc57e1e16b6`
- Feature Branch: `codex/recovery-pr-7h-discovery-renderer`
- Pull Request: `#4 — https://github.com/PariyaProject/BangumiAgentKit/pull/4`
- Merge Strategy: `MERGE_COMMIT`
- Branch Cleanup Policy: after verified merge and frozen-SHA ancestry, retire
  local/remote feature branches safely, synchronize local `master` with
  `origin/master`, and preserve historical PR-3 branch/history as evidence.
- Freeze gate: exact final Candidate, clean tree, required local validation,
  exact-SHA mandatory CI, complete QA/self-review, recorded TIER_2 review PASS,
  no unresolved P0/P1 blocker, and no protected decision.
- Stop: `MERGED_GOAL_COMPLETE`, `FROZEN_GOAL_COMPLETE` only if integration is
  safely inapplicable/blocked under the recorded policy, or a genuine
  documented blocker. Do not begin PR-7G recovery.

## Sol #1 review result

- Review report:
  `docs/product/reviews/PR-7H-recovery-discovery-renderer/milestone-review.md`
- Reviewer: `sol_milestone_reviewer`, launch ordinal `Sol #1`
- Verdict: `CORRECTIVE_REQUIRED` (0 P0, 2 P1)
- P1 blockers: enforce the 12-item/12-image ceiling at the trusted renderer
  boundary; separate plan-only operations from evidence-backed provenance and
  test genuine unsupported/unavailable engine outputs.
- Budget transition: `2 authorized / 1 consumed / 1 remaining`
- Sol #2: reserved for the same reviewer only after all corrections, a new
  exact Candidate, and exact-SHA mandatory CI.

## Corrected Candidate and Sol #2 readiness

- Corrected Candidate SHA: `de09c0ec3b0eab3325168ec7177b835dd25e9651`
- Corrected Candidate commit: `fix(renderer): close PR-7H review blockers`
- Corrected exact-SHA CI: `PASS — run 31496325070; all six mandatory jobs
green`
- Corrective validation: `pnpm build`, `pnpm typecheck`, `pnpm lint`, full
  `pnpm test` (33 files / 188 tests), render (6 files / 51 tests), discovery
  (9 files / 51 tests), contract (22), semantic (31), provider (33), SQLite
  integration (12 files / 33 tests), standalone (3 files / 18 tests), and
  `pnpm openapi:verify` passed.
- Corrective QA: the trusted renderer boundary caps caller-created
  discovery-results ViewModels and image resolution at 12; genuine
  unsupported/unavailable `DiscoveryEngine` results now expose zero evidence
  operations; negative and end-to-end tests pass; realistic degraded fixtures
  were regenerated and inspected at 640/960.
- Sol #2 authorization: the same `sol_milestone_reviewer`, launch ordinal
  `Sol #2 of 2`, is authorized against this exact corrected Candidate.
- Budget transition: `2 authorized / 1 consumed / 1 remaining`; Sol #3 is
  prohibited.

## Current execution state

- Current state: `REVIEW_AUTHORIZED`
- Candidate SHA: `de09c0ec3b0eab3325168ec7177b835dd25e9651`
- Exact-SHA CI: `PASS — run 31496325070; all six mandatory jobs green`
- Implementation Frozen SHA: `N/A`
- Governance Record SHA: `N/A`
- Merge Commit SHA: `N/A`
- Next action: launch Sol #2 `sol_milestone_reviewer` against the corrected
  Candidate; do not mutate the implementation while it is running.
