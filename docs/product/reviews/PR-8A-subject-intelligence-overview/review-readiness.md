# PR-8A — Review Readiness

Status: `HUMAN_REVIEW_READY`

Historical independent-review status: `PARKED_REVIEW_LIMIT`

This packet records the final sequential comprehensive TIER_2 review of the
PR-8A Subject Intelligence Overview Epoch. The exact implementation Candidate
passed mandatory CI but did not pass independent review; the milestone is
parked at its review limit and is not frozen.

The human-directed corrective checkpoint at the end of this packet is a new
implementation Candidate for human review. It does not alter the historical
Sol verdicts or claim an independent review PASS.

## Candidate and integration identity

- Base SHA: `cd0ee074ca6e9d6b65e063e2461bc54a4cc0897e`
- Implementation Candidate:
  `998d4c4935f52d4cdf1543ca1663d68d137065fc`
- Feature branch: `codex/pr-8a-subject-intelligence-overview`
- Pull request: `#6 — https://github.com/PariyaProject/BangumiAgentKit/pull/6`
- Target base: `master`
- Integration policy: `AUTO_MERGE_AFTER_FREEZE`
- Merge strategy: `MERGE_COMMIT`

The reviewer must inspect `Base..Candidate` and treat the Candidate SHA above
as the implementation freeze subject. This packet and later review/freeze
records are governance metadata under the two-SHA freeze model.

## Exact-SHA CI

GitHub Actions run
[31766543465](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31766543465)
passed on the corrected Candidate branch snapshot. All six required jobs passed:

- `sqlite-default`
- `host-integration`
- `standalone-release-smoke`
- `postgres-compat`
- `provider-foundation`
- `discovery-foundation`

The earlier Candidate `968d20e` failed only because `openapi:verify` exposed a
tracked generated-catalog formatting mismatch. The canonical generated catalog
was committed in `8ee9483`; Sol #1 then required the corrections recorded in
`sol-1-review.md`, and the current corrected Candidate above passed the full
remote matrix.

## Local validation

The following checks passed before this packet was persisted:

- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` — 36 files / 208 tests
- `pnpm test:contract` — 22 tests
- `pnpm test:semantic` — 46 tests
- `pnpm test:provider` — 33 tests
- `pnpm test:discovery` — 51 tests
- `pnpm test:standalone` — 21 tests
- `pnpm test:integration:sqlite` — 33 tests
- `pnpm test:render` — 8 files / 58 tests
- `pnpm openapi:verify`
- `git diff --check`

The format check was green for every PR-8A touched source, test, and
documentation file. The repository-wide formatter still reports unrelated
pre-existing files outside this Epoch; no unrelated files were reformatted.

## Product, Agent, and renderer QA

- The semantic journey answers the bounded subject overview questions through
  one `bangumi.get_subject_overview` call, composing subject detail, stats,
  cast, staff, and relations without new source classes or child hydration.
- Section failures remain `partial`, `unavailable`, or `not_computable` with
  warnings, caps, coverage, limitations, and `attemptedAt` versus
  `retrievedAt` evidence; no empty success or fabricated zero is introduced.
- `bangumi.render_subject_overview` consumes a bounded ViewModel and the
  Standalone `overview` and `render overview` commands use the same caps and
  semantic surface. Existing renderer security and zero-network tests pass.
- Corrected Candidate visual QA rendered and inspected complete, partial,
  unavailable, and not-found states at both 640px and 960px under
  `.artifacts/render/pr8a-corrected/`; dense long-CJK content, missing images,
  section states, coverage, hidden-count disclosure, warnings, wrapping,
  footer, and mobile/chat density remained readable without clipping.
- Corrected semantic QA proves the 4-per-character / 32-total actor caps,
  per-operation attempt/retrieval ordering, exhaustive stats failure states,
  source-success accounting, and raw official staff labels.
- Bangumi parity was checked read-only against the subject overview and stats
  journey at `https://bgm.tv/subject/41529` and
  `https://bgm.tv/subject/41529/stats`; episodes, community/history,
  personalization, and source expansion remain explicitly deferred.

## Review budget and focus

- Review tier: `TIER_2`
- Reviewer: `sol_milestone_reviewer`
- Launch ordinal: `Sol #2 of 2`
- Milestone Sol launches consumed: `2 / 2`
- Outer Sol launches consumed: `2 / 4`
- Generic subagents: `0 / 0`
- Sol #2 completed `CORRECTIVE_REQUIRED` with four P1 findings. Sol #3 is
  prohibited; the full report is
  `docs/product/reviews/PR-8A-subject-intelligence-overview/sol-2-review.md`.

Sol #1 returned `CORRECTIVE_REQUIRED`; its four P1 and three safe P2 findings
were addressed in Candidate `998d4c4`, with fresh local validation, full
visual matrix evidence, and exact-SHA CI run `31766543465` green. Sol #2 then
returned `CORRECTIVE_REQUIRED` with four P1 findings, exhausting the milestone
review budget. The complete reports are recorded at
`docs/product/reviews/PR-8A-subject-intelligence-overview/sol-1-review.md` and
`docs/product/reviews/PR-8A-subject-intelligence-overview/sol-2-review.md`.

The final review falsified the renderer asset path, timestamp ordering,
composition provenance, and visual-fixture truthfulness. Candidate
`998d4c4935f52d4cdf1543ca1663d68d137065fc` is therefore not freeze-ready or
mergeable in this Goal. The exact CI run remains green, but the milestone is
parked at `PARKED_REVIEW_LIMIT`.

## Sol #2 result

The four P1 findings are recorded in the complete independent report linked
above. This historical Sol #2 packet must not be read as authorizing a third
review launch. The human-directed corrective checkpoint below is the current
handoff and does not alter the independent verdict.

## Human-directed corrective checkpoint — 2026-08-14

This is the current human-review handoff for the explicit Luna-only corrective
authorized on the existing PR-8A branch. The historical TIER_2 review budget
remains exhausted at `2 / 2`, the outer ledger remains `2 / 4`, and no Sol
launch was made for this corrective.

- Starting branch tip: `e0f5416837f60f60b3d37c9cd4be3da3fcf0ea94`.
- New `HUMAN_REVIEW_CANDIDATE`:
  `05288aecf80f040213dc4fdc938f2838775b9829`.
- Corrected P1 roots: Subject Overview rendered cover/character images are
  bounded through AssetResolver with rejected/failed images on the placeholder
  path and no raw URL fallback; provider stats `retrievedAt` is after source
  completion; composition emits stable `derived-s7` evidence with
  `subject-overview-composition-v1` and deterministic state/limit/partial
  provenance; and visual fixtures use mocked dependencies through the real
  semantic result, ViewModel, Renderer, and PNG path.
- Focused tests: provider 9, semantic 13, renderer 4; all passed. Full local
  validation and the final deterministic 10-image 640/960 visual matrix passed
  and were manually inspected. The final visual fixtures include complete,
  missing-character, partial, unavailable, and not-found states with dense
  long-CJK content.
- Exact-SHA CI run
  [31770406756](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31770406756)
  passed all six required jobs: `sqlite-default`, `host-integration`,
  `standalone-release-smoke`, `postgres-compat`, `provider-foundation`, and
  `discovery-foundation`.
- Luna pre-human falsification found and closed the direct-template raw-image
  fallback risk; no unresolved P0/P1/P2 blocker is claimed by this checkpoint.
- Current state: `HUMAN_REVIEW_READY`. PR #6 is open on
  `codex/pr-8a-subject-intelligence-overview`; the Candidate is not frozen,
  merged, closed, or independently approved. Await human review and stop.
