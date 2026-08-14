# PR-7G Finalization Luna Corrective — Human Review Readiness

Status: `HUMAN_REVIEW_READY`

This is the single explicitly human-directed Luna-only corrective on existing
PR #5. It is not a new Recovery Epoch, Product Review Epoch, branch, PR, Sol
review cycle, Freeze, merge, or Self-Evolution cycle.

## A. Branch and provenance

- Recovery Base: `5e7d4ace51a1aa1657a36d78f2c1a54915a4e05e`
- Existing PR: [#5](https://github.com/PariyaProject/BangumiAgentKit/pull/5)
- Existing branch: `codex/recovery-pr-7g-series-watch-order`
- Starting branch tip before corrective mutation:
  `6aa30f83eae94975787b6f81dc8d005ce600cd35`
- New implementation Candidate:
  `fd48eb626b6b027031cc3884444963018beef2ed`
- Candidate label: `HUMAN_REVIEW_CANDIDATE`
- Previous finalization Candidate:
  `5582f01318619ea8a4797b94b0a9ccec0f32b616`
- Previous Candidate verdict: historical `CORRECTIVE_REQUIRED`; it was not
  rewritten or relabeled.

Historical Recovery review consumption remains `2 / 2`. The separate
finalization Sol allowance remains `1 / 1`, with the historical verdict still
`CORRECTIVE_REQUIRED`. Sol launches during this corrective: `0`. Generic
subagents during this corrective: `0`.

## B. Root cause and production determination

The sole P1 was in the Freeze-level renderer fixture/evidence pipeline, not in
production `SeriesService`:

- the complete hand-authored fixture omitted the child relation reads that
  production schedules for stable direct children;
- a partial deep edge claimed `fromId=300` while its path was
  `[300, 301, 304]`, although production evidence originates that edge at
  `301`;
- the partial fixture omitted depth-driven relation attempts and associated
  failures;
- the validator did not comprehensively reconcile topology, attempts, rows,
  detail outcomes, selection, or state/truncation; and
- `tests/render/series-relations.test.ts` retained a contradictory hand-authored
  service-shaped helper.

No production `SeriesService` behavior was changed. The fix is a fixture and
evidence-pipeline correction.

## C. Service-emittable Freeze fixture pipeline

`runScenario` now installs a deterministic mocked `HttpClient` transport,
executes the real `SeriesService.getSeriesWatchOrder`, records every actual
mock request, and returns the real `SeriesWatchOrderResult`. Both renderer
tests and `scripts/generate-render-fixtures.ts` call
`assertSeriesWatchOrderFixture` before passing `run.result` to
`buildSeriesRelationsViewModel` and the renderer.

The three Freeze-level scenarios are:

- `complete`: root `100`, root relation rows `101/102/103/201/202`, child
  relation reads for stable anime children `101` and `102`, and child detail
  hydrations for `101` and `102`.
- `partial`: root `300`; relation attempts for `300` at depth 0, `301`, failed
  `302`, `303`, and depth-2 `304`; child detail attempts for `301/302/303/304/306`,
  with `303` failing. The deep topology includes
  `300 → 301 → 304 → 306` and the correct immediate origins
  `301 → 304` and `304 → 306`.
- `not-computable`: non-anime root `500`, root relation rows only, no child
  traversal or detail hydration, and explicit `not_computable` state.

## D. Invariants now enforced

The fixture validator uses an independent deterministic request/evidence
oracle and checks:

- exact mock request order, subject IDs, depths, statuses, and relation row
  counts;
- exact evidence-source order and status for root/detail/relation attempts;
- exact edge topology (`fromId`, `toId`, depth, raw label, normalized kind,
  `pathIds`, `pathKinds`, and `direct`), including parent-path continuity and
  successful relation-source provenance at the edge depth;
- every edge target and relation path retained in `related` evidence;
- `relationRowsObserved` against actual successful mock response row totals;
- `edgeEvidenceReturned`, unique observed/returned related counts, and
  relation request/failure counts;
- child detail attempt/fetched/failed counts against actual request statuses
  (root detail is intentionally excluded from the service's child-detail
  coverage counters);
- anime/non-anime observed and returned totals, selected IDs, excluded totals,
  and exclusion-reason sums;
- configured depth, maxNodes, and media preservation;
- `COMPLETE`, `PARTIAL`, and `NOT_COMPUTABLE` state, truthful truncation
  reasons, cap flags, capability state, and non-anime-root behavior.

## E. Old helper audit

The contradictory `makeResult` service-shaped helper was removed from
`tests/render/series-relations.test.ts`. The service-emittable tests and
generator now use only the real service runs. The high-cardinality fixture in
`scripts/generate-render-fixtures.ts` remains intentionally synthetic at the
ViewModel boundary for renderer cap/layout testing and is explicitly labeled
as not being Freeze-level service evidence. No contradictory service-shaped
helper remains in the renderer or Freeze fixture pipeline.

## F. Focused and full validation

Focused corrective matrix:

- `pnpm vitest run tests/render/series-relations.test.ts tests/unit/series-watch-order.test.ts tests/semantic/series-watch-order.test.ts tests/standalone/standalone-runtime.test.ts` — **34/34 passed**.

Complete local validation:

- `pnpm build` — passed.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm test` — **35 files / 206 tests passed**.
- `pnpm test:contract` — **4 files / 22 tests passed**.
- `pnpm test:semantic` — **2 files / 33 tests passed**.
- `pnpm test:provider` — **8 files / 33 tests passed**.
- `pnpm test:discovery` — **9 files / 51 tests passed**.
- `pnpm test:standalone` — **3 files / 20 tests passed**.
- `pnpm test:integration:sqlite` — **12 files / 33 tests passed**.
- `pnpm test:render` — **7 files / 56 tests passed**.
- `pnpm openapi:verify` — passed, including generated catalog verification.
- `git diff --check` — passed.

The local PostgreSQL integration cases were skipped because `DATABASE_URL` is
not configured locally; the mandatory remote `postgres-compat` job succeeded.

## G. Renderer QA

Fresh artifacts were generated by `pnpm render:fixtures` from the corrected
service-emittable results and inspected at both required widths:

| Scenario       | 640px artifact           | 960px artifact           | QA result                                                                                       |
| -------------- | ------------------------ | ------------------------ | ----------------------------------------------------------------------------------------------- |
| COMPLETE       | `640x1888`, 234290 bytes | `960x1686`, 228973 bytes | CJK, raw labels, directed evidence, exclusions, and complete state readable                     |
| PARTIAL        | `640x2324`, 268213 bytes | `960x1838`, 245982 bytes | deep paths, failed relation/detail warnings, partial coverage, and missing-cover state truthful |
| NOT_COMPUTABLE | `640x1436`, 190077 bytes | `960x1341`, 188139 bytes | non-anime root, retained relation evidence, and no watch-order claim explicit                   |

The high-cardinality regression was also regenerated and inspected:

- `series-relations-maximum-640.png`: `640x3668`, 565874 bytes.
- `series-relations-maximum-960.png`: `960x3490`, 497429 bytes.
- The 17-step / 24-related / 64-edge display remains compact, readable, and
  explicit about bounded related evidence and omission/truncation.

No fabricated values were introduced; missing images remain placeholders,
raw relation labels and IDs remain visible, and CJK text remains readable.

## H. Exact-SHA CI

Mandatory remote CI run:

`31542758003`

The run completed successfully for the pushed PR #5 branch Candidate
`fd48eb626b6b027031cc3884444963018beef2ed`.

| Job                        | Job ID        | Terminal state |
| -------------------------- | ------------- | -------------- |
| `sqlite-default`           | `93948651300` | `SUCCESS`      |
| `host-integration`         | `93948651293` | `SUCCESS`      |
| `standalone-release-smoke` | `93948651305` | `SUCCESS`      |
| `postgres-compat`          | `93948651318` | `SUCCESS`      |
| `provider-foundation`      | `93948651320` | `SUCCESS`      |
| `discovery-foundation`     | `93948651299` | `SUCCESS`      |

The run carried only non-blocking Node.js action deprecation warnings; no
mandatory job failed or remained non-terminal.

## I. Terminal state and limitations

- PR #5 remains `OPEN` and unmerged.
- Freeze was not performed: `NOT_FROZEN`.
- No merge commit was created.
- No Sol was launched during this corrective, and no review budget was reset.
- The next gate is human independent review outside this Goal.
- The historical P2 suggestions (root chip wording, direct rendered-omission
  display, non-anime row semantic refinement, and synthetic maximum metadata
  cleanup) remain deferred because they are outside the sole P1 objective.
- This report and the cycle/loop ledger are post-Candidate governance metadata;
  the implementation Candidate SHA above remains the exact SHA reviewed by
  CI and is not replaced by the metadata commit.

Terminal marker: `HUMAN_REVIEW_READY`
