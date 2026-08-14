# PR-8A — Review Readiness

Status: `SOL_2_READY`

This packet authorizes the first sequential comprehensive TIER_2 review of the
PR-8A Subject Intelligence Overview Epoch. It records evidence for the exact
implementation Candidate and does not substitute for independent inspection.

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
- Milestone Sol launches consumed: `1 / 2`
- Outer Sol launches consumed: `1 / 4`
- Generic subagents: `0 / 0`
- Sol #2 is authorized for the corrected Candidate above as the final
  comprehensive review launch. Sol #3 is prohibited.

Sol #1 returned `CORRECTIVE_REQUIRED`; one of two milestone launches and one
of four outer launches are consumed. All four P1 and three safe P2 findings
are corrected in Candidate `998d4c4`, with fresh local validation, full visual
matrix evidence, and exact-SHA CI run `31766543465` green. Sol #2 is now
authorized as the final review launch for this milestone. The complete Sol #1
report is recorded at
`docs/product/reviews/PR-8A-subject-intelligence-overview/sol-1-review.md`.

The review should falsify the public semantic contract, section-state and
evidence honesty, source request/resource caps, provider absence/failure paths,
raw Bangumi role/relation label preservation, renderer boundaries and visual
density, Standalone/catalog integration, zero-network/security regressions,
and the deferred-scope boundary. It must inspect the actual repository and
Candidate rather than relying on this report.
