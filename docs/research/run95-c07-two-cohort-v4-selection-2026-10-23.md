# Run #95 C07 v4 two-cohort renderer profile assessment

Date: 2026-10-23 (UTC)

## Decision state

This is source and terminal-history research for a possible fresh profile. It does not start an Epoch, create a claim, invoke MCP, call Bangumi, or earn acceptance credit. C07 remains `UNASSESSED`.

Current synchronized source is BangumiAgentKit master `0e2db352dc7823d9f0b07b06ebd77eda89859f40`. Run #95 is `ACTIVE`, has no active Epoch, and has `next_action=DISCOVER_NEXT_EPOCH`. The Agent/MCP matrix remains 86/96; public API is 65/65; QQ/TIM remains 0/96.

## Existing C07 one-shot history

Live Harness status calls on 2026-10-23 show all three registered matrix profiles are spent and non-retryable. Each exact input contains one cohort definition (`cohorts.length=1`):

| Profile | PR | Harness state | Calls | Report | Retry | Exact input distinction |
| --- | ---: | --- | ---: | --- | --- | --- |
| `c07-render-comparison-offline-agent-mcp-matrix-v1` | #140 | `AMBIGUOUS_TERMINAL_LATCH`; terminal label says `INCONCLUSIVE no-report`; disposition is absent | 1 | no | forbidden | synthetic cohort C, one query, `maxSubjects=1` |
| `c07-render-comparison-offline-agent-mcp-matrix-v2` | #225 | `INCONCLUSIVE` | 1 | no | forbidden | synthetic cohort D, one query, `maxSubjects=1` |
| `c07-render-comparison-offline-agent-mcp-matrix-v3` | #229 | `INCONCLUSIVE` | 1 | no | forbidden | synthetic cohort E, one query, `maxSubjects=1` |

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
