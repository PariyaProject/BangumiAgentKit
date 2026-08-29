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

## OP-011 Collection Dashboard

Status:
SELECTED_IN_HARNESS_V3_EPOCH / COLLECTION-DASHBOARD-V1

User questions:

“我的收藏概览、backlog 和未来七日播出计划能否一次给出？”

“三个收藏视图分别读取了哪些源，哪些区段 partial、冲突或无法计算？”

User Value:
5/5

Agent Leverage:
5/5

Information Gain:
5/5 — one semantic call joins three already-bounded current-account views
without hiding section-level evidence.

Data Availability:
4/5 — official v0 collection and authenticated episode progress plus the
official legacy seven-day calendar are already integrated and tested.

Reliability:
4/5

Implementation Cost:
3/5 — composition, aggregate budget, private Renderer card, and Standalone
presentation over existing services.

Maintenance Risk:
2/5

Source Risk:
1/5

Possible Sources:
Existing `get_collection_intelligence`, `get_collection_backlog`, and
`get_collection_schedule` services; official v0 collection/episode operations
and official legacy `/calendar`. No HTML, snapshots, or new auth semantics.

Potential Capability:
`get_collection_dashboard`

Potential Renderer:
`CollectionDashboard`

Derived Logic:
`collection-dashboard-v1` composes the three sections with sequential top-level
bounded scheduling (the schedule section retains bounded calendar/collection
concurrency) and an explicit aggregate collection-row, backlog-subject,
episode-row, calendar-row, output-row, deadline, retry, and concurrency budget. Each section retains its own source,
formula, retrieval time, coverage, warnings, and degraded state; overall
`complete` is emitted only when all sections are complete, otherwise the result
is partial or an explicit all-source failure state. The dashboard does not infer
completion, history, recommendations, taste, or a transactional snapshot and
does not return comments or accept arbitrary usernames.

Provenance:
Selected from synchronized Harness V3 `master` in Outer Run Issue #17 after a
canonical six-lane audit. The live Bangumi calendar exposes a seven-day plan and
daily counts, while the repository's collection intelligence, backlog, and
schedule surfaces remained separate Agent calls/cards. This is an independent
safe read-only composition that closes the complete personal collection
journey without reopening authentication, HTML, Structured Web, or write
boundaries.

---

## OP-012 Subject Statistics Intelligence

Status:
SELECTED_IN_HARNESS_V3_EPOCH / SUBJECT-STATS-INTELLIGENCE-V1

User questions:

“这个条目的评分分布集中还是分散？评分人数和官方评分直方图是否一致？”

“收藏状态如何分布，当前样本里的看过完成率是多少？”

User Value:
5/5

Agent Leverage:
5/5

Information Gain:
5/5 — one bounded call turns an existing raw stats seam into a reusable,
evidence-bearing answer for both Agents and presentation surfaces.

Data Availability:
5/5 — official v0 already supplies the score, rank, rating total, ten rating
buckets, and five collection buckets.

Reliability:
4/5 — raw values are official v0; derived percentages and dispersion are
deterministic formulas, while the collection completion denominator is retained
as empirically verified rather than an official contract.

Implementation Cost:
3/5 — a new semantic adapter, formula descriptor, image-free Renderer card,
Standalone route, tests, and catalog/docs updates over existing provider seams.

Maintenance Risk:
2/5

Source Risk:
1/5

Possible Sources:
Official v0 `getSubjectStats`; derived-s7 rating percentages, histogram mean,
population standard deviation, collection percentages, and completion rate. No
HTML, Structured Web, snapshots, history, community statistics, or private
collection data.

Potential Capability:
`get_subject_stats_intelligence`

Potential Renderer:
`SubjectStatsIntelligence`

Derived Logic:
`subject-stats-intelligence-v1` preserves the official rating histogram and
collection buckets, computes versioned percentages and population standard
deviation, retains upstream score versus histogram-mean conflicts, and computes
`collect / (wish + collect + doing + on_hold + dropped)` with empirical-verification
evidence. Zero populations are `not_computable`; malformed, partial, unavailable,
and not-found inputs remain explicit. The result never turns dispersion into a
quality, polarization, or recommendation score and does not claim historical or
cross-subject trends.

Provenance:
Selected from synchronized `master` at `bae48a42cfee4b4a9db4c8f2615e0b5f16a081c9`
in Harness V3 Outer Run Issue #23 after the six-lane discovery audit. Existing
product surfaces already exposed raw subject stats and tested formula primitives,
but Agents lacked one evidence-bearing semantic result, Renderer card, and
Standalone command. The Epoch stays within the public read-only source boundary.

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

Status:
DELIVERED_IN_PERSON_COLLABORATION_V1 / BOUNDED_OFFICIAL_V0

User questions:

“找出和某导演合作次数最多的编剧，并列出共同作品。”

“这位人物与哪些人合作最频繁？”

User Value:
5/5

Agent Leverage:
5/5

Information Gain:
5/5

Data Availability:
4/5 — official v0 exposes person-to-work/character and subject-to-person/character relations

Reliability:
4/5 — shared-work observations are official and stable-ID based, but the graph is bounded and source labels are not a normalized taxonomy

Implementation Cost:
3/5 — bounded subject fan-out with deterministic concurrency and output caps

Maintenance Risk:
3/5

Source Risk:
1/5 for the shipped path; community/HTML sources remain outside the product scope

Possible Sources:
Official v0 `/v0/persons/{person_id}/subjects`, `/characters`, and per-subject
`/persons`, `/characters` endpoints.

Potential Capability:
`get_person_collaboration`

Potential Renderer:
`PersonCollaboration`

Notes:

The shipped bounded capability starts from one official person relation list,
selects at most 120 relation rows and 36 unique subjects, and fan-outs at most
four official subject relation requests concurrently. It deduplicates counts by
stable person and subject ID, ranks by observed shared-subject count and raw
credit-row tie-breakers, and preserves each shared work plus target and
collaborator source labels. `targetRole` is a literal source-label filter;
`collaboratorRole` is limited to the official staff `relation` field. Voice
actor endpoints do not expose a collaborator role, so actor `career` is never
used as a substitute. The Agent, image-free Renderer, Standalone command, unit,
semantic, render, catalog, and ledger surfaces share the same bounded contract.

The result is explicitly not a complete industry graph, historical trend,
workload or relationship-strength measure, and it does not enable the deferred
community/Structured Web source frontier.

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
