# PR-8A — Sol #2 Milestone Review

Status: `COMPLETED_CORRECTIVE_REQUIRED`

## Runtime identity

- Reviewer: `sol_milestone_reviewer`
- Agent ID: `019ffe4f-6b46-7c20-96a4-31147a981e66`
- Launch ordinal: `Sol #2 of 2`
- Milestone budget at launch: `2 authorized / 2 consumed / 0 remaining`
- Outer budget at launch: `4 authorized / 2 consumed / 2 remaining`
- Review Base SHA: `cd0ee074ca6e9d6b65e063e2461bc54a4cc0897e`
- Review Candidate SHA: `998d4c4935f52d4cdf1543ca1663d68d137065fc`
- Governance-only review tip: `be62c7c`
- Completion observed: `2026-08-14T03:39:50Z`
- Verdict: `CORRECTIVE_REQUIRED`
- Severity: `P0 0 / P1 4 / P2 0 / P3 0`

The reviewer inspected the actual Base..Candidate implementation snapshot and
treated the later governance commit as metadata only. The Candidate is not
freeze-ready. The exact-SHA CI run remained green, but passing CI does not
override the independent review findings below.

## P1 findings

### P1-1 — Subject-overview images bypass the renderer asset pipeline

`packages/renderer/src/render-service.ts:67` has no subject-overview image
extraction branch, while `SubjectOverviewCard.tsx:254` can fall back to raw
external URLs. In Chromium's zero-network rendering path, real Bangumi cover
and character images therefore render as broken images in the supplied complete
and partial PNGs.

Acceptance for a future Candidate: extract only the bounded images actually
rendered by the template, route them through `AssetResolver`, preserve SSRF,
timeout, fan-out, and failure-placeholder limits, add extraction/resolution/
security regression tests, and perform successful-image QA at 640px and 960px.

### P1-2 — Successful stats evidence can carry a pre-dispatch timestamp

`packages/provider-core/src/providers.ts:561` captures a timestamp before the
source request is awaited at line 565. `packages/tools/src/subject-overview.ts`
then prefers that mapped timestamp at line 272 over the wrapper's post-
completion timestamp. A delayed successful stats request can consequently
report retrieval before the request completes.

Acceptance for a future Candidate: make operation-level `retrievedAt` occur
after successful completion, keeping any source/cache timestamp distinct when
needed, and add a delayed successful-stats test exercising the real path.

### P1-3 — Required composition-formula provenance is absent

The Cycle Plan requires evidence for the bounded deterministic composition
formula. The model supports `derived-s7` and `formulaVersion`, but
`packages/tools/src/subject-overview.ts:549` only accumulates operation
evidence and does not emit a versioned composition record for the composed
result.

Acceptance for a future Candidate: emit a stable documented `derived-s7`
composition evidence record containing the formula version, description, and
deterministic section ordering, including when the composed result is partial;
test the record and its ordering.

### P1-4 — Corrected visual matrix is not semantically realistic

The corrected fixture names cover the requested matrix, but their semantic
accounting is contradictory. The staff-complete fixture labels observed `12`
and returned `10`; degraded fixtures retain a base `5 attempted / 5
succeeded` accounting even when the root operation fails. The unavailable and
not-found PNGs therefore visibly report five successful sections instead of
truthful degraded evidence.

Acceptance for a future Candidate: derive fixtures from valid semantic outputs
or enforce fixture invariants, then regenerate and inspect complete, partial,
unavailable, not-found, valid-image, missing-image, dense, and long-CJK states
at both widths with truthful request, evidence, and coverage values.

## Verified evidence

- Exact Candidate CI run
  [31766543465](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31766543465)
  passed all six required jobs.
- The reviewer confirmed the Candidate was not freeze-ready and no protected
  Human-On-Exception boundary was crossed.
- Sol #1's prior findings were not treated as automatically resolved; the
  review examined the current implementation and identified the four blockers
  above.

## Required next state

The TIER_2 milestone review budget is exhausted without a PASS. Park PR-8A as
`PARKED_REVIEW_LIMIT`; do not freeze or merge Candidate `998d4c4`, do not
modify its implementation during this outer Goal, and do not launch Sol #3.
Persist this report and the ledger state, then return to opportunity discovery
for an independent safe Epoch while two of the four outer Sol launches remain.
