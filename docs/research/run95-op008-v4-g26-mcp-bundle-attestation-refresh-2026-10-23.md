# Run #95 OP-008 v4 exact-Candidate MCP bundle attestation refresh

Date: 2026-10-23 (Asia/Tokyo)

Bundle measurement Candidate: `f6afd230b0308af9bd4de821e88fe5c71d2adc17`

Base: `7e20cf951f00027e97c60137bf4872eb175024d1`

## Trigger and one-shot state

After exact-Candidate CI run 39838269884 passed all seven checks and the
same-identity GPT-6 Luna Max review returned PASS, the v4 runner stopped during
local preflight because the built MCP bundle did not match the tracked G26
attestation. Harness still reported the v4 profile `UNCLAIMED`, with no
disposition or claim/terminal labels. No Codex invocation, MCP call, report, or
one-shot claim occurred.

The prior tracked digest was
`501f00ac6eb388afa4c331a914761f47e2c86f744c9f4f79455490d3d3ae45d6`.

## Reproducible build evidence

Environment: Node `v24.14.0`, pnpm `9.0.0`.

Two `pnpm build` runs on the unchanged clean Candidate exited successfully.
After each build, `computeMcpBundleSha256` returned the same digest:

`df9629afca03351a66b81aa49b5c87e3c01daa8e43991ce02c7bd9e929fc0ce5`

The tracked `docs/product/g26-mcp-bundle-attestation.json` now records this
reproducible digest. The attestation and this research note are outside the
runtime bundle inputs (`apps/mcp/dist` and `packages/*/dist`), so these
documentation records do not change the measured bundle digest.

The PR's runtime changes to `packages/renderer/src/templates/SubjectCard.tsx`
and `packages/renderer/src/components/TitleBlock.tsx` alter the generated
renderer bundle, which explains why the Base attestation did not match this
Candidate.

## Acceptance boundary and next gates

This refresh records build provenance only. It grants no Agent/MCP matrix
credit and does not claim a profile result. The v4 profile remains unclaimed.
Because this refresh creates a Candidate descendant, it requires new exact-SHA
seven-check CI, Harness `candidate:check`, and same-identity GPT-6 Luna Max
review before the single v4 call. Any inconclusive result remains terminal;
never retry v1-v3 or this profile after a claim. No account/OAuth, community,
write, QQ, or TIM path was used.
