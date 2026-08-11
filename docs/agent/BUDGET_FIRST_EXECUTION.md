# BangumiAgentKit Budget-First Execution Harness

This file is the canonical execution-cost contract for Codex Goals, subagents,
milestone reviews, and autonomous continuation in this repository.

If an older document asks an agent to keep selecting Product Cycles, retry a
reviewer, or relaunch both reviewers automatically, this file and
`AUTONOMOUS_REVIEW_POLICY.md` take precedence.

## Operating principle

Optimize for verified product value per unit of model usage, not parallelism,
agent count, commit count, or number of Product Cycles.

The default execution shape is one primary agent working in one thread. A
subagent is an exception with an explicit, bounded purpose.

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

A Codex Goal in this repository must cover exactly one substantial vertical
milestone. A milestone may contain many commits, multiple implementation stages,
and several hours of Luna Max work. Commit count, stage completion, individual
test fixes, and incremental refactors do not create review boundaries.

Before a Goal starts, record in `docs/product/loop-status.md`:

- objective;
- explicit non-scope;
- verifiable stopping condition;
- validation commands or artifacts;
- Review Tier selected before implementation;
- total Sol review-call budget authorized by that tier;
- whether any non-review subagent use is authorized;
- Integration Policy and the complete integration contract when integration is
  applicable.

The stopping condition is one of:

- the configured final success state is reached;
- the implementation is ready but review authorization or budget is required;
- a protected human decision is reached;
- required infrastructure is unavailable;
- the user pauses or changes direction.

`FROZEN` means that the exact implementation Candidate has satisfied its
quality and Review Tier gate. It completes the Goal only when Integration Policy
is `STOP_AT_FREEZE` or integration is not applicable. If the recorded policy is
`AUTO_MERGE_AFTER_FREEZE`, `FROZEN` is intermediate and the Goal continues only
through the authorized integration and cleanup lifecycle. Neither Freeze nor
merge authorizes opportunity selection, creation of another Cycle, or
continuation into unrelated backlog. A new Product Cycle requires fresh user
authorization.

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

## Model and thread routing

Default:

- one primary thread;
- no implementation subagents;
- no speculative parallel research agents;
- no reviewer launch before the entire milestone reaches readiness;
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

This is the default for normal product milestones. Authorized / maximum Sol
launches: `1`. Use `sol_milestone_reviewer`, which covers correctness,
architecture, security, frozen contracts, tests, evidence and coverage,
resource bounds, user value, Agent UX, and Renderer when applicable.

### `TIER_2` — at most two Sol launches total

Reserve for unusually high-risk or high-value milestones. The Cycle Plan must
justify the tier and record reviewer identity and sequential order. Authorized /
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
stage, an individual test fix, or an incremental refactor.

The repository cannot read or enforce the user's live Plus quota. Launch count
is the deterministic budget proxy and must be recorded in
`docs/product/loop-status.md`.

## Review readiness gate

Do not spend the review budget until all of the following are true:

1. the milestone scope is stable;
2. the Cycle Plan records its Review Tier, total authorized Sol budget, and any
   `TIER_2` reviewer order;
3. the implementation is committed as an exact Candidate SHA;
4. the checked-out branch has no tracked changes from the milestone;
5. relevant local validation is green;
6. mandatory remote CI is green for that Candidate SHA;
7. user, Agent, and visual QA required by the Cycle are complete;
8. the primary thread has performed one consolidated preflight against the
   acceptance criteria;
9. no known blocker is intentionally deferred to the reviewers.

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
  -> PASS or STOP
```

Never launch Sol #3 automatically. If Sol #2 does not PASS the exact corrected
Candidate, persist the result and stop.

If a reviewer launch fails without a verdict, count it against the total tier
budget. Continue only when `TIER_2` has an explicitly planned remaining launch
that can still satisfy its final review requirement; otherwise set the state to
`PAUSED_REVIEW_BUDGET_EXHAUSTED` and stop. Do not loop on platform limits.

## Product branch lifecycle

Product opportunity selection and Product Milestone execution are separate
activities. The opportunity log is a backlog, not authority to invent an active
Cycle. If no authorized active Cycle Plan exists, report that selection and
authorization are required and stop.

When a new Product Cycle is explicitly authorized:

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
ONE SUBSTANTIAL PRODUCT MILESTONE
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

For unattended feature development, `AUTO_MERGE_AFTER_FREEZE` is preferred only
when the Cycle Plan and ledger explicitly record it and the selected Goal
profile permits it. It is never inferred from unattended mode alone.

Record these truthful runtime fields:

- Integration Policy;
- Target Base Branch;
- Base SHA;
- Feature Branch;
- Pull Request Number;
- Merge Strategy;
- Branch Cleanup Policy;
- Integration State;
- Implementation Frozen SHA;
- Merge Commit SHA.

Automatic integration is allowed only when all of these gates are true:

1. the exact Implementation Frozen SHA is known;
2. required local validation passed;
3. mandatory remote CI passed for that exact SHA;
4. the recorded Review Tier is satisfied;
5. the required independent reviewer returned `PASS` when applicable;
6. no unresolved P0/P1 blocker remains;
7. no `HUMAN_REVIEW_REQUIRED` item blocks integration;
8. the PR targets the recorded base branch;
9. the PR is not a draft;
10. repository-host merge requirements are satisfied;
11. production implementation has not changed after independent `PASS`;
12. no unrelated dirty user work would be destroyed or relocated.

If any gate fails, do not merge. Record `INTEGRATION_BLOCKED` with the exact
failed gate and stop. Any production implementation change after `PASS`
invalidates that review and creates a new Candidate; never integrate a
materially different implementation under the old PASS.

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
  -> PAUSED_REVIEW_BUDGET_EXHAUSTED

FROZEN + STOP_AT_FREEZE (or integration not applicable)
  -> FROZEN_GOAL_COMPLETE

FROZEN + AUTO_MERGE_AFTER_FREEZE
  -> INTEGRATING
  -> MERGED
  -> CLEANUP
  -> MERGED_GOAL_COMPLETE

INTEGRATING
  -> INTEGRATION_BLOCKED
```

`FROZEN` is the quality/review fact. `FROZEN_GOAL_COMPLETE` and
`MERGED_GOAL_COMPLETE` are final Goal outcomes determined by Integration
Policy. Do not move from either final outcome into a new Product Cycle inside
the same Goal.

## Required ledger fields

`docs/product/loop-status.md` must keep these fields current:

- Goal scope and stopping condition;
- explicit non-scope;
- current milestone state;
- primary model and reasoning effort;
- generic subagent launches authorized / consumed;
- Review Tier and total Sol launches authorized / consumed;
- Candidate SHA and exact-SHA CI evidence;
- Integration Policy, Target Base Branch, Base SHA, Feature Branch, Pull Request
  Number, Merge Strategy, Branch Cleanup Policy, Integration State,
  Implementation Frozen SHA, and Merge Commit SHA;
- next action;
- human authorization state.

Update the ledger before interruption, before any reviewer launch, after every
reviewer result or actual failure, at Freeze, after every integration state
transition, and when the Goal stops.

## Human override

The user may explicitly authorize:

- a frontier-model primary thread;
- a specific bounded subagent task;
- an additional review launch or a Review Tier change;
- a new Product Cycle or multi-milestone program.

Authorization applies only to the stated action. It does not permanently raise
the repository defaults or revive automatic continuation.
