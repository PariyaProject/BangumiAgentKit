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
- Sol review launch budget
- review readiness evidence
- Freeze Gate

Cycle plans inherit GPT-5.6 Luna `max` as the standing primary-thread and
authorized generic-subagent setting. Luna `xhigh` is the only availability
fallback; lower Luna reasoning efforts are not permitted for cost control.

The default automatic Sol budget is one code-review launch plus one product-
review launch when applicable. Reviewer failures consume budget and are not
retried automatically. See `docs/agent/BUDGET_FIRST_EXECUTION.md`.
