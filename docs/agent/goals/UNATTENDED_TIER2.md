# Unattended Tier 2 Goal Profile

This is a small execution overlay on
`docs/agent/goals/AUTONOMOUS_MILESTONE.md`. Read and obey the complete canonical
profile first. This overlay does not duplicate or weaken higher-authority
governance.

## Selected execution profile

- Execution Mode: `EXECUTE_ONLY_UNATTENDED`
- Primary Model: GPT-5.6 Luna
- Preferred Reasoning: `max`
- Minimum fallback: `xhigh`
- Generic subagent budget: `0`
- Review Tier: `TIER_2`
- Total Sol launches authorized: `2`
- Sol execution: `SEQUENTIAL ONLY`
- Automatic Sol #3: `PROHIBITED`
- Standing reviewer: `sol_milestone_reviewer`
- Sol reasoning: `high`

The user invocation selecting this profile authorizes this bounded execution
mode. Before implementation or review expenditure, persist `TIER_2`, total Sol
budget `2`, reviewer identity, and consumed count in the active Cycle Plan and
`loop-status.md`. If no active milestone exists, stop; do not select one.

## Authorized unattended sequence

```text
Luna Max implementation
  -> complete all related Work Packages
  -> complete Product Review Epoch Readiness Gate
  -> Sol #1
```

If Sol #1 returns `PASS`:

- Freeze the exact Candidate immediately when all other Freeze requirements are
  satisfied.
- Do not spend Sol #2.

If Sol #1 returns `CORRECTIVE_REQUIRED`:

1. Luna Max consolidates and fixes all reported P0/P1 findings.
2. Complete all affected tests, User QA, Agent QA, Renderer QA when applicable,
   and the Luna consolidated self-review.
3. Commit and persist a new exact Candidate SHA.
4. Obtain mandatory remote CI success for that exact SHA.
5. Launch the same comprehensive `sol_milestone_reviewer` as Sol #2 using
   `high` reasoning.

If Sol #2 returns `PASS`, Freeze the exact corrected Candidate. Otherwise,
persist the result and stop.

If a wait or poll call times out while the launched reviewer remains running,
classify the ephemeral runtime result as
`WAIT_TIMEOUT_REVIEWER_STILL_RUNNING` and continue waiting on that same
reviewer. Do not persist it, edit tracked files, commit, push, rerun CI, change
the PR, close the reviewer, launch another reviewer, or consume another launch.

An actual `REVIEWER_HARD_TIMEOUT`, `REVIEWER_TERMINATED_NO_VERDICT`,
`REVIEWER_FAILED`, `HUMAN_REVIEW_REQUIRED`, missing readiness evidence, or
protected decision applies the canonical stop/budget rule. If one `TIER_2`
launch remains and the recorded sequence can still produce a comprehensive
PASS on the exact Candidate, that remaining launch may be used; never exceed
two launches total.

After `FROZEN`, continue through post-Freeze integration only when the Cycle
Plan and ledger explicitly record `AUTO_MERGE_AFTER_FREEZE`. Apply every
canonical integration gate and stop at `MERGED_GOAL_COMPLETE` or
`INTEGRATION_BLOCKED`. Target-base drift stops specifically at
`INTEGRATION_BLOCKED_BASE_DRIFT`; unattended mode must not reconcile it
automatically. With `STOP_AT_FREEZE`, stop at `FROZEN_GOAL_COMPLETE`.

Never launch Sol #3. Never start the next Product Cycle.
