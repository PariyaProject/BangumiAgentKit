# Autonomous Review Records

Each milestone receives `<cycle-id>/freeze-record.md` plus the artifacts required
by its recorded Review Tier:

- `TIER_0`: no Sol report; preserve the non-behavioral eligibility and primary
  preflight evidence in `freeze-record.md`;
- `TIER_1`: one comprehensive `milestone-review.md` report;
- `TIER_2`: one or two reports matching the pre-recorded reviewer sequence,
  ending in comprehensive `milestone-review.md` for the final Candidate.

Specialized report names such as `code-review.md` and `product-review.md` remain
valid for a `TIER_2` plan. They are not mandatory for ordinary milestones.

Review files preserve the exact implementation Candidate SHA.

The review metadata commit may have a later Governance Record SHA.

Each report also records its launch ordinal and whether the launch produced a
verdict. Timeouts and platform-limit failures consume the Cycle's review budget
and must be preserved rather than silently retried.

Reviewers run only after the milestone readiness gate. If a candidate needs
correction, the primary Luna thread fixes and validates it. `TIER_1` then stops
at `CORRECTED_AWAITING_REVIEW_AUTHORIZATION`. `TIER_2` may spend its one
remaining sequential launch on the corrected Candidate, but Sol #3 is never
automatic.
