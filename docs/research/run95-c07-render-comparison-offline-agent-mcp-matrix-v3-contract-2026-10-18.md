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

The signed report can credit only this tool's Agent/MCP matrix cell. C07 remains `UNASSESSED`.

## Codex error classification

Only the exact disabled/unavailable Web Search error category is eligible. The
shared `summarizeCodexErrorItems` classifier retains only bounded counts. It
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

| State    | Width | PNG dimensions | SHA-256                                                          | Individual visual finding                                                                                                                                                                                                             |
| -------- | ----: | -------------: | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete |   320 |       320×1527 | 086c39ce7ff92ef098c1d41c287d5d9ad5a8ba5911d409ee8c029f2274222e39 | Opened individually after the rebuilt bundle. The long Japanese, Chinese, and Latin title wraps cleanly; sample values, four metrics, limits, method version, and footer fit without clipping. Compact captions remain readable.      |
| Complete |   360 |       360×1468 | 7ff4352ac8d316744d00b29c4d2a2bff5c0289caaff10f1bfd5a01cdebd74506 | Opened individually after the rebuilt bundle. The profile-matched title and sample metadata wrap without collision; all four metric cards and the source/footer remain inside the card.                                               |
| Complete |   520 |       520×1243 | f0c66409fabf1ab4d02006258dbd1c374b6f32173a0cbf2184c837d4de5f4824 | Opened individually after the rebuilt bundle. Sample facts and metric rows are distinct; the upstream-search warning, limits, calculation version, and footer remain legible with no horizontal overflow.                             |
| Complete |   640 |       640×1198 | 7179bcfa3a263660361eb28e89e9046ddea2ed6b8fdb2ce1883a591f41c8ae3a | Opened individually after the rebuilt bundle. The single cohort uses the full card width and keeps metrics stacked; the long limitations and version/source labels fit without clipping.                                              |
| Complete |   960 |        960×953 | 9c16a95372c18e243b2bc4a90e70f1e4010b33a7999ebefbdd74f740b32702dc | Opened individually after the rebuilt bundle. Metric values and complete-state labels align in separate columns; the mixed-script title, method version, and footer remain clear with no overflow.                                    |
| Partial  |   320 |       320×1339 | 6cec3f2fe55541c2b87cc8ebcd053940d5be5d5fa7c43bf64b0d857801e973ad | Opened individually after the rebuilt bundle. The red status clearly says one search row was returned, details are unavailable, and no subject row is shown. Unknown values, limits, method version, and footer fit without clipping. |
| Partial  |   360 |       360×1288 | 725898ce2e07dc89be232357938c970f848f33961a319f02d955767a99d0dc0e | Opened individually after the rebuilt bundle. The unavailable-detail status wraps cleanly and distinguishes a returned result from an empty search; all four unknown metric states remain separated.                                  |
| Partial  |   520 |       520×1142 | be3b714ee59aab9eb6be98d3f281d874308ff09f51172daf00e1bef81630a929 | Opened individually after the rebuilt bundle. The returned-row/no-detail status, four missing metrics, warning, limits, method version, and source footer do not collide.                                                             |
| Partial  |   640 |       640×1105 | 852341d21bedb4447233de64f1e8515b6d14be5876ec1253f67d06d669eab118 | Opened individually after the rebuilt bundle. The full-width single cohort keeps the unavailable-detail status distinct from each missing metric; the limits and footer fit with no clipping.                                         |
| Partial  |   960 |        960×890 | f5ea7a574e4b237fc880a986c627614aea7521968f4870b5a2b0f141cd57f1c3 | Opened individually after the rebuilt bundle. Unknown values and partial-state labels align in separate columns; the unavailable-detail caveat, method version, and footer remain readable without overflow.                          |

Across all ten images, the hierarchy is title → cohort → sample-display status or returned row → aggregate metrics → data limits → calculation method and source/footer. The complete case is built from the exact registered v3 query through the same closed local search/detail fixture as the profile; the long mixed-script title and the returned score, rating count, collection total, reported episodes, and rating-distribution standard deviation match that result. The partial case says one synthetic search result was returned, detail was unavailable, and no subject row is displayed; missing values are not zero and missing details do not imply that no match exists. No clipping or horizontal overflow was observed. The 320-pixel layouts are denser, but primary status and partial wording remain readable. Secondary source and coverage labels use the compact caption size.

The plain-text `C07_SYNTHETIC_COHORT_RENDERED` acknowledgement confirms that the
exact registered complete render call succeeded. It does not describe the
separate partial visual fixture; that fixture carries its own visible state and
coverage caveat. This C07 offline renderer review does not provide OAuth
callback, account-message, `auth_status`, QQ/TIM, or C07 user-scenario evidence.
Those account-auth message and rendering checks remain a separate UX-001 scope.

Visual output path:
`.artifacts/render/c07-cohort-comparison-v3-visual-qa-candidate-bound-20261019-round2/`.
The reviewed bundle SHA-256 is `048398b47fb3315e23315cfc4b9cd827f5584ade907ac75857652b1ec66fd2e7`; the
generation source SHA-256 is `d5ecc7aeae633c3d377a5c19194995b85119fc2898780745ed503f3306933e3e`.
The committed receipt SHA-256 is `f97423c73f54a53904ad7de9cfc982d124fdd2d4f425718c37524e66017d1c6c`.

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
