# PR-7H Review Readiness

Status: `SOL_1_RUNNING`

## Candidate and remote evidence

- Target base: `master`
- Recorded Base SHA: `23f960ce3a8a8ac3841b791061a648037a53ab19`
- Feature branch: `codex/pr-7h-discovery-renderer`
- Pull request: `#3 — https://github.com/PariyaProject/BangumiAgentKit/pull/3`
- Exact implementation Candidate SHA:
  `8dd069a0e700161d5a484af378b0ec9eb10e395c`
- Exact mandatory CI run:
  [31483703874](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31483703874)
- CI result: `PASS`; `provider-foundation`, `sqlite-default`,
  `host-integration`, `postgres-compat`, `standalone-release-smoke`, and
  `discovery-foundation` all completed successfully on the exact Candidate.
- Candidate worktree state: clean after the implementation commit and before
  this governance-only readiness record.
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
at 12 and image URLs continue through the existing SSRF-constrained resolver.

## Local validation

All commands below passed against the Candidate before readiness:

- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` — 33 files, 183 tests
- `pnpm test:contract` — 22 tests
- `pnpm test:semantic` — 31 tests
- `pnpm test:provider` — 33 tests
- `pnpm test:discovery` — 50 tests
- `pnpm test:standalone` — 18 tests
- `pnpm test:integration:sqlite` — 33 tests
- `pnpm test:render` — 46 tests
- `pnpm openapi:verify`
- focused PR-7H tests — 3 files, 7 tests

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

Focused renderer tests cover complete/partial fixture mapping, unsupported and
unavailable states, long CJK text, missing images and numeric fields, bounded
item display, XSS-safe query text, and PNG output at 640px and 960px.

Representative inspected artifacts:

- [PR-7H mobile discovery card](/Users/wuzhao/.codex/visualizations/2026/08/11/019fefef-0e53-7ae0-b080-8977738528ba/pr7h-discovery-results-640.png)
- [PR-7H desktop discovery card](/Users/wuzhao/.codex/visualizations/2026/08/11/019fefef-0e53-7ae0-b080-8977738528ba/pr7h-discovery-results-960.png)

Inspection confirmed readable hierarchy and density, CJK wrapping, missing-image
fallback, explicit unknown values, visible partial/budget state, and legible
plan/evidence/coverage/limitation sections at both widths.

## Review budget and gate

- Review tier: `TIER_2`, selected by the explicit self-evolution profile.
- PR-7H milestone Sol budget: `2 authorized / 1 consumed`.
- Outer Goal Sol budget: `4 authorized / 3 consumed`; `1 remaining`.
- Generic subagent budget: `0 authorized / 0 consumed`.
- Reviewer: sequential `sol_milestone_reviewer`, `high` reasoning.
- Sol #1 is running as agent `019ff073-7b21-79b3-ae85-6e10676edb96`
  (`Russell`). If corrective findings arrive, Luna may create one corrected
  Candidate and use the final PR-7H Sol #2 launch. Sol #3 is prohibited.
- No P0/P1 blockers are known from Luna preflight. The independent reviewer
  must inspect the actual Base..Candidate diff and evidence before Freeze.
