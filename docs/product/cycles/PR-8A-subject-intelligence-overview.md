# PR-8A — Subject Intelligence Overview

Status: `VALIDATING`

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
  successful operations, evidence, warnings, limitations, and capability state.

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
  capped again. All visible arrays and warning/evidence lists are deterministic.
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
  and limitations distinguish bounded observation from completeness and
  not-computable claims.
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
- Recorded Base SHA: `cd0ee074ca6e9d6b65e063e2461bc54a4cc0897e`
- Current Target Base SHA: resolve immediately before integration
- Feature Branch: `codex/pr-8a-subject-intelligence-overview`
- Pull Request: to create after Candidate readiness
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
