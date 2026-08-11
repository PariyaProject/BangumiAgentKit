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
or documentation change to `master`. If dirty feature work prevents a normal
branch switch, preserve it in an explicit temporary branch commit, perform the
operation in the existing checkout, and restore the feature changes to their
previous committed or uncommitted state before removing the temporary branch.

## Goal contract

A Codex Goal in this repository must cover exactly one coherent milestone.

Before a Goal starts, record in `docs/product/loop-status.md`:

- objective;
- explicit non-scope;
- verifiable stopping condition;
- validation commands or artifacts;
- review-call budget;
- whether any non-review subagent use is authorized.

The default stopping condition is one of:

- the milestone is frozen;
- the implementation is ready but review authorization or budget is required;
- a protected human decision is reached;
- required infrastructure is unavailable;
- the user pauses or changes direction.

Freezing a milestone completes the Goal. It does not authorize opportunity
selection, creation of another Cycle, or continuation into unrelated backlog.
A new Product Cycle requires a new user-authorized Goal or normal task.

Do not create a Goal merely because a task could take several turns. Use a Goal
only when the user explicitly requests one and the stopping condition is already
verifiable.

Recommended starter form:

```text
/goal Complete [one milestone] without expanding into another Product Cycle.
Use one primary thread. Non-review subagent budget: 0. Automatic Sol review
budget: [0, 1, or 2 launches]. Stop when [verifiable end state] is reached, a
fresh review needs authorization, or the recorded budget is exhausted.
```

## Model and thread routing

Default:

- one primary thread;
- no implementation subagents;
- no speculative parallel research agents;
- no automatic reviewer launches.

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

## Review-call budget

The default automatic Sol review budget for one milestone is:

- `sol_code_reviewer`: one launch;
- `sol_product_reviewer`: one launch when the milestone has a product, Agent UX,
  semantic, analytics, or Renderer surface;
- all other Sol subagents: zero launches.

Therefore a normal Product Cycle has a maximum automatic Sol budget of two
launches.

A launch counts when the reviewer is started, even if it times out, hits a
platform usage limit, crashes, or returns no verdict. Failed launches must not
be retried automatically.

The repository cannot read or enforce the user's live Plus quota. Launch count
is the deterministic budget proxy and must be recorded in
`docs/product/loop-status.md`.

## Review readiness gate

Do not spend the review budget until all of the following are true:

1. the milestone scope is stable;
2. the implementation is committed as an exact Candidate SHA;
3. the checked-out branch has no tracked changes;
4. relevant local validation is green;
5. mandatory remote CI is green for that Candidate SHA;
6. user, Agent, and visual QA required by the Cycle are complete;
7. the primary thread has performed one consolidated preflight against the
   acceptance criteria;
8. no known blocker is intentionally deferred to the reviewers.

Reviewers must inspect the actual Base..Candidate diff and relevant evidence.
They should receive a concise review packet and perform one comprehensive pass,
reporting all known P0/P1 blockers rather than stopping at the first finding.

## Corrective review behavior

If either reviewer returns `CORRECTIVE_REQUIRED`:

1. preserve and consolidate all findings;
2. fix them in the primary thread without spawning more reviewers;
3. rerun affected validation;
4. create a new clean Candidate SHA;
5. set the state to `CORRECTED_AWAITING_REVIEW_AUTHORIZATION`;
6. stop.

No reviewer is relaunched automatically. A fresh review requires explicit user
authorization and a newly recorded review budget. When exact-SHA Freeze policy
requires both reviewers again, say so before spending that budget.

If a reviewer launch fails without a verdict, set the state to
`PAUSED_REVIEW_BUDGET_EXHAUSTED` and stop. Do not loop on platform limits.

## Milestone state machine

Use these states in the execution ledger:

```text
PLANNED
  -> IMPLEMENTING
  -> VALIDATING
  -> CANDIDATE_READY
  -> REVIEW_AUTHORIZED
  -> FROZEN_GOAL_COMPLETE

REVIEW_AUTHORIZED
  -> CORRECTING
  -> CORRECTED_AWAITING_REVIEW_AUTHORIZATION

REVIEW_AUTHORIZED
  -> PAUSED_REVIEW_BUDGET_EXHAUSTED
```

Do not move from `FROZEN_GOAL_COMPLETE` into a new Product Cycle inside the same
Goal.

## Required ledger fields

`docs/product/loop-status.md` must keep these fields current:

- Goal scope and stopping condition;
- current milestone state;
- primary-thread strategy;
- generic subagent launches authorized / consumed;
- Sol review launches authorized / consumed, by reviewer;
- Candidate SHA and CI evidence;
- next action;
- whether human authorization is required.

Update the ledger before interruption, before any reviewer launch, after every
reviewer result or failure, and when the Goal stops.

## Human override

The user may explicitly authorize:

- a frontier-model primary thread;
- a specific bounded subagent task;
- an additional review launch or fresh review pair;
- a new Product Cycle or multi-milestone program.

Authorization applies only to the stated action. It does not permanently raise
the repository defaults or revive automatic continuation.
