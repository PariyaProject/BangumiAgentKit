# BangumiAgentKit Product Execution Status

## North Star

Build BangumiAgentKit into the most complete, trustworthy, intelligent,
agent-friendly and visually excellent Bangumi Product Intelligence Layer.

Primary governance:

- `AGENTS.md`
- `docs/agent/BUDGET_FIRST_EXECUTION.md`
- `docs/agent/AUTONOMOUS_PRODUCT_EVOLUTION.md`
- `docs/agent/AUTONOMOUS_REVIEW_POLICY.md`
- `docs/agent/goals/AUTONOMOUS_MILESTONE.md`
- `docs/agent/goals/AUTONOMOUS_EVOLUTION_TIER2.md`

---

## Governance Mode

`BUDGET_FIRST_SINGLE_THREAD + AI_REVIEW_AT_PRODUCT_EPOCH + HUMAN_ON_EXCEPTION`

Standing execution defaults:

- one GPT-5.6 Luna primary thread at `max` reasoning;
- Luna `xhigh` only as the minimum availability fallback;
- generic implementation and research subagents disabled;
- sequential Product Review Epoch review only; never parallel;
- one coherent Product Review Epoch per feature branch and PR; multiple related
  Work Packages may live inside it;
- `LUNA_STABLE` and reviewer polling create zero Git churn;
- no Git worktree;
- no cross-milestone continuation unless the user explicitly selects the
  self-evolution profile.

---

## Persistent Goal Ledger

Goal Scope:

`NONE — NO ACTIVE PRODUCT GOAL OR CYCLE`

`TIER_0` governance maintenance on `master`. The corrective in the commit
containing this ledger adopts Product Review Epochs as the sparse Sol boundary,
defines Work Package and logical `LUNA_STABLE` semantics, prohibits polling Git
churn, and preserves the accepted four-launch outer Sol ceiling. It does not
start or resume product evolution. PR-7G and PR-7H remain untouched historical
product branches for a separate controlled recovery action.

Explicit Non-Scope:

- selecting or implementing the next Product Cycle;
- reopening PR-7D, PR-7E, PR-7F, PR-7G, or PR-7H;
- modifying frozen production implementation or tests;
- launching a generic subagent or Sol reviewer;
- creating a feature branch, PR, release, package, or tag;
- stashing, resetting, rewriting, relocating, or committing unrelated user
  work.

Stopping Condition:

This maintenance task ends after the governance-only corrective is validated,
committed, and pushed to `master`. Future product work requires an explicit Goal
profile: execute-only mode requires a separately selected active milestone;
self-evolution mode authorizes discovery and safe milestone selection during
that outer Goal session.

Selected Product Goal Profile:

`NONE — governance maintenance only`

Outer Goal State:

`INACTIVE`

Current Milestone State:

`BETWEEN_MILESTONES`

Current Product Review Epoch:

`NONE`

Current Work Packages / `LUNA_STABLE` Summary:

`N/A — runtime-only unless included in an already-required durable checkpoint`

Review Boundary Rationale:

`N/A — TIER_0 governance maintenance; no Product Review Epoch selected`

Current Phase:

`READY_FOR_PROFILE_SELECTION`

Profile-dependent no-cycle semantics:

- `UNATTENDED_TIER2`: `NO_ACTIVE_PRODUCT_CYCLE` means report missing milestone
  selection/authorization and stop;
- `AUTONOMOUS_EVOLUTION_TIER2`: `NO_ACTIVE_PRODUCT_CYCLE` means enter
  `OPPORTUNITY_DISCOVERY` and select a substantial safe milestone.

Primary Model / Reasoning:

- primary: GPT-5.6 Luna;
- preferred reasoning: `max`;
- minimum availability fallback: `xhigh`;
- lower Luna reasoning: prohibited.

Generic Subagent Budget Authorized / Consumed:

`0 / 0`

Review Tier:

`TIER_0` for this governance-only corrective; no Product Cycle is active.

Total Sol Review Budget Authorized / Consumed:

`0 / 0`

Outer Sol Review Budget Authorized / Consumed:

`N/A / 0 — no self-evolution Goal is active`

Current Outer Review Budget State:

`INACTIVE`

Candidate SHA:

`N/A — no implementation Candidate`

Exact-SHA CI:

`N/A — governance-only maintenance with no production or test change`

Integration Policy:

`N/A — no active feature milestone`

Target Base Branch:

`master`

Base SHA:

`23f960ce3a8a8ac3841b791061a648037a53ab19` at this corrective's start.

Current Target Base SHA:

`N/A — no active integration attempt`

Feature Branch:

`N/A`

Pull Request Number:

`N/A`

Merge Strategy:

`N/A`

Branch Cleanup Policy:

`N/A`

Integration State:

`NOT_APPLICABLE`

Implementation Frozen SHA:

`N/A for the current maintenance task`

Merge Commit SHA:

`N/A for the current maintenance task`

Next Action:

`SELECT A GOAL PROFILE`

- Choose `UNATTENDED_TIER2` only after explicitly selecting an active milestone.
- Choose `AUTONOMOUS_EVOLUTION_TIER2` to authorize continuous discovery,
  milestone selection, and safe execution during that outer Goal session.

No profile is invoked by this governance corrective, and no opportunity is
selected now.

Human Authorization State:

`NO PRODUCT GOAL PROFILE CURRENTLY ACTIVE`

Execution-budget pause state:

`N/A`. When active, `PAUSED_BY_EXECUTION_BUDGET` must persist outer state,
current milestone/phase, branch, `HEAD`, latest stable commit, tests/CI, review
and subagent usage, blockers, and exact next action.

Outer review-budget pause state:

`N/A`. When active, `PAUSED_BY_OUTER_REVIEW_BUDGET` must persist selected
profile, outer Sol authorized/consumed, milestone and phase, milestone Sol
authorized/consumed, branch, `HEAD`, latest stable Candidate, tests/CI,
outstanding findings, parked directions, and exact next action.

---

## Reviewer Runtime Reference

`docs/agent/AUTONOMOUS_REVIEW_POLICY.md` is the canonical source. A wait or
poll timeout while the same reviewer remains running is
`WAIT_TIMEOUT_REVIEWER_STILL_RUNNING`: keep the reviewer open and continue
waiting with zero additional milestone or outer launch consumption and zero
tracked-file edits, ledger/Plan updates, wait artifacts, commits, pushes, CI
reruns, PR changes, or Candidate changes. Wait counts are never persisted. Only
actual termination, overall hard timeout, crash, platform failure, or another
unrecoverable state may become a terminal reviewer failure. A historical
`REVIEWER_RUNNING` checkpoint becomes `REVIEWER_RUNTIME_UNKNOWN` until runtime
availability is reconciled after resume. Tier budgets remain `0 / 1 / 2` total
launches, the Self-Evolution outer ceiling is `4`, reviews remain sequential,
and Sol #3 is prohibited.

---

## Completed PR-7D / PR-7E / PR-7F Program

The cumulative program is complete and must not be reopened by this ledger.

### Integration Record

- PR: `#1`, `feat: add person, calendar and revision intelligence`
- recorded PR state: `MERGED`
- target base: `master`
- retired head: `codex/pr-7d-person-staff`
- pre-merge master: `85b07f2df2968f7880a9be6950b6d479a895234d`
- feature tip: `683f78d98c809f58d525ccf2536df4ab72af2ee4`
- Implementation Frozen SHA:
  `433e80cf1da7a5994513053c3391487d1c911a3e`
- merge commit: `5424131e124b5f2927fb3abb7f2fcb1942745ce3`
- integration/governance record that closed this historical program:
  `f096918354b90feda4971fe5565160705cb6a7ac`

The merge used non-squashed merge history. The frozen Candidate is an ancestor
of pushed `master`; local and remote feature branches were deleted after the
merge and ancestry checks. Local `master` and `origin/master` both pointed to
`f096918354b90feda4971fe5565160705cb6a7ac` when that historical integration
record was completed.

### Exact-Candidate evidence

Candidate `433e80cf1da7a5994513053c3391487d1c911a3e` passed GitHub Actions run
`31463062377` across all six mandatory jobs. Local validation, User QA, Agent
QA, representative Renderer QA, and the Luna consolidated preflight were
recorded before review. The one-off manual finalization
`sol_milestone_reviewer` returned `PASS` with no P0/P1 findings; see
`docs/product/reviews/PR-7F/manual-finalization-review.md`.

The reviewed production implementation is frozen. Later integration and
governance records do not change the Implementation Frozen SHA.

### Historical wait-timeout correction

The earlier Sol #1 event is preserved as history: one reviewer was launched,
one wait call returned `timed_out: true`, the reviewer was still running, and
the old harness then closed it without a verdict. Under the corrected canonical
semantics, the wait result itself would have been
`WAIT_TIMEOUT_REVIEWER_STILL_RUNNING`, not a reviewer failure; the correct
action would have been to continue waiting on that same launched reviewer at
zero additional launch cost. Closing the running reviewer produced the actual
terminal state `REVIEWER_TERMINATED_NO_VERDICT`. This clarification does not
fabricate a verdict, refund the historical launch, or reopen PR-7F.

Historical pre-profile attempts and the one-off manual finalization review
remain recorded in their original artifacts. They do not authorize any future
Sol launch.

### Completed Product Cycles

#### PR-7D — Person / Seiyuu / Staff Intelligence

- state: `FROZEN`
- Implementation Frozen SHA:
  `84e32b3366c62346e14d154bb740fb5c480e96f9`
- freeze record: `docs/product/reviews/PR-7D/freeze-record.md`

#### PR-7E — Calendar / Schedule Intelligence

- state: `FROZEN`
- Implementation Frozen SHA:
  `d53d800c5497cacd156792b1139ab7f2a696cdbe`
- freeze record: `docs/product/reviews/PR-7E/freeze-record.md`

#### PR-7F — Revision / Change History Intelligence

- state: `FROZEN` and integrated;
- Implementation Frozen SHA:
  `433e80cf1da7a5994513053c3391487d1c911a3e`
- exact Candidate CI: run `31463062377`, six mandatory jobs successful;
- manual finalization review: `PASS`, no P0/P1 findings;
- review record: `docs/product/reviews/PR-7F/manual-finalization-review.md`.

### Historical corrective source

The six post-Candidate PR-7F files were preserved in user Git stash commit
`8df0121` and incorporated into the clean Candidate without modifying or
consuming that preserved source. Their stable binary patch fingerprint is
`ac421b1afb521d85ef9c3162f2ca192ccd07379ad9f3607b6386ea743abf57f7`.
Future governance work must not modify or consume that stash.

---

## Human Review Queue

Open protected-decision items: `0`

Human-gated opportunities must be parked under
`docs/product/human-review-queue/`. Parking an item stops execute-only mode. In
self-evolution mode it parks that direction and returns to discovery for another
independent safe milestone; the protected decision remains prohibited.
