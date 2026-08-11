# Autonomous Evolution Tier 2 Goal Profile

## Purpose and authority

This profile selects continuous product self-evolution for the active outer
Goal session. It is not an execute-only milestone profile and does not require a
pre-existing active Cycle.

Read and obey, in order:

1. `AGENTS.md`;
2. `docs/agent/BUDGET_FIRST_EXECUTION.md`;
3. `docs/agent/AUTONOMOUS_REVIEW_POLICY.md`;
4. `docs/agent/AUTONOMOUS_PRODUCT_EVOLUTION.md`;
5. `docs/product/loop-status.md`;
6. `docs/product/opportunity-log.md`;
7. any active Cycle Plan;
8. this profile.

The canonical policies own security, Git, CI, review accounting, reviewer wait
semantics, Freeze, and integration. This profile supplies explicit authority to
discover and select later safe milestones within one outer Goal; it never
weakens protected human-only boundaries.

## Selected execution profile

- Execution Mode: `SELF_EVOLUTION`
- Primary Model: GPT-5.6 Luna
- Preferred Reasoning: `max`
- Minimum fallback: `xhigh`
- Generic subagent budget: `0` per milestone unless separately authorized
- Review Tier: `TIER_2` per substantial milestone
- Expected Sol launches: `1` per milestone
- Maximum automatic Sol launches: `2` total per milestone
- Outer Sol Launches Authorized: `4` per explicitly invoked outer Goal
- Outer Sol Launches Consumed: `0` at new outer Goal invocation
- Sol execution: `SEQUENTIAL ONLY`
- Automatic Sol #3: `PROHIBITED`
- Standing reviewer: `sol_milestone_reviewer`
- Sol reasoning: `high`

Sol is never used for observation, product audits, opportunity discovery,
prioritization, planning, ordinary implementation, individual commits, stage
completion, test fixes, or incremental debugging.

The outer four-launch ceiling is hard for this invocation. Never raise or reset
it inside the same outer Goal; a fresh ledger requires a future explicit
self-evolution Goal invocation.

## Startup and resume

Reconstruct truth from the repository rather than chat memory.

1. Inspect branch, `HEAD`, upstream, staged, unstaged, and untracked state.
2. Read the outer state and current milestone from `loop-status.md`.
3. Establish a fresh `4 authorized / 0 consumed` outer Sol ledger only for this
   newly invoked outer Goal. If resuming an existing milestone, preserve its
   existing milestone review ledger.
4. If an active milestone exists, read its Cycle Plan and resume its exact
   persisted phase; do not replace or reprioritize it mid-cycle.
5. If no active milestone exists, set the outer state to
   `OPPORTUNITY_DISCOVERY`; absence of a Cycle is not an error or stop.
6. If repository state is ambiguous or unsafe to mutate, persist the blocker
   and apply the outer stop rules rather than guessing.

## Outer evolution loop

```text
NO_ACTIVE_CYCLE
  -> OBSERVE
  -> PRODUCT_AUDIT
  -> OPPORTUNITY_DISCOVERY
  -> PRIORITIZATION
  -> MILESTONE_SELECTION
  -> MILESTONE_PLANNING
  -> MILESTONE_ACTIVE
  -> IMPLEMENTING
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

A successful Freeze completes one mature product increment, not the outer Goal.
After completing the recorded integration and branch-cleanup policy, persist
evidence, update the backlog, and observe again.

## Opportunity discovery and product audit

Between milestones, actively use the product and ask targeted questions from
these perspectives:

- User: which real Bangumi question still receives a weak answer?
- Power user: which useful bgm.tv information is absent or poorly exposed?
- Agent: which task requires too many low-level calls or invites guessing?
- Intelligence: which deterministic insight can existing reliable data derive?
- Renderer: which valid output is visually or informationally weak?
- Beyond Bangumi: which aggregation, relationship, history, personalization, or
  analysis can AgentKit provide more usefully than the site directly?

Perform narrow read-only audits around concrete candidate areas such as subject,
person, character, calendar, statistics, relations, collections, community, or
Renderer. Do not repeatedly run broad repository or website research passes.
Research must answer a concrete selection or design question.

## Living backlog and selection

The roadmap and opportunity log are implementation hypotheses, not the North
Star. Luna may add, split, merge, reorder, defer, or mark entries `SUPERSEDED`.
For every material change persist the prior state, new state, evidence, and
rationale.

Prioritize substantial vertical milestones using:

- real user and Bangumi power-user value;
- Agent leverage and information richness;
- current product and repository gaps;
- data/source availability and reliability;
- dependency fit and implementation cost;
- maintenance, security, and source risk;
- Renderer opportunity where applicable.

Do not select by roadmap number alone. A milestone may include many related
tasks and commits, but must remain one coherent PR-level product increment with
explicit representative questions, acceptance criteria, QA, and resource
bounds.

## Per-milestone lifecycle

Before implementation, create a bounded Cycle Plan and reset the per-milestone
ledger to `TIER_2`, `2 authorized / 0 consumed` Sol launches and
`0 authorized / 0 consumed` generic subagents. A corrective commit never resets
the milestone or outer Sol ledger. A new milestone resets the milestone ledger
only; it carries the outer authorized/consumed totals forward unchanged.

Use the inner execution, readiness, Candidate, CI, Freeze, and integration rules
from `AUTONOMOUS_MILESTONE.md` and the canonical policies. Each product
milestone uses one new ordinary feature branch and one PR. Feature milestones
normally record `AUTO_MERGE_AFTER_FREEZE` so the branch lifecycle can complete;
the policy must still be explicit in the Cycle Plan and every integration gate,
including target-base freshness, must pass.

`INTEGRATION_BLOCKED` or `INTEGRATION_BLOCKED_BASE_DRIFT` parks that milestone;
it never authorizes automatic rebase, base merge, or reuse of stale evidence.
Return to discovery only when the blocked branch can remain preserved and the
checkout can safely return to current `master` without mutating unrelated user
work. Otherwise the unsafe repository-state outer stop applies.

Luna Max performs research, planning, implementation, debugging, targeted
testing, User QA, Agent QA, Renderer inspection, consolidated self-review, and
backlog evolution. Full validation and Sol occur only at milestone readiness.

## Sparse Sol sequence

Before every Sol launch require both:

```text
milestoneRemainingSol > 0
AND
outerGoalRemainingSol > 0
```

Starting a reviewer consumes one launch from each ledger. If either remaining
count is zero, do not launch.

```text
stable Candidate + exact-SHA evidence
  -> Sol #1 comprehensive review

PASS
  -> Freeze

CORRECTIVE_REQUIRED
  -> Luna fixes all consolidated findings
  -> new stable Candidate + validation + exact-SHA CI
  -> Sol #2 comprehensive review

PASS
  -> Freeze

blocking result after Sol #2
  -> PARKED_REVIEW_LIMIT
  -> persist findings and ledger
  -> return to opportunity discovery
```

Wait/poll timeouts while the same reviewer remains running continue waiting on
that reviewer and consume no additional milestone or outer launch. Actual
reviewer terminal failures consume their started launch in both ledgers. Never
launch Sol #3.

`PARKED_REVIEW_LIMIT` parks only that milestone. Do not override findings or
reset its budget. Return to discovery and select another independent safe
milestone when one exists.

## Human-only directions

When a protected decision is encountered, do not implement it. Persist the
proposal under `docs/product/human-review-queue/`, mark the direction
`PARKED_FOR_HUMAN`, preserve all evidence, and return to discovery. Continue
only with a genuinely independent safe milestone. Stop the outer Goal if no
valuable independent safe work remains or governance declares a global
emergency.

## Outer stop and pause

Do not stop merely because no Cycle is active, one milestone froze, the current
backlog was exhausted, one direction was parked for human review, or one
milestone reached its Sol ceiling.

Stop only for the canonical outer conditions: runtime/system/Goal budget or
quota exhaustion, user pause/stop, infrastructure or permission blocking all
useful safe work, explicit discovery finding no meaningful independent safe
opportunity, unsafe repository state, exhausted outer Sol budget, or a
governance-mandated global emergency.

Budget exhaustion records `PAUSED_BY_EXECUTION_BUDGET`, never project
completion. Persist:

- outer state and selected profile;
- current milestone and phase;
- branch, `HEAD`, and latest stable commit;
- tests and exact-SHA CI state;
- Sol and generic subagent usage;
- blockers and parked items;
- exact next action.

Outer Sol budget exhaustion is a distinct pause:

`PAUSED_BY_OUTER_REVIEW_BUDGET`

When `4 / 4` outer launches have been consumed, finish waiting for any already
running reviewer without further charge and process its verdict truthfully. A
reviewer `PASS` may complete that exact milestone checkpoint. Then stop before
any fifth launch or any new implementation milestone requiring mandatory
review. If the current `TIER_2` Candidate has not received the required PASS, do
not Freeze it.

Persist selected profile, outer authorized/consumed, current milestone and
phase, milestone authorized/consumed, branch, `HEAD`, latest stable Candidate,
tests/CI, outstanding findings, parked directions, and exact next action. This
pause is not Product North Star completion. A future explicit self-evolution
Goal may create a fresh `4 / 0` outer ledger and resume; it must preserve any
existing milestone ledger.

## Efficiency and Git discipline

Use one long-lived Luna Max primary context, concise persistent state, targeted
file reads and product audits, targeted implementation tests, and one full
readiness validation. Avoid duplicated context, broad repeated summaries, tiny
milestones, unstable review diffs, parallel reviewers, and repeated corrective
review loops.

Never use a Git worktree, mutate unrelated user work, rewrite frozen history,
reuse a completed milestone branch, or carry one milestone's review budget into
another. Complete or truthfully park each branch lifecycle before beginning a
new milestone, and start every new milestone from a safe current `master`.
