# PR-7H Review Readiness

Status: `SOL_2_RUNNING`

## Candidate and remote evidence

- Target base: `master`
- Recorded Base SHA: `23f960ce3a8a8ac3841b791061a648037a53ab19`
- Feature branch: `codex/pr-7h-discovery-renderer`
- Pull request: `#3 — https://github.com/PariyaProject/BangumiAgentKit/pull/3`
- Corrected implementation Candidate SHA:
  `3f46a97010fff829ab6cfec132bae07359b34e2c`
- Exact mandatory CI run:
  [31486111752](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31486111752)
- CI result: `PASS`; `provider-foundation`, `sqlite-default`,
  `host-integration`, `postgres-compat`, `standalone-release-smoke`, and
  `discovery-foundation` all completed successfully on the exact corrected
  Candidate.
- Candidate worktree state: clean after the corrected implementation commit;
  current branch tip may contain governance-only readiness commits after the
  Candidate; this record is governance-only.
- `git diff --check`: passed.

## Product and implementation evidence

PR-7H adds the evidence-bearing `discovery-results` renderer view model/card
and `bangumi.render_query_subjects`. The tool reuses the existing
`bangumi.query_subjects` Zod schema and `DiscoveryEngine`/`ProviderRegistry`
seam. It does not add a source, query semantic, persistence, authorization,
credential, write, HTML/Structured Web, or migration capability.

The card preserves query facets, result facts, official-v0 operation labels,
pushdown/post-filter/derived-plan classification, estimated versus exact total
semantics, page/scan/hydration coverage, warnings, limitations, missing fields,
and explicit unsupported/unavailable/partial states. Rendered items are capped
at 12; card-hidden returned rows are separated from observed-but-not-returned
candidates, and bounded criteria disclose omitted values/groups. Image URLs
continue through the existing SSRF-constrained resolver.

## Local validation

All commands below passed against the Candidate before readiness:

- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` — 33 files, 186 tests
- `pnpm test:contract` — 22 tests
- `pnpm test:semantic` — 31 tests
- `pnpm test:provider` — 33 tests
- `pnpm test:discovery` — 50 tests
- `pnpm test:standalone` — 18 tests
- `pnpm test:integration:sqlite` — 33 tests
- `pnpm test:render` — 49 tests
- `pnpm openapi:verify`
- focused PR-7H renderer tests — 1 file, 6 tests

The existing test output includes expected stderr/stdout from security/error
regression fixtures and skipped PostgreSQL tests when `DATABASE_URL` is absent;
no test failed.

## Agent QA

- `bangumi.render_query_subjects` is registered with `risk: read` and
  `auth: none`.
- Its schema is shared with `bangumi.query_subjects`; raw execution budget
  fields remain rejected.
- Missing `ProviderRegistry` fails closed before rendering.
- The tool requests compact explanation by default and honors explicit
  `explain: "none"`.
- The builder maps only validated, typed fields; unknown score/rank/date/image
  values remain unknown or absent.
- React static rendering escapes query text; no raw evidence or HTML is trusted.

## Renderer and visual QA

Focused renderer tests cover complete/partial fixture mapping, unsupported,
unavailable and empty states, long CJK text, missing images and numeric fields,
bounded item/criteria display, observed-versus-hidden count wording, coverage
reasons without hydration, XSS-safe query text, and PNG output at 640px and
960px.

The corrected visual matrix was generated from the built Candidate with
`RenderService.renderCard`, `deviceScaleFactor: 1`, no resolved images, and
the seven cases `complete`, `partial`, `unsupported`, `unavailable`, `empty`,
`long-cjk`, and `max-input` at both widths. Inspected heights were:

- 640px: `1099`, `2137`, `844`, `844`, `844`, `1348`, `2339` pixels;
- 960px: `877`, `1484`, `844`, `844`, `844`, `1144`, `1626` pixels.

Artifacts:

- [complete 640](/Users/wuzhao/.codex/visualizations/2026/08/11/019fefef-0e53-7ae0-b080-8977738528ba/pr7h-corrected-discovery-complete-640.png), [complete 960](/Users/wuzhao/.codex/visualizations/2026/08/11/019fefef-0e53-7ae0-b080-8977738528ba/pr7h-corrected-discovery-complete-960.png)
- [partial 640](/Users/wuzhao/.codex/visualizations/2026/08/11/019fefef-0e53-7ae0-b080-8977738528ba/pr7h-corrected-discovery-partial-640.png), [partial 960](/Users/wuzhao/.codex/visualizations/2026/08/11/019fefef-0e53-7ae0-b080-8977738528ba/pr7h-corrected-discovery-partial-960.png)
- [unsupported 640](/Users/wuzhao/.codex/visualizations/2026/08/11/019fefef-0e53-7ae0-b080-8977738528ba/pr7h-corrected-discovery-unsupported-640.png), [unsupported 960](/Users/wuzhao/.codex/visualizations/2026/08/11/019fefef-0e53-7ae0-b080-8977738528ba/pr7h-corrected-discovery-unsupported-960.png)
- [unavailable 640](/Users/wuzhao/.codex/visualizations/2026/08/11/019fefef-0e53-7ae0-b080-8977738528ba/pr7h-corrected-discovery-unavailable-640.png), [unavailable 960](/Users/wuzhao/.codex/visualizations/2026/08/11/019fefef-0e53-7ae0-b080-8977738528ba/pr7h-corrected-discovery-unavailable-960.png)
- [empty 640](/Users/wuzhao/.codex/visualizations/2026/08/11/019fefef-0e53-7ae0-b080-8977738528ba/pr7h-corrected-discovery-empty-640.png), [empty 960](/Users/wuzhao/.codex/visualizations/2026/08/11/019fefef-0e53-7ae0-b080-8977738528ba/pr7h-corrected-discovery-empty-960.png)
- [long CJK 640](/Users/wuzhao/.codex/visualizations/2026/08/11/019fefef-0e53-7ae0-b080-8977738528ba/pr7h-corrected-discovery-long-cjk-640.png), [long CJK 960](/Users/wuzhao/.codex/visualizations/2026/08/11/019fefef-0e53-7ae0-b080-8977738528ba/pr7h-corrected-discovery-long-cjk-960.png)
- [max input 640](/Users/wuzhao/.codex/visualizations/2026/08/11/019fefef-0e53-7ae0-b080-8977738528ba/pr7h-corrected-discovery-max-input-640.png), [max input 960](/Users/wuzhao/.codex/visualizations/2026/08/11/019fefef-0e53-7ae0-b080-8977738528ba/pr7h-corrected-discovery-max-input-960.png)

Inspection confirmed readable hierarchy and density, CJK wrapping, missing-image
fallback, explicit unknown values, visible partial/budget state, humanized plan
labels, disclosed max-input omissions, and legible
plan/evidence/coverage/limitation sections at both widths.

## Review budget and gate

- Review tier: `TIER_2`, selected by the explicit self-evolution profile.
- PR-7H milestone Sol budget: `2 authorized / 2 consumed`; Sol #2 is running.
- Outer Goal Sol budget: `4 authorized / 4 consumed`; no launch remains after
  this review.
- Generic subagent budget: `0 authorized / 0 consumed`.
- Reviewer: sequential `sol_milestone_reviewer`, `high` reasoning.
- Sol #1 agent `019ff073-7b21-79b3-ae85-6e10676edb96` (`Russell`) returned
  `CORRECTIVE_REQUIRED`; the complete record is
  `docs/product/reviews/PR-7H/sol-1-corrective.md`.
- Two earlier bounded waits returned `timed_out` while the reviewer was still
  running; those were correctly treated as
  `WAIT_TIMEOUT_REVIEWER_STILL_RUNNING` and consumed no additional launch.
- Luna corrected the findings in Candidate
  `3f46a97010fff829ab6cfec132bae07359b34e2c`; exact run `31486111752` passed,
  and final PR-7H Sol #2 agent `019ff090-bf00-7b00-865f-0e65ef3fe018`
  (`Tesla`) is now running. Sol #3 is prohibited; after the terminal verdict,
  persist the outer `PAUSED_BY_OUTER_REVIEW_BUDGET` checkpoint.
- Three bounded waits returned `timed_out` while Tesla remained active; this is
  `WAIT_TIMEOUT_REVIEWER_STILL_RUNNING`, not a reviewer failure or refunded
  launch. Continue waiting on the same agent.
- No P0/P1 blockers are known from Luna preflight. The independent reviewer
  must inspect the actual Base..Candidate diff and evidence before Freeze.
