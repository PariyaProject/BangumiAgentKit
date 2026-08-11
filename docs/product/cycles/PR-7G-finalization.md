# PR-7G Finalization — Existing Recovery PR #5

Status: `CORRECTIVE_REQUIRED_STOPPED`

This is one explicitly human-authorized finalization review cycle for the
existing parked PR-7G Recovery PR. It is not a new Recovery Epoch, Product
Review Epoch, branch, PR, or self-evolution cycle.

## Provenance and scope

- Recovery Base: `5e7d4ace51a1aa1657a36d78f2c1a54915a4e05e`
- Existing PR: `#5 — https://github.com/PariyaProject/BangumiAgentKit/pull/5`
- Existing branch: `codex/recovery-pr-7g-series-watch-order`
- Starting branch tip: `ebcfad4406104aa2a8a7775fcca74efa204db57b`
- Historical Sol #2 implementation Candidate:
  `1e0cbd97fcdd0859187534fda67ae797c33e5d0e`
- Historical PR #2: closed without merge and superseded; its branch remains
  preserved read-only.

The historical Recovery Epoch remains terminal and immutable:

- Historical Sol budget: `2 authorized / 2 consumed`
- Historical terminal state: `PARKED_REVIEW_LIMIT`
- Historical Sol #3: prohibited

This finalization allowance is separate:

- Finalization reviewer: `sol_milestone_reviewer`
- Finalization Sol budget: `1 authorized / 1 consumed`
- Maximum finalization launches: `1`
- Generic subagents: `0 authorized / 0 launched`
- Integration policy: `AUTO_MERGE_AFTER_FREEZE`

## Known finding disposition

### P1-1 — renderer fixture/evidence consistency

Root cause: fixture/evidence construction only. The production
`SeriesWatchOrderResult` path was not found to fabricate the contradictory
states; the old hand-authored renderer fixtures did.

Attempted resolution: `scripts/series-watch-order-fixtures.ts` constructs
typed complete, partial, and not-computable results. The fixture generator
converts each result through `buildSeriesRelationsViewModel`, and
`assertSeriesWatchOrderFixture` checks several request/source, selected/
excluded, media, detail, state, and truncation invariants before PNG
generation. Renderer regression tests run the same fixtures.

Final Sol disposition: `CORRECTIVE_REQUIRED`. The fixtures still do not match
production relation-request topology and one deep edge has inconsistent
`fromId`/`pathIds`; the validator also misses required topology, row, detail,
and depth-driven attempt invariants. See
`docs/product/reviews/PR-7G-recovery-series-watch-order/finalization-sol-1-review.md`.

### P1-2 — exact-SHA CI coherence

The historical run `31508533985` remains unresolved historical evidence and is
not reused. After implementation is complete, a new exact Candidate will be
created, pushed, and checked job-by-job. The final Sol launch is forbidden
until every canonical required job reaches terminal `SUCCESS` for that exact
Candidate SHA.

## P2 disposition

| Finding | Decision | Finalization result |
| --- | --- | --- |
| Public root-relation error code/retryability | `DEFER_WITH_REASON` | Existing transport mapping already yields `NOT_FOUND`, `retryable=false`; service, read-tool, and Standalone regression coverage now proves propagation. No new error architecture is justified. |
| Oversized caller-created ViewModel normalization | `FIX_NOW` | Renderer normalization records `coverage.renderedOmitted`, explicit renderer truncation reasons, and a warning naming omitted steps/related/edge counts. |
| `maxNodes` versus detail-date ordering | `FIX_NOW` (bounded clarification) | Tool descriptions, cycle contract, and regression coverage state and prove relation-evidence preselection with ID tie-break, followed by date ordering only within the selected cap. |
| Extreme Renderer height | `FIX_NOW` | High-cardinality steps and related evidence use dense rows; edge evidence uses compact two-column rows while retaining all 64 records. |

## Candidate and gate ledger

- Finalization Candidate:
  `5582f01318619ea8a4797b94b0a9ccec0f32b616`
- Candidate commit: `fix: finalize PR-7G evidence and renderer QA`
- Candidate scope: 16 files, 1,131 insertions, 338 deletions from the
  finalization starting tip `ebcfad4406104aa2a8a7775fcca74efa204db57b`
- Exact-SHA CI run: `31530076120`
- Exact-SHA required jobs, all terminal `SUCCESS`:
  - `sqlite-default` (`93907731886`)
  - `host-integration` (`93907732071`)
  - `standalone-release-smoke` (`93907732027`)
  - `postgres-compat` (`93907731838`)
  - `provider-foundation` (`93907731871`)
  - `discovery-foundation` (`93907731920`)
- Historical run `31508533985` remains unresolved historical evidence and was
  not reused for this gate.
- Final Sol verdict: `CORRECTIVE_REQUIRED` (reviewer
  `019ff266-17c0-7050-aa84-969263f204cf`; exactly one launch consumed)
- Freeze status: `NOT_FROZEN`
- Merge commit: `NOT_CREATED`
- Current branch state: governance tip
  `42c22e05317748f540dfdcbef67d720194de90e8` is pushed to existing PR #5;
  PR #5 remains open and unmerged; historical branch untouched.

## Finalization readiness evidence

The exact Candidate was validated on the clean Candidate tree with:

- `pnpm typecheck` — passed.
- `pnpm build` — passed.
- `pnpm lint` — passed.
- `pnpm test` — 35 files / 206 tests passed.
- `pnpm test:contract` — 4 files / 22 tests passed.
- `pnpm test:semantic` — 2 files / 33 tests passed.
- `pnpm test:provider` — 8 files / 33 tests passed.
- `pnpm test:discovery` — 9 files / 51 tests passed.
- `pnpm test:standalone` — 3 files / 20 tests passed.
- `pnpm test:integration:sqlite` — 12 files / 33 tests passed; PostgreSQL
  cases were skipped because `DATABASE_URL` is not configured locally and are
  covered by the exact remote `postgres-compat` job.
- `pnpm test:render` — 7 files / 56 tests passed.
- `pnpm openapi:verify` — passed, including generated tool-catalog
  verification.
- `git diff --check` — passed; the Candidate checkout is clean.

Consolidated Luna preflight:

- P1-1 was the intended fixture/evidence correction, but the final Sol found
  it remains unresolved: the typed fixtures are not yet fully
  service-emittable, and the invariant set is incomplete.
- P1-2 is closed by run `31530076120` at the exact Candidate SHA with every
  required job terminal-success.
- Root-relation failure semantics remain `NOT_FOUND`, non-retryable, and are
  regression-tested through SeriesService, the read tool, and Standalone.
- Renderer caller-created truncation is explicit through omitted step/related/
  edge counts, renderer truncation reasons, and a warning naming the omitted
  categories. High-cardinality evidence uses compact rows and a two-column
  edge layout while retaining the truthful 64-edge cap.
- `maxNodes` selection is relation-evidence-first; detail dates order only the
  selected bounded set, with a regression proving an out-of-cap earlier date
  cannot replace the selected candidate.
- PR-7H compatibility is covered by the full build/test matrix and the
  discovery suite (9 files / 51 tests); no PR-7H discovery surface was
  reverted.
- Renderer QA inspected complete, partial, and not-computable typed fixtures
  at 640px and 960px, including long CJK, missing-image/data, exclusions,
  directed evidence, and partial-state messaging. The high-cardinality
  artifact measured 640x3631 and 960x3490, versus the historical 640x6925.

The finalization reviewer was authorized exactly once, sequentially, with the
historical `2 / 2` budget preserved. The separate finalization ledger is now
`1 authorized / 1 consumed`; its sole verdict is `CORRECTIVE_REQUIRED`.
Per the request, no second Sol launch, corrective Candidate, Freeze, or merge
is performed. The complete report is recorded at
`docs/product/reviews/PR-7G-recovery-series-watch-order/finalization-sol-1-review.md`.

## Required finalization gate

After the final Candidate, exact job-level CI evidence, renderer QA, local
validation, PR-7H compatibility evidence, and Luna consolidated audit were
complete before the one independent Sol review. That review returned
`CORRECTIVE_REQUIRED`; therefore PR #5 remains unmerged and the finalization
stops for human decision with no remaining finalization review allowance.
