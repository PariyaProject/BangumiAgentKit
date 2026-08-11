# Product Cycles

Each Product Cycle must have a bounded implementation plan and is one Goal
milestone by default. A frozen Cycle ends the Goal; it does not automatically
start another Cycle.

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
- review readiness evidence
- Freeze Gate

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
