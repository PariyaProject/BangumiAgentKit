# BangumiAgentKit Autonomous Review Policy

## Governance Model

Default:

AI_REVIEW_IN_LOOP
+
HUMAN_ON_EXCEPTION

The implementation/orchestration agent must never approve its own
Product Cycle Freeze Candidate.

## Roles

### Implementation / Orchestration Agent

Responsibilities:

- product opportunity discovery
- targeted research
- cycle planning
- implementation
- tests
- user QA
- Agent QA
- visual QA
- corrective implementation
- progress persistence
- next-cycle selection

### sol_code_reviewer

Independent read-only Freeze reviewer.

Primary responsibility:

- correctness
- architecture
- frozen-contract compatibility
- source/evidence semantics
- resource bounds
- security
- regressions
- negative tests
- CI completeness

### sol_product_reviewer

Independent read-only Product Freeze reviewer.

Primary responsibility:

- real user value
- Bangumi parity
- information richness
- Agent UX
- semantic-tool usefulness
- analytics value
- Renderer quality
- missing product opportunities inside the defined Cycle

## Reviewer Verdicts

Each reviewer must return exactly one final verdict:

PASS

CORRECTIVE_REQUIRED

HUMAN_REVIEW_REQUIRED

### PASS

No known P0/P1 Freeze blocker remains.

### CORRECTIVE_REQUIRED

The Cycle remains open.

The implementation agent must:

1. preserve the findings
2. fix the blockers
3. rerun affected validation
4. create a new Candidate SHA
5. invoke BOTH independent reviewers again

The implementation agent may not override a reviewer blocker.

### HUMAN_REVIEW_REQUIRED

The requested change crosses a protected governance boundary.

The implementation agent must:

1. NOT implement the protected change
2. create a proposal under
   `docs/product/human-review-queue/`
3. mark the affected opportunity `PARKED_FOR_HUMAN`
4. continue with another independent safe opportunity if one exists

The entire Autonomous Goal stops only when no meaningful safe work remains.

## Freeze Requirements

A Product Cycle may be automatically frozen only when:

1. Cycle acceptance criteria are satisfied
2. required local validation is green
3. mandatory remote CI is green for the exact implementation Candidate SHA
4. sol_code_reviewer returns PASS
5. sol_product_reviewer returns PASS
6. no unresolved P0/P1 blockers remain
7. no HUMAN_ONLY boundary was crossed
8. tracked implementation state is clean

## Two-SHA Freeze Model

Review artifacts change repository contents after reviewers inspect a
Candidate SHA.

Therefore distinguish:

### Implementation Frozen SHA

The exact implementation Candidate independently reviewed and validated.

### Governance Record SHA

A later documentation-only commit containing:

- reviewer reports
- freeze record
- loop-status update
- opportunity-log update

The next Product Cycle may start from the Governance Record SHA.

Never pretend the Governance Record SHA was the implementation SHA
reviewed by the reviewers.

## Review Artifacts

For each Product Cycle create:

docs/product/reviews/<cycle-id>/

At minimum:

- code-review.md
- product-review.md
- freeze-record.md

The implementation agent writes these files from the reviewers'
returned verdicts because reviewer agents are read-only.

The reports must preserve:

- reviewed Candidate SHA
- reviewer identity
- verdict
- blockers
- non-blocking recommendations
- evidence inspected
- tests/CI inspected

## Freeze Record

freeze-record.md must include:

Cycle

Base SHA

Implementation Frozen SHA

Governance Record SHA if already known

sol_code_reviewer verdict

sol_product_reviewer verdict

mandatory CI evidence

major capabilities

known limitations

deferred opportunities

human-review queue references

## Protected Human Decisions

The following may not be autonomously approved:

- Auth trust-model changes
- Principal/authorization changes
- weakening SSRF/security boundaries
- token/cookie/credential expansion
- destructive/write authority expansion
- broad default Structured Web enablement
- broad default HTML enablement
- aggressive crawling
- major irreversible semantic DB migrations
- licensing/legal uncertainty
- breaking frozen public contracts without safe compatibility
- publishing packages/releases/tags

When encountered:

PARK, DO NOT IMPLEMENT, CONTINUE ELSEWHERE.

## Autonomous Continuation

After an AI-reviewed Freeze:

1. persist review artifacts
2. update loop-status
3. update opportunity-log
4. commit Governance Record
5. perform Product Opportunity Selection
6. select the next highest-value independent safe Cycle
7. create its Cycle Plan
8. continue

The old roadmap is advisory, not mandatory.

## Opportunity Selection

Evaluate candidate Cycles by:

- User Value
- Agent Leverage
- Information Gain
- Data Availability
- Reliability
- Implementation Cost
- Maintenance Risk
- Source Risk

Prefer high-value reliable capabilities over high novelty.

## Stop Conditions

Stop the outer Autonomous Goal when:

- configured maximum cycle count is reached
- no valuable independent safe opportunity remains
- repeated reviewer failures reveal no defensible path
- required infrastructure/permission is unavailable
- runtime/system budget is exhausted
- user explicitly pauses/stops the Goal

Before stopping or interruption:

update `docs/product/loop-status.md`.

Never fabricate completion.