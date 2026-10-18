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

| State    | Width | PNG dimensions | SHA-256                                                          | Individual visual finding                                                                                                                                                                       |
| -------- | ----: | -------------: | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete |   320 |       320×1512 | 9538d7c249adacb2202d9ccafd71857d21a9b11dee41ebef610670e179343ff4 | Opened individually after localization. The Chinese experimental-source warning wraps cleanly at 320px; title, sample values, metrics, limits, method version, and footer fit without clipping. |
| Complete |   360 |       360×1453 | 8a0f3f6b33eee12a6aa5a5a35879bce6aaa62ed4774488cf7373793b2fa49ed6 | Opened individually after localization. The Chinese warning is readable in the narrow card; mixed-script title, sample metadata, metrics, and footer remain inside the card.                    |
| Complete |   520 |       520×1243 | 91111099344b9c01b59ade15e10f5c427b3efd2cdc9955eec32c551398c1b0de | Opened individually after localization. The Chinese warning is legible between metrics and limitations; the long fixture title and footer fit without horizontal overflow.                      |
| Complete |   640 |       640×1198 | b3a3fd39d982d99da1b6f694d0246a4fc48a7a49d55ee16eff20c212010cde93 | Opened individually after localization. The Chinese warning and limitations remain distinct; all metric cards, methodology version, and footer fit without clipping.                            |
| Complete |   960 |        960×953 | 89327e84416a3db38f0b1197f29328ed0a2be32fc2d51146f751c33e100bf903 | Opened individually after localization. The Chinese warning is clear at full width; metric columns, methodology version, and footer remain aligned with no overflow.                            |
| Partial  |   320 |       320×1339 | 6cec3f2fe55541c2b87cc8ebcd053940d5be5d5fa7c43bf64b0d857801e973ad | Opened individually after regeneration. The red text clearly distinguishes one returned search row from unavailable details and says no subject row is shown; no clipping.                      |
| Partial  |   360 |       360×1288 | 725898ce2e07dc89be232357938c970f848f33961a319f02d955767a99d0dc0e | Opened individually after regeneration. The returned-row/no-detail caveat wraps cleanly and stays distinct from the empty-search case and metric states.                                        |
| Partial  |   520 |       520×1142 | be3b714ee59aab9eb6be98d3f281d874308ff09f51172daf00e1bef81630a929 | Opened individually after regeneration. The returned-row/no-detail caveat, missing metrics, warning, limitations, method version, and footer do not collide.                                    |
| Partial  |   640 |       640×1105 | 852341d21bedb4447233de64f1e8515b6d14be5876ec1253f67d06d669eab118 | Opened individually after regeneration. The unavailable-detail caveat remains separate from every missing metric; limitations and footer fit without clipping.                                  |
| Partial  |   960 |        960×890 | f5ea7a574e4b237fc880a986c627614aea7521968f4870b5a2b0f141cd57f1c3 | Opened individually after regeneration. Partial-state labels align in columns; unavailable-detail caveat, method version, and footer remain readable without overflow.                          |

Across all ten images, the hierarchy is title → cohort → sample-display status or returned row → aggregate metrics → data limits → calculation method and source/footer. The complete case is built from the exact registered v3 query through the same closed local search/detail fixture as the profile; the long mixed-script title and the returned score, rating count, collection total, reported episodes, and rating-distribution standard deviation match that result. The partial case says one synthetic search result was returned, detail was unavailable, and no subject row is displayed; missing values are not zero and missing details do not imply that no match exists. All five complete screenshots now show the localized Chinese experimental-source warning; at 320px it wraps onto two readable lines. The partial fixture warning remains intact. No clipping or horizontal overflow was observed. The 320-pixel layouts are denser, but primary status and partial wording remain readable. Secondary source and coverage labels use the compact caption size.

The plain-text `C07_SYNTHETIC_COHORT_RENDERED` acknowledgement confirms that the
exact registered complete render call succeeded. It does not describe the
separate partial visual fixture; that fixture carries its own visible state and
coverage caveat. This C07 offline renderer review does not provide OAuth
callback, account-message, `auth_status`, QQ/TIM, or C07 user-scenario evidence.
Those account-auth message and rendering checks remain a separate UX-001 scope.

Visual output path:
`.artifacts/render/c07-cohort-comparison-v3-visual-qa-candidate-bound-20261019-round2/`.
The reviewed bundle SHA-256 is `197bc34e49580b7d57a3a473c211043f027cb72881849d553ef386592287d746`; the
generation source SHA-256 is `bce99de566d476e73a1b43952be739ce4595633fd3897be1ab1a91a47e6fac49`.
The committed receipt SHA-256 is `ce15f94b457a62a795a2ff26748e721be4e1ee9bd36bece1671f8d8246240c42`.

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
