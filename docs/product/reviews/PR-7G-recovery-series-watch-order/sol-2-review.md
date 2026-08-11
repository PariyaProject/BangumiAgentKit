# PR-7G Recovery — Sol #2 Review

- Reviewer: `sol_milestone_reviewer`
- Agent ID: `019ff187-e693-7952-b5cd-99dcb9369812`
- Launch ordinal: `Sol #2 of 2`
- Launch time: `2026-08-11T15:53:46Z`
- Recovery Base: `5e7d4ace51a1aa1657a36d78f2c1a54915a4e05e`
- Candidate reviewed: `1e0cbd97fcdd0859187534fda67ae797c33e5d0e`
- Verdict: `CORRECTIVE_REQUIRED`
- P0 findings: `0`
- P1 findings: `2`
- P2 findings: `4`
- Human review required: `No`

This was the final reserved TIER_2 launch. The review budget is exhausted;
Sol #3 is prohibited. Under the execute-only policy, the milestone is parked
at `PARKED_REVIEW_LIMIT` and is not integrated.

## P1-1 — renderer fixtures are still not service-consistent

The corrected readiness packet claims internally consistent complete, partial,
and not-computable evidence at both widths, but the generated fixture model
still represents impossible service states:

- the partial fixture has one edge while claiming 20 observed rows and 20
  evidence records;
- the complete fixture claims nine relation rows but inherits that one edge;
- the not-computable fixture inherits three relation requests and nine evidence
  sources even though a non-anime root performs no child traversal or detail
  hydration.

Acceptance for a future explicitly authorized cycle: construct fixtures from
real `SeriesWatchOrderResult` outputs or enforce automated invariants for
request/source counts, rows/edges, selected/excluded totals, and state/
truncation semantics, then regenerate and inspect all six 640/960 artifacts.

## P1-2 — exact-SHA CI state is incoherent

Run `31508533985`
([run](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31508533985))
is tied to the corrected Candidate. Five jobs reported success, while the
job-level view still reported `postgres-compat` as `Currently running` after
the workflow header reported `Success`. The mandatory exact-Candidate CI gate
therefore cannot be claimed coherently.

Acceptance for a future explicitly authorized cycle: the exact Candidate run
must reach one coherent terminal state with all six required jobs, including
`postgres-compat`, successful.

## P2 findings

- Root-relation failure coverage asserts only message text. Establish the
  truthful public error code/retryability through service, tool, and Standalone
  surfaces for a relation-endpoint 404 after successful root detail.
- Renderer normalization updates state/flags/returned counts for oversized
  caller-created ViewModels but does not add a truncation reason or explicit
  omitted counts.
- `maxNodes` selection occurs before detail hydration/date discovery; clarify
  that cap-preselection semantics or align them with the documented date-order
  rule in a future cycle.
- The valid-maximum renderer test uses a one-pixel browser stub; a real
  24-related/64-edge 640px render measured 640×6925 and is too unwieldy for
  mobile/chat without a compact evidence hierarchy.

## Verified evidence

- Duplicate safe seeds, same-direction traversal, 24/64 display and asset
  caps, media descriptions, conflict handling, historical directional/media/
  edge blockers, tool catalog, Standalone routes, and SSRF boundaries were
  inspected.
- Local validation passed: 204 unit/render tests; typecheck; lint; contract 22;
  semantic 32; provider 33; discovery 51; SQLite integration 33; Standalone
  19; OpenAPI/catalog verification; and live official-v0 probes.
- Six 640/960 PNG artifacts were supplied and inspected, but the fixture
  provenance mismatch above prevents them from serving as final freeze
  evidence.

## Terminal review-budget transition

`TIER_2`: `2 authorized / 2 consumed / 0 remaining`. The corrected Candidate
is not frozen, no merge commit exists, and no further Sol launch is allowed.
