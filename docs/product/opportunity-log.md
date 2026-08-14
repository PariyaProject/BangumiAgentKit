# BangumiAgentKit Product Opportunity Log

## Archived V2 self-evolution selection record — 2026-08-14

This section preserves product-selection provenance; it is not active Harness
runtime state. Harness V3 runtime truth lives only in its Outer Run Issue and
Epoch PR. The opportunity entries below remain durable product knowledge.

The fresh `AUTONOMOUS_EVOLUTION_TIER2` outer Goal selected **OP-008 Subject
Intelligence Overview** as the highest-value safe next Epoch from synchronized
`master` (`cd0ee074ca6e9d6b65e063e2461bc54a4cc0897e`). The selection was based on
the current tool/renderer audit, existing official-v0 research, and a narrow
read-only parity check of Bangumi's subject and stats pages. It closes a
repeated Agent orchestration gap using existing source seams and does not
require a protected boundary change.

Selection comparison and provenance:

- OP-008 was selected as the highest combination of user value and Agent
  leverage while remaining bounded and source-reliable. Its independent V2
  review remained parked at the TIER_2 limit; it was later integrated by
  explicit human authorization without claiming an independent Freeze.
- OP-003 Community Discussion Spike remains deferred. Its existing entry
  requires S3 + S6 + S7; current policy does not broadly enable Structured Web,
  HTML, or historical snapshot collection, so it is not an immediately safe
  Epoch.
- OP-004 Staff Collaboration Graph remains deferred. A useful implementation
  needs cross-subject graph traversal and materially higher fan-out/resource
  risk than the selected subject journey; no graph foundation is authorized.

This record is a durable selection checkpoint, not a claim that the deferred
opportunities are superseded. The completed-but-parked Cycle Plan is
`docs/product/cycles/PR-8A-subject-intelligence-overview.md`.

Sol #2's full review evidence is
`docs/product/reviews/PR-8A-subject-intelligence-overview/sol-2-review.md`.

---

## OP-008 Subject Intelligence Overview

Status:
MERGED_BY_HUMAN_AUTHORIZATION / HISTORICAL_REVIEW_PARKED

User questions:

“介绍一下这部作品；它的评分、角色、制作人员和关联作品怎么样？”

“能不能一次给我这部动画的基本信息、统计、主要角色、职员和关联条目？”

User Value:
5/5

Agent Leverage:
5/5

Information Gain:
5/5

Data Availability:
5/5

Reliability:
4/5

Implementation Cost:
4/5 — bounded composition over existing services and provider seams

Maintenance Risk:
2/5

Source Risk:
1/5

Possible Sources:
Official v0 subject detail, subject stats, subject characters, subject persons,
and subject relations; deterministic derived section coverage and grouping.

Potential Capability:
get_subject_overview

Potential Renderer:
SubjectIntelligenceOverview / SubjectOverview

Notes:
The current AgentKit surface makes a user or Agent orchestrate separate
`get_subject`, `get_subject_stats`, `get_subject_cast`, `get_subject_staff`,
and `get_subject_relations` calls. The selected Epoch composes those bounded
read-only facts into one evidence-bearing result and one dense-but-readable
card. It deliberately excludes episodes, community/history, personalization,
HTML/Structured Web, collaboration graphs, inferred role taxonomies, and new
authentication or persistence semantics. Section failures remain explicit;
the result never claims complete franchise, cast, staff, or lifetime history.

Parked checkpoint — 2026-08-14: Sol #2 returned `CORRECTIVE_REQUIRED` with
four P1 blockers: subject-overview images bypass the renderer asset pipeline;
successful stats evidence can use a pre-dispatch timestamp; required
versioned composition-formula provenance is absent; and the corrected visual
fixtures are not semantically truthful in degraded states. Candidate
`998d4c4935f52d4cdf1543ca1663d68d137065fc` passed exact CI run `31766543465`
but is not frozen or merged. The milestone review budget is exhausted
(`2 / 2`); Sol #3 is prohibited. Future remediation requires a separately
authorized fresh milestone; this outer Goal will select only an independent
safe opportunity next.

Selection evidence:

- `docs/product/cycles/PR-8A-subject-intelligence-overview.md`
- `packages/tools/src/definitions/read-tools.ts`
- `packages/tools/src/definitions/render-presentation-tools.ts`
- `packages/renderer/src/view-models/index.ts`
- `docs/research/pr7a2/renderer-data-requirements.md`
- current read-only Bangumi parity pages: `https://bgm.tv/subject/41529` and
  `https://bgm.tv/subject/41529/stats`

---

## OP-009 Collection Intelligence

Status:
SELECTED_IN_HARNESS_V3_EPOCH / COLLECTION-INTELLIGENCE-V1

User questions:

“我的收藏中各状态、评分和标签如何分布？”

“我当前待看或搁置的 backlog 有多大，最近更新了哪些条目？”

User Value:
5/5

Agent Leverage:
5/5

Information Gain:
4/5

Data Availability:
4/5 — the official v0 collection page exposes status, rating, tags,
episode progress, names, and updated timestamps, but not per-item total episode
denominators in the collection envelope.

Reliability:
4/5

Implementation Cost:
3/5 — bounded pagination and deterministic aggregation over an existing
authenticated read seam, plus an image-free card.

Maintenance Risk:
2/5

Source Risk:
1/5

Possible Sources:
Official v0 `GET /v0/users/{username}/collections`, restricted to the currently
bound account; no HTML, Structured Web, snapshots, or per-subject hydration.

Potential Capability:
get_collection_intelligence

Potential Renderer:
CollectionIntelligence

Derived Logic:
`collection-intelligence-v1` computes status and subject-type counts, a
`wish + on_hold` backlog (with `doing` reported separately), valid 1–10 rating
distribution/average with `0` treated as unrated, completed `ep_status` totals,
bounded tag frequency, and source-reported `updated_at` ordering within the
observed sample. Source total may be unknown on an unavailable first page;
long-tag skips, page failures, missing fields, deduplication, scan caps,
retrieval time, and the upstream `updated_at` reliability limitation remain
explicit. The result does not infer taste, recommendations, full-collection
recency, or historical trends.

Provenance:
Selected from synchronized Harness V3 `master` in Outer Run Issue #8 after a
narrow audit of the existing collection tools and the [official Bangumi API
surface](https://bangumi.github.io/api/). The current public Bangumi experience
and ecosystem also expose collection progress and collection-oriented analysis,
which supports the user-value hypothesis without authorizing broader crawling.

---

## OP-010 Collection Weekly Schedule

Status:
SELECTED_IN_HARNESS_V3_EPOCH / COLLECTION-WEEKLY-SCHEDULE-V1

User questions:

“我收藏的动画本周哪几天更新？”

“本周有哪些我在看或想看的收藏条目会播出？当前进度和播出计划能否对应上？”

“为什么某些收藏条目没有出现在本周计划中，哪些信息无法计算？”

User Value:
5/5

Agent Leverage:
5/5

Information Gain:
5/5

Data Availability:
4/5 — official legacy `/calendar` supplies a bounded seven-day airing
surface and the authenticated v0 collection envelope supplies current-account
status, `ep_status`, and `subject.eps`; the source does not provide a concrete
airing time or timezone and does not certify episode-level completion.

Reliability:
4/5

Implementation Cost:
3/5 — bounded join over existing calendar and account-collection seams, plus
an image-free card.

Maintenance Risk:
2/5

Source Risk:
1/5

Possible Sources:
Official legacy `/calendar` and current-account official v0
`GET /v0/users/{username}/collections`; no HTML, Structured Web, snapshots,
or per-subject episode hydration.

Potential Capability:
`get_collection_schedule`

Potential Renderer:
`CollectionSchedule`

Derived Logic:
`collection-schedule-v1` matches only stable `subjectId` values, preserves
calendar and collection source order, exposes unmatched calendar and collection
rows, and labels `ep_status`/`subject.eps` progress as collection-envelope
evidence. Missing, invalid, duplicate, conflicting, truncated, and unavailable
source observations remain explicit; unmatched rows distinguish complete-scan
absence, status filtering, and incomplete coverage; derived retrieval evidence
spans both source attempts and the latest successful input. No timezone,
historical trend, airing time, recommendation, or episode-completion claim is
inferred.

Provenance:
Selected from synchronized Harness V3 `master` in Outer Run Issue #14 after
the six-lane discovery audit. The live Bangumi calendar exposes a seven-day
airing plan, while the merged collection-backlog Epoch explicitly excluded a
calendar/weekly-schedule join. The slice reuses the existing current-account
`read:collection` seam without changing authentication or write authority.

---

## OP-001 Voice Actor Workload

Status:
DELIVERED_IN_PR-7D_BOUNDED

User question:

“水濑祈最近半年是不是特别忙？”

User Value:
5/5

Agent Leverage:
5/5

Data Availability:
5/5

Possible Sources:
S1 + S7

Potential Capability:
analyze_voice_actor_workload

Potential Renderer:
VoiceActorWorkload

Notes:
The full 3/6/12 month comparison is deferred: official person relationship
payloads do not include air dates and the repository has no compatible snapshots.
PR-7D will first deliver evidence-bearing static person/media/role/credit counts;
time-window workload remains explicitly not-computable until its source contract
is bounded.

---

## OP-002 Franchise Watch Order

Status:
DELIVERED_IN_PR-7G_RECOVERY

User question:

“物语系列到底应该怎么看？”

User Value:
5/5

Agent Leverage:
5/5

Information Gain:
5/5

Data Availability:
4/5

Reliability:
4/5

Implementation Cost:
4/5

Maintenance Risk:
3/5

Source Risk:
2/5

Possible Sources:
Official v0 subject relations and bounded subject details

Potential Capability:
get_series_watch_order

Potential Renderer:
SeriesRelations / WatchOrder

Notes:
The fresh PR-7G Recovery Epoch starts from current post-PR-7H master. It must
preserve directed paths, distinguish deterministic bounded recommendation from
official canonical order, keep non-anime evidence from consuming anime node or
hydration budgets, and expose historical review blockers as explicit conflict,
coverage, evidence, and limitation states. Historical PR-7G branch/reports are
read-only provenance only. The accepted implementation Candidate
`fd48eb626b6b027031cc3884444963018beef2ed` passed Human Final Review, was
frozen, and was integrated in PR #5 with merge commit
`77bd5b63a20c2043e6a7323f3945a6ed16257c8f`.

---

## OP-003 Community Discussion Spike

User question:

“最近哪部动画突然讨论多起来了？”

Requires:
S3 + S6 + S7

...

---

## OP-004 Staff Collaboration Graph

...

---

## OP-005 Subject Staff Intelligence

Status:
DELIVERED_IN_PR-7D

User question:

“少女终末旅行的导演、脚本、音乐和声优分别是谁？”

User Value:
5/5

Agent Leverage:
5/5

Data Availability:
5/5

Possible Sources:
S1 + S7

Potential Capability:
get_subject_staff

Potential Renderer:
Staff / PersonProfile

Notes:
Official `/v0/subjects/{id}/persons` returns person identity, raw relation,
episode/track participation, and image. Preserve raw relation labels while
grouping them deterministically; do not infer a broader role taxonomy in this cycle.

---

## OP-006 Calendar / Schedule Intelligence

Status:
DELIVERED_IN_PR-7E_FROZEN

User questions:

“今天和本周有哪些动画，什么时候播？”

“为什么今天的播出日历不完整？”

User Value:
5/5

Agent Leverage:
4/5

Data Availability:
5/5

Reliability:
4/5

Possible Sources:
Official legacy `/calendar` through the existing Provider seam

Potential Capability:
calendar_intelligence

Potential Renderer:
CalendarSchedule

Notes:
The existing calendar path is read-only and source-bounded but loses useful schedule
facts and coverage semantics at the semantic boundary. PR-7E preserved air dates,
ratings, types, ranks, missing fields, caps, evidence, and unavailable states without
adding OAuth, personal watchlists, HTML, Structured Web, snapshots, or write authority.

---

## OP-007 Revision / Change History Intelligence

Status:
DELIVERED_IN_PR-7F_FROZEN

User questions:

“这个条目的标题或简介为什么变了？”

“最近有哪些官方修订记录？”

User Value:
4/5

Agent Leverage:
4/5

Data Availability:
5/5

Reliability:
4/5

Possible Sources:
Official v0 subject/person/character/episode revisions through the existing OpenAPI
client and read-only Provider seam

Potential Capability:
revision_change_intelligence

Potential Renderer:
RevisionTimeline / ChangeHistoryCard

Notes:
The repository already exposed list/get revision operations, but the semantic boundary
needed bounded entity-scoped change summaries, field-level unknowns, and a human-readable
timeline. PR-7F preserves official revision timestamps and summaries, bounds list/detail
work, and distinguishes observed history from unsupported trend claims. No snapshot store,
HTML/Structured Web source, authentication, or write authority was needed for the bounded
read-only cycle. The exact frozen Candidate passed the one-off manual finalization review
with no P0/P1 findings; integration evidence is recorded in
`docs/product/loop-status.md` and `docs/product/reviews/PR-7F/manual-finalization-review.md`.
