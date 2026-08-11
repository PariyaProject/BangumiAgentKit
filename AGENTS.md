# BangumiAgentKit Agent Instructions

## Product North Star

BangumiAgentKit aims to become the most thoughtful, complete,
trustworthy, intelligent, agent-friendly and visually excellent
Bangumi Product Intelligence Layer.

It should capture the useful information richness of bgm.tv and,
where reliable data permits, exceed the website through aggregation,
analysis, relationships, history, personalization and better presentation.

Before substantial product work, always read:

- `docs/agent/BUDGET_FIRST_EXECUTION.md`
- `docs/agent/AUTONOMOUS_PRODUCT_EVOLUTION.md`
- `docs/agent/AUTONOMOUS_REVIEW_POLICY.md`
- `docs/product/loop-status.md`
- `docs/product/opportunity-log.md`

If an active cycle plan is referenced by `loop-status.md`, read it too.

## Budget-First Development Model

The default governance mode is:

BUDGET_FIRST_SINGLE_THREAD +
AI_REVIEW_AT_MILESTONE +
HUMAN_ON_EXCEPTION

The default execution path is:

OBSERVE
→ DISCOVER PRODUCT OPPORTUNITIES
→ RESEARCH
→ DESIGN
→ IMPLEMENT
→ TEST
→ USER QA
→ AGENT QA
→ VISUAL QA when applicable
→ CREATE FREEZE CANDIDATE
→ STOP FOR THE REVIEW GATE
→ REQUEST INDEPENDENT AI REVIEWS ONLY WITHIN THE RECORDED BUDGET
→ FIX REVIEW FINDINGS
→ AUTO FREEZE WHEN APPROVED
→ STOP THE GOAL

Follow:

`docs/agent/BUDGET_FIRST_EXECUTION.md`

and:

`docs/agent/AUTONOMOUS_REVIEW_POLICY.md`

for exact Goal, review-budget, freeze and stopping rules.

## Goal and Agent Budget

A Goal covers one coherent Product Cycle or milestone and must have a verifiable
stopping condition. Freezing that milestone completes the Goal. Never select or
implement the next Product Cycle inside the same Goal without fresh user
authorization.

Use one primary thread by default. Do not spawn implementation, exploration, or
review subagents unless the user explicitly authorizes the specific use or a
repository skill requires it.

The standing implementation model is GPT-5.6 Luna at `max` reasoning. If `max`
is temporarily unavailable, `xhigh` is the minimum acceptable Luna effort.
Never lower Luna to `medium`, `high`, `low`, or `none` for cost control. Control
cost by reducing agent launches and reserving Sol for milestone gates.

The default automatic Sol budget for a Product Cycle is at most two launches:
one `sol_code_reviewer` and, when product-facing review is applicable, one
`sol_product_reviewer`. Every launch counts, including platform-limit failures.
Never retry a failed reviewer launch automatically.

## Independent Review

The implementation agent MUST NOT approve its own Freeze Candidate.

Every Product Cycle Freeze Candidate must be independently reviewed by:

- `sol_code_reviewer`
- `sol_product_reviewer`

Both reviewers must inspect the actual repository and evidence.

They must not trust the implementation report alone.

If either reviewer returns `CORRECTIVE_REQUIRED`,
the implementation agent must consolidate and fix the findings, validate a new
Candidate, mark it `CORRECTED_AWAITING_REVIEW_AUTHORIZATION`, and stop. Fresh
reviews require explicit user authorization and a newly recorded budget.

If either returns `HUMAN_REVIEW_REQUIRED`,
the affected decision must be parked under:

`docs/product/human-review-queue/`

Do not implement that protected change.

Stop the current Goal after parking the protected decision. A different safe
opportunity requires a new user-authorized Goal.

## Human-On-Exception Boundaries

Human approval remains required before implementing:

- authentication trust-model changes
- principal / authorization model changes
- weakening SSRF or security boundaries
- token, cookie or credential handling expansion
- destructive/write authority expansion
- broad default enablement of Structured Web or HTML sources
- aggressive crawling
- major irreversible semantic database migrations
- license/legal-policy changes
- breaking frozen public contracts without a safe compatibility path
- release / package / tag publication

Encountering one protected decision stops the current Goal after the decision is
parked. It does not authorize unrelated continuation.

## Frozen Foundations

Do not casually reopen frozen foundations.

If a frozen contract blocks a high-value capability, create a:

FOUNDATION CHANGE PROPOSAL

with:

- blocked capability
- why current contract is insufficient
- smallest proposed change
- compatibility impact
- migration risk
- alternatives

Then classify it according to the Autonomous Review Policy.

## Progress Management

`docs/product/loop-status.md`
is the canonical persistent execution ledger.

Update it after meaningful milestones and before interruption.

`docs/product/opportunity-log.md`
is the canonical product opportunity backlog.

New ideas outside the active Cycle belong there rather than expanding
the active Cycle indefinitely. Backlog entries are not authorization to start
another Cycle.

## Product Quality

Do not optimize for feature count.

A capability is mature only when it:

- solves meaningful user questions
- has correct semantics
- has truthful evidence and coverage
- handles partial / unknown / conflict / unavailable states honestly
- is easy for an Agent to use correctly
- has useful human-facing output
- has excellent visual output when rendering is relevant

Never fabricate certainty.

## Renderer Quality

Renderer is a first-class product surface.

A successfully generated PNG is not sufficient evidence of quality.

When rendering is in scope, perform representative visual QA for:

- information density
- layout hierarchy
- Chinese/Japanese typography
- covers and avatars
- long and missing fields
- mobile/chat readability
- partial/conflict/unavailable states

Aim to equal or exceed the useful information density of bgm.tv,
not blindly duplicate its visual design.

## Git / CI

Never force-push shared frozen history.

Never create release tags or publish packages autonomously.

Every implementation Freeze Candidate requires:

- exact Candidate SHA
- relevant local tests
- mandatory remote CI on the exact Candidate SHA
- independent AI review
- no unresolved P0/P1 blockers

Do not spend the review budget until the Candidate SHA is clean, locally
validated, and green in mandatory remote CI. Do not create a follow-on Product
Cycle after Freeze without fresh user authorization.

Review metadata may be committed after the implementation Candidate
according to the two-SHA freeze model in
`AUTONOMOUS_REVIEW_POLICY.md`.
