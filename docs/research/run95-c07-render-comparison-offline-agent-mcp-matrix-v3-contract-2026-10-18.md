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

The previous R04 v2 runner retained only a Codex error-item count. The v3
runner uses the shared `summarizeCodexErrorItems` classifier and retains only
bounded counts. Only the exact disabled/unavailable Web Search error category
is eligible: up to three such items may coexist with the required successful
single MCP call. A count mismatch, any unexpected or unclassified error, more
than three errors, an incomplete event stream, a failed turn, any non-MCP or
shell call, an MCP error, or a failed server summary terminates the one-shot as
INCONCLUSIVE. Raw messages, event JSONL, prompts, answers, arguments, fixture
rows, credentials, and image bytes are never persisted.

## Visual acceptance

Before one-shot eligibility, render the v3 synthetic ViewModel at 320, 360, 520,
640, and 960 CSS pixels at DPR 1. Open every PNG individually and record its
dimensions, SHA-256, wrapping, clipping, hierarchy, partial-state wording, and
agreement with the plain-text acknowledgement. The prior renderer build's ten
PNGs were retained under the `*-pre-renderer-rebuild-*` directory and excluded
from this review. The current ten were generated after the updated renderer
build and inspected individually.

| State    | Width | PNG dimensions | SHA-256                                                            | Individual visual finding                                                                                                                                      |
| -------- | ----: | -------------: | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete |   320 |       320×1225 | `38a2b77c42c4ccaeb5557dab7ce15e0ebe92e1ec1704d5aeb3245ef4538c4683` | One-column layout; mixed Japanese/Chinese/Latin title wraps without clipping; metrics and limitations remain separated. Body labels are compact at this width. |
| Complete |   360 |       360×1196 | `2b801cb168800caa81103a8613a4c11c9aac12a2f29b6da746120866c51959b0` | Same hierarchy; metadata wraps without colliding with the title or sample block.                                                                               |
| Complete |   520 |       520×1045 | `2081532104c4078197cb0ea3316f2920a8bb31131a98c8298f6be1e9544a6f8f` | Wider sample panel; aggregate metrics remain distinct rows with source labels.                                                                                 |
| Complete |   640 |       640×1031 | `940b296bb091f40207bfa0b17e2e9c17f1262b0a08a4c5f526c67bbfbf3aff1b` | No horizontal overflow; full-width single cohort avoids an unused second-column gap.                                                                           |
| Complete |   960 |        960×816 | `b682f76cc1fa95a8d0f811859104887138288bb6745eca3c5ff1d987a7f99233` | Metric rows use the available horizontal space; footer labels remain aligned and separated.                                                                    |
| Partial  |   320 |       320×1246 | `9a97ceb94072159ba8edcb09d066047ad4251024a61ad770434c7a3698d342f3` | Missing subject details are not rendered as zero; the empty-result caveat and partial state are visible. Warning and footnotes fit within the card.            |
| Partial  |   360 |       360×1210 | `4fa59b65849512e7c8e65e35d92e5a46638d9c749e9fb49216adc9d924859b58` | Empty-result explanation wraps cleanly; all four metrics show unknown/partial coverage.                                                                        |
| Partial  |   520 |       520×1080 | `25e57dc6c61520833d4971e9a9ede7611e5c22a291bb7fc9ea9eaf54cc349033` | No collision between the warning, coverage rows, and limitation block.                                                                                         |
| Partial  |   640 |       640×1059 | `55ae21335550fccc82447e31707c6350ce698b9b91ecc278f9efb8fccce1d7a1` | Single cohort continues to use the full card width; no clipping or stray comparison column.                                                                    |
| Partial  |   960 |        960×844 | `051e11009f7669b83040e2ded488d4dc363094c021b4dd2e9bc7ee4a54d06d4d` | Status, unknown values, and coverage align in separate metric columns; no overflow.                                                                            |

Across all ten images, the hierarchy is title → cohort → returned sample or
empty-result explanation → aggregate metrics → data limits → source/footer.
The partial images say that missing fields are not calculated as zero and that
an empty result does not prove no match exists. The plain-text renderer
acknowledgement carries the same partial/empty limitation. No clipping or
horizontal overflow was seen. The 320-pixel layouts are necessarily denser;
the main action/status and partial caveat remain readable, while secondary
source and coverage labels use the renderer's compact caption size. This is a
bounded C07 renderer review only; it adds no OAuth callback, `auth_status`,
QQ/TIM, or user-facing C07 scenario evidence.

Visual output path: `.artifacts/render/c07-cohort-comparison-v3-visual-qa/`.
Images and their hashes are local-only; the committed report will contain the
sanitized review table, not image bytes.

## One-shot gates and terminal rule

Require a clean exact Candidate, synchronized Base, seven successful exact-SHA
CI checks, Harness Candidate readiness, same-identity GPT-6 Luna Max PASS, and
a fresh v3 profile status of UNCLAIMED/eligible. Then invoke once. Any
INCONCLUSIVE result is permanently terminal and earns no matrix credit; never
retry it or alter the v1/v2 claims.

OAuth/account, community, private writes, QQ, and TIM are outside this
synthetic profile and remain passive.
