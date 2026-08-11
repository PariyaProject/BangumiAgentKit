# PR-7G Finalization — Existing Recovery PR #5

Status: `IMPLEMENTATION_IN_PROGRESS`

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
- Finalization Sol budget: `1 authorized / 0 consumed`
- Maximum finalization launches: `1`
- Generic subagents: `0 authorized / 0 launched`
- Integration policy: `AUTO_MERGE_AFTER_FREEZE`

## Known finding disposition

### P1-1 — renderer fixture/evidence consistency

Root cause: fixture/evidence construction only. The production
`SeriesWatchOrderResult` path was not found to fabricate the contradictory
states; the old hand-authored renderer fixtures did.

Resolution: `scripts/series-watch-order-fixtures.ts` constructs typed,
service-shaped complete, partial, and not-computable results. The fixture
generator converts each result through `buildSeriesRelationsViewModel`, and
`assertSeriesWatchOrderFixture` checks request/source, relation-row/edge,
selected/excluded, media, detail, state, and truncation invariants before PNG
generation. Renderer regression tests run the same invariant-checked fixtures.

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

- Finalization Candidate: `NOT_CREATED`
- Exact-SHA CI run: `NOT_RUN`
- Final Sol verdict: `NOT_RUN`
- Freeze status: `NOT_FROZEN`
- Merge commit: `NOT_CREATED`
- Current branch state: existing PR #5 branch; historical branch untouched.

## Required finalization gate

After the final Candidate, exact job-level CI evidence, renderer QA, local
validation, PR-7H compatibility evidence, and Luna consolidated audit are
complete, launch exactly one independent Sol review. Merge PR #5 only if that
review returns `PASS`; otherwise persist the findings and stop with PR #5
unmerged for human decision.
