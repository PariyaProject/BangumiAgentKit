# PR-7G Recovery — Series / Watch-Order Intelligence

Status: `PARKED_REVIEW_LIMIT`

This is exactly one fresh execute-only Product Review Epoch on the current
post-PR-7H master. The historical PR-7G branch and reports are read-only source
material; no historical runtime or governance state is imported.

## Recovery provenance and current base

- Current Recovery Base: `5e7d4ace51a1aa1657a36d78f2c1a54915a4e05e`
- Base verification: `HEAD == master == origin/master`; clean tree before the
  branch was created.
- Historical source branch (read-only): `codex/pr-7g-series-watch-order`
- Historical source tip (read-only):
  `15c08455731ac1b1acafd12feecb5683a2af9384`
- Historical initial Candidate (read-only):
  `3459689e69c8c14774d31a967b2161ed1e686a9d`
- Historical corrected Candidate (read-only):
  `08e1c4bc14269b110c24b4694819b652284aae46`
- Historical review records (read-only):
  `docs/product/reviews/PR-7G/review-readiness.md`,
  `sol-1-corrective.md`, and `sol-2-corrective.md`.
- Fresh feature branch: `codex/recovery-pr-7g-series-watch-order`
- Pull request: `#5 — https://github.com/PariyaProject/BangumiAgentKit/pull/5`
- Historical PR #2: closed without merge after the supersession comment was
  posted; `codex/pr-7g-series-watch-order` remains preserved read-only:
  `https://github.com/PariyaProject/BangumiAgentKit/pull/2`

## Epoch objective

Recover and complete the meaningful Series / Watch-Order Intelligence journey
on current master so an Agent and a human can answer “物语系列到底应该怎么
看？” with a bounded deterministic recommendation, directed relation evidence,
media exclusions, coverage, limitations, and a readable artifact. Preserve the
existing raw relation tool and the PR-7H discovery presentation capability.

## Representative user and Agent questions

1. 物语系列应该按什么顺序看？
2. 少女终末旅行有哪些关联的动画作品？
3. 某条目的前传、续集、衍生作分别有哪些？
4. 哪些关联条目其实是书籍、音乐、游戏或真人作品？
5. 为什么某个关联条目没有进入推荐观看步骤？
6. 关系图是否被深度、动画节点上限或证据上限截断？
7. 直接关系和更深层关系是否方向一致，还是存在反向/跨系列证据？
8. 当同一条目同时出现前传和续集标签时，系统如何表达冲突？
9. Agent 能否在一次调用中获得步骤、原始标签、路径、证据和限制？
10. 人类用户能否在 640px 和 960px 下看懂起点、步骤、排除项和不确定性？

## Work Packages

1. **Bounded directed SeriesService** — reconstruct the current-master core
   service, typed result, traversal, detail hydration, evidence ledger, and
   deterministic ordering without changing frozen source/security foundations.
2. **Semantic and Agent surface** — add
   `bangumi.get_series_watch_order`, registration, generated catalog visibility,
   and an honest public media/maxNodes contract.
3. **Series-relations Renderer** — add the semantic ViewModel, bounded card,
   directed path/evidence section, exclusion samples, and complete/partial/
   not-computable states while preserving PR-7H renderer registration.
4. **Standalone and verification** — add semantic/render routes, documentation,
   unit/semantic/renderer/Standalone coverage, regression fixtures, and
   representative PNG QA.

## Scope

In scope:

- Official v0 subject detail and one-hop subject relation reads through the
  existing `SubjectService`/HTTP seam.
- `SeriesService` with depth `0..2`, `maxNodes` `1..16`, default depth `1`,
  default maxNodes `8`, and `media: "anime" | "all"`.
- Deterministic prequel/sequel/side-story/recap hints with raw labels retained;
  unknown and non-watch labels remain evidence, not inferred watch steps.
- Directed edges and bounded root-relative paths, including safely composable
  all-prequel and all-sequel deeper chains.
- Explicit conflict, reverse-edge, cross-franchise, duplicate, tie, media,
  depth, node, detail-failure, relation-failure, and 64-edge evidence states.
- `series-relations` ViewModel/template, `bangumi.render_series_watch_order`,
  Standalone semantic/render routes, catalog/docs, and focused regression tests.

Explicit non-scope:

- A universal franchise ontology or a claim of an official canonical order.
- Structured Web/HTML sources, source-policy expansion, authentication,
  authorization, credentials, cookies, writes, persistence, migrations,
  releases, packages, and tags.
- Full-franchise crawling, global graph indexing, personalization, episode
  scheduling, snapshots, or a new graph/persistence layer.
- Changes to frozen foundations or the already-merged PR-7H discovery
  presentation capability.
- Modifying, merging, rebasing, rewriting, deleting, or importing historical
  PR-7G/PR-7H governance state.
- Generic implementation/research subagents; authorized and consumed remain
  `0 / 0`.

## Public semantic contract

`maxNodes` is the maximum number of non-root **anime recommendation/traversal
nodes** selected for child relation reads, detail hydration, and the bounded
watch-order result. The root does not consume this budget. Non-anime rows never
consume it and are never detail-hydrated or traversed. In `media: "all"`, up to
8 non-anime rows may additionally appear in `related` as explicitly bounded
media evidence; `coverage.relatedLimit`, `animeNodeLimit`, and
`nonAnimeEvidenceLimit` expose these separate limits. `related` never silently
exceeds the declared `relatedLimit`; omitted candidates remain identifiable via
bounded exclusion samples, edge evidence, counts, or limitations.

The result preserves:

- root identity and requested input;
- `watchOrder` with deterministic positions, raw relation labels, placement
  reason, and path context;
- `related` rows with relation observations and directed `relationPaths`;
- `excluded` counts/samples with raw labels and reasons including non-anime
  roots, media, unknown/non-watch, conflict, depth evidence, node cap, and
  evidence cap;
- `coverage` for requests, observed rows, unique entities, selected/returned
  entities, details attempted/succeeded/failed, depth/node/evidence truncation,
  and every bounded output limit;
- `evidence.sources` for every attempted relation/detail path, with success or
  failure status, plus `series-watch-order-v2` derivation evidence;
- warnings and limitations that distinguish bounded recommendation from
  official canonical ordering and distinguish partial/not-computable states.

Ordering rules:

- Root-relative direct stable labels control direct placement. A direct
  prequel is before the root; direct sequel, recap, and side story are after it.
- Direct prequel plus any after-root stable label is an explicit conflict and is
  excluded from definitive steps; it is not silently resolved by priority.
- Deeper nodes enter definitive steps only through a same-direction chain of
  stable prequel edges or stable sequel edges. The chain path is retained and
  deeper prequels precede shallower prequels while deeper sequels follow
  shallower sequels.
- Reverse, unknown, cross-franchise, mixed-direction, and non-composable paths
  may remain visible as evidence but cannot override direct root semantics.
- Within the same placement/depth, known dates sort ascending, missing dates
  sort after known dates, and subject ID is the final deterministic tie-breaker.
- `maxNodes` selection is intentionally made from relation evidence before
  selected-subject detail hydration; detail dates order the selected bounded
  set but cannot retroactively replace a candidate outside that cap. The
  relation-row ID is the stable preselection tie-breaker.

## Historical findings and Luna resolution matrix

The historical Sol #1/#2 records were inspected before fresh review. These
requirements are part of the current implementation contract and must be
closed, with focused regression evidence, before Sol #1 is launched:

| Historical finding                                | Current resolution to implement and verify                                                                                                                                                                                                                                              |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Directional semantics and cross-franchise bridges | Store every directed edge with `fromId`, `toId`, depth, raw label, normalized kind, and path IDs. Expand only stable watch labels. Derive order from direct root edges or safe same-direction paths; never merge deeper/reverse labels into direct placement.                           |
| `media: all` and anime node budget                | Define `maxNodes` as the anime budget. Select/traverse/hydrate anime independently of non-anime rows; `all` only adds a separately capped non-anime evidence surface. Assert anime/all watch order and request paths are identical.                                                     |
| Evidence and coverage truth                       | Record every attempted path, all observed relation rows, unique candidate counts, detail failures, and eligible unvisited depth/cap candidates. Back-edges do not create depth truncation. Add duplicate, tie, root-failure, mixed-media, recap, reverse, and cross-franchise fixtures. |
| Renderer evidence                                 | Render bounded directed edges/paths, raw labels, excluded samples, reasons, coverage limits, and partial/not-computable states. Inspect 640px/960px long-CJK, missing-image, partial, and not-computable artifacts.                                                                     |
| Conflicting direct relations                      | Detect contradictory before/after placement groups, expose `conflicting_direct_relations`, mark the result partial, and exclude the subject from definitive steps unless the implementation has an explicit truthful rule (this Epoch uses exclusion).                                  |
| Deeper directional chains                         | Preserve path context and include only same-direction prequel/sequel chains in order, with deterministic depth-aware placement. Mixed/reverse/non-composable paths remain evidence-only.                                                                                                |
| Public media/maxNodes contract                    | Expose separate anime/non-anime/related limits in the result, tool descriptions, docs, and tests. Cap `related` at the explicit `relatedLimit`; identify omitted subjects through exclusions/evidence/coverage.                                                                         |
| 64-edge evidence cap                              | Retain at most 64 serialized edge records, report `edgeEvidenceLimit`, returned count, clipping, partial state, truncation reason, and a warning. Add a >64-edge regression fixture.                                                                                                    |

## Evidence, resource, and security limits

- Before transport retries, the service performs at most one root detail read,
  one root relation read, at most `maxNodes` child relation reads, and at most
  `maxNodes` child detail reads: `2 + 2N` requests for a successful bounded
  run. Non-anime candidates never create child requests.
- Relation rows and candidate evidence are processed deterministically; output
  arrays, relation paths, samples, warnings, and source records are bounded and
  sorted. The global edge evidence limit is 64.
- Existing HttpClient retry, Renderer SSRF, timeout, output, concurrency, and
  artifact boundaries remain authoritative. No credential or write path is
  introduced.

## Acceptance criteria

- The semantic tool is discoverable, read-only, no-auth, schema-bounded, and
  returns the complete typed contract above.
- Direct and safely composable deeper order is deterministic; contradictory
  direct labels are explicit and not placed definitively.
- `media: "anime"` and `media: "all"` produce identical anime recommendation
  steps/details/request budgets; non-anime evidence is bounded and visible in
  the all-media surface without hydration or traversal.
- Coverage and evidence truthfully describe root/child failures, duplicates,
  ties, depth/cap boundaries, omitted related rows, and edge clipping.
- A non-anime root is explicitly `not_computable`, does not create anime watch
  steps, and does not traverse or hydrate child anime candidates.
- Renderer exposes root, steps, directed evidence, exclusions, coverage,
  warnings, limitations, and not-computable/partial states at 640px and 960px.
- Standalone exposes `watch-order <subjectId>` and
  `render watch-order <subjectId>` with the shared tool semantics.
- Relevant focused tests, affected/full repository validation, catalog checks,
  exact-SHA CI, User QA, Agent QA, visual QA, and consolidated self-review pass
  before review expenditure.

## Validation and visual QA plan

- Focused: SeriesService unit, semantic tool, renderer, Standalone route,
  renderer security/zero-network regressions.
- Affected/full: `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm test:contract`, `pnpm test:semantic`, `pnpm test:provider`,
  `pnpm test:discovery`, `pnpm test:standalone`,
  `pnpm test:integration:sqlite`, `pnpm test:render`, and
  `pnpm openapi:verify`.
- Generate and inspect representative 640px/960px PNGs for complete,
  long-CJK, missing-image, partial, conflict, and not-computable fixtures.
- Perform realistic Agent/tool QA, `git diff --check`, and a consolidated
  Base..Candidate self-review before the first Sol launch.

## Review Boundary Rationale

- Why these Work Packages belong together: they complete one tightly coupled
  semantic-to-renderer-to-tool-to-Standalone journey for the same series and
  watch-order question. The evidence contract is only useful when every
  surface preserves its directed semantics and bounded uncertainty.
- User / Agent journey completed: an Agent requests a bounded series order and
  can hand a human a readable card containing the recommendation, relation
  paths, exclusions, evidence, and limits without a second query language.
- Related work intentionally included: current-master compatibility, catalog,
  docs, negative fixtures, renderer QA, and Standalone routing are required to
  make this read-only capability trustworthy and discoverable.
- Adjacent work intentionally deferred: new sources, discovery semantics,
  persistence, personal features, and unrelated renderer work remain deferred.
- Why reviewing now has higher value than reviewing earlier: the historical
  blockers cross traversal, evidence, public contract, and renderer surfaces;
  a complete current-master vertical slice lets one reviewer falsify them as a
  system instead of duplicating partial reviews.
- Why extending further would reduce coherence or reviewability: broader graph
  ontology, source expansion, or other product capabilities would introduce
  independent semantics and dilute the bounded recovery contract.

## Review Economics

- Review Tier: `TIER_2`
- Expected Sol: `1`
- Automatic Maximum: `2`
- Outer Remaining Sol: `N/A` (execute-only; no outer self-evolution Goal)
- Generic Subagents: `0`
- Reviewer order: Sol #1 and, only if corrective, Sol #2 are the same
  comprehensive `sol_milestone_reviewer`; Sol #3 is prohibited.
- Reviewer overall wall-clock limit: 120 minutes from each launch.

## Integration and Freeze contract

- Integration Policy: `AUTO_MERGE_AFTER_FREEZE`
- Target Base Branch: `master`
- Recorded Base SHA: `5e7d4ace51a1aa1657a36d78f2c1a54915a4e05e`
- Current Target Base SHA: to resolve immediately before integration
- Feature Branch: `codex/recovery-pr-7g-series-watch-order`
- Pull Request: `#5 — https://github.com/PariyaProject/BangumiAgentKit/pull/5`
- Merge Strategy: `MERGE_COMMIT`
- Branch Cleanup Policy: after verified frozen-SHA ancestry and merged PR,
  safely retire local/remote feature branches and return to synchronized
  `master`; never touch the historical branch.
- Stop: `MERGED_GOAL_COMPLETE`, or a truthful documented
  `FROZEN_GOAL_COMPLETE`/integration blocker under the canonical policy.

## Readiness checkpoint — before Sol #1

- Milestone state: `REVIEW_READY`.
- Exact Implementation Candidate: `c9de0a46a1445650c6b2699f7c0cd35adf5daef5`.
- Recovery Base: `5e7d4ace51a1aa1657a36d78f2c1a54915a4e05e`.
- Pull request: `#5 — https://github.com/PariyaProject/BangumiAgentKit/pull/5`.
- Exact-SHA CI: GitHub Actions run `31505310143`; `sqlite-default`,
  `host-integration`, `standalone-release-smoke`, `postgres-compat`,
  `provider-foundation`, and `discovery-foundation` all passed.
- Local validation: `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`
  (35 files / 201 tests), `pnpm test:contract` (22), `pnpm test:semantic`
  (32), `pnpm test:provider` (33), `pnpm test:discovery` (51),
  `pnpm test:standalone` (19), `pnpm test:integration:sqlite` (33),
  `pnpm test:render` (7 files / 54 tests), and `pnpm openapi:verify` passed.
- Agent QA: both semantic/render tools are discoverable and describable;
  Standalone `watch-order` and render routes work; a read-only official API
  query returned bounded steps, raw evidence, non-anime exclusions, coverage,
  and truthful partial/depth state.
- Renderer QA: generated and inspected complete/partial/not-computable
  640px and 960px PNGs with long CJK, missing covers, evidence, exclusions,
  and bounded-state messaging; layout remains readable at both widths.
- Repository preflight: `git diff --check` passed and the working tree was
  clean at the Candidate; historical PR-7G branch remains untouched.
- Review budget: `TIER_2`, `2 authorized / 0 consumed / 2 remaining`;
  generic subagents `0 / 0`; Sol #1 is the next and only currently authorized
  launch. Sol #2 is reserved only for a corrective Candidate; Sol #3 is
  prohibited.

The exact Candidate is the implementation SHA to review. Later governance
metadata may be recorded as a separate Governance Record SHA under the
two-SHA freeze policy.

## Sol #2 terminal outcome

- Sol #1: `CORRECTIVE_REQUIRED`, 0 P0 / 3 P1 / 2 P2; consumed launch 1.
- Sol #2: `CORRECTIVE_REQUIRED`, 0 P0 / 2 P1 / 4 P2; consumed launch 2.
- Exact corrected Candidate: `1e0cbd97fcdd0859187534fda67ae797c33e5d0e`.
- Exact-SHA CI: not accepted as green because run `31508533985` had a
  contradictory workflow/job state with `postgres-compat` still reported as
  running in the job-level view.
- Terminal state: `PARKED_REVIEW_LIMIT`; no freeze, merge, or branch cleanup.
- Full terminal report: `docs/product/reviews/PR-7G-recovery-series-watch-order/sol-2-review.md`.

## Current next action

STOP at `PARKED_REVIEW_LIMIT`. Sol #1 and Sol #2 consumed the complete TIER_2
budget without a PASS. Preserve the corrected Candidate and branch for a
future explicitly authorized cycle; do not launch Sol #3 or integrate this PR.

## Separate finalization overlay

The historical Recovery Epoch and its `2 / 2` review budget remain terminal and
immutable. A later, explicitly human-authorized finalization of the existing
PR #5 is recorded separately in
`docs/product/cycles/PR-7G-finalization.md`; it does not reset this historical
state or create a new branch, PR, or Product Review Epoch.
