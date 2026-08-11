# PR-7G Recovery — Review Readiness

Status: `READY_FOR_SOL_1`

This packet authorizes the first sequential comprehensive TIER_2 review of
the fresh PR-7G Recovery Epoch. It is evidence for the exact implementation
Candidate, not a substitute for the independent reviewer’s inspection.

## Candidate and integration identity

- Recovery Base: `5e7d4ace51a1aa1657a36d78f2c1a54915a4e05e`
- Implementation Candidate: `c9de0a46a1445650c6b2699f7c0cd35adf5daef5`
- Feature branch: `codex/recovery-pr-7g-series-watch-order`
- Pull request: `#5 — https://github.com/PariyaProject/BangumiAgentKit/pull/5`
- Target base: `master`
- Integration policy: `AUTO_MERGE_AFTER_FREEZE`
- Merge strategy: `MERGE_COMMIT`

The reviewer must inspect `Base..Candidate` and treat the Candidate SHA above
as the implementation freeze subject. Review/freeze metadata written after
this checkpoint is governance-only and may receive a separate Governance
Record SHA under the two-SHA freeze model.

## Exact-SHA CI

GitHub Actions run `31505310143`
([run](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31505310143))
passed on the exact Candidate SHA. All six required jobs passed:

- `sqlite-default`
- `host-integration`
- `standalone-release-smoke`
- `postgres-compat`
- `provider-foundation`
- `discovery-foundation`

## Local validation

The following checks passed before this packet was persisted:

- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` — 35 files / 201 tests
- `pnpm test:contract` — 22 tests
- `pnpm test:semantic` — 32 tests
- `pnpm test:provider` — 33 tests
- `pnpm test:discovery` — 51 tests
- `pnpm test:standalone` — 19 tests
- `pnpm test:integration:sqlite` — 33 tests
- `pnpm test:render` — 7 files / 54 tests
- `pnpm openapi:verify`
- `git diff --check`

## Agent, user-journey, and renderer QA

- Both new tools are present in the generated 49-tool catalog and return
  schema-valid descriptions.
- Standalone semantic/render `watch-order` routes execute successfully. A
  read-only official API query produced bounded watch steps, raw relation
  labels, directed evidence, non-anime related evidence, exclusions, source
  status, coverage, and a truthful partial/depth state.
- Representative complete, partial, and not-computable fixtures were rendered
  at 640px and 960px. Inspection covered long CJK text, missing covers,
  relation evidence, exclusions, truncation messaging, and unavailable state.
  The layouts were readable in both widths, with the 640px view remaining a
  single-column mobile/chat presentation.
- The user journey is intentionally read-only and bounded: a user or Agent
  can ask for a watch order and receive the recommendation together with raw
  evidence, limits, exclusions, and non-canonical-order caveats.

## Review budget and focus

- Review tier: `TIER_2`
- Reviewer: `sol_milestone_reviewer`
- Launch ordinal: `Sol #1 of 2`
- Sol launches consumed: `0 / 2`
- Generic subagents: `0 / 0`
- Sol #2 is reserved only for a corrected Candidate after a
  `CORRECTIVE_REQUIRED` result. Sol #3 is prohibited.

The review should specifically falsify the historical PR-7G concerns across
directed traversal semantics, conflict/reverse/mixed evidence, non-anime
budget isolation, failure/partial/not-computable truthfulness, public tool
contract and catalog, renderer boundary caps and visual density, zero-network
and source/security boundaries, and regression coverage on the current
post-PR-7H master.
