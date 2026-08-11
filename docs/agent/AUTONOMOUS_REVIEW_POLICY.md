# BangumiAgentKit Milestone Review Policy

## Governance model

Default:

`BUDGET_FIRST_SINGLE_THREAD + AI_REVIEW_AT_MILESTONE + HUMAN_ON_EXCEPTION`

The implementation/orchestration agent must never approve its own Product
Cycle Freeze Candidate. Independent review remains a Freeze requirement, but
review agents are scarce milestone gates rather than an implementation loop.

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

### `sol_code_reviewer`

Independent read-only milestone reviewer for:

- correctness;
- architecture;
- frozen-contract compatibility;
- source and evidence semantics;
- resource bounds;
- security;
- regressions and negative tests;
- exact-Candidate CI completeness.

### `sol_product_reviewer`

Independent read-only milestone reviewer for:

- real user value;
- Bangumi parity and information richness;
- Agent UX and semantic-tool usefulness;
- analytics truthfulness;
- Renderer quality;
- missing product blockers inside the defined Cycle.

The product reviewer is required when the Cycle changes a user-facing,
Agent-facing, semantic, analytics, or Renderer surface. A purely internal
maintenance milestone may omit it only when the Cycle Plan records why product
behavior cannot change.

## Automatic review budget

For one Product Cycle, the default automatic Sol budget is:

- one `sol_code_reviewer` launch;
- one `sol_product_reviewer` launch when applicable;
- zero other Sol launches.

Every launch consumes budget, including a timeout, platform usage-limit error,
crash, cancellation, or run that returns no verdict.

Do not retry a failed launch. Do not replace a failed required reviewer with the
implementation agent's judgment. Set the Cycle to
`PAUSED_REVIEW_BUDGET_EXHAUSTED`, persist the failure, and stop.

Additional review calls require explicit user authorization and a newly
recorded budget in `docs/product/loop-status.md`.

## Review readiness

The implementation agent must not launch reviewers until:

1. Cycle acceptance criteria are believed satisfied;
2. the implementation is committed at an exact Candidate SHA;
3. the tracked worktree is clean;
4. relevant local validation is green;
5. mandatory remote CI is green for the exact Candidate SHA;
6. required user, Agent, and visual QA are complete;
7. a consolidated preflight has checked failure states, resource bounds,
   compatibility, evidence, and representative product output;
8. the execution ledger records reviewer authorization and remaining calls.

A reviewer receives the Base SHA, Candidate SHA, active Cycle Plan, concise
evidence packet, and relevant repository paths. Review should focus on the
actual Base..Candidate diff and affected execution paths. Historical review
narratives and the full long-term Charter are read only when directly relevant.

Each reviewer must make one comprehensive pass and report all known P0/P1
blockers, rather than returning after the first finding.

## Reviewer verdicts

Each reviewer returns exactly one final verdict:

- `PASS`
- `CORRECTIVE_REQUIRED`
- `HUMAN_REVIEW_REQUIRED`

### `PASS`

No known P0/P1 blocker remains in that review lane for the exact Candidate SHA.

### `CORRECTIVE_REQUIRED`

The Cycle remains open. The primary agent must:

1. preserve and consolidate all findings;
2. fix the blockers without launching reviewers;
3. rerun affected validation and QA;
4. create a new clean Candidate SHA;
5. mark the Cycle `CORRECTED_AWAITING_REVIEW_AUTHORIZATION`;
6. stop.

The implementation agent may not override a reviewer blocker. It also may not
automatically relaunch either reviewer. Because the implementation Candidate
changed, a later Freeze normally needs fresh exact-SHA independent reviews;
the user decides whether and when to spend that additional budget.

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

A Product Cycle may be frozen only when:

1. Cycle acceptance criteria are satisfied;
2. required local validation is green;
3. mandatory remote CI is green for the exact implementation Candidate SHA;
4. the required independent reviewers return `PASS` for that Candidate SHA;
5. no unresolved P0/P1 blocker remains;
6. no protected human-only boundary was crossed;
7. the tracked implementation state is clean;
8. review-call usage is recorded truthfully.

After Freeze, persist the governance record and set the Goal to
`FROZEN_GOAL_COMPLETE`. Do not select or begin another Product Cycle.

## Two-SHA Freeze model

Review artifacts change repository contents after reviewers inspect a
Candidate SHA. Therefore distinguish:

### Implementation Frozen SHA

The exact implementation Candidate independently reviewed and validated.

### Governance Record SHA

A later documentation-only commit containing:

- reviewer reports;
- Freeze record;
- loop-status update;
- opportunity-log update.

Never pretend the Governance Record SHA was the implementation SHA inspected by
the reviewers.

## Review artifacts

For each Product Cycle create:

`docs/product/reviews/<cycle-id>/`

At minimum:

- `code-review.md`;
- `product-review.md` when applicable;
- `freeze-record.md`.

Reports must preserve:

- reviewed Base and Candidate SHAs;
- reviewer identity and review lane;
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
- independent reviewer verdicts;
- review launches authorized and consumed;
- mandatory CI evidence;
- major capabilities;
- known limitations;
- deferred opportunities;
- human-review queue references;
- confirmation that the Goal stopped at this milestone.

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

- the authorized milestone is frozen;
- the review launch budget is exhausted;
- a corrected Candidate needs fresh review authorization;
- a protected decision is parked;
- required infrastructure or permission is unavailable;
- runtime or system budget is exhausted;
- the user pauses, stops, or changes the Goal.

Before stopping, update `docs/product/loop-status.md`. Never fabricate review,
budget, CI, or completion evidence.
