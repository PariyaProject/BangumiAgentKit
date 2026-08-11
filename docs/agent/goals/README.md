# Portable Goal Profiles

This directory contains reusable execution profiles for Codex Goals. Profiles
make a Goal invocation portable across tasks and sessions; they do not replace
repository governance, select a Product Cycle, or store runtime progress.

## Standard invocation

```text
/goal Read docs/agent/goals/UNATTENDED_TIER2.md and execute the current
active milestone exactly as defined there. Continue until
FROZEN_GOAL_COMPLETE or a documented stop condition.
```

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

`AUTONOMOUS_MILESTONE.md` is the reusable canonical execution contract for one
substantial vertical milestone. `UNATTENDED_TIER2.md` is a small overlay that
selects unattended execution and a hard two-launch Sol ceiling.

Profiles may specialize an execution budget only when the user invocation,
Cycle Plan, and runtime ledger record that authorization. They may never weaken
the mandatory security, source, Git, human-only, review-readiness, or Freeze
rules in the authority chain. If the ledger does not reference an active Cycle
Plan, the profile stops rather than selecting or starting one.
