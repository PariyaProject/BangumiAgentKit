# Run #95 C07 v3 offline renderer matrix contract

## Purpose and profile separation

This selected Epoch targets only the missing Agent/MCP matrix cell for
`bangumi.render_subject_cohort_comparison`. It does not establish the C07 user
scenario, compare-subject-tool coverage, a recommendation, public API evidence,
or complete cohort coverage.

The registered profile is
`c07-render-comparison-offline-agent-mcp-matrix-v3`, Epoch
`run95-c07-render-comparison-offline-agent-mcp-matrix-v3-20261018`, and uses
one synthetic cohort E query with synthetic subject ID `991226`. The profile
ID, argument profile, keyword, report path, and network mode are distinct from
both consumed v1 and v2 claims. Those claims remain terminal and are never
replayed.

## Closed execution boundary

The sole allowed tool call is one
`bangumi.render_subject_cohort_comparison` invocation with the exact registered
arguments. Its fixture permits exactly one anonymous search POST and one
subject detail GET, both answered locally. Authorization, duplicate calls,
other origins, methods, paths or queries, renderer asset requests, and external
fallback are rejected. The result artifact is copied only to an ignored local
directory for visual inspection and is never stored in the signed report.

The signed report can credit only this tool's Agent/MCP matrix cell. C07 remains
`UNASSESSED`.

## Codex error classification

The shared `summarizeCodexErrorItems` classifier retains only bounded counts. It
accepts exactly two complete status messages: `The web search tool is disabled.`
and `The web search tool is unavailable.` A near match, unrelated backend or
request failure, or any unclassified error is unexpected. Up to three error
items may coexist with the required successful single MCP call, only when every
item is one of those exact messages. A count mismatch, any unexpected error,
more than three errors, an incomplete event stream, a failed turn, any non-MCP
or shell call, an MCP error, or a failed server summary terminalizes the
one-shot as INCONCLUSIVE. Raw messages, event JSONL, prompts, answers, tool
arguments, fixture rows, credentials, and image bytes are never persisted.

## Visual acceptance

Before one-shot eligibility, render the exact v3 synthetic ViewModel after the
renderer build at 320, 360, 520, 640, and 960 CSS pixels with DPR 1. Open every
PNG individually and record its dimensions, SHA-256, wrapping, clipping,
hierarchy, state wording, and coverage. The complete and partial fixtures are
separate static visual cases; the one-shot profile input itself is the exact
complete synthetic fixture.

The committed [visual-QA receipt](run95-c07-render-comparison-offline-agent-mcp-matrix-v3-visual-qa-2026-10-18.json)
contains the explicit PASS acknowledgement, all ten image hashes/dimensions,
and a finding for each image. The generated PNGs stay in the ignored local
artifact directory and are not committed.

| State    | Width | PNG dimensions | SHA-256                                                            | Individual visual finding                                                                                                                                                                                               |
| -------- | ----: | -------------: | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete |   320 |       320×1225 | `604763667f01f01876786cd05ce3c0ebe150ba90b0217a87fd95d7eaa26601b0` | Single-column layout. The mixed Japanese, Chinese, and Latin title wraps without clipping; sample, four metrics, limits, and footer stay separated. Secondary captions are compact but readable.                        |
| Complete |   360 |       360×1196 | `a4953dd346d5d89eb5b2a8ff26a7b2c3f0faa94c2dcbcd340f6dc0f1b03354e6` | The title and sample metadata wrap cleanly; the subject row and four metric cards remain distinct with no collision.                                                                                                    |
| Complete |   520 |       520×1045 | `0b746deb23edeb2e11a98997056037206406a693f07e3114a1db292e534c074c` | The sample panel and four metric rows have clear separation; source labels and footer stay inside the card with no horizontal overflow.                                                                                 |
| Complete |   640 |       640×1031 | `c59c085e6b8a13fa77dee51cc302fbbb5eee66bf7a50c69ebc7d12eb20bfda53` | The single cohort uses the full card width; metrics remain stacked and no unused comparison column or clipping appears.                                                                                                 |
| Complete |   960 |        960×816 | `f952c5d90011c7d8a8e22947d44b36786887ac6a40890a8c5da68c627568a82f` | Metric values and complete-state labels align in separate columns; the wide layout has no overflow and the footer remains aligned.                                                                                      |
| Partial  |   320 |       320×1308 | `25620340221ec4c597c56076798ceeaf83936338989d7b4eb1d8c215485ef20a` | The new sample-display explanation says a search result was returned but details are unavailable and no subject row is shown. Unknown values and partial states remain visible; the dense footer fits without clipping. |
| Partial  |   360 |       360×1257 | `aa753578afa35b381d94d0093a7d984edde495569fb42e8beb0c96f9c1a6195b` | The no-row explanation wraps cleanly and distinguishes missing details from no match; all four unknown metric states remain visible.                                                                                    |
| Partial  |   520 |       520×1111 | `57c8030beedc6efde1762fdd027adab4c12996bd90b86b47f7453a839de1efe7` | The search/detail caveat, metric rows, missing-data explanation, limits, and source footer do not collide.                                                                                                              |
| Partial  |   640 |       640×1074 | `690e79e43e319b9c1ea1e05d6372798b9a4f4d0a424c8546adc4f4a14d45730c` | The single cohort uses the full card width; the partial state and unavailable-detail explanation remain distinct from all four metrics.                                                                                 |
| Partial  |   960 |        960×859 | `5f3d7836d11e26598deddd9637449afa51b23a2de71869a6696a83acd8b3ef89` | Unknown values and partial-state labels align in separate columns; the unavailable-detail caveat remains readable with no overflow.                                                                                     |

Across all ten images, the hierarchy is title → cohort → sample-display status
or returned row → aggregate metrics → data limits → source/footer. The partial
case says one synthetic search result was returned, detail was unavailable, and
no subject row is displayed; missing values are not zero and missing details do
not imply that no match exists. No clipping or horizontal overflow was observed.
The 320-pixel layouts are denser, but primary status and partial wording remain
readable. Secondary source and coverage labels use the compact caption size.

The plain-text `C07_SYNTHETIC_COHORT_RENDERED` acknowledgement confirms that the
exact registered complete render call succeeded. It does not describe the
separate partial visual fixture; that fixture carries its own visible state and
coverage caveat. This C07 offline renderer review does not provide OAuth
callback, account-message, `auth_status`, QQ/TIM, or C07 user-scenario evidence.
Those account-auth message and rendering checks remain a separate UX-001 scope.

Visual output path:
`.artifacts/render/c07-cohort-comparison-v3-visual-qa-candidate-bound-20261018/`.
The reviewed bundle SHA-256 is `41797e00c7bafdaa6a057c8030eaaccccd32fe3d3d71982033f227e9a715501c`; the
generation source SHA-256 is `cd55dad85793af20621850d72fcab9bec9ded2df867da6135a7efa3800d38ae2`.
The committed receipt SHA-256 is `7864091557b976b22ce252fbb3536b1d3593da1b0a26b7b16e0d962761d77287`.

## One-shot gates and terminal rule

Require a clean exact Candidate, synchronized Base, seven successful exact-SHA
CI checks, Harness Candidate readiness, same-identity GPT-6 Luna Max PASS, and
a fresh v3 profile status of UNCLAIMED/eligible. Immediately before creating the
permanent Harness claim, the runner verifies the pinned visual-QA receipt,
explicit PASS acknowledgement, all ten expected image records, and the SHA-256,
byte length, PNG dimensions, and local paths of each ignored PNG. It also binds
the receipt to the exact built MCP bundle and to the renderer source, generator,
synthetic fixture, lockfile, and build configuration hashes. Missing,
unreviewed, stale, or mismatched visual evidence aborts before the claim. Then
invoke once. Any INCONCLUSIVE result is permanently terminal and earns no
matrix credit; never retry it or alter the v1/v2 claims.

OAuth/account, community, private writes, QQ, and TIM are outside this synthetic
profile and remain passive.
