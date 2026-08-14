# Autonomous Product Review Epoch Goal Profile

## Status and precedence

This is the reusable execute-only Goal profile for one substantial coherent
BangumiAgentKit Product Review Epoch (the Product Cycle/milestone review unit).
It is not a policy replacement and is never
hard-coded to a particular Cycle. Its inner milestone lifecycle may be reused by
`AUTONOMOUS_EVOLUTION_TIER2`, but its outer stopping clauses apply to
execute-only mode.

Authority remains, in order:

1. `AGENTS.md` for repository-wide mandatory rules;
2. `docs/agent/BUDGET_FIRST_EXECUTION.md` for model, token, and review budget;
3. `docs/agent/AUTONOMOUS_REVIEW_POLICY.md` for review and Freeze rules;
4. `docs/agent/AUTONOMOUS_PRODUCT_EVOLUTION.md` for product philosophy;
5. `docs/product/loop-status.md` for current runtime truth;
6. the active Cycle Plan for milestone-specific scope and acceptance criteria;
7. this profile and any explicitly selected profile overlay.

A profile may narrow execution or spend an already authorized budget. It may
never weaken a higher-authority rule.

## Goal unit

Execute exactly one already-authorized substantial coherent Product Review
Epoch from its persisted repository state until it reaches the final state selected by its
Integration Policy or a documented stop condition. An Epoch may contain several
related Work Packages, many meaningful commits and implementation stages, test
failures, internal fixes, and several hours of GPT-5.6 Luna Max work.

Those events and `LUNA_STABLE` Work Package states are not Sol or Git triggers.
Sol review is allowed only after the complete Epoch passes the canonical
coherence and Review Readiness gates in `BUDGET_FIRST_EXECUTION.md`.
A coherent end-to-end vertical slice may be one Work Package, but it is an
implementation slice rather than an automatic Epoch boundary. After it becomes
`LUNA_STABLE`, evaluate the remaining closely related high-value Work Packages
before declaring review readiness.

This execute-only Goal does not select, plan, or begin the next Product Cycle
after the current milestone stops or freezes. The separate self-evolution
profile supplies explicit multi-milestone authority.

## Startup contract

Before planning, editing, committing, launching an agent, or relying on chat
context:

1. read `AGENTS.md`;
2. read `docs/agent/BUDGET_FIRST_EXECUTION.md`;
3. read `docs/agent/AUTONOMOUS_REVIEW_POLICY.md`;
4. read `docs/agent/AUTONOMOUS_PRODUCT_EVOLUTION.md`;
5. read `docs/product/loop-status.md`;
6. locate and read the active Cycle Plan referenced by `loop-status.md`;
7. inspect the current branch, HEAD, upstream relationship, staged files,
   unstaged files, and untracked files;
8. reconstruct scope, evidence, Candidate, CI, budgets, and next action from the
   repository rather than chat memory.

Chat history may provide context but never overrides persisted repository
state. If no active Cycle Plan is referenced, required ledger fields disagree,
or the milestone cannot be identified unambiguously, persist or report the
blocker and stop. Do not invent a Cycle or consume review budget.

## Runtime contract

Confirm that `loop-status.md` and the active Cycle Plan record:

- Goal scope and explicit non-scope;
- verifiable stopping condition;
- current milestone state;
- Product Review Epoch scope, Work Packages, and Review Boundary Rationale;
- primary model and reasoning;
- generic subagent budget authorized and consumed;
- Review Tier and total Sol launches authorized and consumed;
- Candidate SHA and exact-SHA CI state;
- Integration Policy and the complete integration contract required by
  `BUDGET_FIRST_EXECUTION.md`;
- next action and human authorization state.

The active Cycle/Epoch Plan additionally defines user questions, product gap,
sources, evidence and coverage semantics, Agent UX, Renderer scope, tests, QA,
resource/security limits, acceptance criteria, and Freeze requirements. Do not
expand the Goal beyond that contract. Record new opportunities in the backlog.

## Model and agent routing

- Standing implementation model: GPT-5.6 Luna.
- Preferred reasoning: `max`.
- Minimum availability fallback: `xhigh`.
- Never lower Luna below `xhigh` for cost control.
- Generic implementation or research subagents: disabled by default; use only
  when an explicit higher-authority authorization records a bounded purpose and
  budget.
- Sol: milestone reviewer only, never an implementation worker, incremental
  debugger, speculative researcher, or stage-completion checker.
- Sol launches: sequential only and bounded by the persisted Review Tier.

## Epoch execution loop

Use the Luna primary thread to repeat the following within the Cycle scope:

1. inspect persisted progress, evidence, and remaining acceptance criteria;
2. research only what the current Epoch requires;
3. design the next coherent Work Package that advances the Epoch;
4. implement without reopening frozen foundations or protected boundaries;
5. run focused tests and negative tests, then broader affected validation;
6. use the capability as a real user and verify representative questions;
7. exercise the Agent/tool surface for discoverability, semantics, partial,
   unknown, conflict, not-computable, and unavailable states;
8. perform Renderer QA when rendering is relevant, including representative
   widths, CJK typography, hierarchy, long/missing data, and degraded states;
9. mark a completed Work Package logically `LUNA_STABLE` after targeted
   validation and Luna self-review, without creating status-only Git churn;
10. update the runtime ledger only at meaningful durable checkpoints and before
    a genuine interruption;
11. perform the canonical consolidated `PRE-SOL FALSIFICATION` against the
    complete Base..Candidate Epoch and fix any blocker before review launch;
12. continue Luna work until the complete Epoch, not a Work Package or
    intermediate stage, is ready for consolidated review.

Tests failing during implementation are Luna work. Fixing tests, refactoring
internals, completing a sub-stage, or creating another implementation commit
does not authorize Sol.

## Luna consolidated self-review

Before declaring readiness, perform one consolidated primary-thread review of
the entire Base..Candidate Epoch against:

- correctness and important failure states;
- architecture and frozen-contract compatibility;
- security and protected human-only boundaries;
- source truthfulness, provenance, evidence, and coverage;
- resource bounds, fan-out, pagination, and renderer limits;
- tests, negative tests, and regressions;
- user value and the Cycle's representative questions;
- Agent UX and semantic usability;
- Renderer quality when applicable.

This review includes the canonical `PRE-SOL FALSIFICATION`; tests and green CI
alone are not sufficient evidence of readiness. Keep the falsification summary
compact and batch it with existing readiness or launch evidence rather than
creating a separate checklist commit.

Fix every known in-scope blocker before spending Sol.

## Review Readiness Gate

Apply the complete gate from `BUDGET_FIRST_EXECUTION.md` and
`AUTONOMOUS_REVIEW_POLICY.md`. At minimum, review is prohibited until:

- the Epoch passes the canonical coherence/readiness test and its Review
  Boundary Rationale remains accurate;
- Epoch scope and acceptance criteria are stable;
- the Cycle Plan and ledger agree on Review Tier and total launch budget;
- the entire implementation is committed at an exact Candidate SHA;
- no milestone changes remain uncommitted;
- relevant local validation is green;
- required User QA, Agent QA, and Renderer QA are complete;
- mandatory remote CI is green for that exact Candidate SHA;
- the Luna consolidated self-review found no known deferred blocker;
- reviewer identity, launch ordinal, consumed budget, and remaining budget are
  ready to be persisted before launch.

Never present an uncommitted tree, a moving branch name, or CI from another SHA
as review evidence.

## Candidate and exact-SHA CI

Create a Candidate only after the complete Epoch is ready. Record the exact
commit SHA in `loop-status.md` and the Cycle Plan. Push only within existing Git
authority and run mandatory remote CI against that exact SHA. If implementation
changes after CI or review, it is a new Candidate and requires new exact-SHA
validation.

Do not convert a failed, cancelled, stale, or different-SHA CI run into success.

## Review Tier and Sol accounting

Discover the Review Tier from the active Cycle Plan and confirm it against the
ledger before implementation and again before review:

- `TIER_0`: zero Sol launches;
- `TIER_1`: one comprehensive `sol_milestone_reviewer` launch;
- `TIER_2`: at most two sequential Sol launches total.

The profile itself does not upgrade the tier or grant Sol calls. An explicitly
selected overlay may specialize the budget only when the user invocation
authorizes it and the Cycle Plan plus ledger are updated before expenditure.

A reviewer start consumes one launch; `REVIEW_AUTHORIZED` alone consumes zero
and does not imply `REVIEWER_RUNNING`. A persisted running state requires an
actual start plus the identity, ordinal, exact Candidate, validation/CI, and
incremented applicable ledgers. Wait and poll calls on that same reviewer
consume zero additional launches. Apply the canonical runtime states and
120-minute default overall reviewer deadline from
`AUTONOMOUS_REVIEW_POLICY.md`. A wait timeout while the reviewer remains
running means continue waiting on that same reviewer with zero repository
mutation; it is not failure, a persistence event, a verdict, or authorization
for a replacement. Persist authorized, consumed, and
remaining totals before and after each launch and terminal outcome. Never
exceed the recorded total. Sol #3 is never automatic.

## Corrective loop

Treat `PASS`, `CORRECTIVE_REQUIRED`, and `HUMAN_REVIEW_REQUIRED` exactly as the
Review Policy defines.

- On `PASS`, Freeze only the exact reviewed Candidate when all remaining tier
  requirements are satisfied.
- On `CORRECTIVE_REQUIRED`, preserve every P0/P1 finding, return to Luna Max,
  fix all findings, rerun affected QA and validation, create a new Candidate,
  and obtain exact-SHA CI.
- `TIER_1` then stops at
  `CORRECTED_AWAITING_REVIEW_AUTHORIZATION`; it has no automatic second launch.
- `TIER_2` may spend one remaining sequential launch only as explicitly
  authorized by its profile, Plan, and ledger. It never launches Sol #3.
- On `HUMAN_REVIEW_REQUIRED`, do not implement the protected decision; park it,
  persist the state, and stop.
- On failure or no verdict, count the launch and apply the tier's stopping rule.
- On `WAIT_TIMEOUT_REVIEWER_STILL_RUNNING`, keep the reviewer open and continue
  waiting or polling it without consuming another launch or editing, committing,
  pushing, rerunning CI, or persisting a wait count.

## Protected human-only boundaries

Never autonomously approve or weaken the protected boundaries in `AGENTS.md`
and `AUTONOMOUS_REVIEW_POLICY.md`, including authentication or authorization,
credentials, SSRF, write/destructive authority, broad HTML or Structured Web
enablement, aggressive crawling, irreversible semantic migration, legal or
license policy, frozen-contract breakage without compatibility, and release,
package, or tag publication.

Park the exact proposal under `docs/product/human-review-queue/`, update the
ledger, and stop. A parked decision does not authorize unrelated continuation.

## Dirty-work and Git protection

- Never use `git worktree` or create an additional Git working tree.
- Never automatically commit, stash, reset, discard, rewrite, or relocate
  unrelated user work.
- Preserve unrelated staged, unstaged, and untracked files untouched.
- Work safely on the current branch when possible.
- If a required branch operation cannot proceed without touching unrelated
  work, record the blocker and stop.
- Never force-push shared or frozen history.
- Inspect the exact commits a push would publish before pushing.
- Never merge to `master` unless the Cycle's recorded
  `AUTO_MERGE_AFTER_FREEZE` policy and all canonical integration gates authorize
  it. Never release, publish, or tag unless separately explicitly authorized.

## Freeze and integration lifecycle

Freeze only when every Cycle acceptance criterion and the Review Policy's
tier-specific Freeze requirements are satisfied for the exact final Candidate.
Persist the Implementation Frozen SHA separately from any later Governance
Record SHA. Record validation, exact-SHA CI, QA, Review Tier, launch usage,
verdicts or `TIER_0` eligibility, limitations, and deferred opportunities.

Set the milestone to `FROZEN`, then apply the canonical Integration Policy and
branch lifecycle in `BUDGET_FIRST_EXECUTION.md`:

- `STOP_AT_FREEZE` or no applicable integration:
  `FROZEN -> FROZEN_GOAL_COMPLETE`;
- `AUTO_MERGE_AFTER_FREEZE`:
  `FROZEN -> INTEGRATING -> MERGED -> CLEANUP -> MERGED_GOAL_COMPLETE`.

For automatic integration, verify every safety gate, preserve the reviewed SHA
as an ancestor through the default `MERGE_COMMIT` strategy, verify the PR is
merged, retire the branch safely, and return to synchronized `master`. A failed
gate becomes `INTEGRATION_BLOCKED` and stops. Target-base drift uses the
specific canonical state `INTEGRATION_BLOCKED_BASE_DRIFT`; do not automatically
rebase, merge the advanced base, or reuse old CI/review evidence. Do not select
or start the next Product Cycle after either successful final state.

## Stopping conditions

Stop after persisting the ledger when any of the following occurs:

- `FROZEN_GOAL_COMPLETE` or `MERGED_GOAL_COMPLETE`;
- `INTEGRATION_BLOCKED`;
- `INTEGRATION_BLOCKED_BASE_DRIFT`;
- the Review Tier budget is exhausted without a valid Freeze;
- a corrected Candidate requires fresh human review authorization;
- a protected human-only decision is parked;
- required permission, infrastructure, exact-SHA CI, or evidence is unavailable;
- unrelated dirty work blocks a required safe Git operation;
- runtime/system budget is exhausted;
- the user pauses, stops, or changes the Goal;
- repository state no longer identifies one unambiguous active milestone.

`WAIT_TIMEOUT_REVIEWER_STILL_RUNNING` is not a stop condition or durable state
transition. Continue waiting on the same reviewer with zero Git churn. Stopping
is not permission to start another opportunity.

## Final report

Report concisely:

- Goal and Product Review Epoch scope;
- final milestone state;
- Base, Candidate, Implementation Frozen, and Governance Record SHAs as
  applicable;
- Integration Policy, PR, Merge Commit SHA, cleanup result, and final base
  synchronization as applicable;
- local validation and exact-SHA CI evidence;
- User, Agent, and Renderer QA performed;
- Review Tier and total Sol launches authorized, consumed, and remaining;
- reviewer verdicts or failure states;
- commits and pushes performed;
- known limitations, parked decisions, and next action;
- confirmation that no next Product Cycle was started.
