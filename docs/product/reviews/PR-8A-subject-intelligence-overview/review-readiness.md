# PR-8A — Review Readiness

Status: `SOL_1_RUNNING`

This packet authorizes the first sequential comprehensive TIER_2 review of the
PR-8A Subject Intelligence Overview Epoch. It records evidence for the exact
implementation Candidate and does not substitute for independent inspection.

## Candidate and integration identity

- Base SHA: `cd0ee074ca6e9d6b65e063e2461bc54a4cc0897e`
- Implementation Candidate:
  `aeb2b34d127e49dbe09f81ce80b0b53873ff1a3c`
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
[31764720966](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31764720966)
passed on the Candidate branch snapshot. All six required jobs passed:

- `sqlite-default`
- `host-integration`
- `standalone-release-smoke`
- `postgres-compat`
- `provider-foundation`
- `discovery-foundation`

The earlier Candidate `968d20e` failed only because `openapi:verify` exposed a
tracked generated-catalog formatting mismatch. The canonical generated catalog
was committed in `8ee9483`, and the corrected Candidate above passed the full
remote matrix.

## Local validation

The following checks passed before this packet was persisted:

- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` — 36 files / 208 tests
- `pnpm test:contract` — 22 tests
- `pnpm test:semantic` — 36 tests
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
- Representative complete/partial/no-image long-CJK fixtures were rendered
  and inspected at 640px and 960px under `.artifacts/render/`; section states,
  coverage, warnings, wrapping, footer, and mobile/chat density remained
  readable without clipping.
- Bangumi parity was checked read-only against the subject overview and stats
  journey at `https://bgm.tv/subject/41529` and
  `https://bgm.tv/subject/41529/stats`; episodes, community/history,
  personalization, and source expansion remain explicitly deferred.

## Review budget and focus

- Review tier: `TIER_2`
- Reviewer: `sol_milestone_reviewer`
- Launch ordinal: `Sol #1 of 2`
- Milestone Sol launches consumed: `0 / 2`
- Outer Sol launches consumed: `0 / 4`
- Generic subagents: `0 / 0`
- Sol #2 is reserved only for a corrected Candidate after a
  `CORRECTIVE_REQUIRED` result. Sol #3 is prohibited.

The review should falsify the public semantic contract, section-state and
evidence honesty, source request/resource caps, provider absence/failure paths,
raw Bangumi role/relation label preservation, renderer boundaries and visual
density, Standalone/catalog integration, zero-network/security regressions,
and the deferred-scope boundary. It must inspect the actual repository and
Candidate rather than relying on this report.
