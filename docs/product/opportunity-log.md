# BangumiAgentKit Product Opportunity Log

## OP-001 Voice Actor Workload

Status:
SELECTED_FOR_PR-7D_BOUNDED

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

User question:

“物语系列到底应该怎么看？”

...

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
SELECTED_FOR_PR-7D

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
