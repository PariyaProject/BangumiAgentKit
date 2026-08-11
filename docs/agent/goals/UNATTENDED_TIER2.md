# Unattended Tier 2 Goal Profile

This is a small execution overlay on
`docs/agent/goals/AUTONOMOUS_MILESTONE.md`. Read and obey the complete canonical
profile first. This overlay does not duplicate or weaken higher-authority
governance.

## Selected execution profile

- Execution Mode: `UNATTENDED`
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
  -> complete milestone Review Readiness Gate
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

Any timeout, usage-limit failure, crash, cancellation, no verdict,
`HUMAN_REVIEW_REQUIRED`, missing readiness evidence, or protected decision
stops the unattended sequence after truthful budget accounting. It does not
authorize another reviewer.

Never launch Sol #3. Never start the next Product Cycle.
