# BangumiAgentKit Budget-First Execution Harness

This file is the canonical execution-cost contract for Codex Goals, subagents,
Product Review Epoch boundaries, milestone reviews, and autonomous continuation
in this repository. It is the only canonical source for the detailed Product
Review Epoch and Work Package semantics below.

Only the explicitly selected self-evolution profile may keep selecting Product
Cycles inside one outer Goal. It still obeys this file's per-milestone review
budgets and never retries or parallelizes reviewers beyond the recorded tier.
This file and `AUTONOMOUS_REVIEW_POLICY.md` take precedence over older
continuation or review-loop wording.

## Operating principle

Optimize for verified product value per unit of model usage, not parallelism,
agent count, commit count, or number of Product Cycles.

The default execution shape is one primary agent working in one thread. A
subagent is an exception with an explicit, bounded purpose.

The optimization objective is:

```text
MAXIMIZE MEANINGFUL PRODUCT PROGRESS PER SOL REVIEW
```

Preserve review quality, correctness, security, traceability, and
recoverability. Do not mechanically maximize commits, files, Work Packages, or
lines per review.

## Development hierarchy and review boundary

Use this hierarchy:

```text
PRODUCT NORTH STAR
  -> AUTONOMOUS EVOLUTION OUTER GOAL
  -> PRODUCT REVIEW EPOCH
  -> WORK PACKAGE
  -> TASK
  -> COMMIT
```

The default Sol boundary is the **Product Review Epoch**, not a commit, task,
implementation stage, or ordinary Work Package. A Product Review Epoch is one
coherent, reviewable product increment: a related group of work that completes
a meaningful user journey, Agent capability, product domain capability, or
tightly coupled architectural slice. Product coherence—not repository layout
or numeric size—defines the boundary.

For product development, one substantial milestone or Product Cycle is planned
as one Product Review Epoch. Existing `MILESTONE_*` runtime state names remain
valid compatibility names for that Epoch lifecycle. One Epoch normally uses
one feature branch and one eventual product PR.

### Work Packages and `LUNA_STABLE`

A Work Package is a meaningful implementation slice inside an Epoch, such as a
semantic capability, provider extension, analytics module, Agent-facing tool,
Standalone UX, Renderer section, relation traversal, or verification layer. A
Work Package may contain multiple meaningful engineering commits.

The normal Work Package lifecycle is:

```text
IMPLEMENT
  -> TARGETED VALIDATION
  -> LUNA MAX SELF-REVIEW
  -> LUNA_STABLE
  -> CONTINUE THE EPOCH
```

`LUNA_STABLE` is a logical runtime/project-management state, not a Git event.
It does not by itself justify editing the ledger or Plan, committing, pushing,
running remote CI, opening a PR, creating a Candidate, or launching Sol. Keep it
session-local or include it compactly in an already-required durable
checkpoint. Never create a standalone “mark Work Package Luna stable” commit.

An Epoch will often contain multiple related Work Packages, but it has no
numeric minimum. A single Work Package may be an Epoch when it is naturally
complete, independently high-risk, foundational, sufficiently substantial, or
unsafe to combine. Never manufacture scope to satisfy a count.

### Coherence and reviewability

Before adding another Work Package, ask:

1. Does it improve the same user journey, Agent capability, product domain, or
   tightly coupled architecture?
2. Will reviewing it together clarify cross-component behavior?
3. Will completing it before review avoid duplicated review work?

If mostly yes, it may belong in the Epoch. If mostly no, record it in the
opportunity backlog. Never bundle unrelated features merely to delay review.

Before Review Readiness, assess conceptual surface, independent subsystems,
frozen contracts, cross-cutting risk, test surface, and reviewer cognitive
load. Split before review when multiple loosely coupled product domains or
independent architectures make one rigorous review unrealistic. Numeric size
is only a warning to re-evaluate semantic coherence; commit count, file count,
and line count are never automatic split or review triggers. The objective is
the largest **coherent and reviewable** product increment, not the largest diff.

Sparse review does not override safety. An explicitly justified earlier review
may be required when a Work Package changes security foundations, data
integrity, persistent migration semantics, source trust boundaries, or a
foundational public contract on which substantial later work would depend.
Protected human-only boundaries remain human-only. “This feels important” is
not sufficient justification.

### Epoch Plan and Review Boundary Rationale

Before implementation, every product Cycle/Epoch Plan must include:

```text
## Review Boundary Rationale
```

It must explain why the Work Packages belong together, the user or Agent
journey they complete, related work intentionally included, adjacent work
intentionally deferred, why review now is more valuable than earlier review,
and why extending the Epoch further would reduce coherence or reviewability.

It must also record these expected economics before implementation:

- Review Tier: `TIER_0`, `TIER_1`, or `TIER_2`;
- Expected Sol: normally `1` for a Sol-reviewed Epoch;
- Automatic Maximum: the tier maximum, never more than `2`;
- Outer Remaining Sol when self-evolution is active;
- Generic Subagents: `0` unless separately authorized.

The second `TIER_2` launch is corrective capacity, not the expected path.

### Epoch readiness test

Do not trigger Sol merely because something finished. Before declaring an
Epoch `REVIEW_READY`, Luna must establish all of the following:

1. the Epoch forms a meaningful end-to-end product increment;
2. the major related Work Packages that naturally belong together are done;
3. another closely related Work Package would not materially improve this same
   capability, or a recorded safety/reviewability reason requires review first;
4. one Sol reviewer can reasonably audit the Base..Candidate as one coherent
   system;
5. acceptance criteria and required UX are satisfied;
6. Luna's consolidated self-review has removed known obvious defects.

If a closely related high-value package clearly belongs and no safety reason
requires early review, continue Luna work. If further work belongs mainly to a
different theme, enter Review Readiness. Readiness means coherent and stable,
not theoretically perfect; later improvements may become later Epochs.

Sol reviews the complete Epoch as a system and seeks all known P0/P1 findings
in one pass. Sol is a final independent falsification layer, never the first
serious reviewer or an incremental debugger. Do not launch it for a failing
test, unclear ordinary implementation decision, completed Work Package,
successful compilation or render, CI failure, reassurance, or normal planning.

### Engineering, validation, and discovery discipline

Luna Max owns implementation, debugging, targeted inspection, edge and
negative paths, architecture consistency, frozen-contract awareness, Agent UX,
Renderer QA when applicable, obvious performance/resource issues, and the
consolidated Base..Candidate self-review.

Use targeted tests and representative checks while developing each Work
Package, broader affected tests at meaningful integration boundaries, and the
complete required Epoch validation plus exact-SHA remote CI only at Review
Readiness. Do not run the full repository pipeline after every commit unless a
high-risk shared foundation warrants broader early validation. Reducing Sol
frequency never authorizes skipping correctness validation.

Opportunity discovery exists to select engineering work, not sustain an
endless research or documentation loop. Reuse persisted research and backlog
state, investigate only missing facts required for selection or design, and
start implementation once a defensible high-value Epoch is selected. New
unrelated ideas go to the mutable opportunity backlog with provenance rather
than into the active Epoch. Do not use Sol for planning or discovery.

### Commit, persistence, push, and PR hygiene

Every autonomous commit must represent meaningful durable engineering or
governance change. Meaningful `feat`, `fix`, `test`, `refactor`, and real
product/support documentation commits are encouraged, and an Epoch may contain
many of them. The objective is fewer review events, not fewer engineering
commits.

Never create standalone commits for reviewer waits, heartbeats, wait counts,
timestamps, “still running”, “checked again”, `LUNA_STABLE`, or phase wording
without a meaningful durable transition. Do not commit to demonstrate
activity. Batch closely related governance state when truthful; a healthy
review lifecycle normally needs planning/activation, many engineering commits,
an optional Candidate/reviewer-launch checkpoint, and verdict/corrective/Freeze
records—not one governance commit per transition.

Do not push merely because a local commit exists. Push for durable backup,
collaboration, Candidate publication, remote CI, or another repository need.
Avoid status-only pushes that trigger CI. Do not open one branch or PR per Work
Package.

The following interpretations are explicitly wrong:

- every Work Package or every N commits needs Sol;
- an Epoch must contain at least N Work Packages;
- Epochs should be as large as possible or a large diff proves efficiency;
- `LUNA_STABLE` or a reviewer wait timeout requires a Git commit;
- more governance commits automatically improve auditability;
- fewer reviews means fewer tests;
- unrelated work should be added to postpone review;
- Sol should select the Epoch during planning;
- every Work Package needs its own PR;
- Sol may start while the Candidate is changing or stop after its first finding;
- review cost permits skipping required review;
- the Task List is immutable or self-evolution means endless brainstorming.

## Repository checkout policy

Never use `git worktree` or create an additional Git working tree. All Git work
must use the repository's existing checkout and ordinary branches.

Before changing `master`, first inspect and report:

- the current branch and dirty files;
- local `master` versus `origin/master`;
- unpublished commits on local `master`;
- whether those commits are already reachable from a pushed feature branch;
- the exact commits that the proposed push would publish.

Do not push unrelated unpublished commits as a side effect of carrying a harness
or documentation change to `master`. Never automatically commit, stash, reset,
rewrite, or relocate unrelated user work. Preserve unrelated dirty files
untouched and work safely on the current branch when possible. If a genuinely
required branch operation cannot be performed without touching that work,
record the blocker and stop.

## Goal contract

Every Goal must select one execution profile and persist it in
`docs/product/loop-status.md`.

### Execute-only Goal

`UNATTENDED_TIER2` and the generic `AUTONOMOUS_MILESTONE` contract execute
exactly one already-authorized substantial vertical milestone. If no active
Cycle Plan exists, they report the missing selection/authorization and stop.
The configured Freeze/integration result or a documented blocker ends that
Goal. They never select the next Product Cycle.

### Self-evolution Goal

`AUTONOMOUS_EVOLUTION_TIER2` is an explicitly authorized outer Goal for
continuous safe product evolution during the current Goal/session. It does not
require a pre-existing active Cycle. If one exists, it resumes that milestone
without replacing it. Otherwise `NO_ACTIVE_PRODUCT_CYCLE` enters
`OPPORTUNITY_DISCOVERY`.

The outer Goal may contain multiple substantial Product Review Epochs. Each
Epoch remains a separate bounded Product Cycle/milestone with its own Plan,
ordinary feature branch, PR, Review Tier and launch ledger, Candidate,
exact-SHA evidence, Freeze, integration, and cleanup lifecycle. An Epoch may
contain multiple Work Packages, many tasks and commits, and several hours of
Luna Max work. Commit count, stage completion, Work Package stability,
individual test fixes, and incremental refactors never create review
boundaries.

Before either Goal mode acts, record:

- selected execution profile and outer Goal state;
- outer objective and explicit non-scope;
- outer stopping conditions;
- primary model/reasoning and generic subagent policy;
- current or most recently completed milestone and exact resumable next action.

When `AUTONOMOUS_EVOLUTION_TIER2` is explicitly invoked as a new outer Goal,
initialize its independent review ledger to `4 authorized / 0 consumed`. Do not
pretend this budget exists while no self-evolution Goal is active.

Before each Epoch implementation begins, additionally record:

- Epoch objective, Work Packages, representative user questions, and explicit
  non-scope;
- the required Review Boundary Rationale;
- acceptance criteria and validation commands or artifacts;
- Review Tier selected before implementation;
- total Sol launches authorized and consumed for this milestone;
- generic subagent launches authorized and consumed for this milestone;
- Integration Policy and the complete integration contract.

`FROZEN` means that the exact implementation Candidate satisfied its quality
and Review Tier gate. In execute-only mode, the configured Freeze or merge
result completes the Goal. In self-evolution mode, Freeze and integration are
one mature product checkpoint: persist evidence, update the living backlog and
runtime state, then return to observation and discovery. Review and subagent
accounting reset only when a genuinely new substantial milestone begins, never
for a corrective commit. A new milestone never resets the outer Goal Sol
ledger.

Self-evolution does not mean finishing a finite Task List. The Task List and
opportunity backlog are living implementation hypotheses. Luna may add, split,
merge, reorder, defer, or mark entries `SUPERSEDED` based on current repository
evidence, user and Agent value, Bangumi parity, dependencies, reliability, cost,
and source/maintenance risk. Every mutation must preserve its rationale and
provenance.

Do not create a Goal merely because a task could take several turns. Use a Goal
only when the user explicitly requests one and the stopping condition is already
verifiable.

Recommended starter form:

```text
/goal Complete [one milestone] without expanding into another Product Cycle.
Use one Luna Max primary thread. Non-review subagent budget: 0. Review Tier:
[TIER_0, TIER_1, or TIER_2]. Total Sol budget: [0, 1, or 2 launches]. Stop when
[verifiable end state] is reached, a fresh review needs authorization, or the
recorded budget is exhausted.
```

The canonical self-evolution invocation lives in
`docs/agent/goals/README.md`. Selecting it authorizes autonomous safe
opportunity discovery and milestone selection for the active outer Goal only;
it does not authorize protected human-only changes, generic subagents, releases,
or review launches beyond each milestone's tier.

## Self-evolution outer loop and stopping conditions

The canonical outer loop is:

```text
NO_ACTIVE_CYCLE
  -> OBSERVE
  -> PRODUCT_AUDIT
  -> OPPORTUNITY_DISCOVERY
  -> PRIORITIZATION
  -> EPOCH_SELECTION
  -> EPOCH_PLANNING
  -> EPOCH_ACTIVE
  -> IMPLEMENTING
  -> WORK_PACKAGE_LUNA_STABLE (runtime only; repeat without Git churn)
  -> VALIDATING
  -> REVIEW_READY
  -> SOL_REVIEW
  -> CORRECTIVE (when required)
  -> FREEZING
  -> POST_FREEZE_INTEGRATION (when applicable)
  -> MILESTONE_CHECKPOINT_COMPLETE
  -> UPDATE_BACKLOG_AND_STATE
  -> OBSERVE

SOL_REVIEW
  -> PARKED_REVIEW_LIMIT
  -> UPDATE_BACKLOG_AND_STATE
  -> OBSERVE

ANY_MILESTONE_PHASE
  -> PARKED_FOR_HUMAN
  -> UPDATE_BACKLOG_AND_STATE
  -> OBSERVE

ANY_OUTER_PHASE
  -> PAUSED_BY_EXECUTION_BUDGET
  -> PAUSED_BY_OUTER_REVIEW_BUDGET
```

At startup, an existing active milestone resumes at its persisted phase instead
of entering selection. Between milestones, Luna performs targeted read-only
product audits and opportunity discovery rather than repeating huge broad
research passes. Selection must choose a substantial vertical milestone using
real user value, Bangumi power-user value, Agent leverage, information richness,
data/source reliability, dependency fit, implementation cost, and maintenance
risk. Roadmap order alone is not authority.

A self-evolution Goal must not stop merely because no Cycle is active, one
milestone froze or merged, the current Task List was exhausted, one direction
was parked for human review, or one milestone exhausted its Sol budget. Valid
outer stop conditions are only:

- runtime, system, Codex quota, or explicit Goal budget exhaustion;
- the active outer Goal's Sol review budget is exhausted;
- user pause, stop, or changed direction;
- infrastructure or permission prevents further useful safe work;
- explicit opportunity discovery finds no meaningful independent safe work;
- repository state makes further mutation unsafe;
- governance mandates a global stop for a protected emergency.

Budget exhaustion is a pause, not product completion. Before stopping for it,
persist `PAUSED_BY_EXECUTION_BUDGET` with the selected profile, outer state,
current milestone and phase, branch, `HEAD`, latest stable commit, tests and CI,
review and subagent usage, blockers, and exact next action. Any outer stop must
leave repository state sufficient for a later Goal to resume without relying on
chat history.

## Model and thread routing

Default:

- one primary thread;
- no implementation subagents;
- no speculative parallel research agents;
- no reviewer launch before the entire Product Review Epoch reaches readiness;
- reviews are sequential and never parallel.

The standing implementation model is GPT-5.6 Luna with `max` reasoning. If
`max` is temporarily unavailable, Luna `xhigh` is the minimum fallback. Do not
use Luna at `medium`, `high`, `low`, or `none` to save budget.

Budget control applies to agent-launch count, duplicated context, and Sol usage;
it does not reduce Luna reasoning depth. A frontier model may still be used as
the primary thread when the user chooses it or when a high-risk task would
otherwise cause expensive rework.

Generic subagents may be used only when the user explicitly authorizes them or
when a repository skill explicitly requires them. Each subtask must be
independent and bounded. Authorized generic subagents use Luna `max` by default
and Luna `xhigh` only as the availability fallback.

Never spawn a subagent merely to reread context, restate a plan, run commands the
primary thread can run, or provide redundant reassurance.

## Review tiers and launch budget

Every Cycle Plan must record one Review Tier before implementation:

### `TIER_0` — zero Sol launches

Use only for documentation, tests, non-behavioral maintenance, and trivial
internal work where the Plan establishes that user behavior and frozen
contracts cannot change. Authorized / maximum Sol launches: `0`.

### `TIER_1` — one comprehensive Sol launch

This is the default for normal product Review Epochs. Authorized / maximum Sol
launches: `1`. Use `sol_milestone_reviewer`, which covers correctness,
architecture, security, frozen contracts, tests, evidence and coverage,
resource bounds, user value, Agent UX, and Renderer when applicable.

### `TIER_2` — at most two Sol launches total

Reserve for unusually high-risk or high-value Epochs, or select it through
the explicitly authorized `AUTONOMOUS_EVOLUTION_TIER2` profile. The Cycle Plan
must record the tier, reviewer identity, and sequential order. Authorized /
maximum Sol launches: `2` total, not two per role. Existing specialized
`sol_code_reviewer` and `sol_product_reviewer` roles may be selected only here.
They are not an automatic pair.

A `TIER_2` sequence must end with `sol_milestone_reviewer` performing a
comprehensive PASS on the exact final Candidate. A specialized reviewer may use
launch #1 for a deliberately narrow high-risk lane; launch #2 remains the final
comprehensive gate. If launch #1 is already comprehensive and returns PASS, the
review requirement is satisfied without spending launch #2.

All Sol launches are sequential. `.codex/config.toml` limits the session to one
concurrent agent thread. Sol uses `high` reasoning by default. `xhigh` may be
used only with explicit authorization for an exceptionally critical review; it
is not the normal automatic setting.

A launch counts when the reviewer is started. If that launched reviewer later
hard-times-out, hits a platform usage limit, crashes, is terminated, or returns
no verdict, the launch remains consumed. Wait or poll calls on the same reviewer
consume zero additional launches. In particular, a transient wait timeout while
the reviewer is still running is not a reviewer failure and must not trigger a
replacement launch. `AUTONOMOUS_REVIEW_POLICY.md` is the canonical source for
reviewer runtime states, the overall wall-clock limit, and failure
classification. Sol is never triggered by commit count, an implementation
stage, Work Package completion, an individual test fix, or an incremental
refactor.

The repository cannot read or enforce the user's live Plus quota. Launch count
is the deterministic budget proxy and must be recorded in
`docs/product/loop-status.md`.

## Self-evolution outer Sol launch budget

This additional ledger applies only to an active
`AUTONOMOUS_EVOLUTION_TIER2` outer Goal. Its default is:

- Outer Sol Launches Authorized: `4`;
- Outer Sol Launches Consumed: `0`.

It is independent from every milestone's `TIER_2` ledger. Do not raise or reset
the four-launch ceiling inside the same outer Goal. A fifth automatic launch is
prohibited; continuation with a fresh outer ledger requires a future explicit
self-evolution Goal invocation.

Before a Sol launch, both conditions must be true:

```text
milestoneRemainingSol > 0
AND
outerGoalRemainingSol > 0
```

Starting one reviewer consumes exactly one launch from both ledgers. The launch
remains consumed in both if that reviewer later hard-times-out, hits a platform
limit, crashes, terminates, or returns no verdict. Wait or poll calls on the
same running reviewer consume neither additional milestone nor outer budget.

Corrective commits reset neither ledger. A genuinely new substantial milestone
resets only its own per-milestone ledger; the outer authorized/consumed totals
continue unchanged for the entire outer Goal.

If a launch consumes the final outer slot, continue waiting for that already
running reviewer at zero additional cost and process its verdict truthfully. A
`PASS` may complete that exact reviewed milestone's Freeze/integration
checkpoint. Before any later reviewer launch—or before starting another
implementation milestone that requires mandatory `TIER_2` review—persist
`PAUSED_BY_OUTER_REVIEW_BUDGET` and stop the outer Goal.

If the outer remaining budget is zero before a required launch, do not launch,
do not Freeze an unreviewed `TIER_2` Candidate, and do not accumulate more
implementation milestones that cannot reach their mandatory review gate. The
pause record must include:

- selected Goal profile;
- outer Sol authorized / consumed;
- current milestone, its phase, and milestone Sol authorized / consumed;
- branch, `HEAD`, and latest stable Candidate;
- tests and exact-SHA CI state;
- outstanding findings and parked directions;
- exact next action.

Outer budget exhaustion is not Product North Star or project completion. A
future explicitly invoked self-evolution Goal may establish a fresh outer
`4 / 0` ledger and resume the exact persisted state. It must not reset the
active milestone's ledger unless a genuinely new milestone begins.

## Review readiness gate

Do not spend the review budget until all of the following are true:

1. the canonical Epoch readiness test above has passed and its Review Boundary
   Rationale remains accurate;
2. the Epoch scope and acceptance criteria are stable;
3. the Cycle/Epoch Plan records its Review Tier, expected and maximum Sol
   economics, total authorized budget, and any `TIER_2` reviewer order;
4. for self-evolution, both milestone and outer remaining Sol budgets are
   greater than zero;
5. the complete Epoch implementation is committed as an exact Candidate SHA;
6. the checked-out branch has no tracked changes from the Epoch;
7. relevant local and integration validation is green;
8. mandatory remote CI is green for that Candidate SHA;
9. user, Agent, and visual QA required by the Epoch are complete;
10. the primary thread has performed one consolidated Base..Candidate preflight
    against the acceptance criteria;
11. no known blocker is intentionally deferred to the reviewers.

Reviewers must inspect the actual Base..Candidate diff and relevant evidence.
They should receive a concise review packet and perform one comprehensive pass,
reporting all known P0/P1 blockers rather than stopping at the first finding.

## Corrective review behavior

If a reviewer returns `CORRECTIVE_REQUIRED`:

1. preserve and consolidate all findings;
2. fix them in the primary thread without spawning more reviewers;
3. rerun affected validation;
4. create a new clean Candidate SHA;
5. set the state according to the remaining tier budget.

For `TIER_1`, Luna may persist the corrected Candidate, then must set
`CORRECTED_AWAITING_REVIEW_AUTHORIZATION` and stop. A second Sol launch requires
an explicit user budget grant or explicit upgrade to `TIER_2`.

For `TIER_2`, one unattended correction sequence is permitted when budget
remains:

```text
Luna implementation
  -> Sol #1
  -> CORRECTIVE_REQUIRED
  -> Luna corrective + validation + new exact Candidate and CI
  -> Sol #2
  -> PASS or PARKED_REVIEW_LIMIT
```

Never launch Sol #3 automatically. If Sol #2 does not PASS the exact corrected
Candidate, persist every finding and mark the milestone
`PARKED_REVIEW_LIMIT`. Execute-only mode stops. Self-evolution mode returns to
opportunity discovery and may select another independent safe milestone; it
must not silently bypass or reset the parked milestone's review ledger.

If a reviewer launch fails without a verdict, count it against the total tier
budget. Continue only when `TIER_2` has an explicitly planned remaining launch
that can still satisfy its final review requirement; otherwise set the state to
`PARKED_REVIEW_LIMIT`. Execute-only mode stops; self-evolution mode may continue
from discovery with another independent safe milestone. Do not loop on
platform limits.

## Product branch lifecycle

Product opportunity selection and Product Milestone execution are separate
activities. The opportunity log is a backlog, not authority to invent an active
Cycle in execute-only mode. If no active Cycle Plan exists, execute-only mode
reports that selection and authorization are required and stops;
self-evolution mode enters its authorized discovery and selection loop.

When a new Product Cycle is explicitly authorized by execute-only selection or
selected within an active self-evolution Goal:

1. start from a clean, current `master` and update it safely;
2. create one dedicated ordinary feature branch from the recorded Base SHA;
3. record the base, branch, Integration Policy, and remaining integration
   contract in the Cycle Plan and ledger;
4. perform exactly that substantial milestone on the feature branch;
5. create or update one PR for the milestone;
6. review and Freeze the exact Candidate;
7. integrate according to the recorded policy;
8. retire the branch after a verified merge and return to synchronized
   `master`.

This lifecycle is:

```text
ONE COHERENT PRODUCT REVIEW EPOCH
  -> ONE OR MORE RELATED WORK PACKAGES AS NEEDED
  -> ONE FEATURE BRANCH
  -> ONE PR
  -> REVIEW
  -> FREEZE
  -> MERGE
  -> CLEANUP
  -> RETURN TO MASTER
```

Never use a Git worktree, implement a new Product Cycle directly on `master`,
reuse a completed Cycle branch for another milestone, or silently accumulate
later Cycles on the same branch. Explicitly scoped and safe governance or
documentation maintenance may run directly on `master`.

## Post-Freeze integration contract

Every Cycle Plan and ledger must select one Integration Policy before
implementation:

- `STOP_AT_FREEZE`: stop successfully at `FROZEN_GOAL_COMPLETE`; or
- `AUTO_MERGE_AFTER_FREEZE`: after Freeze, perform the authorized integration
  lifecycle and stop successfully only at `MERGED_GOAL_COMPLETE`.

Those `*_GOAL_COMPLETE` names are final outer outcomes only for execute-only
mode. In self-evolution mode the same successful inner lifecycle produces
`MILESTONE_CHECKPOINT_COMPLETE`, updates backlog/state, and returns to
`OBSERVE`; it never marks the outer product mission complete.

For unattended feature development, `AUTO_MERGE_AFTER_FREEZE` is preferred only
when the Cycle Plan and ledger explicitly record it and the selected Goal
profile permits it. It is never inferred from unattended mode alone.

Record these truthful runtime fields:

- Integration Policy;
- Target Base Branch;
- Base SHA;
- Current Target Base SHA when integration is attempted;
- Feature Branch;
- Pull Request Number;
- Merge Strategy;
- Branch Cleanup Policy;
- Integration State;
- Implementation Frozen SHA;
- Merge Commit SHA.

### Target-base freshness gate

Immediately before automatic integration, safely fetch the recorded Target
Base Branch, resolve the current `origin/<TargetBaseBranch>` SHA, and compare it
with the Cycle's recorded Base SHA. For the normal unattended
`AUTO_MERGE_AFTER_FREEZE` path, these SHAs must be exactly equal.

If they differ, do not merge. Record `INTEGRATION_BLOCKED_BASE_DRIFT` together
with the recorded Base SHA, current target-base SHA, and Implementation Frozen
SHA, then stop. Do not automatically rebase, merge the advanced base into the
reviewed feature branch, regenerate the Candidate, or claim that the old
exact-SHA CI or Sol `PASS` covers the new base combination.

Integrating onto an advanced base requires a separately authorized,
validated, and when applicable independently reviewed integration path. It
must not silently reuse the prior Freeze evidence.

Automatic integration is allowed only when all of these gates are true:

1. the target-base freshness gate passed after a safe fetch;
2. the exact Implementation Frozen SHA is known;
3. required local validation passed;
4. mandatory remote CI passed for that exact SHA;
5. the recorded Review Tier is satisfied;
6. the required independent reviewer returned `PASS` when applicable;
7. no unresolved P0/P1 blocker remains;
8. no `HUMAN_REVIEW_REQUIRED` item blocks integration;
9. the PR targets the recorded base branch;
10. the PR is not a draft;
11. repository-host merge requirements are satisfied;
12. production implementation has not changed after independent `PASS`;
13. no unrelated dirty user work would be destroyed or relocated.

If any non-freshness gate fails, do not merge. Record `INTEGRATION_BLOCKED` with
the exact failed gate and stop. Base freshness failure uses the more specific
`INTEGRATION_BLOCKED_BASE_DRIFT` state above. Any production implementation
change after `PASS` invalidates that review and creates a new Candidate; never
integrate a materially different implementation under the old PASS.

The default strategy for reviewed feature milestones is `MERGE_COMMIT`. Do not
squash or rebase independently reviewed Candidate history by default. The
Implementation Frozen SHA must remain an ancestor of the final pushed base and
must be verified with:

```sh
git merge-base --is-ancestor <ImplementationFrozenSHA> origin/<TargetBaseBranch>
```

After a successful merge, verify the PR state is `MERGED`, verify frozen-SHA
ancestry, delete the remote and local feature branches only when safe, switch to
`master`, fetch/pull safely, and verify local `master == origin/master`. Only
then is branch cleanup complete.

## Milestone state machine

Use these states in the execution ledger:

```text
PLANNED
  -> IMPLEMENTING
  -> VALIDATING
  -> CANDIDATE_READY

TIER_0: CANDIDATE_READY
  -> FROZEN

TIER_1 or TIER_2: CANDIDATE_READY
  -> REVIEW_AUTHORIZED
  -> FROZEN

TIER_1: REVIEW_AUTHORIZED
  -> CORRECTING
  -> CORRECTED_AWAITING_REVIEW_AUTHORIZATION

TIER_2 with one launch remaining: REVIEW_AUTHORIZED
  -> CORRECTING
  -> CORRECTED_CANDIDATE_READY
  -> REVIEW_AUTHORIZED

REVIEW_AUTHORIZED
  -> PARKED_REVIEW_LIMIT

FROZEN + STOP_AT_FREEZE (or integration not applicable)
  -> FROZEN_GOAL_COMPLETE

FROZEN + AUTO_MERGE_AFTER_FREEZE
  -> INTEGRATING
  -> MERGED
  -> CLEANUP
  -> MERGED_GOAL_COMPLETE

INTEGRATING
  -> INTEGRATION_BLOCKED
  -> INTEGRATION_BLOCKED_BASE_DRIFT
```

`FROZEN` is the quality/review fact. `FROZEN_GOAL_COMPLETE` and
`MERGED_GOAL_COMPLETE` are final Goal outcomes determined by Integration
Policy only for execute-only mode. In self-evolution mode, a completed or
truthfully parked milestone transitions to `UPDATE_BACKLOG_AND_STATE` and then
`OBSERVE`, without carrying its branch, scope, or review budget into the next
milestone.

## Required ledger fields

`docs/product/loop-status.md` must keep these fields current:

- Goal scope and stopping condition;
- selected execution profile and outer Goal state;
- Outer Sol Review Budget authorized / consumed and current budget state;
- explicit non-scope;
- current Product Review Epoch/milestone identity and phase, or
  `BETWEEN_MILESTONES`;
- Work Package summary and logical `LUNA_STABLE` status only when included in
  an already-required durable checkpoint;
- Review Boundary Rationale;
- current milestone state;
- primary model and reasoning effort;
- generic subagent launches authorized / consumed;
- Review Tier and total Sol launches authorized / consumed;
- Candidate SHA and exact-SHA CI evidence;
- Integration Policy, Target Base Branch, Base SHA, Current Target Base SHA,
  Feature Branch, Pull Request Number, Merge Strategy, Branch Cleanup Policy,
  Integration State, Implementation Frozen SHA, and Merge Commit SHA;
- next action;
- human authorization state.

For every backlog reprioritization also persist the changed entries, prior
state, new state, rationale, and evidence provenance. For a budget pause persist
all `PAUSED_BY_EXECUTION_BUDGET` resume fields from the outer-loop contract.

Update the ledger before a genuine interruption, before any reviewer launch,
after every reviewer verdict or actual terminal failure, at Freeze, after every
durable integration state transition, and when the Goal stops. Never update the
ledger for an ordinary `LUNA_STABLE` event, reviewer heartbeat, wait count, or
`WAIT_TIMEOUT_REVIEWER_STILL_RUNNING`; those are ephemeral runtime telemetry.

## Human override

The user may explicitly authorize:

- a frontier-model primary thread;
- a specific bounded subagent task;
- an additional review launch or a Review Tier change;
- a new Product Cycle or multi-milestone program.

Authorization applies only to the stated action. It does not permanently raise
the repository defaults. Selecting `AUTONOMOUS_EVOLUTION_TIER2` is the explicit
multi-milestone authorization for that outer Goal session; continuation ends at
its recorded outer stop conditions.
