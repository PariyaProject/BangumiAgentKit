# Run #95 C07 v4 two-cohort renderer profile assessment

Date: 2026-10-23 (UTC)

## Decision state

This is source and terminal-history research for a possible fresh profile. It does not start an Epoch, create a claim, invoke MCP, call Bangumi, or earn acceptance credit. C07 remains `UNASSESSED`.

Current synchronized source is BangumiAgentKit master `0e2db352dc7823d9f0b07b06ebd77eda89859f40`. Run #95 is `ACTIVE`, has no active Epoch, and has `next_action=DISCOVER_NEXT_EPOCH`. The Agent/MCP matrix remains 86/96; public API is 65/65; QQ/TIM remains 0/96.

## Existing C07 one-shot history

Live Harness status calls on 2026-10-23 show all three registered matrix profiles are spent and non-retryable. Each exact input contains one cohort definition (`cohorts.length=1`):

| Profile                                             |   PR | Harness state                                                                                   | Calls | Report | Retry     | Exact input distinction                        |
| --------------------------------------------------- | ---: | ----------------------------------------------------------------------------------------------- | ----: | ------ | --------- | ---------------------------------------------- |
| `c07-render-comparison-offline-agent-mcp-matrix-v1` | #140 | `AMBIGUOUS_TERMINAL_LATCH`; terminal label says `INCONCLUSIVE no-report`; disposition is absent |     1 | no     | forbidden | synthetic cohort C, one query, `maxSubjects=1` |
| `c07-render-comparison-offline-agent-mcp-matrix-v2` | #225 | `INCONCLUSIVE`                                                                                  |     1 | no     | forbidden | synthetic cohort D, one query, `maxSubjects=1` |
| `c07-render-comparison-offline-agent-mcp-matrix-v3` | #229 | `INCONCLUSIVE`                                                                                  |     1 | no     | forbidden | synthetic cohort E, one query, `maxSubjects=1` |

For v2/v3, Harness exposes no diagnostic cause. Do not infer one or replay any claim. PR #140/#225/#229 are merged; their green CI and reviews do not change the terminal no-report result.

## Source coverage not exercised by those profiles

- `compareSubjectCohorts()` accepts one or two definitions and processes every definition independently before building cohort and metric results, in [`packages/discovery/src/cohort.ts`](../../packages/discovery/src/cohort.ts#L905).
- With exactly two cohorts, complete metric rows can include an input-order `B − A` delta; this branch is guarded by `cohorts.length === 2` and complete metric state in the same function.
- `buildSubjectCohortComparisonViewModel()` preserves the result's cohort array and per-cohort omitted counts in [`packages/renderer/src/view-model-builders/index.ts`](../../packages/renderer/src/view-model-builders/index.ts#L1056).
- The v3 visual generator explicitly asserts `viewModel.cohorts.length === 1` and its closed fixture allows one search plus one detail response in [`scripts/acceptance/generate-c07-render-comparison-offline-v3-visuals.ts`](../../scripts/acceptance/generate-c07-render-comparison-offline-v3-visuals.ts#L42). Its partial visual case also starts from that single-cohort model.

Thus a two-cohort profile would cover a materially different product execution branch: two bounded searches, two bounded details, two cohort sections, overlap handling, and complete/partial per-metric deltas. It is not a renamed copy of v1/v2/v3.

## Candidate v4 contract — pending full Epoch specification

A viable v4 would use a new immutable profile ID, argument profile, network mode, claim label, epoch ID, visual-QA receipt, and report path. Proposed fixed arguments:

```json
{
  "cohorts": [
    {
      "label": "合成样本 F",
      "query": {
        "keyword": "run95 c07 synthetic cohort f offline matrix 20261023",
        "media": "anime",
        "resultMode": "all",
        "limit": 1
      }
    },
    {
      "label": "合成样本 G",
      "query": {
        "keyword": "run95 c07 synthetic cohort g offline matrix 20261023",
        "media": "anime",
        "resultMode": "all",
        "limit": 1
      }
    }
  ],
  "maxSubjects": 1
}
```

Use new synthetic subject IDs `992401` and `992402`, with deterministic bounded local fixtures. The fixture may answer exactly four anonymous requests: one exact search POST and one exact subject-detail GET per cohort. Reject authorization, all other origins/paths/methods/queries, duplicate requests, writes, asset URLs, and external fallback. No request may reach Bangumi.

The one allowed Agent/MCP call would be `bangumi.render_subject_cohort_comparison` with the exact registered arguments. A validated report can credit only that Agent/MCP matrix row. It cannot establish the C07 user scenario, credit `bangumi.compare_subject_cohorts`, claim public API evidence, or imply QQ/TIM output.

Before any one-shot claim, the Epoch must add v4-specific offline tests and visual evidence for complete and partial two-cohort states across all three design packs and both palettes, using the configured typography path. Record 320/360/520/640/960-width image receipts and inspect the relevant contact sheets and full-size narrow samples. This remains comparison-layout QA; it does not close UX-002's separate image-bearing SubjectCard fidelity work against PariyaAgent v19.

## Readiness and limits

The distinct source branch makes v4 a candidate for the source-coverage reopen condition. It is not yet claim-ready. The terminal causes for v2 and v3 are unavailable in their durable dispositions, so the v4 runner must have locally verified success/failure classification, exact event completion, artifact readback, request bounds, and report validation before review. Any future claim requires a clean exact Candidate, synchronized current Base, all seven exact-SHA CI checks, Harness `candidate:check`, and same-identity GPT-6 Luna Max PASS. Once claimed, any terminal result is permanent and must never be retried.

No API, account/OAuth, community, write, QQ, or TIM action occurred during this assessment.

## Active Epoch implementation and visual QA — 2026-10-23

The selected Epoch is `run95-renderer-v19-c07-two-cohort-v4-20261023`, branch `codex/epoch-run95-renderer-v19-c07-two-cohort-v4-20261023`, Base `0e2db352dc7823d9f0b07b06ebd77eda89859f40`. It remains selected and awaits its first Candidate commit. The user rejected the earlier flattened renderer preview; the SubjectCard and title layout have been restored to the saved v19 baseline, with 12/12 original 320/360 PNG hashes matched exactly.

- The fixed v4 profile now uses the F/G synthetic cohort pair, IDs 992401/992402, with distinct keywords and values. Its fixture allows exactly two anonymous search POSTs and two detail GETs; duplicate, auth, body, URL, and external-asset paths remain denied. The rating histograms now agree with their synthetic means (6.4 and 8.1), avoiding an unintended data-conflict state.
- Added a production-path complete/partial visual generator and a strict validator. It rendered 60 PNGs: two states × three design packs × two palettes × widths 320/360/520/640/960 at DPR 1. The output directory is ignored: `.artifacts/render/c07-cohort-comparison-v4-visual-qa-candidate-bound-20261023/`; total PNG bytes 7,156,929. All 60 files were individually inspected; no clipped text or unintended overlap was found. The partial cohort's values remain explicitly unknown.
- Tracked manifest: `docs/research/run95-c07-render-comparison-offline-agent-mcp-matrix-v4-visual-qa-2026-10-23.json`, SHA-256 `db958a173e3bbeee74d65cf12e0d2de20080f8aec5391b157a8613249f84864e`. Generation-source SHA-256 `808aabf3a0e2f51df13a729dadf43123614119d4687d3a8ec8bbda4654d504ab`; the validator returned `true` against all 60 local PNG receipts and the current exact bundle.
- Two clean builds reproduced MCP bundle SHA-256 `ac3d5e33473df21961278bb6dd6f7db1bbfea07078626fa83e69995b5af7f42f`; `docs/product/g26-mcp-bundle-attestation.json` was refreshed to this digest. Latest `pnpm build` passed and the 44 focused Node harness tests passed.
- No product commit, PR, GitHub CI, review, Harness claim, Bangumi request, OAuth/account/community/write action, QQ, or TIM action has occurred for this Epoch. C07 v4 remains UNCLAIMED; v1/v2/v3 remain terminal and non-retryable. The visual matrix only supports the later profile gate and does not establish UX-002 acceptance or C07 scenario credit.

## Next

Review the exact dirty diff and all epoch-scope documents, finish any source/report issues, then make the first meaningful Candidate commit. Require exact seven-check CI, Harness `candidate:check`, matching bundle and same-identity GPT-6 Luna Max review PASS before the single v4 claim.

## Current-bundle visual receipt refresh — 2026-10-23

After the Graphic Zine caption refinement changed the renderer bundle, the C07 v4 visual receipt was regenerated against the exact current bundle. The renderer source digest changed, but the C07 comparison output did not change.

- `computeMcpBundleSha256(process.cwd())` returned `d0b81eaf0f9f01fc3c088b563c095f1d0f79714db31827a915c234a136854be2` twice; `docs/product/g26-mcp-bundle-attestation.json` matches it.
- New generation-source SHA-256: `96b61c4f1d05152fa0369537d0b9ed66bb6833a1ae530ec8fa0b8be457926744`.
- All 60 PNG SHA-256 values match the prior individually inspected matrix byte-for-byte; no image review needed to be repeated. The new manifest is [`run95-c07-render-comparison-offline-agent-mcp-matrix-v4-visual-qa-2026-10-23.json`](run95-c07-render-comparison-offline-agent-mcp-matrix-v4-visual-qa-2026-10-23.json), SHA-256 `b53ec986d7cd4c396dd7a17ebd99a7093f27b845fb2399a02ff19899fda8f727`.
- The runner now binds that exact manifest SHA. `validateC07V4VisualQaEvidence()` returned `true` against the current bundle and all 60 local PNG receipts.
- Added a v4 negative fixture regression for extra search-body fields and unregistered subject IDs; the seven focused C07/Harness test files now pass 45/45.
- C07 v4 remains UNCLAIMED; v1/v2/v3 remain terminal/no-retry. No matrix credit, API call, account action, or QQ/TIM action occurred.

## Narrow comparison layout correction and current visual receipt — 2026-10-23T14:47Z

The first 320px comparison output repeated every subject metric inside each cohort panel, then repeated the same values in four vertically stacked aggregate cards. The narrow presentation was dense and the A/B/delta values were hard to scan. The renderer now switches at 640px and below to a three-column A / B / B−A metric layout, omits repeated subject-level numbers while retaining sample titles, coverage states, sample counts, and aggregate values, and applies each design pack's panel mask to the metric cards. The wider 720px diagnostic view retains per-subject conflict details.

- Exact source validation: `pnpm build` PASS; `pnpm exec vitest run tests/render/subject-cohort-comparison.test.ts` PASS (10/10); `git diff --check` PASS.
- Regenerated all 60 images at `.artifacts/render/c07-cohort-comparison-v4-visual-qa-candidate-bound-20261023-v2/` (two result states × three design packs × two palettes × five widths). Each image was opened and inspected individually. A/B/delta values remain visible, the partial cohort remains unknown rather than zero, and no clipped or overlapping content was found.
- Current MCP bundle attestation: `8fb10dbfd60a7645e86185647476f67198a460160e8f903c09604aebd2c726ac`. Generation-source SHA-256: `e37a2b66e56bc36adbb9f33866684684981acbd23d8d81f6249d386a49f7fe22`.
- Current tracked matrix is [`run95-c07-render-comparison-offline-agent-mcp-matrix-v4-visual-qa-2026-10-23.json`](run95-c07-render-comparison-offline-agent-mcp-matrix-v4-visual-qa-2026-10-23.json), SHA-256 `ce1ed4e7ad3e12c9993c9a719843db3d22c56fd80d35c5fe70f171d6b55cf225`; `validateC07V4VisualQaEvidence()` returned true against the exact bundle and 60 local PNG receipts.
- The earlier v1 visual directory and prior-bundle manifest are retained as historical evidence; the v2 matrix is the current C07 gate. C07 v4 remains UNCLAIMED, no acceptance credit is added, and no live API, OAuth/account, community, write, QQ, or TIM action occurred.

## Luna Max corrective review and second visual pass — 2026-10-23T15:30Z

The exact Candidate `faec3e1e6a4c3fc9cd9e07ba474c815ee88ea8a1` on Base `0e2db352dc7823d9f0b07b06ebd77eda89859f40` received `CORRECTIVE_REQUIRED` with four P1 findings. Harness recorded them on PR #271. No C07 v4 claim was made.

- The review found an Epoch/frontier mismatch (`OP-008` only while the v4 profile names C07), missing exact-CI/report validation, missing merge reconciliation/source reference, and stale partial-state deltas. A new guarded Harness `epoch:frontier-amend` command records a matrix-only C07 binding after corrective review without changing C07's `UNASSESSED` scenario status or consuming a claim.
- Added a renderer regression that first failed on the old partial renderer because no metric showed `不可计算` while stale deltas were present; the corrected renderer passes 11/11 focused tests. It now renders A/B in two columns at 320/360px and puts B−A on a separate full-width row. It only renders numeric deltas for complete metrics; the partial visual generator also clears them.
- C07 v4 is now listed in exact-CI evidence, sanitized report validation, and pre-merge reconciliation. Focused Harness regressions for v4 claim CI, report validator dispatch, terminal merge gating, report validation, and frontier amendment pass 5/5; the exact-CI registry suite passes 9/9.
- The new directory `.artifacts/render/c07-cohort-comparison-v4-visual-qa-candidate-bound-20261023-v3/` contains 60 images. All 42 changed images were opened and individually reviewed; the other 18 complete-state images are byte-identical to the prior inspected v2 matrix. The partial images show B as unknown and B−A as `不可计算`; no clipping or overlap appeared across all packs/palettes.
- Build bundle SHA-256 is `ae58ae99a26e407368ed4bb045d83bd1c57c5a346c32df1c0ff1f96d44a0c00a`; generation-source SHA-256 is `b142f0e7c63ceaec76b7bb893909a2c124e8d1178df3a8f2fb8662f3b888a00a`; tracked v3 manifest SHA-256 is `e33b93e610cc05827c788511fd0cc84448edc03b77b97e00b1f6161d2057a22b`. The strict 60-image validator returned `true`; `pnpm harness frontier:check` reports 122 records / 97 actionable.
- Image generation succeeds with `pnpm exec ts-node --transpile-only -P tsconfig.base.json scripts/acceptance/generate-c07-render-comparison-offline-v4-visuals.ts`. The default ts-node type-checking mode reports existing source/dist declaration mismatches in this script; transpile-only generation completed and produced all 60 PNGs.

The v3 visual receipt is local synthetic evidence only. C07 remains UNASSESSED and v4 UNCLAIMED; no Bangumi request, OAuth/account/community/write action, QQ, or TIM action occurred.

## Full local verification — 2026-10-23T15:40Z

- `pnpm lint`: PASS.
- `pnpm harness:test`: PASS, 885/885.
- `pnpm test:render`: PASS, 32 files / 168 passed / 2 skipped.
- `pnpm acceptance:check`: PASS, 311 tests; catalog/direct execute 96/96, public API 65/65, Agent/MCP 86/96, QQ/TIM 0/96.
- `pnpm harness frontier:check`: PASS, 122 records / 97 actionable.
- `pnpm harness guard:legacy-paths --base origin/master --product-epoch`: PASS.
- `git diff --check`: PASS.

These are local Candidate checks. The corrective source has not yet been committed or pushed, and no v4 profile claim has been attempted. Exact seven-check GitHub CI, Harness Candidate readiness, and same-identity review are still required.

## User-rejected visual direction and v4 design correction — 2026-10-23T16:23Z

The user correctly called out that this preview had regressed from the v19 visual baseline that had previously looked good. The 2026-10-23 v3 manifest's PASS documented individual image inspection for clipping, wrapping, and state correctness; it did not establish that the design matched the earlier reference or that the user accepted the result. Do not cite that manifest as aesthetic acceptance.

The v19 renderer uses pack-matched artwork, configured type profiles, compact metadata, and a chart-led statistics layout. C07's SubjectCohortSubject data type has no image/cover field, so this comparison must not invent or attach unrelated covers. The v12 proposal below records the initial reference adaptation and is superseded by the v13 responsive layout documented afterward:

- At 320/360px the A/B cohort summaries stack as full-width folio, gallery, or cut-paper panels, each showing one representative subject and explicit coverage. At 520/640/960px the cohorts sit side by side. The <=640 metadata uses two wrap-safe lines, avoiding orphan separators.
- At 320/360px each metric gives A and B distinct value columns and keeps B−A on its own line; at 520/640px it uses A/B/B−A columns; desktop uses a metric/A/B/delta grid. Warm Editorial uses soft folio metric panels, Clean Gallery uses a clipped open comparison grid, and Graphic Zine uses alternating cut-paper value panels with a separate delta sticker. The packs now differ in layout and typography as well as color.
- Metric icons use the existing semantic SVG registry. Display type is used for titles, cohort names, and numeric emphasis; the configured body stack carries labels and explanatory text. C07 has no cover field, so this comparison remains data-led and does not add unrelated artwork.
- Complete paired metrics use bars normalized within that metric's two observed means. Missing values remain `未知` with dashed tracks; a numeric B−A appears only for complete metrics. Duplicate provider warnings are collapsed with their occurrence count.

Final v12 images were individually opened across complete/partial, three packs, light/dark, and 320/360/520/640/960px. No clipping, overflow, or overlap was found. This is Codex's local synthetic visual QA, not user acceptance, production-client proof, or acceptance credit.

- Final ignored images: `.artifacts/render/c07-cohort-comparison-v4-visual-qa-candidate-bound-20261024-v12/`.
- Tracked 60-image receipt: [run95-c07-render-comparison-offline-agent-mcp-matrix-v4-visual-qa-2026-10-24.json](run95-c07-render-comparison-offline-agent-mcp-matrix-v4-visual-qa-2026-10-24.json), SHA-256 `d7f6688d49a4aba5136460eb1c702adeabc8c4baea5f2430fed0e4b8044b2836`.
- Exact bundle SHA-256: `5c83e17c9f002f3f727b0d6ce364f1dceebb1ded877e508e8a19009afa1f1187`; generation-source SHA-256: `6d4a03387e5fc1d4589d37a017633642331cf583b9b2421dcc205d8852a4e08c`. `validateC07V4VisualQaEvidence()` returned `true` against the tracked manifest, matching bundle attestation, and all 60 local PNG receipts.
- Current local checks: `pnpm build` PASS; `pnpm exec vitest run tests/render/subject-cohort-comparison.test.ts` PASS (13/13). Full lint, renderer suite, Harness suite, acceptance, frontier, legacy guard, Candidate, and exact CI remain pending after final evidence binding.
- Exact CI run 39980861949 for the preceding remote Candidate failed because `harness-control` still expected v3 frontier wording; `sqlite-default` also timed out after 5 seconds in `tests/render/render-pool-cache.test.ts`. The v4 guard markers are corrected; both require a fresh exact-SHA result before any claim.

C07 remains UNASSESSED; v4 remains unclaimed. No one-shot claim, Bangumi call, account/OAuth/community/write operation, QQ action, or TIM action occurred.

## Visual fidelity correction and final v16 receipt — 2026-10-24

The user again pointed out that the new render no longer felt like the earlier accepted v19 direction. This time the cause was not missing data: the comparison view had reused one repeated metric-card stack across all packs, used overly large narrow-screen support labels, and let the Graphic Zine font/layout squeeze metric titles. Passing no-overflow checks was not enough to establish visual fidelity.

- `SubjectCohortComparisonCard` now gives each pack a different metric composition: Warm Editorial has a featured score with quiet folio rows; Clean Gallery uses an open A/B/delta matrix; Graphic Zine uses a two-by-two die-cut metric collage with the delta tag on its own line. Zine values use the configured body number face instead of the brush display face. The aggregate heading no longer repeats a badge tile. Narrow metadata is sized with the renderer's 0.75 typography scale in mind.
- v14 exposed the squeezed Zine labels; v15 separated their delta tags. Individual image inspection then found that the final explanatory line in the partial Warm Editorial cohort card touched the lower mask at 320/360px. v16 adds a mask-safe bottom inset to cohort panels. All 24 changed 320/360px outputs were opened and reviewed individually; the other 36 520/640/960px outputs have the same PNG hashes as the already-inspected v15 matrix and were also individually reviewed.
- All 60 final v16 images were individually inspected across complete/partial × three packs × light/dark × 320/360/520/640/960px. Complete A/B values, bars, and deltas align; partial values remain `未知` with dashed tracks and no numeric `B−A`; all mask-contained copy is visible with no clipping, overlap, or horizontal overflow. The output reflects local synthetic fixtures only and is not user aesthetic acceptance or QQ/TIM client proof.
- Final ignored images: `.artifacts/render/c07-cohort-comparison-v4-visual-qa-candidate-bound-20261024-v16/`.
- Tracked receipt: [`run95-c07-render-comparison-offline-agent-mcp-matrix-v4-visual-qa-2026-10-24.json`](run95-c07-render-comparison-offline-agent-mcp-matrix-v4-visual-qa-2026-10-24.json), SHA-256 `fa6d8ce50f9befcf41659b7dbaaa2eac88eaf0be67526917e9d207b5d5f2e2b3`. Bundle SHA-256 `23e499e6489bcfbf0c06a5ffe1c48bc1219a4c1a299cf5fb3713cc0ca2c8e0f7`; generation-source SHA-256 `110ec70e7b68acccd69bec35426fa17b6bda6e4cb92f93b51972a75ae77543be`. The strict `validateC07V4VisualQaEvidence()` returned `true` against the exact bundle, source, manifest, and 60 PNG hashes.
- Local targeted verification after this change: `pnpm build`, `pnpm typecheck:tests`, and `pnpm exec vitest run tests/render/subject-cohort-comparison.test.ts` PASS (13/13). Full renderer/Harness/acceptance checks and a fresh exact-Candidate review are still required before the one-shot claim.

C07 remains UNASSESSED and v4 UNCLAIMED. No Bangumi request, OAuth/account/community/write operation, QQ action, or TIM action occurred.

## Gallery title fidelity follow-up and final v17 receipt — 2026-10-24

The v16 image review found one remaining reference mismatch in Clean Gallery: its title still used the generic blue side stripe. The shared `TitleBlock` now has a C07-scoped `cohort-gallery-open` treatment with the Gallery's thin horizontal rule; Warm Editorial and Graphic Zine retain their pack-specific title treatments.

- v17 regenerated the complete matrix against bundle SHA-256 `5db582654ad9574be2106761315e638856b1a73527a6684780203b6e2d2d9616` and source SHA-256 `8749dc9c19edbfef724ad3090e899a4bd443184ff367daeed8b8b1e3b069d281`.
- Exactly 20 pixels changed from v16, all Clean Gallery outputs across complete/partial, light/dark, and five widths. All 20 changed images were individually reviewed; the other 40 images are byte-identical to v16 and retain their individual review.
- Final ignored images: `.artifacts/render/c07-cohort-comparison-v4-visual-qa-candidate-bound-20261024-v17/`.
- The tracked manifest SHA-256 is `9863f6b165417f5efd7d7113ba8fbc1f63ee235a713c8f697c3aef89af1ace09`. `validateC07V4VisualQaEvidence()` returned `true` for the exact manifest, bundle attestation, generation source, and all 60 PNG hashes.
- The final v17 review remains synthetic local visual QA. It is not user aesthetic acceptance, production-font proof, QQ/TIM display acceptance, or C07 scenario credit.

C07 remains UNASSESSED and v4 UNCLAIMED; no one-shot call, Bangumi request, account/OAuth/community/write operation, QQ action, or TIM action occurred.

## Visual regression correction, v19 parity, and final v13 receipt — 2026-10-23T17:42Z

The v12 matrix had no clipping, but the user correctly rejected its visual quality. Review found the comparison still read like a tall spreadsheet. A first v13 attempt also regressed: two-column metrics squeezed labels at 320px and the flex container placed all four metric cards in one clipped row. Those attempts were discarded and their generated images removed. The final v13 layout keeps the sample identities paired at narrow widths, stacks the four metric cards below 520px, and uses a two-by-two metric board at 520px and wider. Metric labels and sources share a compact line, A/B values share a baseline, and B−A has a distinct row. Explanatory notes are grouped; pack-specific surfaces and masks remain intact. Mobile sample titles get up to three lines, missing-detail copy is shortened only for the two-cohort compact card, and clipped-panel padding keeps delta labels inside the mask.

- Opened all 60 final v13 PNGs individually: complete/partial × three design packs × light/dark × 320/360/520/640/960px. No clipping, overlap, or horizontal overflow appeared. Complete A/B bars and signed deltas align; partial B values remain `未知` with dashed tracks and `B−A` remains `不可计算`. Warm Editorial, Clean Gallery, and Graphic Zine retain different typography and surface treatments. This is local synthetic visual QA, not user acceptance or production-client proof.
- Final ignored images: `.artifacts/render/c07-cohort-comparison-v4-visual-qa-candidate-bound-20261024-v13/`.
- Tracked 60-image receipt: [run95-c07-render-comparison-offline-agent-mcp-matrix-v4-visual-qa-2026-10-24.json](run95-c07-render-comparison-offline-agent-mcp-matrix-v4-visual-qa-2026-10-24.json), SHA-256 `3efad1e8f22c1687e4a2f43eac66c9fa44e5086c6686a6ebd6ca051270dcea2a`. `validateC07V4VisualQaEvidence()` returned `true` for this exact manifest, bundle attestation, generation-source hash, and 60 PNG receipts.
- Re-rendered the already-approved v19 image-bearing baseline twice. All 48 output PNG SHA-256 values matched the v5 baseline exactly; both parity runs had zero renderer warnings. The shared `TitleBlock` change therefore leaves the prior v19 visuals byte-identical. Temporary parity outputs were removed after comparison; the approved v5 baseline remains.
- Two consecutive `pnpm build` runs produced the same G26 bundle digest, `40ac1bbd111327b04cdee5b7db007fdbffaf9900b25389b4d187d0c47298357e`. `docs/product/g26-mcp-bundle-attestation.json` records that digest. This is build provenance only and gives no C07 claim or matrix credit.
- Local verification passes: `pnpm build`; `pnpm lint`; `pnpm typecheck:tests`; the focused renderer suite (13/13); `pnpm test:render` (32 files / 170 passed / 2 skipped); `pnpm harness:test` (885/885); `pnpm harness frontier:check` (122 records / 97 actionable); and `pnpm harness guard:legacy-paths --base origin/master --product-epoch`. The HEAD-bound acceptance check, Candidate gate, and exact-SHA CI still need fresh verification before PR #271 can advance. The old failed CI run remains evidence only for its old SHA.

C07 remains UNASSESSED; v4 remains unclaimed. No one-shot claim, Bangumi call, account/OAuth/community/write operation, QQ action, or TIM action occurred.

## DPR2 visual correction and final v19 receipt — 2026-10-23T19:25Z

The user pointed out that the result had regressed from the previous accepted-looking renderer direction. Side-by-side inspection confirmed that the C07 320px preview had narrowed both cohort summaries into side-by-side columns and reduced metadata to roughly 9 CSS px after the 0.75 type scale. A no-overflow pass had incorrectly been treated as sufficient visual evidence. I also verified that the C07 MCP tool is created with `renderTarget: 'chat'`, whose default is 360 CSS px at DPR 2; the earlier v17 matrix used DPR 1 and therefore was not an exact raster-size preview of the chat target. The cohort ViewModel has no cover field, so no unrelated artwork was added.

- Cohort summary panels now stack below 520 CSS px and pair from 520px upward. Narrow group labels and support copy are larger, while the compact global typography default remains 0.75. Family-only body/display overrides no longer register bundled font bytes under the configured system family; the unaffected role keeps its default bundled face.
- The final matrix was regenerated at DPR 2 for complete/partial × three design packs × light/dark × 320/360/520/640/960 CSS px. All 60 exact-source PNGs were opened individually. The 360px cases match the C07 chat target's CSS width and DPR; the other widths exercise responsive layout. No clipping, overlap, or horizontal overflow appeared. Complete values retain their signed deltas; partial values stay `未知` with dashed tracks and `B−A` stays `不可计算`.
- Final ignored images: `.artifacts/render/c07-cohort-comparison-v4-visual-qa-candidate-bound-20261024-v19/`. Pixel widths are twice the CSS width; maximum image height is 2,608px and largest PNG is 460,008 bytes. The local matrix totals 19,126,929 bytes.
- Tracked receipt: [run95-c07-render-comparison-offline-agent-mcp-matrix-v4-visual-qa-2026-10-24.json](run95-c07-render-comparison-offline-agent-mcp-matrix-v4-visual-qa-2026-10-24.json), SHA-256 `8b3a966c3a916a88ef1ccae2c3539c02d01d92d658fcdd9274d9b103d947eee9`. Exact bundle SHA-256 `d79cfbde310f8f180baa14a3da461d3ceb321b969268fffd5b38b0584fe3daa3`; generation-source SHA-256 `ed4152fd5c1e100ae84087a54a17f1d93cc06d4505009c123ebce3c733c07147`. The strict validator and the new runner-pin regression must pass against these exact values before the profile can be considered.
- The matrix remains local synthetic visual QA, not user aesthetic acceptance, production-font proof, QQ/TIM display acceptance, or C07 scenario credit. C07 remains `UNASSESSED`; v4 remains unclaimed, and no API/account/OAuth/community/write/QQ/TIM action occurred.

## User visual-regression correction and v21 receipt — 2026-10-24

The user reported that the render had looked better before. A direct comparison confirmed a layout regression at the actual 360 CSS px chat width: v19 stacked two full-width cohort panels, adding vertical weight and making the card read like a long report; Clean Gallery also gave its primary average score no greater hierarchy than the supporting rows. The prior image-bearing v19 baseline's type scale, palette, title treatment, and pack identity remain the reference. C07 has no cover field, so this correction stays data-led instead of adding unrelated artwork.

- Cohorts are paired at 320/360 CSS px again. Clean Gallery uses one shared, clipped comparison panel with a center divider; its real average score is the lead visual, with the three supporting metrics in the open A/B/delta matrix. Warm Editorial keeps its featured folio score and quiet rows; Graphic Zine keeps its cut-paper metric collage. Existing configured fonts, colors, and semantic icons are preserved.
- The final DPR2 matrix covers complete/partial × three packs × light/dark × 320/360/520/640/960 CSS px. Thirty-six images differ from v19 and were opened and inspected individually at CSS-sized display; the remaining 24 are byte-identical to individually inspected v19 images. At 320/360 the paired panels stay readable; at 520+ the paired overview and wider metric matrix retain their intended proportions. Complete values and signed deltas align. Partial values remain `未知`, coverage remains dashed, and `B−A` remains `不可计算`. No clipping, overlap, or horizontal overflow appeared.
- Final ignored images: `.artifacts/render/c07-cohort-comparison-v4-visual-qa-candidate-bound-20261024-v21/`. Pixel widths are twice CSS width; maximum height is 2,362px, maximum PNG size is 460,008 bytes, and the matrix totals 19,009,873 bytes.
- The tracked 60-image receipt is [`run95-c07-render-comparison-offline-agent-mcp-matrix-v4-visual-qa-2026-10-24.json`](run95-c07-render-comparison-offline-agent-mcp-matrix-v4-visual-qa-2026-10-24.json), SHA-256 `1d2ee8f6f5db022694c1ceefc04398e298b0ab95a952f03a697a5fd88ab134a0`. Bundle SHA-256 is `d57f042e2540a6c895afe8a93361010f6fb06186c581227e9366e145250dc0f7`; generation-source SHA-256 is `4ca2092641ff66b414f4b27dfb16a64a5ef47863e36ec8e2566403e9a49fa258`. The strict visual evidence validator passes for this exact bundle, source, manifest, and all 60 PNG hashes.
- The screenshots remain synthetic local visual QA, not user aesthetic acceptance, production-font proof, QQ/TIM display acceptance, or C07 scenario credit. C07 remains `UNASSESSED`; v4 remains unclaimed pending the exact Candidate, CI, Harness, and review gates.

No Bangumi request, OAuth/account/community/write operation, QQ action, or TIM action occurred.
