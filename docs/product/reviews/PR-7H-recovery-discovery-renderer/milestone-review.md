# PR-7H Recovery Milestone Review — Sol #1

- Reviewer: `sol_milestone_reviewer`
- Agent ID: `019ff0ee-caf8-77b3-ada6-5c72cfe8254f`
- Launch ordinal: `Sol #1 of 2 authorized`
- Launch time: `2026-08-11T13:06:54Z`
- Candidate reviewed: `043a5a02cff8e596d435bedd7e0bc37ab8a3ebce`
- Recovery Base: `be89a2699ed7ccc85fc2e23718319bc57e1e16b6`
- Verdict: `CORRECTIVE_REQUIRED`
- P0 findings: `0`
- P1 findings: `2`

## P1-1 — enforce the renderer ceiling at the trusted boundary

The builder caps discovery results at 12, but `RenderService` image extraction
and `DiscoveryResultsCard` rendering accept caller-created ViewModels with more
than 12 items. An independent 13-item probe produced 13 asset URLs and
rendered the thirteenth item.

Required correction:

- enforce the 12-item/12-image ceiling at the RenderService/template boundary;
- add a negative test that bypasses the builder with at least 13 unique image
  URLs and proves no more than 12 are resolved/rendered, or rejects the input
  with `RENDER_VALIDATION_ERROR`;
- preserve truthful hidden/returned/rendered counts.

## P1-2 — do not present plan-only operations as evidence provenance

The builder unconditionally combines `result.plan.operation` with evidence
operations. A real unknown-concept `DiscoveryEngine` result was `unsupported`,
had zero evidence and no provider request, but still exposed
`["searchSubjects"]` as the card's source path. Existing unsupported/unavailable
fixtures also retained synthetic plan, scan, budget, hydration, and evidence
data, so they were not representative degraded outputs.

Required correction:

- separate planned operation from evidence-backed/attempted source operations;
- do not label a plan-only operation as an evidence source path;
- add end-to-end negative tests using real unknown-concept and
  unavailable-provider results;
- regenerate and inspect realistic unsupported/unavailable visual fixtures.

## Evidence reviewed

The reviewer inspected the required governance and review files, the exact
Base-to-Candidate diff, local discovery/renderer/focused tests, generated
catalog, PR #4, exact-Candidate CI run 31493891023, and all 14 visual QA
artifacts. Typecheck, discovery tests, renderer tests, and the focused PR-7H
suite passed independently. No protected human boundary was crossed.

## Non-blocking recommendations

- Display schema-valid month-only input in query facets.
- Bound individual warning, limitation, and coverage-reason text lengths.
- Record Candidate SHA and fixture provenance in future visual manifests.
- Remove stale launch wording after the corrective cycle advances.

## Review budget transition

- TIER_2 budget: `2 authorized / 1 consumed / 1 remaining`
- Sol #2 remains reserved for the same comprehensive reviewer only after Luna
  corrects all findings, creates a new Candidate, and obtains exact-SHA CI.
- Sol #3 remains prohibited.
