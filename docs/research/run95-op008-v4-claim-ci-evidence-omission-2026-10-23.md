# Run #95 OP-008 v4 claim omitted exact CI evidence

Date: 2026-10-23

## Result

The single permitted v4 Agent/MCP attempt ended `INCONCLUSIVE` with
`RENDER_SUBJECT_CARD_RUNNER_GATE_INVALID`. Harness marks this profile terminal with
`retryAllowed: false`. Its sanitized report was not written, so the attempt earns no Agent/MCP
matrix credit. Do not invoke or recreate this profile.

The exact Candidate was `ea62b65b736c6a179d228e4ae9a1615c4ad1e02e` on Base
`7e20cf951f00027e97c60137bf4872eb175024d1`; its CI run `39840086212` passed 7/7, and same-identity
review round 3 passed before the claim. The failure occurred after the claim, inside the report
builder.

## Root cause

`scripts/agent-harness.mjs` used `PROFILE_CI_RUN_EVIDENCE_IDS` to decide whether a profile claim
persists `ciRunId` and `ciChecks`. The set contained the v1, v2, and v3 subject-card profiles, but
omitted `render-subject-card-compact-typography-agent-mcp-v4`. The v4 claim therefore lacked those
fields. `scripts/acceptance/write-render-subject-card-offline-agent-mcp-report.mjs` requires them
through `isValidP06CiRunEvidence`, so report construction rejected the otherwise accepted run.

This was an authoring defect in the Harness profile allowlist. The generic gate error did not name
the failed predicate, which made diagnosis harder; the source-level mismatch above identifies the
failure without relying on discarded runtime output.

## Correction and limits

The allowlist now lives in `scripts/lib/agent-mcp-profile-ci-evidence.mjs`, includes v4, and has a
focused regression test. That test failed before the v4 entry was added and passed afterward. The
v4 Harness disposition remains terminal `INCONCLUSIVE`; no report or acceptance credit is
backfilled. The report path remains absent, and the matrix remains Agent/MCP 83/96.

Existing source contracts and visual previews remain design evidence only. This result does not
establish production-font delivery, QQ pipeline behavior, or TIM client behavior. Any future
acceptance must use a distinct registered profile and input with fresh Harness, CI, and review
gates; the spent v4 profile must not be retried.
