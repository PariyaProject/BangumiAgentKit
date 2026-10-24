# Run #95 R03 exact-Candidate MCP bundle attestation refresh

Date: 2026-10-23 (Asia/Tokyo)

Bundle measurement Candidate: `e598273776282693eddab2c8c49f96e8269a1fa3`

Base: `9d7a563adfb17a6220520a775e6c5fb5cd9891f6`

## Trigger and one-shot state

After exact-Candidate CI run `39937351076` passed all seven checks and the
same-identity GPT-6 Luna Max review returned PASS, the R03 two-hop runner
stopped at its pre-claim bundle gate with `R03_PREFLIGHT_FAILED`. Harness still
reported profile `r03-two-hop-rating-analysis-offline-agent-mcp-v1` as
`UNCLAIMED`, with no claim or terminal latch. Its report file was absent. The
runner had not called Codex or MCP, and no live API, OAuth/account, community,
write, QQ, or TIM action occurred.

The previous tracked G26 bundle digest was
`bf5a656a96ab61e20d88cec1f7adfec62e6ea76b948438919a833a1be75ddcce`; the
bundle built from this Candidate produced a different digest.

## Reproducible build evidence

Environment: Node `v24.14.0`, pnpm `9.0.0`.

Two successive `pnpm build` runs on the unchanged clean Candidate exited
successfully. `computeMcpBundleSha256` returned the same digest after each:

`f6716824a29ec0c2ca7c8daa5bab201d7b1aa511b827f0aa59861dbc042f18c2`

The tracked `docs/product/g26-mcp-bundle-attestation.json` now records this
reproducible digest. The attestation and this report are outside the runtime
bundle inputs (`apps/mcp/dist` and `packages/*/dist`), so updating these records
does not change the measured bundle hash.

## Acceptance boundary and next gates

This refresh records build provenance only. It grants no Agent/MCP matrix
credit and makes no profile claim. The R03 scenario remains PARTIAL; the profile
remains UNCLAIMED. Because this documentation refresh creates a Candidate
descendant, it requires new exact-SHA seven-check CI, Harness `candidate:check`,
and same-identity GPT-6 Luna Max review before the single synthetic call. A
claimed call may never be retried. No live API, account/OAuth, community,
write, QQ, or TIM path was used.
