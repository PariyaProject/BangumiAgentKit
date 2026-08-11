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

Reusable Goal execution profiles live under `docs/agent/goals/`. When a
`/goal` invocation selects a profile, read it after the mandatory governance
documents above and before acting. A profile may narrow execution mode or
specialize an explicitly authorized model, subagent, or review budget, but it
must never weaken this file's security, source, Git, human-approval, Freeze, or
governance rules. Goal profiles are execution overlays, not competing sources
of repository policy or runtime progress.

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
→ SATISFY THE RECORDED REVIEW TIER WITHIN ITS TOTAL BUDGET
→ FIX REVIEW FINDINGS
→ FREEZE THE EXACT CANDIDATE WHEN THE RECORDED TIER IS SATISFIED
→ APPLY THE RECORDED POST-FREEZE INTEGRATION POLICY
→ COMPLETE THE BRANCH LIFECYCLE OR STOP AT A DOCUMENTED BLOCKER

Follow:

`docs/agent/BUDGET_FIRST_EXECUTION.md`

and:

`docs/agent/AUTONOMOUS_REVIEW_POLICY.md`

for exact Goal, review-budget, freeze and stopping rules.

## Goal and Agent Budget

A Goal covers one substantial vertical Product Cycle or milestone and must have
a verifiable stopping condition. It may contain many commits and several hours
of Luna Max work. Commit count, stage completion, individual test fixes, and
incremental refactors are never review triggers. `FROZEN` proves the exact
Candidate satisfied its quality gate; it completes the Goal only when the
recorded Integration Policy is `STOP_AT_FREEZE` or integration is not
applicable. `AUTO_MERGE_AFTER_FREEZE` continues through the authorized
integration and cleanup lifecycle to `MERGED_GOAL_COMPLETE`. Never select or
implement the next Product Cycle inside the same Goal without fresh user
authorization.

Use one primary thread by default. Do not spawn implementation or exploration
subagents unless the user explicitly authorizes the specific use or a repository
skill requires it. A Sol review launch additionally requires the user-authorized
Cycle Plan and ledger to record its Review Tier, total budget, and readiness.

The standing implementation model is GPT-5.6 Luna at `max` reasoning. If `max`
is temporarily unavailable, `xhigh` is the minimum acceptable Luna effort.
Never lower Luna to `medium`, `high`, `low`, or `none` for cost control. Control
cost by reducing agent launches and reserving Sol for milestone gates.

Every Cycle Plan must select a Review Tier before implementation:

- `TIER_0`: zero Sol launches for documentation, tests, non-behavioral
  maintenance, and trivial internal work;
- `TIER_1`: one comprehensive `sol_milestone_reviewer` launch; this is the
  default for normal product milestones;
- `TIER_2`: at most two sequential Sol launches total, reserved for unusually
  high-risk or high-value milestones.

Reviews are never parallel. A launch counts when a reviewer starts, including
one that later fails or terminates. Wait and poll calls on that same reviewer do
not consume launches. A transient wait timeout while the reviewer remains
running is not reviewer failure and must continue waiting on the same reviewer.
Sol uses `high` reasoning by default; `xhigh` requires explicit authorization
for an exceptionally critical review. Never launch Sol beyond the recorded tier
budget. `AUTONOMOUS_REVIEW_POLICY.md` owns the canonical reviewer runtime-state
semantics.

## Independent Review

The implementation agent MUST NOT approve its own `TIER_1` or `TIER_2` Freeze
Candidate. `TIER_0` may complete without Sol only when the Cycle Plan establishes
that product behavior and frozen contracts cannot change.

For `TIER_1`, one independent `sol_milestone_reviewer` performs a comprehensive
review of correctness, architecture, security, frozen contracts, tests,
evidence and coverage, resource bounds, user value, Agent UX, and Renderer when
applicable. Existing `sol_code_reviewer` and `sol_product_reviewer` roles remain
available only for an explicitly planned `TIER_2` sequence. Every reviewer must
inspect the actual repository and evidence and must not trust the implementation
report alone.

For `TIER_1`, `CORRECTIVE_REQUIRED` allows Luna to fix findings and persist a
corrected Candidate, but no second Sol launch is automatic. Stop at
`CORRECTED_AWAITING_REVIEW_AUTHORIZATION` unless the user explicitly grants new
budget or upgrades the Cycle to `TIER_2`.

For `TIER_2`, an unattended sequence may use Sol #1, Luna correction, then Sol
#2. Sol #3 is never automatic. If the total two-launch ceiling is exhausted
without a PASS on the final Candidate, stop.

If a reviewer returns `HUMAN_REVIEW_REQUIRED`,
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

Never use `git worktree` or create an additional Git working tree for this
repository. Use the existing checkout and ordinary branches only. Never
automatically commit, stash, reset, rewrite, or otherwise relocate unrelated
user work. Preserve unrelated dirty files untouched and work safely on the
current branch when possible. If a required branch operation cannot be
performed without touching that work, record the blocker and stop.

Before moving, merging, resetting, or pushing `master`, inspect its relationship
to `origin/master`, all unpublished local commits, and the active feature branch.
Do not publish unrelated local commits merely to deliver a governance change.
Any intentional rewrite or removal of an unpublished local `master` commit
requires explicit human authorization after reporting where that commit remains
recoverable.

Never force-push shared frozen history.

Never create release tags or publish packages autonomously.

An explicitly authorized Product Cycle starts from a clean, current `master`
and uses one dedicated ordinary feature branch and one PR for that milestone.
Do not implement a new Product Cycle directly on `master`, reuse a completed
milestone branch, or let one branch silently accumulate later Cycles.
Governance-only maintenance may run directly on `master` only when explicitly
scoped and safe.

Every implementation Freeze Candidate requires:

- exact Candidate SHA
- relevant local tests
- mandatory remote CI on the exact Candidate SHA
- the review evidence required by its recorded Review Tier
- no unresolved P0/P1 blockers

Do not spend the review budget until the Candidate SHA is clean, locally
validated, and green in mandatory remote CI. Do not create a follow-on Product
Cycle after Freeze or merge without fresh user authorization. For an explicitly
recorded `AUTO_MERGE_AFTER_FREEZE` feature milestone, complete the canonical
integration safety gate. This includes safely fetching the target base and
requiring its current remote SHA to equal the Cycle's recorded Base SHA; drift
is `INTEGRATION_BLOCKED_BASE_DRIFT`, never an automatic rebase or merge. Use a
merge commit by default, prove the frozen SHA is an ancestor of the pushed base,
retire the feature branch safely, and return to a synchronized `master`. If any
other gate fails, record `INTEGRATION_BLOCKED` and stop.

Review metadata may be committed after the implementation Candidate
according to the two-SHA freeze model in
`AUTONOMOUS_REVIEW_POLICY.md`.
