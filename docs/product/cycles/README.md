# Product Cycles

Each Product Cycle must have a bounded implementation plan and is one Goal
milestone by default. Freeze satisfies the quality gate; the recorded
Integration Policy determines whether the Goal stops at Freeze or continues
through merge and branch cleanup. Neither outcome starts another Cycle.

A Cycle Plan should define:

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
- total Sol review launch budget and, for `TIER_2`, reviewer order
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

Cycle plans inherit GPT-5.6 Luna `max` as the standing primary-thread setting
and a generic-subagent budget of zero. Luna `xhigh` is the only availability
fallback; lower Luna reasoning efforts are not permitted for cost control.

The default for a normal product milestone is `TIER_1`: one sequential,
comprehensive `sol_milestone_reviewer` launch after the entire milestone passes
the review-readiness gate. `TIER_0` spends no Sol and is limited to
documentation, tests, non-behavioral maintenance, and trivial internal work.
`TIER_2` permits at most two sequential Sol High launches total and must justify
the unusual risk or value before implementation. Its final Candidate requires a
comprehensive `sol_milestone_reviewer` PASS. See
`docs/agent/BUDGET_FIRST_EXECUTION.md`.

For product work, one authorized substantial milestone uses one dedicated
ordinary feature branch and one PR. The canonical startup, automatic-integration
gate, merge, ancestry proof, cleanup, and final Goal states are defined in
`docs/agent/BUDGET_FIRST_EXECUTION.md`. Reviewer wait and terminal-failure
semantics are defined only in `docs/agent/AUTONOMOUS_REVIEW_POLICY.md`.
