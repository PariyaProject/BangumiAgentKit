# PR-7G Series Relations & Watch-Order Intelligence

Status: `PLANNED`

This is one bounded milestone inside the active
`AUTONOMOUS_EVOLUTION_TIER2` outer Goal. Completion, parking, or review-budget
exhaustion for this milestone returns the outer Goal to discovery; it does not
complete the outer Goal.

## Objective

Answer “物语系列到底应该怎么看？” and related franchise-navigation
questions with a trustworthy, agent-friendly, read-only result built from the
existing official Bangumi v0 subject-relation seam.

The current `bangumi.get_subject_relations` operation exposes useful one-hop
rows but does not explain media exclusions, relation semantics, evidence,
coverage, or a bounded viewing recommendation. PR-7G adds that semantic layer,
a renderer card, and Standalone entry points while preserving the raw source
labels and the limits of the inference.

## Representative user and Agent questions

1. 物语系列应该按什么顺序看？
2. 少女终末旅行有哪些关联的动画作品？
3. 某条目的前传、续集、衍生作分别有哪些？
4. 哪些关联条目是动画，哪些其实是书籍、音乐、游戏或真人作品？
5. 如果官方关系接口没有给出顺序，系统到底能确定什么？
6. 为什么某个关联条目没有进入推荐观看步骤？
7. 关系图是否被深度、节点数或接口覆盖上限截断？
8. 同一关系类型下没有日期或日期相同，推荐顺序如何保持诚实？
9. Agent 能否在一次调用中获得步骤、原始关系标签、证据和限制？
10. 人类用户能否在手机宽度下快速看懂起点、步骤、排除项和不确定性？

## Scope

In scope:

- New semantic operation `bangumi.get_series_watch_order`.
- A bounded graph walk starting at one subject, with `depth` in `0..2` and
  `maxNodes` in `1..16` (defaults `1` and `8`). Traversal follows anime
  relations only and de-duplicates subject IDs.
- `media: "anime" | "all"` (default `"anime"`). Anime is the default
  recommendation surface; `all` retains non-anime relation rows in the related
  evidence summary and exclusion accounting.
- Optional official-v0 subject-detail hydration for the bounded included node
  set, used only for names, types, dates, and images. Detail failures become
  explicit partial coverage rather than fabricated dates or order.
- Deterministic relation-kind hints for a small documented set of common raw
  labels (`前传`, `续集`, `衍生`, `番外`, `总集篇`, `原作`, `改编`, and common
  media labels). Unknown labels remain unknown and are not silently retyped.
- A recommended sequence that puts clear prequels before the root, the root at
  the main entry point, and clear sequels/side stories after it. Ties use known
  dates ascending and then subject ID ascending. The output labels this as a
  bounded recommendation and reports ambiguity; it never claims a canonical
  order.
- Evidence and coverage fields: source operation, retrieval time, relation
  rows observed, unique nodes considered/returned, details fetched/failed,
  requested depth/cap, truncation, warnings, and limitations.
- Renderer view model/template `series-relations` and tool
  `bangumi.render_series_watch_order`, including root, ordered steps, raw
  relation labels, excluded media counts, coverage, evidence, and partial /
  not-computable messaging.
- Standalone commands `watch-order <subjectId>` and
  `render watch-order <subjectId>` plus generated tool-catalog documentation.
- Unit, semantic-contract, renderer, and Standalone route tests, including
  empty, unknown-label, mixed-media, detail-failure, and cap/truncation cases.

Explicitly out of scope:

- A universal franchise ontology or a claim that Bangumi's relation labels are
  semantically complete.
- HTML or Structured Web activation, community signals, snapshots, aggressive
  crawling, authentication, personal watchlists, writes, database migrations,
  or release/package/tag publication.
- Full franchise crawling, global graph indexing, personalized order, episode
  release scheduling, or a new persistence layer.
- Reopening PR-7D, PR-7E, or PR-7F deferred capabilities.

## Source and semantic contract

Primary source:

- Official v0 `GET /v0/subjects/{subject_id}/subjects` for relation rows.
- Official v0 `GET /v0/subjects/{subject_id}` for bounded detail hydration.

The source is public read-only official data. The relation endpoint's raw
`relation` string is evidence and is retained in every displayed edge. The
implementation may attach a normalized hint only when an exact known label
matches the documented mapping; otherwise it returns `unknown` and preserves
the original label.

The semantic result will contain:

- `state`: `complete` or `partial` for a successful root read, with partial
  whenever a cap, depth boundary, or optional detail failure affects coverage.
- `capabilityStates.watchOrder`:
  `bounded_recommendation` when at least one meaningful anime step or root is
  available, otherwise `not_computable` with a reason.
- `root`: the requested subject identity and evidence-backed detail fields.
- `watchOrder`: a deterministic list whose first item is the root unless a
  clearly classified prequel is placed before it; each item carries source
  relation label(s), normalized hint, optional date, position, and an
  explanation of its placement.
- `related`: bounded unique relation nodes/edges used or observed, including
  media type and raw labels where available.
- `excluded`: counts and small samples grouped by media or non-watchable
  relation reason; exclusions are never silently dropped.
- `coverage`: requested cap/depth, relation requests/rows, unique nodes,
  details fetched/failed, truncation flags, and retrieval timestamp.
- `evidence`: official v0 operation identifiers/paths plus the deterministic
  derivation identifier `series-watch-order-v1`.
- `warnings` and `limitations`: honest statements for unknown labels, missing
  dates, ties, partial detail, no usable anime edges, and source limitations.

Resource bound: for `maxNodes = N`, the implementation makes at most one root
relation request, one relation request per traversed anime node, one root detail
request, and one detail request per returned node: no more than `2 + 2N` HTTP
requests, sequentially, before retries owned by the existing HTTP client. The
root request is allowed to fail normally; optional node failures are recorded
as partial. No request is made for an excluded non-anime node.

## Acceptance criteria

- An Agent can call `bangumi.get_series_watch_order` with one subject ID and
  receive a stable, typed result containing recommendation, raw relation
  evidence, coverage, exclusions, and limitations.
- The result is deterministic for the same fetched payload, including tie
  breaking, de-duplication, cap behavior, and unknown-label handling.
- Mixed media is represented honestly; default anime scope does not turn
  books/music/games/real subjects into watch steps.
- Missing dates, unknown labels, empty relations, detail errors, depth limits,
  and node caps are explicit states/warnings rather than guessed facts.
- The implementation never adds a protected source or authority boundary and
  does not modify the database schema or frozen public contracts.
- Renderer output is readable at representative desktop and mobile widths,
  handles long CJK names and missing images, and visibly communicates partial /
  not-computable states.
- Standalone commands expose the semantic and rendered paths with the same
  validation and error semantics as the tools.
- Focused unit, semantic, renderer, and Standalone tests pass; existing
  semantic/provider/discovery/renderer suites remain green; generated catalog
  verification passes.
- A clean exact Candidate is validated locally and by mandatory remote CI before
  any Sol launch.

## Validation and evidence plan

1. Unit-test the service with deterministic injected HTTP fixtures for mixed
   media, known/unknown labels, duplicate IDs, ordering ties, detail failures,
   depth, and request caps.
2. Test tool metadata, input bounds, structured output, error propagation for a
   failed root read, and no-auth read-only classification.
3. Render representative complete, long-name, missing-image, and partial
   fixtures at mobile and desktop widths; inspect PNGs for hierarchy, CJK
   typography, density, and warning legibility.
4. Test Standalone semantic and render dispatch without live network.
5. Run focused tests plus `pnpm build`, generated catalog checks, and the
   repository's mandatory test suites. Record exact commands and results in the
   evidence packet.
6. Run the consolidated preflight only after the Candidate SHA is clean and all
   local evidence is current.
7. Request exactly one sequential comprehensive
   `sol_milestone_reviewer` launch for TIER_2 review. If it returns
   `CORRECTIVE_REQUIRED`, fix findings and create a new Candidate, then use the
   second and final authorized comprehensive launch. Never launch a third.

## Review, branch, and integration ledger

- Review tier: `TIER_2`.
- Milestone Sol budget: `2` launches maximum, `0` consumed at plan time.
- Reviewer order: comprehensive `sol_milestone_reviewer` #1; if corrective,
  Luna correction followed by comprehensive `sol_milestone_reviewer` #2.
- Outer Sol budget at plan time: `4` authorized, `0` consumed.
- Feature branch: `codex/pr-7g-series-watch-order`.
- Target base: `master`.
- Recorded Base SHA: `23f960ce3a8a8ac3841b791061a648037a53ab19`.
- Pull request: to be recorded after the exact Candidate is pushed.
- Integration policy: `AUTO_MERGE_AFTER_FREEZE`.
- Merge strategy: merge commit by default; verify frozen SHA ancestry and
  synchronized target before retiring the branch.
- Cleanup: delete the feature branch only after successful verified merge; stop
  with a persisted `INTEGRATION_BLOCKED*` state if any integration gate fails.

## Stopping/checkpoint rule

This Cycle Plan stops at a truthful inner state such as `FROZEN`,
`CORRECTED_AWAITING_REVIEW_AUTHORIZATION`, `PARKED_REVIEW_LIMIT`,
`HUMAN_REVIEW_REQUIRED`, or an integration blocker. The outer Goal then
persists the checkpoint in `docs/product/loop-status.md` and
`docs/product/opportunity-log.md` and resumes discovery whenever the repository
is safe and the outer review budget permits.
