# Product Cycles

Each Product Cycle must have a bounded implementation plan and is one coherent
Product Review Epoch: one execute-only Goal milestone or one inner milestone of
a selected self-evolution Goal. An Epoch may contain multiple related Work
Packages and meaningful commits. Freeze satisfies the quality gate; the
recorded Integration Policy
determines whether its branch lifecycle stops at Freeze or continues through
merge and cleanup. Execute-only mode ends there. Self-evolution checkpoints the
result, updates backlog/state, and returns to discovery.

A Cycle Plan should define:

- Epoch objective and related Work Packages
- user problem
- representative questions
- product gap
- sources
- semantic capabilities
- evidence / coverage
- Agent UX
- Renderer opportunity
- tests
- QA
- resource/security limits
- acceptance criteria
- verifiable Goal stopping condition
- primary-thread strategy
- generic subagent budget
- Review Tier (`TIER_0`, `TIER_1`, or `TIER_2`) selected before implementation
- Expected Sol (`1` for a Sol-reviewed Epoch)
- Automatic Maximum (`0`, `1`, or `2` according to tier)
- total Sol review launch budget and, for `TIER_2`, reviewer order
- Generic Subagents (`0` unless separately authorized)
- active Self-Evolution outer Sol budget state/remaining snapshot when
  applicable
- overall reviewer wall-clock limit (120 minutes by default)
- review readiness evidence
- Freeze Gate
- Integration Policy (`STOP_AT_FREEZE` or `AUTO_MERGE_AFTER_FREEZE`)
- Target Base Branch and Base SHA
- Current Target Base SHA when integration is attempted
- Feature Branch
- Pull Request Number
- Merge Strategy (`MERGE_COMMIT` by default for reviewed features)
- Branch Cleanup Policy
- Integration State
- Implementation Frozen SHA
- Merge Commit SHA

Every new product Cycle/Epoch Plan must contain:

```markdown
## Review Boundary Rationale

- Why these Work Packages belong together:
- User / Agent journey completed:
- Related work intentionally included:
- Adjacent work intentionally deferred:
- Why reviewing now has higher value than reviewing earlier:
- Why extending further would reduce coherence or reviewability:

## Review Economics

- Review Tier: <TIER_0 | TIER_1 | TIER_2>
- Expected Sol: <0 or 1>
- Automatic Maximum: <0, 1, or 2 according to tier>
- Outer Remaining Sol: <value or N/A>
- Generic Subagents: 0
```

Do not impose a minimum Work Package, commit, file, or line count. Do not make
the Epoch as large as possible. Apply the canonical coherence, reviewability,
readiness, validation, and anti-overbatching rules only from
`docs/agent/BUDGET_FIRST_EXECUTION.md`.

Cycle plans inherit GPT-5.6 Luna `max` as the standing primary-thread setting
and a generic-subagent budget of zero. Luna `xhigh` is the only availability
fallback; lower Luna reasoning efforts are not permitted for cost control.

The default for a normal product Epoch is `TIER_1`: one sequential,
comprehensive `sol_milestone_reviewer` launch after the entire Epoch passes
the review-readiness gate. `TIER_0` spends no Sol and is limited to
documentation, tests, non-behavioral maintenance, and trivial internal work.
`TIER_2` permits at most two sequential Sol High launches total and must justify
the unusual risk/value or be selected by the explicit self-evolution profile.
Its final Candidate requires a comprehensive `sol_milestone_reviewer` PASS. See
`docs/agent/BUDGET_FIRST_EXECUTION.md`.

For product work, one authorized coherent Product Review Epoch uses one
dedicated ordinary feature branch and one PR; Work Packages do not create their
own branches or PRs. The canonical startup, automatic-integration
gate, merge, ancestry proof, cleanup, and final Goal states are defined in
`docs/agent/BUDGET_FIRST_EXECUTION.md`. Reviewer wait and terminal-failure
semantics are defined only in `docs/agent/AUTONOMOUS_REVIEW_POLICY.md`.
`WAIT_TIMEOUT_REVIEWER_STILL_RUNNING` and ordinary `LUNA_STABLE` events never
create Plan/ledger edits or Git commits.

Review Tier, Sol authorized/consumed, and generic subagent authorized/consumed
are per-milestone fields. Reset them only when a genuinely new substantial
milestone begins, never for a corrective commit or implementation stage. A new
milestone does not reset an active Self-Evolution outer Sol ledger.
