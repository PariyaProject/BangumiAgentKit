# Portable Goal Profiles

This directory contains reusable execution profiles for Codex Goals. Profiles
make a Goal invocation portable across tasks and sessions; they do not replace
repository governance or store runtime progress. Execute-only profiles do not
select a Product Cycle. The explicit self-evolution profile may discover and
select safe substantial milestones during its active outer Goal.

## Execution mode — one already-selected milestone

```text
/goal Read docs/agent/goals/UNATTENDED_TIER2.md and execute the current
active milestone exactly as defined there. Continue through review,
freeze, and authorized post-freeze integration until
MERGED_GOAL_COMPLETE, FROZEN_GOAL_COMPLETE, or a documented stop
condition.
```

Use this deterministic entry point only when `loop-status.md` references an
already-selected active Cycle Plan. It never invents or selects the next Cycle.

## Self-evolution mode — continuous product evolution

```text
/goal Read docs/agent/goals/AUTONOMOUS_EVOLUTION_TIER2.md and continuously
make the highest-value safe evidence-backed progress toward the Product North
Star for as long as this Goal session can responsibly operate. Resume any
active milestone; otherwise enter opportunity discovery. Persist resumable
state before every stop. Do not treat a milestone Freeze, parked direction, or
exhausted milestone review budget as completion of the outer Goal.
```

This entry point authorizes Luna Max to observe the product, evolve the living
backlog with provenance, select substantial safe milestones, execute their
separate branch/PR/review/Freeze/integration lifecycles, and then return to
discovery. Each milestone expects one and permits at most two Sol launches; the
entire invoked outer Goal permits at most four Sol launches total. It does not
authorize protected human-only decisions, generic subagents, Sol #3, worktrees,
release/publication, or unsafe Git mutation.

The selected profile resolves through this authority chain:

```text
UNATTENDED_TIER2.md
  -> AUTONOMOUS_MILESTONE.md
  -> AGENTS.md
  -> BUDGET_FIRST_EXECUTION.md
  -> AUTONOMOUS_REVIEW_POLICY.md
  -> loop-status.md
  -> active Cycle Plan
```

The self-evolution chain is:

```text
AUTONOMOUS_EVOLUTION_TIER2.md
  -> AGENTS.md
  -> BUDGET_FIRST_EXECUTION.md
  -> AUTONOMOUS_REVIEW_POLICY.md
  -> AUTONOMOUS_PRODUCT_EVOLUTION.md
  -> loop-status.md
  -> opportunity-log.md
  -> active Cycle Plan when one exists
```

`AUTONOMOUS_MILESTONE.md` is the reusable canonical execution contract for one
substantial vertical milestone. `UNATTENDED_TIER2.md` is a small overlay that
selects unattended execution, a hard two-launch Sol ceiling, same-reviewer wait
continuation, and authorized post-Freeze integration.

`AUTONOMOUS_EVOLUTION_TIER2.md` is the separate outer-loop profile. It may enter
discovery without an active Cycle, but every selected milestone still obeys the
same bounded readiness, Sol, Freeze, integration, branch, and human-only rules.

Profiles may specialize an execution budget only when the user invocation,
Cycle Plan, and runtime ledger record that authorization. They may never weaken
the mandatory security, source, Git, human-only, review-readiness, or Freeze
rules in the authority chain. If the ledger does not reference an active Cycle
Plan, the execute-only profile stops; the self-evolution profile enters
opportunity discovery.
