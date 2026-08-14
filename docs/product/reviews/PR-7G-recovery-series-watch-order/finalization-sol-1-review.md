# PR-7G Finalization Sol #1 Review

Verdict: `CORRECTIVE_REQUIRED`

This is the one explicitly authorized finalization review for existing PR #5.
It is separate from the historical Recovery Epoch's exhausted `2 / 2`
review budget. No second finalization Sol launch is authorized.

## Review identity and exact scope

- Reviewer: `sol_milestone_reviewer`
- Reviewer agent: `019ff266-17c0-7050-aa84-969263f204cf`
- Review lane: finalization Sol #1 of exactly 1
- Recovery Base: `5e7d4ace51a1aa1657a36d78f2c1a54915a4e05e`
- Implementation Candidate reviewed:
  `5582f01318619ea8a4797b94b0a9ccec0f32b616`
- Starting finalization tip: `ebcfad4406104aa2a8a7775fcca74efa204db57b`
- Governance Record SHA at review time:
  `42c22e05317748f540dfdcbef67d720194de90e8`
- PR: `#5`, still open and unmerged
- Historical PR #2 and branch: preserved read-only; not merged or modified

The reviewer inspected the actual Base..Candidate diff, historical Sol
reports, the finalization plan, affected implementation/tests, exact-SHA CI
evidence, and the recorded renderer QA. It reported no P0 and no protected
human-only boundary issue.

## Blocking finding

### P1 — Renderer QA fixtures still cannot be emitted by SeriesService

The Candidate's fixture/evidence correction is incomplete:

- The complete fixture has `depth: 1` and stable prequel/sequel candidates but
  records only the root relation request and no child-relation sources. The
  production traversal schedules relation reads for both stable children, so
  the corresponding service-shaped result would have three relation requests
  including the root. See
  `scripts/series-watch-order-fixtures.ts:168-240` and
  `packages/bangumi-core/src/services/series-service.ts:774`.
- The partial deep path records `fromId: 300` while its `pathIds` are
  `[300, 301, 304]`. Production relation evidence sets `fromId` to the
  subject whose relation endpoint produced the row, so this edge should
  originate from `301`. See
  `scripts/series-watch-order-fixtures.ts:268` and
  `packages/bangumi-core/src/services/series-service.ts:312`.
- The partial fixture omits required relation attempts for the depth-2
  traversal. With the listed candidates, production also attempts the missing
  child relation paths (including 303 and 304), but the fixture records only
  root/301/302 relation sources.
- `assertSeriesWatchOrderFixture` does not yet validate
  `relationRowsObserved`, edge topology, `edgeEvidenceReturned`,
  `detailsFetched`, or every depth-driven relation attempt/status. The older
  hand-authored renderer helper in
  `tests/render/series-relations.test.ts:90` also remains a two-row/one-edge
  contradiction.

Impact: the six PNGs do pass through the ViewModel builder, but the fixtures
do not yet prove that the renderer preserves evidence from a result that the
real `SeriesService` can emit. Historical P1-1 therefore remains unresolved
for the exact Candidate.

The reviewer's acceptance conditions were:

1. Generate complete/partial/not-computable fixtures by executing
   `SeriesService` against deterministic mocked API responses, or enforce
   equivalent comprehensive invariants.
2. Validate edge topology, relation rows, every required relation/detail
   attempt and status, fetched/failed counts, returned edge/related counts,
   selected/excluded/media counts, and state/truncation consistency.
3. Remove or validate every remaining contradictory hand-authored service
   result helper.
4. Regenerate and inspect the six 640px/960px artifacts from corrected
   results.

## Non-blocking recommendations

- Render the root step's relation chip as `起点` instead of `关系未知`.
- Render `coverage.renderedOmitted` directly so omission details are not hidden
  behind the four-warning display cap.
- Revisit whether `nonAnimeRowsObserved` means unique classified subjects or
  raw relation rows.
- Make the synthetic maximum fixture's step metadata internally consistent
  and consider a more compact summary hierarchy.

The reviewer also corrected the readiness-record provenance: the full
Governance Record SHA is
`42c22e05317748f540dfdcbef67d720194de90e8`.

## Evidence verified by the reviewer

- Exact Candidate CI run `31530076120` targets `5582f013...`; all six required
  jobs are terminal-success.
- Focused 34/34, full 35-file/206-test, typecheck, and OpenAPI/catalog checks
  passed.
- PR #5 is cleanly mergeable against the recorded Recovery Base and points to
  the governance-only tip.
- Security boundaries, request ceilings, tool registration, Standalone
  propagation, PR-7H compatibility, and renderer asset caps showed no other
  P0/P1 blocker.

## Terminal action

Because the only finalization Sol returned `CORRECTIVE_REQUIRED` and the
finalization budget is exactly `1 / 1`, no corrective Candidate or second Sol
review is authorized by this request. PR #5 remains unmerged and unfrozen for
human decision. The implementation Candidate and historical branch are
preserved.
