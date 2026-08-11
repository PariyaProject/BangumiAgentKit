# BangumiAgentKit Milestone Review Policy

## Governance model

Default:

`BUDGET_FIRST_SINGLE_THREAD + AI_REVIEW_AT_MILESTONE + HUMAN_ON_EXCEPTION`

The implementation/orchestration agent must never approve its own `TIER_1` or
`TIER_2` Product Cycle Freeze Candidate. `TIER_0` may complete without Sol only
when its Cycle Plan proves that product behavior and frozen contracts cannot
change. Review agents are scarce milestone gates rather than an implementation
loop.

`docs/agent/BUDGET_FIRST_EXECUTION.md` defines the Goal boundary, launch budget,
model routing, failure behavior, and stopping rules.

## Roles

### Primary implementation agent

Responsibilities:

- product opportunity discovery within the authorized milestone;
- targeted research;
- cycle planning;
- implementation;
- tests and negative tests;
- user, Agent, and visual QA;
- consolidated preflight review;
- corrective implementation;
- progress and budget persistence.

The primary agent works in one thread by default. It does not use independent
reviewers as incremental debuggers and does not select the next Product Cycle
after Freeze.

### `sol_milestone_reviewer`

The default `TIER_1` comprehensive read-only milestone reviewer. One pass
covers:

- correctness and architecture;
- security and protected boundaries;
- frozen contracts and compatibility;
- tests, negative tests, and exact-Candidate CI;
- source evidence, provenance, coverage, and resource bounds;
- real user value and information richness;
- Agent UX and semantic usefulness;
- Renderer quality when applicable.

It reports all known P0/P1 blockers in one pass.

### `sol_code_reviewer` (`TIER_2` only)

Independent read-only milestone reviewer for:

- correctness;
- architecture;
- frozen-contract compatibility;
- source and evidence semantics;
- resource bounds;
- security;
- regressions and negative tests;
- exact-Candidate CI completeness.

### `sol_product_reviewer` (`TIER_2` only)

Independent read-only milestone reviewer for:

- real user value;
- Bangumi parity and information richness;
- Agent UX and semantic-tool usefulness;
- analytics truthfulness;
- Renderer quality;
- missing product blockers inside the defined Cycle.

The specialized reviewers remain available for an explicitly planned `TIER_2`
sequence. They are never an automatic pair and are not the default for ordinary
product milestones.

## Review tiers and hard launch budgets

Every Cycle Plan must select and justify its Review Tier before implementation:

- `TIER_0`: zero Sol launches; documentation, tests, non-behavioral maintenance,
  and trivial internal work only;
- `TIER_1`: one comprehensive `sol_milestone_reviewer` launch; default for a
  normal product milestone;
- `TIER_2`: at most two Sol launches total; unusually high-risk or high-value
  milestones only, with reviewer identities and order recorded in advance.

A `TIER_2` sequence must end with a comprehensive
`sol_milestone_reviewer` PASS on the exact final Candidate. A specialized role
may occupy launch #1 for a narrow high-risk lane; launch #2 is then the final
comprehensive gate. If launch #1 is comprehensive and returns PASS, the review
requirement is satisfied without spending launch #2.

Reviews are sequential and never parallel. The budget is total launches, not a
per-role allowance. Sol reasoning is `high` by default. `xhigh` requires
explicit authorization for an exceptionally critical review and is not the
normal automatic setting.

Every reviewer start consumes one launch. A launch remains consumed if that
reviewer later hard-times-out, hits a platform usage-limit error, crashes, is
terminated, or returns no verdict. Wait and poll calls on the same launched
reviewer consume zero additional launches.

Never launch Sol #3 automatically. Do not replace a failed required reviewer
with the implementation agent's judgment. Any launch beyond the recorded tier
budget requires explicit user authorization and an updated total budget in
`docs/product/loop-status.md`.

A failed `TIER_1` launch consumes its only call and pauses the Cycle. A failed
`TIER_2` launch also consumes one call; the remaining launch may proceed only
when the pre-recorded sequence can still end in a comprehensive PASS for the
exact final Candidate. Otherwise persist
`PAUSED_REVIEW_BUDGET_EXHAUSTED` and stop.

## Reviewer runtime and wait semantics

This section is the canonical source for reviewer runtime-state
classification. Persist the reviewer identity, launch ordinal, launch time,
current runtime status, and the applicable overall wall-clock deadline.

Use exactly these runtime outcomes:

- `WAIT_TIMEOUT_REVIEWER_STILL_RUNNING`: one wait or poll returned without a
  final message and the same reviewer is still `RUNNING`;
- `REVIEWER_TERMINATED_NO_VERDICT`: the runtime confirms that the reviewer
  terminated or was closed before returning a verdict;
- `REVIEWER_HARD_TIMEOUT`: the same reviewer exceeded the overall reviewer
  wall-clock deadline without a verdict;
- `REVIEWER_FAILED`: the runtime reports a crash, platform-limit failure, or
  another unrecoverable failure;
- `REVIEWER_VERDICT_RECEIVED`: the same reviewer returned one of the three
  canonical final verdicts.

Before launch, record a bounded overall reviewer wall-clock limit. The default
is `120 minutes from reviewer launch`; a different bounded limit requires an
explicit pre-launch justification in the Cycle Plan and ledger. Runtime wait
calls may be much shorter than this overall deadline and should use the longest
safe interval supported by the available Codex runtime while preserving normal
progress reporting.

When a wait or poll operation times out, inspect the already-launched reviewer.
If it remains `RUNNING`, record
`WAIT_TIMEOUT_REVIEWER_STILL_RUNNING`, keep it open, and continue waiting or
polling that same reviewer. Do not cancel or close it, do not launch a
replacement, do not mark no-verdict, and do not consume another Sol launch.
Repeated waits on that same reviewer cost zero launches.

Classify `REVIEWER_HARD_TIMEOUT` only when the overall recorded deadline is
actually exceeded. Classify `REVIEWER_TERMINATED_NO_VERDICT` only when runtime
state confirms termination without a verdict. Classify `REVIEWER_FAILED` only
for a reported crash, platform-limit failure, or other unrecoverable state. A
transient wait timeout alone can never produce any of those outcomes.

An actual hard timeout, termination, or failure does not refund the launch. For
`TIER_1`, no replacement reviewer is automatic. For `TIER_2`, one remaining
launch may be used only when the recorded sequence can still produce a valid
comprehensive `PASS` on the exact Candidate. Sol #3 remains prohibited.

## Review readiness

The implementation agent must not launch reviewers until:

1. Cycle acceptance criteria are believed satisfied;
2. the Cycle Plan records Review Tier, total authorized Sol launches, and any
   `TIER_2` reviewer order;
3. the implementation is committed at an exact Candidate SHA;
4. the checked-out branch has no milestone changes pending;
5. relevant local validation is green;
6. mandatory remote CI is green for the exact Candidate SHA;
7. required user, Agent, and visual QA are complete;
8. a consolidated preflight has checked failure states, resource bounds,
   compatibility, evidence, and representative product output;
9. the execution ledger records reviewer authorization and remaining calls.

A reviewer receives the Base SHA, Candidate SHA, active Cycle Plan, concise
evidence packet, and relevant repository paths. Review should focus on the
actual Base..Candidate diff and affected execution paths. Historical review
narratives and the full long-term Charter are read only when directly relevant.

Each launch must make one comprehensive pass within its recorded lane and report
all known P0/P1 blockers, rather than returning after the first finding. Sol is
not triggered by commit count, stage completion, individual test fixes, or
incremental refactors.

## Reviewer verdicts

Each reviewer returns exactly one final verdict:

- `PASS`
- `CORRECTIVE_REQUIRED`
- `HUMAN_REVIEW_REQUIRED`

### `PASS`

No known P0/P1 blocker remains in that review lane for the exact Candidate SHA.

### `CORRECTIVE_REQUIRED`

The Cycle remains open. The primary Luna agent must:

1. preserve and consolidate all findings;
2. fix the blockers without launching reviewers;
3. rerun affected validation and QA;
4. create a new clean Candidate SHA;
5. follow its tier-specific remaining budget.

For `TIER_1`, persist the corrected Candidate, mark the Cycle
`CORRECTED_AWAITING_REVIEW_AUTHORIZATION`, and stop. A second Sol launch is not
allowed unless the user explicitly grants new budget or upgrades the Cycle to
`TIER_2`.

For `TIER_2`, if one launch remains, Luna may complete validation and exact-SHA
CI for the corrected Candidate and then launch Sol #2 sequentially. Sol #2 must
return `PASS` for the exact corrected Candidate or the Cycle stops. Sol #3 is
never automatic.

The implementation agent may not override a reviewer blocker.

### `HUMAN_REVIEW_REQUIRED`

The requested change crosses a protected governance boundary. The primary
agent must:

1. not implement the protected change;
2. create a proposal under `docs/product/human-review-queue/`;
3. mark the affected opportunity `PARKED_FOR_HUMAN`;
4. persist the state and stop the current Goal.

Parking one decision does not authorize starting another opportunity inside
the same Goal.

## Freeze requirements

A milestone may be frozen or completed only when:

1. Cycle acceptance criteria are satisfied;
2. required local validation is green;
3. mandatory remote CI is green for the exact implementation Candidate SHA;
4. its recorded Review Tier is satisfied:
   - `TIER_0`: the Plan's non-behavioral eligibility and primary preflight are
     recorded; or
   - `TIER_1`: the comprehensive reviewer returns `PASS` for that Candidate; or
   - `TIER_2`: the pre-recorded review sequence is satisfied and the
     comprehensive reviewer returns `PASS` for the exact final Candidate;
5. no unresolved P0/P1 blocker remains;
6. no protected human-only boundary was crossed;
7. the milestone implementation state is clean;
8. review-call usage is recorded truthfully.

After the gate is satisfied, persist the governance record and set the exact
Candidate to `FROZEN`. Then follow the Integration Policy and Goal-state
lifecycle defined canonically in `BUDGET_FIRST_EXECUTION.md`. `FROZEN` becomes
`FROZEN_GOAL_COMPLETE` only for `STOP_AT_FREEZE` or when integration is not
applicable; `AUTO_MERGE_AFTER_FREEZE` must continue through authorized
integration to `MERGED_GOAL_COMPLETE`. Neither outcome authorizes selecting or
beginning another Product Cycle.

## Two-SHA Freeze model

Review or Freeze artifacts can change repository contents after a Candidate is
validated. Therefore distinguish:

### Implementation Frozen SHA

The exact implementation Candidate validated under its recorded Review Tier.

### Governance Record SHA

A later documentation-only commit containing:

- reviewer reports;
- Freeze record;
- loop-status update;
- opportunity-log update.

Never pretend the Governance Record SHA was the implementation SHA validated or,
when applicable, inspected by reviewers.

## Review artifacts

For each Product Cycle create:

`docs/product/reviews/<cycle-id>/`

At minimum:

- `freeze-record.md`;
- `milestone-review.md` for the comprehensive `TIER_1` review;
- the explicitly planned review report or reports for `TIER_2`;
- no Sol report for `TIER_0`; record its eligibility evidence in the Freeze
  record.

A `TIER_2` specialized first pass may use `code-review.md` or
`product-review.md`; its final comprehensive pass uses `milestone-review.md`.

Reports must preserve:

- reviewed Base and Candidate SHAs;
- Review Tier, reviewer identity, and review lane;
- verdict;
- all P0/P1 blockers reported in the pass;
- non-blocking recommendations;
- evidence and tests/CI inspected;
- launch ordinal and budget consumed;
- failures that produced no verdict.

## Freeze record

`freeze-record.md` must include:

- Cycle and Goal scope;
- Base SHA;
- Implementation Frozen SHA;
- Governance Record SHA if already known;
- Review Tier and required reviewer verdicts, or `TIER_0` eligibility evidence;
- review launches authorized and consumed;
- reviewer runtime outcomes, including wait-continuation evidence or actual
  terminal failure classification when applicable;
- mandatory CI evidence;
- major capabilities;
- known limitations;
- deferred opportunities;
- human-review queue references;
- Integration Policy and final integration state;
- confirmation that the Goal stopped at this milestone and did not select the
  next Cycle.

## Protected human decisions

The following may not be autonomously approved:

- authentication trust-model changes;
- principal or authorization changes;
- weakening SSRF or security boundaries;
- token, cookie, or credential expansion;
- destructive or write-authority expansion;
- broad default Structured Web or HTML enablement;
- aggressive crawling;
- major irreversible semantic database migrations;
- licensing or legal uncertainty;
- breaking frozen public contracts without a compatibility path;
- publishing packages, releases, or tags.

When encountered: park the proposal, persist the state, and stop the Goal.

## Opportunity selection

The opportunity log remains a backlog. It may be updated with observations, but
it is not execution authority.

After a Freeze, the user may authorize a new Goal. At that time evaluate:

- User Value;
- Agent Leverage;
- Information Gain;
- Data Availability;
- Reliability;
- Implementation Cost;
- Maintenance Risk;
- Source Risk.

## Stop conditions

Stop the current Goal when:

- the configured final success state is reached;
- the review launch budget is exhausted;
- a corrected Candidate needs fresh review authorization;
- a protected decision is parked;
- required infrastructure or permission is unavailable;
- runtime or system budget is exhausted;
- the user pauses, stops, or changes the Goal.

Before stopping, update `docs/product/loop-status.md`. Never fabricate review,
budget, CI, or completion evidence.

`WAIT_TIMEOUT_REVIEWER_STILL_RUNNING` is not a stop condition. Continue waiting
on the same reviewer until a verdict or a genuine terminal runtime outcome.
