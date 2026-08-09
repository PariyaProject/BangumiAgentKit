# BangumiAgentKit Agent Instructions

## Product North Star

BangumiAgentKit aims to become the most thoughtful, complete,
trustworthy, intelligent, agent-friendly and visually excellent
Bangumi Product Intelligence Layer.

It should capture the useful information richness of bgm.tv and,
where reliable data permits, exceed the website through aggregation,
analysis, relationships, history, personalization and better presentation.

Before substantial product work, always read:

- `docs/agent/AUTONOMOUS_PRODUCT_EVOLUTION.md`
- `docs/agent/AUTONOMOUS_REVIEW_POLICY.md`
- `docs/product/loop-status.md`
- `docs/product/opportunity-log.md`

If an active cycle plan is referenced by `loop-status.md`, read it too.

## Autonomous Development Model

The default governance mode is:

AI_REVIEW_IN_LOOP + HUMAN_ON_EXCEPTION

The implementation/orchestration agent may autonomously:

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
→ REQUEST INDEPENDENT AI REVIEWS
→ FIX REVIEW FINDINGS
→ AUTO FREEZE WHEN APPROVED
→ CONTINUE TO NEXT SAFE PRODUCT CYCLE

Follow:

`docs/agent/AUTONOMOUS_REVIEW_POLICY.md`

for exact freeze and continuation rules.

## Independent Review

The implementation agent MUST NOT approve its own Freeze Candidate.

Every Product Cycle Freeze Candidate must be independently reviewed by:

- `sol_code_reviewer`
- `sol_product_reviewer`

Both reviewers must inspect the actual repository and evidence.

They must not trust the implementation report alone.

If either reviewer returns `CORRECTIVE_REQUIRED`,
the implementation agent must fix the findings and request fresh reviews.

If either returns `HUMAN_REVIEW_REQUIRED`,
the affected decision must be parked under:

`docs/product/human-review-queue/`

Do not implement that protected change.

Continue with another independent safe opportunity when possible.

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

Encountering one protected decision does NOT automatically stop the
whole Autonomous Loop.

Park the decision and continue with another safe opportunity.

Stop only if no valuable independent safe work remains.

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
the active Cycle indefinitely.

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

Review metadata may be committed after the implementation Candidate
according to the two-SHA freeze model in
`AUTONOMOUS_REVIEW_POLICY.md`.