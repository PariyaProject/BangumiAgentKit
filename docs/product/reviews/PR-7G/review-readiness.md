# PR-7G Review Readiness

Cycle: `PR-7G Series Relations & Watch-Order Intelligence`

Review tier: `TIER_2`

Base branch: `master`

Recorded Base SHA: `23f960ce3a8a8ac3841b791061a648037a53ab19`

Feature branch: `codex/pr-7g-series-watch-order`

Pull request: [#2](https://github.com/PariyaProject/BangumiAgentKit/pull/2)

Implementation Candidate SHA:
`08e1c4bc14269b110c24b4694819b652284aae46`

Governance record before reviewer launch:
`e82e9644da0208e4f023a04fe6bbba97b3c52cc1`

The prior metadata head passed [GitHub Actions run
31476551304](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31476551304)
across all six mandatory jobs. The current metadata-only head is a governance
record after the exact Candidate and does not replace that exact-Candidate CI.

This corrected Candidate contains the production, test, renderer, and
correction-record tree validated below. The prior Candidate's exact CI is
historical evidence only. Later commits must remain governance metadata unless
the one authorized corrective Candidate changes again.

## Exact-Candidate CI

[GitHub Actions run 31480599124](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31480599124)
passed all six mandatory jobs for the exact corrected Candidate SHA
`08e1c4bc14269b110c24b4694819b652284aae46`.

- `sqlite-default`
- `host-integration`
- `standalone-release-smoke`
- `postgres-compat`
- `provider-foundation`
- `discovery-foundation`

## Local validation

The corrected Candidate passed locally:

- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` — 191 tests
- `pnpm test:contract` — 22 tests
- `pnpm test:semantic` — 32 tests
- `pnpm test:provider` — 33 tests
- `pnpm test:discovery` — 48 tests
- `pnpm test:render` — 46 tests
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
   comprehensive launch is authorized after Candidate
   `08e1c4bc14269b110c24b4694819b652284aae46` has green exact-SHA CI and the
   refreshed readiness record is committed;
3. no automatic third launch.

Readiness gate: exact-Candidate CI run 31480599124 is green, local and visual
QA above are current, the corrected Candidate is clean and pushed, and Sol #2
is now authorized as the final milestone review launch. Sol #2 was launched as
agent `019ff04c-276c-7aa0-8728-311142ababed` (`Aquinas`); no third launch is
authorized.

Sol #2 returned `CORRECTIVE_REQUIRED` with no P0 and four P1 findings. The
complete final review record is [`sol-2-corrective.md`](sol-2-corrective.md).
Because this was launch 2/2, the Candidate is not frozen and PR-7G is parked
at `PARKED_REVIEW_LIMIT`; no third review launch is authorized.

The complete Sol #1 verdict and P1 correction requirements are recorded in
[`sol-1-corrective.md`](sol-1-corrective.md). The prior Candidate's exact CI is
historical evidence only; it is not a freeze candidate.
