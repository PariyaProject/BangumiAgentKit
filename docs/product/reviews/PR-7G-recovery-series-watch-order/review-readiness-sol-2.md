# PR-7G Recovery — Corrected Candidate Review Readiness

Status: `SUPERSEDED_BY_SOL_2_CORRECTIVE_REQUIRED`

This packet is the final reserved TIER_2 review gate after Sol #1 returned
`CORRECTIVE_REQUIRED`. Sol #2 must independently inspect the corrected
Candidate; it must not treat this packet as a substitute for repository
inspection.

## Candidate and integration identity

- Recovery Base: `5e7d4ace51a1aa1657a36d78f2c1a54915a4e05e`
- Sol #1 Candidate: `c9de0a46a1445650c6b2699f7c0cd35adf5daef5`
- Corrected Implementation Candidate:
  `1e0cbd97fcdd0859187534fda67ae797c33e5d0e`
- Feature branch: `codex/recovery-pr-7g-series-watch-order`
- Pull request: `#5 — https://github.com/PariyaProject/BangumiAgentKit/pull/5`
- Target base: `master`
- Integration policy: `AUTO_MERGE_AFTER_FREEZE`
- Merge strategy: `MERGE_COMMIT`

The corrected Candidate is the exact implementation SHA for Sol #2. The
review report, ledger, and this packet are governance-only commits after the
implementation Candidate under the two-SHA freeze policy.

## Sol #1 closure and correction map

Sol #1 was `CORRECTIVE_REQUIRED` with 0 P0, 3 P1, and 2 P2 findings. The
accepted corrections in the corrected Candidate are:

- traversal observation keys include path kinds, and pending traversal merges
  every safe duplicate direct seed so a valid homogeneous deeper sequel path
  cannot be overwritten by side-story evidence;
- the Series Relations card renders the same 24-related / 64-edge maximum
  evidence accepted by RenderService and adds a valid-maximum regression that
  proves all accepted assets and evidence remain visible;
- fixture generation now produces internally consistent complete, partial,
  and not-computable artifacts at both 640px and 960px, including partial
  omission messaging and long-CJK/missing-image coverage;
- the public `media` descriptions explain that `anime` filters `related`
  while observed non-anime rows may remain in edges/exclusion evidence;
- root relation failure coverage establishes the required structured failure
  behavior alongside the duplicate-seed regression.

The full Sol #1 report remains at
`docs/product/reviews/PR-7G-recovery-series-watch-order/sol-1-review.md`.

## Exact-SHA CI

GitHub Actions run `31508533985`
([run](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/31508533985))
reports `Success` for the corrected Candidate. The six required jobs are:

- `sqlite-default`
- `host-integration`
- `standalone-release-smoke`
- `postgres-compat`
- `provider-foundation`
- `discovery-foundation`

## Corrected local validation

- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` — 35 files / 204 tests
- focused corrective unit/renderer tests — 16 tests
- `pnpm test:contract` — 22 tests
- `pnpm test:semantic` — 32 tests
- `pnpm test:provider` — 33 tests
- `pnpm test:discovery` — 51 tests
- `pnpm test:integration:sqlite` — 33 tests
- `pnpm test:standalone` — 19 tests
- `pnpm test:render` — 7 files / 55 tests
- OpenAPI validation/generation completed and the intentional catalog diff
  contains only the corrected public media descriptions; the generated
  catalog is included in the corrected Candidate.
- `git diff --check` passed before Candidate creation.

## Agent, visual, and user-journey QA

- Both new tools remain discoverable in the generated 49-tool catalog and
  retain no-auth/read-only/schema-bounded behavior.
- Standalone semantic/render `watch-order` routes and the read-only official
  API journey remain operational; bounded steps, directed paths, exclusions,
  coverage, and partial state are preserved.
- The regenerated fixture set was inspected at both widths:
  `.artifacts/render/series-relations-complete-640.png`,
  `series-relations-complete-960.png`,
  `series-relations-partial-640.png`,
  `series-relations-partial-960.png`,
  `series-relations-not-computable-640.png`, and
  `series-relations-not-computable-960.png`.
- Complete fixtures show readable six-step output; partial fixtures show all
  16 accepted related evidence rows and explicit `relatedLimit=16` omission
  messaging; not-computable fixtures show zero steps while retaining evidence
  and the explicit non-anime explanation. Long CJK, missing-image placeholders,
  conflict/unknown/non-anime exclusions, and 640px single-column/960px dense
  layouts were readable.

## Review budget and focus

- Review tier: `TIER_2`
- Reviewer: `sol_milestone_reviewer`
- Launch ordinal: `Sol #2 of 2`
- Sol launches consumed: `1 / 2`
- Generic subagents: `0 / 0`
- Sol #3 is prohibited.

Sol #2 should verify the corrected duplicate-path traversal and evidence-key
semantics, renderer boundary/display/asset caps, fixture truthfulness, public
media wording, root-relation failure behavior, historical blocker closure,
and all current-master regressions. If Sol #2 passes, create the freeze record
for the exact corrected Candidate and proceed to the recorded integration
gate. If it does not pass, park the milestone at `PARKED_REVIEW_LIMIT`.
