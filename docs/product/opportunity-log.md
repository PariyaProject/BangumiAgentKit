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
PARKED_REVIEW_LIMIT_IN_PR-7G

User question:

“物语系列到底应该怎么看？”

Notes:

PR-7G delivered a bounded official-v0 implementation Candidate and green exact
CI, but its two-launch milestone review budget was exhausted after Sol #2
returned `CORRECTIVE_REQUIRED`. The direction remains recoverable on
`codex/pr-7g-series-watch-order` / PR #2 and is not reopened by PR-7H. Findings
cover direct relation-label conflicts, deeper chain/order semantics,
media/maxNodes contract alignment, and explicit edge-evidence truncation.

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

---

## OP-008 Evidence-Bearing Subject Discovery Presentation

Status:
ACTIVE_IN_PR-7H_REVIEW_READY

User questions:

“今年七月有哪些后宫动画？”

“2024 年最热门的异世界动画有哪些，结果覆盖到哪里？”

“为什么这个高级筛选结果是部分的，哪些条件由官方接口直接支持？”

User Value:
5/5

Agent Leverage:
5/5

Data Availability:
5/5

Reliability:
4/5

Possible Sources:
Existing official v0 `query_subjects` provider seam (S1) plus deterministic
renderer derivation (S7). No new source is selected.

Product Gap Evidence:

`bangumi.query_subjects` already exposes bounded media/date/tag/concept/rating/
ranking filters, a compiled plan, hydration budget, coverage, warnings, and
field-level evidence. The existing renderer only has the legacy keyword
`search-list` card and `bangumi.render_search`; it cannot present the advanced
query plan, evidence boundary, partial state, or explain output. The gap is
therefore a human-facing presentation seam, not another provider or query
semantic expansion.

Selected Capability:

`bangumi.render_query_subjects` — execute the existing bounded read-only
discovery engine and render its typed result without changing query semantics.

Selected Renderer:

`discovery-results` card showing the controlled query summary, ordered result
items, score/rank/collection facts when known, source/evidence boundary,
pushdown/post-filter explanation, coverage, warnings, and explicit partial /
unsupported /
unavailable states at mobile and desktop widths.

Why selected:

It closes a high-value North Star gap for the already-built discovery engine,
improves both Agent-to-human handoff and visual information density, and stays
independent of the parked PR-7G implementation. It is read-only, bounded by the
existing engine budgets, official-source only, and does not touch auth, SSRF,
credentials, persistence, writes, HTML/Structured Web policy, or migrations.

Explicit limitations:

The card must preserve the engine’s estimated-total and experimental-search
limitations. It must not imply that a bounded result is a complete Bangumi
database enumeration, must not invent missing fields, and must not render raw
evidence URLs as trusted markup. Query semantics remain in the existing engine;
PR-7H is presentation and tool orchestration only.

Parking relationship:

PR-7G remains parked at `PARKED_REVIEW_LIMIT` on
`codex/pr-7g-series-watch-order` / PR #2. PR-7H is independent and does not
reopen or alter PR-7G.
