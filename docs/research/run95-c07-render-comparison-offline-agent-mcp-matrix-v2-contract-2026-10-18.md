# Run #95 C07 v2 offline renderer matrix contract

## Purpose and current state

This fresh, synthetic profile covers only the Agent/MCP matrix cell for
`bangumi.render_subject_cohort_comparison`. The selected Harness Epoch is
`run95-c07-render-comparison-offline-agent-mcp-matrix-v2-20261018`, based on
master `de2c2b9bd059c7e9ce2773875cfe1f696e7db6f1`. This branch adds the
registry entry; no permanent Harness claim or MCP call has occurred yet.

The profile ID is
`c07-render-comparison-offline-agent-mcp-matrix-v2`. It uses one synthetic
cohort D query, the unique keyword `run95 c07 synthetic cohort d offline
matrix 20261018`, and synthetic subject ID `991224`. These differ from the
consumed C cohort v1 profile. The v1 profile and its terminal disposition stay
unchanged and must never be retried.

## Exact bounded execution

The one allowed MCP tool is `bangumi.render_subject_cohort_comparison`, called
once with the exact registered profile arguments. The closed local fetch fixture may answer one exact anonymous
search `POST /v0/search/subjects` and one exact
`GET /v0/subjects/991224`. The fixture rejects authorization, duplicate calls,
query or method drift, any other origin/path, and unexpected requests. Renderer
asset resolution is denied. No live Bangumi API, OAuth/account, community,
write, QQ, or TIM path is in scope.

The signed report contains sanitized request counters, hashes, booleans, and
bounded PNG metadata only. It does not contain raw cohort rows, labels/titles,
subject IDs, prompt, full answer/tool result, credentials, or image bytes. A
valid report can credit only the
`bangumi.render_subject_cohort_comparison` Agent/MCP matrix cell. C07 remains `UNASSESSED`; this is not a C07 scenario result, does not credit
`bangumi.compare_subject_cohorts`, and does not add public API evidence.

## Visual inspection

Before any one-shot claim, render this template from a local deterministic
synthetic ViewModel at CSS widths 320, 360, 520, 640, and 960 pixels with DPR 1.
That sample was generated at `2026-10-18T07:48:46.070Z` in ignored local output
`.artifacts/render/c07-cohort-comparison-v2-visual-qa/`. All 10 PNGs were opened
and inspected individually. Pixel width matched the requested CSS width at DPR
1; the renderer returned a valid PNG signature. The files are local-only and
their bytes are not committed.

| Case                     | CSS/pixel dimensions | SHA-256                                                            | Individual visual finding                                                                                                           |
| ------------------------ | -------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Complete bilingual       | 320×1916             | `9ca57aba0f8561a8071aee30712b5a05a52f603ec5babe7230d2045f9c4e730c` | No clipping or overflow; long bilingual titles wrap. Details and metrics are very dense at phone width.                             |
| Complete bilingual       | 360×1852             | `6276ef1f2e56b7569243909a42c746683d3c0e005b27eeab640f96678ea8baad` | Same hierarchy and safe wrapping; long vertical scan and small secondary text remain.                                               |
| Complete bilingual       | 520×1461             | `0312d0508dceba76b37f0e441f2f8b2183d899d70aede69bf4ffdac5fe0aa8d4` | Cohort blocks and metric rows separate cleanly; internal field names and coverage details still compete with the result.            |
| Complete bilingual       | 640×1425             | `cae789fecce9ef419c51426abedbb045c2eacfedb05c82ef955fc227b3e8e27d` | No obvious clipping; mixed CJK/Latin text wraps; technical source and formula labels remain visible.                                |
| Complete bilingual       | 960×856              | `933c249d22002154b6737b44fb00e496448452f49d5e6b7d2f41a48fbcf9c4ac` | Balanced two-cohort layout; metric table is compact but still contains machine-oriented field/formula details.                      |
| Partial / missing cohort | 320×1969             | `63f7e51db2538d79b9406e9e1b60dd933f9ecabc36fb34fb0ba2b138044d7387` | Missing cohort and non-computable deltas are visible; no false zero/delta. Raw synthetic warning code is displayed; dense and tall. |
| Partial / missing cohort | 360×1905             | `6703fabfa42467cd6e904aa4429ddbe8ef834014d718603eb6807378f1a1dcbd` | Warning and missing cohort remain legible with no clipping; raw warning code and long vertical scan remain.                         |
| Partial / missing cohort | 520×1527             | `7bc9d7f252c81d8a19b05ecd1f7ad24c4ce8bb5a587d6179b6161828e382724c` | Partial wording is visible and consistent across cohort and metric sections; technical details still dominate.                      |
| Partial / missing cohort | 640×1476             | `d5d8c16f33f44e9293d7b305766c548fbb400cc2c11b9a5d6e8274d61f48a77f` | No obvious clipping; missing-data state is clear; warning code is not user-facing language.                                         |
| Partial / missing cohort | 960×914              | `fb1c2a03c42f4cc4f8d8b39f4e36d3dfa8c0e11ee03ff8229022b036a9dbca50` | Two-column state is clear and delta is explicitly not computable; diagnostic wording and field-level counts remain prominent.       |

The sample confirms safe wrapping and clear missing-data behavior, while also
recording concrete follow-ups: reduce chat-scale density, translate internal
field/formula labels, and replace exposed warning codes with concise user
language. It does not test OAuth, callback HTML, post-auth user messages, or
QQ/TIM client display. No OAuth-specific image has been generated or inspected.

The MCP result itself is a separate artifact. For the exact v2 profile, the
server writes a create-only PNG copy beside its temporary summary file. The
runner verifies its byte length and SHA-256 against the sanitized summary, then
copies it to ignored `.artifacts/render/` output and returns the local path for
individual inspection. Those bytes never enter the signed report or Git. If
capture or hash verification fails after the claim, the result is terminal
INCONCLUSIVE/no-report/no-retry; never rerun the profile to obtain a better
image.

## Gates and credit

The v2 profile is registered only on the selected Epoch branch. Invoke only after the
exact Candidate passes all seven required CI checks, Harness Candidate returns
`REVIEW_READY`, the same-identity GPT-6 Luna Max review returns `PASS`, and a
fresh Harness profile-status check confirms the profile is unclaimed and
eligible. The invocation is one-shot. An `INCONCLUSIVE` result is terminal,
non-retryable, and earns no matrix credit. Any report-only refresh requires a
new exact-SHA CI and same-identity review before merge.
