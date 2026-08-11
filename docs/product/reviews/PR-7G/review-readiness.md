# PR-7G Review Readiness

Cycle: `PR-7G Series Relations & Watch-Order Intelligence`

Review tier: `TIER_2`

Base branch: `master`

Recorded Base SHA: `23f960ce3a8a8ac3841b791061a648037a53ab19`

Feature branch: `codex/pr-7g-series-watch-order`

Pull request: [#2](https://github.com/PariyaProject/BangumiAgentKit/pull/2)

Implementation Candidate SHA:
`PENDING_CORRECTED_CANDIDATE` (prior Candidate
`3459689e69c8c14774d31a967b2161ed1e686a9d` was rejected by Sol #1 for
correction; the corrected implementation is now validated in the working tree)

Governance record before reviewer launch:
`de9c2264173937c506eaec93cd88515d5e99d897`

The metadata head also passed [GitHub Actions run
31476551304](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31476551304)
across all six mandatory jobs; this does not replace the exact Candidate CI
evidence above.

The prior Candidate's exact CI is historical evidence only. The corrected
production/test tree is not review-ready until its exact commit SHA is
recorded below and mandatory remote CI is green for that SHA. After that point,
later commits must remain governance metadata unless the one authorized
corrective Candidate changes again.

## Exact-Candidate CI

[GitHub Actions run 31476188502](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31476188502)
passed all six mandatory jobs for the prior Candidate SHA; this is historical
evidence and does not authorize Sol #2. Corrected-Candidate CI is pending.

- `sqlite-default`
- `host-integration`
- `standalone-release-smoke`
- `postgres-compat`
- `provider-foundation`
- `discovery-foundation`

## Local validation

The corrected working tree passed:

- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` — 191 tests
- `pnpm test:contract` — 22 tests
- `pnpm test:semantic` — 32 tests
- `pnpm test:provider` — 33 tests
- `pnpm test:discovery` — 48 tests
- `pnpm test:render` — 45 tests
- `pnpm test:standalone` — 19 tests
- `pnpm test:integration:sqlite` — 33 tests
- `pnpm openapi:verify` — pinned-spec validation, generation, formatting, and
  exact generated-output diff all passed

Focused PR-7G coverage includes 8 core service tests, the semantic input/output
contract, renderer at 640px and 960px, long CJK names, missing images, partial
detail failures, not-computable output, mixed media request-path assertions,
unknown/non-watch labels, directed reverse-edge and cross-franchise negatives,
duplicate labels, deterministic ties, depth/back-edge truncation, and
Standalone semantic/render dispatch.

## User, Agent, and visual QA

- Agent QA: inspected the corrected diff, OpenAPI contract, transport request
  paths, resource bound (`2 + 2N` before transport retries), tests, tool
  catalog, and protected-boundary non-scope. Direct root-relative labels now
  control recommendations; stable watch edges alone expand; non-anime rows
  are never detail-hydrated. No auth, credential, write, migration,
  HTML/Structured Web, snapshot, or release path was added.
- Visual QA: rendered and inspected corrected representative partial/long-CJK
  fixtures at [640px](../../../../.codex/visualizations/2026/08/11/019fefef-0e53-7ae0-b080-8977738528ba/pr7g-corrected-series-relations-640.png),
  [960px](../../../../.codex/visualizations/2026/08/11/019fefef-0e53-7ae0-b080-8977738528ba/pr7g-corrected-series-relations-960.png),
  and the [not-computable 640px state](../../../../.codex/visualizations/2026/08/11/019fefef-0e53-7ae0-b080-8977738528ba/pr7g-corrected-not-computable-640.png).
  Hierarchy, step numbering, mobile wrapping, raw relation evidence,
  exclusion reasons, warning color, limitation, and footer remain legible.

## Review launch authorization

Sol #1 was launched as agent
`019ff01d-dfae-7d80-9d24-5cff183ecd8a` (`Poincare`). The recorded sequence
authorizes:

1. one comprehensive `sol_milestone_reviewer` launch at the Candidate above;
2. Sol #1 returned `CORRECTIVE_REQUIRED`; one and only one further
   comprehensive launch is authorized after Luna creates a corrected Candidate
   and refreshes all evidence;
3. no automatic third launch.

The complete Sol #1 verdict and P1 correction requirements are recorded in
[`sol-1-corrective.md`](sol-1-corrective.md). The prior Candidate's exact CI is
historical evidence only; it is not a freeze candidate.
