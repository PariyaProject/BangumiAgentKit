# BangumiAgentKit Product Opportunity Log

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
