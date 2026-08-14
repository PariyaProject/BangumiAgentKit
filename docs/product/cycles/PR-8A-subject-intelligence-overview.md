# PR-8A — Subject Intelligence Overview

Status: `MILESTONE_CHECKPOINT_COMPLETE / MERGED`

Historical independent-review status: `PARKED_REVIEW_LIMIT`

Candidate status before integration attempt: `HUMAN_REVIEW_READY`

Sol #2 returned `CORRECTIVE_REQUIRED` against the corrected Candidate. The
milestone exhausted its TIER_2 review budget without a PASS and is parked
without freeze or merge; Sol #3 is prohibited. The full independent report is
persisted at
`docs/product/reviews/PR-8A-subject-intelligence-overview/sol-2-review.md`.

The later human-directed corrective checkpoint below does not rewrite either
Sol verdict or spend another Sol launch. The user subsequently authorized a
controlled integration refresh on the existing PR; that refresh does not claim
an independent review PASS.

This is the first Product Review Epoch selected inside the fresh
`AUTONOMOUS_EVOLUTION_TIER2` outer Goal. It starts from the synchronized
`master` recorded below and uses one dedicated feature branch.

## Epoch objective

Answer the common power-user question “介绍一下这部作品；它的评分、角色、
制作人员和关联作品怎么样？” with one bounded, read-only semantic result and
one readable artifact. Compose the existing official-v0 subject, subject-stats,
cast, staff, and relation capabilities while preserving each section's source,
coverage, partial, unavailable, and not-computable semantics.

## Representative user and Agent questions

1. 这部动画的基本信息、评分、排名和收藏分布是什么？
2. 它有多少评分，评分直方图大致如何？
3. 主要角色和 Bangumi 返回的声优分别是谁？
4. 哪些制作人员参与了这部作品，原始职位标签是什么？
5. 它有哪些前传、续集、衍生作、原作或其他关联条目？
6. 哪个章节数值来自条目详情，哪些统计字段来自单独的 stats 能力？
7. 当角色、职员、统计或关系接口部分不可用时，哪些部分仍然可信？
8. Agent 能否用一次语义调用回答上述组合问题，而不编排五个低层调用？
9. 人类用户能否在 640px 和 960px 宽度下读懂概览、统计、角色、职员和关联区？
10. 缺少图片、长日文/中文标题、截断或上游失败时，卡片是否诚实且仍可读？

## Current product gap and parity evidence

AgentKit currently exposes `get_subject`, `get_subject_stats`,
`get_subject_cast`, `get_subject_staff`, and `get_subject_relations` as separate
calls. Its renderer has separate subject, cast, and other single-purpose cards,
but no subject intelligence report that composes these bounded results. The
current Bangumi subject journey visibly groups overview, episodes, characters,
staff, and relations, while its stats page separately presents rating/count and
collection facts. The parity audit was read-only and used:

- `https://bgm.tv/subject/41529`
- `https://bgm.tv/subject/41529/stats`
- existing official-v0 research under `docs/research/pr7a2/`

The selected increment is the smallest coherent vertical slice that closes the
composition gap without enabling a new source class.

## Work Packages

1. **Bounded subject-overview composition** — add a typed orchestration result
   over existing SubjectService, ProviderRegistry subject stats,
   CharacterService cast, PersonService staff, and SubjectService relations.
   Run independent sections within explicit caps; preserve successful sections
   when another section is partial or unavailable.
2. **Semantic Agent surface** — add `bangumi.get_subject_overview` with a
   discoverable no-auth read contract, bounded section limits, evidence,
   coverage, warnings, limitations, and explicit capability states.
3. **Subject-overview renderer** — add a semantic ViewModel and a single
   `subject-overview` card containing identity, score/collection metrics,
   rating distribution, compact cast/staff/relations previews, section states,
   coverage, and source/limitation footer. Reuse the existing renderer security,
   asset, width, timeout, and artifact boundaries.
4. **Standalone, docs, and verification** — expose `overview <subjectId>` and
   `render overview <subjectId>`, update the tool catalog and Agent guidance,
   add focused semantic/renderer/Standalone tests, and perform representative
   640px/960px visual QA.

## Scope

In scope:

- Official v0 subject detail, subject stats, subject characters, subject
  persons, and subject relations through existing read-only seams.
- A bounded composite semantic result with deterministic section ordering and
  stable item caps. Default limits are 8 cast rows, 24 staff rows, and 12
  relation rows; callers may lower or raise them only within hard caps of
  1..20, 1..80, and 1..32 respectively.
- Nested actor references are independently bounded: at most 4 actor
  references per returned character and 32 actor references across the
  overview, with per-character and aggregate nested coverage exposed.
- Section-level `complete`, `partial`, `unavailable`, and `not_computable`
  states; the whole result is `complete`, `partial`, `unavailable`, or
  `not_found` according to observed section truth.
- Evidence records for each attempted official-v0 operation and the bounded
  deterministic composition formula; no claim of complete franchise, cast,
  staff, or lifetime statistics beyond observed source limits.
- A human-facing card, Agent tool, Standalone routes, catalog/docs, focused
  tests, and visual fixtures that exercise complete and degraded states.

Explicit non-scope:

- Structured Web, HTML, community discussions, reviews, snapshots, historical
  trends, personalized collection data, recommendation scoring, or new source
  policy.
- Full episode listing or episode analytics; the existing `get_episodes` tool
  remains the bounded entry point for that separate journey.
- Universal staff-role taxonomy, inferred “main cast,” inferred canonical
  relation meaning, collaboration graphs, or cross-subject graph traversal.
- Authentication, authorization, credentials, cookies, writes, persistence,
  migrations, releases, packages, and tags.
- Breaking or reopening frozen public contracts; existing tools and renderer
  templates remain compatible.
- Generic implementation/research subagents; authorized and consumed remain
  `0 / 0`.

## Public semantic contract

`bangumi.get_subject_overview` accepts a positive `subjectId` and optional
`maxCast`, `maxStaff`, and `maxRelations` caps. It returns:

- the mapped subject identity and existing detail fields;
- a stats section retaining official histogram and collection buckets when the
  provider result is available;
- cast rows retaining Bangumi character relation labels and actor identities;
- staff rows and deterministic groups by raw Bangumi relation label;
- related subject rows retaining the raw relation label and mapped media type;
- per-section coverage (`observed`, `returned`, `truncated`), attempted and
  successful operations, per-operation attempt/retrieval evidence, nested
  actor coverage, warnings, limitations, and capability state.

No section is silently replaced with an empty success. Missing or failed
sections remain explicit. The result does not claim “all” records when a source
page or configured cap is bounded. Stats stay separate from the legacy subject
shape and retain their provider evidence.

The renderer consumes a ViewModel derived from this result. Business formulas
remain in the semantic composition/builder layer; the React template only
arranges already-derived values and displays state/coverage honestly.

## Evidence, resource, and security limits

- A normal successful run attempts at most five bounded source operations:
  subject detail, subject stats, subject characters, subject persons, and
  subject relations. It performs no child hydration and no graph traversal.
- Source arrays are capped before entering the result and rendered previews are
  capped again. Actor references are capped at 4 per character and 32 total;
  all visible arrays and warning/evidence lists are deterministic.
- Existing HTTP retry, provider policy, renderer SSRF, browser, timeout, image,
  concurrency, output-size, and artifact boundaries remain authoritative.
- No credentials or authenticated execution session is needed; optional account
  context is deliberately excluded from this Epoch.

## Acceptance criteria

- `bangumi.get_subject_overview` is registered, discoverable, no-auth,
  read-only, schema-bounded, and does not change existing tool shapes.
- One successful call composes the five bounded sections with stable ordering
  and preserves raw relation/role labels rather than inventing taxonomy.
- Section failure or missing data produces truthful partial/unavailable states
  while retaining other successful sections; a missing stats provider is
  `unavailable`, not fabricated zero values.
- Evidence identifies the official-v0 operation for every attempted section,
  records an attempt before dispatch and a retrieval timestamp only after
  successful completion,
  and limitations distinguish bounded observation from completeness and
  not-computable claims.
- Nested actor output is bounded and exposes truthful per-character and
  aggregate truncation coverage.
- The renderer has a registered `subject-overview` ViewModel/template and
  renders complete, partial, unavailable, missing-image, long-CJK, and dense
  relationship fixtures without clipping or fake values at 640px and 960px.
- Standalone exposes `overview <subjectId>` and `render overview <subjectId>`
  using the same semantic contract.
- Focused tests, affected/full repository validation, catalog checks, exact-SHA
  CI, User QA, Agent QA, visual QA, and the consolidated Luna preflight pass
  before review expenditure.

## Validation and visual QA plan

- Focused: subject-overview composition and tool tests, renderer ViewModel and
  template tests, Standalone command/route tests, and existing renderer
  security/zero-network regressions.
- Affected/full: `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm test:semantic`, `pnpm test:render`, `pnpm test:standalone`,
  `pnpm test:provider`, `pnpm test:discovery`, `pnpm test:contract`,
  `pnpm test:integration:sqlite`, and `pnpm openapi:verify` as available in the
  repository.
- Render and inspect representative complete, partial, unavailable,
  missing-image, dense, and long-CJK fixtures at 640px and 960px. Verify
  section hierarchy, no false zeroes, typography, wrapping, and mobile/chat
  readability.
- Perform realistic Agent QA for the ten representative questions and
  `git diff --check` plus a consolidated Base..Candidate self-review before
  the first Sol launch.

## Review Boundary Rationale

- Why these Work Packages belong together: the semantic composition, Agent
  contract, renderer ViewModel/card, Standalone route, and evidence tests are
  one tightly coupled subject-question journey. None is useful as a mature
  capability without the others.
- User / Agent journey completed: an Agent asks for a subject overview once and
  can return a compact human-readable report containing identity, core stats,
  cast, staff, relations, evidence, coverage, and honest limitations.
- Related work intentionally included: existing official-v0 adapters, the
  renderer registry, Standalone discoverability, catalog/docs, negative states,
  and visual QA are included because they make the same journey trustworthy.
- Adjacent work intentionally deferred: episodes, personalized collections,
  community/history, new sources, role ontology, graph traversal, and unrelated
  renderer improvements remain backlog work.
- Why reviewing now has higher value than reviewing earlier: only the complete
  semantic-to-renderer journey can show whether section failures, evidence, and
  visual density remain aligned; reviewing isolated layers would duplicate work.
- Why extending further would reduce coherence or reviewability: adding
  episodes, community, personalization, or graph-derived analysis would create
  independent product semantics and source/risk surfaces.

## Review Economics

- Review Tier: `TIER_2`
- Expected Sol: `1`
- Automatic Maximum: `2`
- Outer Remaining Sol at selection: `4`
- Generic Subagents: `0`
- Reviewer order: Sol #1 and, only if corrective, Sol #2 are the same
  comprehensive `sol_milestone_reviewer`; Sol #3 is prohibited.
- Reviewer overall wall-clock limit: 120 minutes from each launch.

## Integration and Freeze contract

- Integration Policy: `AUTO_MERGE_AFTER_FREEZE`
- Target Base Branch: `master`
- Recorded Base SHA: `0b9893bfec38ecaf53d7377ccb7c9d66f67d38cc`
- Previous review Base SHA: `cd0ee074ca6e9d6b65e063e2461bc54a4cc0897e`
- Current Target Base SHA: `548bc4cd95bce8434de505342054ec6e77290496`
- Feature Branch: `codex/pr-8a-subject-intelligence-overview` (retired)
- Pull Request: `#6 — https://github.com/PariyaProject/BangumiAgentKit/pull/6`
- Merge Strategy: `MERGE_COMMIT`
- Branch Cleanup Policy: after verified frozen-SHA ancestry and merged PR,
  safely retire local/remote feature branches and return to synchronized
  `master`; never touch historical recovery branches.
- Stop: in the self-evolution outer loop this milestone becomes
  `MILESTONE_CHECKPOINT_COMPLETE` after freeze/integration/cleanup, then the
  backlog and ledger are updated before returning to discovery. A truthful
  review-limit, protected-decision, exact-SHA CI, infrastructure, or unsafe
  repository blocker parks this milestone.

## Readiness checkpoint — before Sol #1

The exact Candidate SHA, clean tree, affected local validation, mandatory
remote CI, User QA, Agent QA, Renderer QA, consolidated Luna preflight, and
reviewer launch checkpoint must be recorded in `loop-status.md` and the review
artifacts before any Sol launch. A corrective Candidate resets none of the
milestone or outer launch ledgers.

## Local validation checkpoint — 2026-08-14

- Implementation checkpoint: `a728de0 feat: add subject intelligence overview capability`.
- Typecheck and lint pass; full unit/render run passes 208 tests.
- Semantic/provider/discovery/contract suites pass 36/33/51/22 tests.
- Renderer/Standalone/SQLite integration suites pass 58/21/33 tests.
- OpenAPI spec validation, client generation, operation registry generation,
  build, catalog generation, and `openapi:verify` pass after normalizing the
  generated catalog to the generator's canonical Prettier output.
- Representative complete/partial/no-image long-CJK fixtures were rendered
  and inspected at 640px and 960px under `.artifacts/render/`; section states,
  coverage, warnings, wrapping, and footer remained readable with no clipping.
- Exact Candidate, mandatory remote CI, User/Agent preflight record, and
  independent review readiness are complete. The exact Candidate is
  `aeb2b34d127e49dbe09f81ce80b0b53873ff1a3c` under PR #6. Mandatory CI run
  `31764720966` passed all six required jobs after the generated catalog was
  normalized to canonical output. The readiness packet is persisted at
  `docs/product/reviews/PR-8A-subject-intelligence-overview/review-readiness.md`.

## Corrected Candidate validation checkpoint — 2026-08-14

- Sol #1's four P1 findings and three safe P2 findings were corrected: nested
  actor caps/coverage, per-operation evidence timestamps, exhaustive stats
  state/accounting semantics, the complete visual matrix, raw staff labels,
  and hidden warning/limitation disclosure.
- Corrected Candidate:
  `998d4c4935f52d4cdf1543ca1663d68d137065fc`.
- Focused corrected tests pass: semantic subject overview 13 tests and
  renderer subject overview 2 tests / 15 assertions total.
- Full corrected validation passes: unit/render 208 tests; semantic 46;
  provider 33; discovery 51; contract 22; renderer 58; Standalone 21; SQLite
  integration 33; typecheck; lint; build; `pnpm openapi:verify`; touched-file
  formatting; and `git diff --check`.
- Corrected visual QA rendered and inspected complete, partial, unavailable,
  and not-found states at both 640px and 960px, including dense long-CJK and
  missing-image cases. Evidence is under
  `.artifacts/render/pr8a-corrected/`.
- Mandatory exact-SHA CI run
  [31766543465](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31766543465)
  passed all six required jobs. The milestone was ready for the single
  remaining Sol #2 review launch at this checkpoint; it is not frozen.

## Sol #2 review checkpoint — 2026-08-14

- Reviewer: `sol_milestone_reviewer`, agent
  `019ffe4f-6b46-7c20-96a4-31147a981e66`, launch ordinal `Sol #2 of 2`.
- Review Base SHA:
  `cd0ee074ca6e9d6b65e063e2461bc54a4cc0897e`.
- Review Candidate SHA:
  `998d4c4935f52d4cdf1543ca1663d68d137065fc`.
- Governance-only review tip: `be62c7c`.
- Exact-SHA CI run
  [31766543465](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31766543465)
  remained green across all six required jobs.
- Verdict: `CORRECTIVE_REQUIRED`, with `P0 0 / P1 4 / P2 0 / P3 0`.
- Findings: subject-overview images bypass the renderer asset pipeline;
  successful stats evidence can use a pre-dispatch timestamp; required
  versioned composition-formula provenance is absent; and the corrected visual
  matrix contains semantically contradictory degraded fixtures.
- State: `PARKED_REVIEW_LIMIT`; implementation is not frozen, integration is
  not started, and Sol #3 is prohibited. The outer ledger consumed two of four
  authorized Sol launches and may return to independent opportunity discovery.

## Human-directed corrective checkpoint — 2026-08-14

This checkpoint is the current resumable state after an explicit user-directed
Luna-only corrective on the existing branch and PR. The historical Sol #2
verdict above remains unchanged.

- Starting branch tip: `e0f5416837f60f60b3d37c9cd4be3da3fcf0ea94`.
- New implementation Candidate:
  `05288aecf80f040213dc4fdc938f2838775b9829`.
- Corrected roots: bounded AssetResolver extraction for only rendered cover and
  character images with no raw URL fallback; post-completion provider stats
  retrieval timestamps; stable `derived-s7` composition evidence with
  `subject-overview-composition-v1`; and semantic-to-PNG visual fixtures with
  truthful state/coverage invariants.
- Final local validation is green, including build, typecheck, lint, full
  unit/render, semantic, provider, discovery, contract, standalone, SQLite
  integration, OpenAPI/catalog, and renderer security/asset checks.
- Visual QA rendered and inspected complete, missing-character, partial,
  unavailable, and not-found states at 640px and 960px with dense long-CJK
  content.
- Exact-SHA CI run
  [31770406756](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31770406756)
  passed all six required jobs: `sqlite-default`, `host-integration`,
  `standalone-release-smoke`, `postgres-compat`, `provider-foundation`, and
  `discovery-foundation`.
- State: `HUMAN_REVIEW_READY`; PR #6 remains open, the Candidate is not a
  `SOL_PASS_CANDIDATE` or `FROZEN` Candidate, integration is not started, and
  no additional Sol or generic subagent was used.
- Stop: do not launch Sol, Freeze, merge, close, reset, start recovery, select
  a new Epoch, or enter opportunity discovery until the user changes this
  instruction.

## Integration safety checkpoint — 2026-08-14

The user subsequently authorized merge of PR #6. Before any merge action, the
canonical integration gate fetched the target base and compared it with the
recorded Cycle Base SHA.

- Recorded Base SHA: `cd0ee074ca6e9d6b65e063e2461bc54a4cc0897e`.
- Current `origin/master`: `0b9893bfec38ecaf53d7377ccb7c9d66f67d38cc`.
- Divergence: `origin/master` contains the later governance commit
  `0b9893bfec38ecaf53d7377ccb7c9d66f67d38cc`; the recorded Base remains the
  branch merge-base.
- Result: `INTEGRATION_BLOCKED_BASE_DRIFT`. Policy forbids automatic rebase or
  merge after this mismatch, so no merge action was performed.
- PR #6 remains open; Candidate `05288aecf80f040213dc4fdc938f2838775b9829`
  remains a human-review Candidate, not frozen or merged. Resume requires
  explicit resolution of the base drift and a fresh safety-gate evaluation.

## Base refresh and validation checkpoint — 2026-08-14

The user authorized the existing PR to be integrated after the base-drift
checkpoint. The current remote base was refreshed into the same feature branch
with a non-rewriting merge:

- Previous recorded/review Base SHA:
  `cd0ee074ca6e9d6b65e063e2461bc54a4cc0897e`.
- Fetched current `origin/master`:
  `0b9893bfec38ecaf53d7377ccb7c9d66f67d38cc`.
- Base-refresh commit and refreshed branch tip:
  `0159daa5ce38dbd626458c007a8cf944df3f6454`.
- `git merge-base HEAD origin/master` equals
  `0b9893bfec38ecaf53d7377ccb7c9d66f67d38cc`.
- No rebase, force-push, reset, or unrelated-worktree mutation was used.

On the refreshed branch tip, local validation passed: build, typecheck, lint,
full tests (36 files / 210 tests), renderer tests (8 files / 60 tests),
semantic (46), provider (34), discovery (51), contract (22), standalone (21),
SQLite integration (33), and `openapi:verify`. Postgres-only integration tests
were skipped locally because `DATABASE_URL` is unset; the mandatory remote
matrix remains required. Exact-SHA remote CI is pending the push of the
refreshed branch tip. Current state is
`INTEGRATION_PENDING_EXACT_REFRESH_CI`; the historical Sol verdicts remain
`PARKED_REVIEW_LIMIT` and no new Sol launch was made.

## Merge and cleanup checkpoint — 2026-08-14

The user-authorized integration completed through PR #6:

- Refreshed branch tip: `989262394e81abc71260422be2c51c41d22afdcb`.
- Exact-SHA GitHub Actions run
  [31772037697](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31772037697)
  passed all six mandatory jobs.
- PR #6 was merged as merge commit
  `548bc4cd95bce8434de505342054ec6e77290496`.
- The corrected implementation Candidate
  `05288aecf80f040213dc4fdc938f2838775b9829`, refreshed base
  `0b9893bfec38ecaf53d7377ccb7c9d66f67d38cc`, and refreshed branch tip are
  all ancestors of the merge commit.
- The dedicated local and remote feature branch
  `codex/pr-8a-subject-intelligence-overview` was retired; historical recovery
  branches were untouched.

This merge is recorded as user-authorized integration of the human-review
Candidate. It does not rewrite the historical `PARKED_REVIEW_LIMIT` or claim
an independent Sol PASS. The self-evolution outer loop remains stopped; no
new Epoch or opportunity discovery was started.
