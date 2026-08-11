# Autonomous Review Records

Each independently reviewed Product Cycle receives:

`<cycle-id>/code-review.md`
`<cycle-id>/product-review.md`
`<cycle-id>/freeze-record.md`

Review files preserve the exact implementation Candidate SHA.

The review metadata commit may have a later Governance Record SHA.

Each report also records its launch ordinal and whether the launch produced a
verdict. Timeouts and platform-limit failures consume the Cycle's review budget
and must be preserved rather than silently retried.

Reviewers run only after the milestone readiness gate. If a candidate needs
correction, the primary thread fixes and validates it, then stops at
`CORRECTED_AWAITING_REVIEW_AUTHORIZATION`; it does not automatically relaunch
either reviewer.
