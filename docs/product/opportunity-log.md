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
ACTIVE_IN_PR-7G_VALIDATING

User question:

“物语系列到底应该怎么看？”

Discovery update (2026-08-11):

The repository exposes one-hop official-v0 subject relations, but the current
semantic boundary returns only raw relation rows. The official v0 relation
contract supplies a relation label and media type, not a canonical watch order
or a universal franchise ontology. A bounded, evidence-bearing recommendation
can still answer the common anime-only question if it preserves the raw labels,
uses a small traversal/detail budget, and reports ambiguity, exclusions, and
coverage instead of presenting an inferred order as authoritative.

Scores:

- User Value: 5/5
- Agent Leverage: 5/5
- Information Gain: 5/5
- Data Availability: 5/5
- Reliability: 4/5
- Implementation Cost: 3/5
- Maintenance Risk: 2/5
- Source / Policy Risk: 1/5

Possible Sources:

Official v0 `GET /v0/subjects/{subject_id}/subjects` and, within a bounded
request budget, official v0 subject detail for dates, types, names, and images.
No HTML, Structured Web, snapshot, authentication, or write source is selected.

Potential Capability:

`get_series_watch_order` — a bounded, deterministic viewing-order
recommendation with raw relation evidence, coverage, and explicit
not-computable/partial states.

Potential Renderer:

`SeriesRelations / WatchOrder` mobile-readable card with the root subject,
recommended steps, relation labels, excluded media, coverage, and limitations.

Why selected:

It is an independent safe vertical slice with high user value and agent
leverage, reuses the existing official-v0 seam, and closes a visible semantic
and renderer gap without changing authentication, source policy, persistence,
or write authority. It also provides a useful foundation for later franchise
navigation without committing to a broader graph ontology.

Explicit limitations:

The source does not publish a canonical order. The result is a bounded
recommendation, not a fact that every viewer must follow. Relation labels remain
visible, date ties and unknown labels remain ambiguous, traversal is capped,
and non-anime assets are summarized as excluded rather than silently treated as
watch steps.

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
