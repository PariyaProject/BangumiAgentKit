# Run #95 UX-002 exact-Candidate MCP bundle attestation refresh

Date: 2026-10-22 (Asia/Tokyo)

Candidate used for reproducible build measurement: `68a0e6842a072472984e5c5d54b2a297994adbda`

Base: `ac20862dd85165a3263ea6b1015cd92553e63703`

## Trigger and one-shot state

After the exact-Candidate CI and same-identity review passed, the synthetic
`render-subject-card-compact-typography-agent-mcp-v2` runner stopped in
preflight before acquiring its one-shot claim. It found that the exact
Candidate's built MCP runtime bundle differed from the existing tracked G26
bundle attestation. Harness confirmed the v2 profile remained `UNCLAIMED`, with
no disposition, label, or MCP invocation.

The prior tracked attestation was
`4f4810c352e12387cf0a61e5eced2efa9fff6335866fa388505dc1ded11a8e10`.

## Reproducible build evidence

Two `pnpm build` runs on the same clean Candidate `68a0e684` exited
successfully. `computeMcpBundleSha256` returned the same digest after both runs:

`f84d2f4ddec2822eaefe94e9b7be421ca78f22aa88724f855811c79cea86685b`

The tracked `docs/product/g26-mcp-bundle-attestation.json` now records this
reproducible exact-Candidate build digest. The attestation and this research
note are outside the runtime bundle inputs (`apps/mcp/dist` and
`packages/*/dist`), so these documentation records do not change the measured
bundle digest.

## Acceptance boundary

This is build provenance only. It grants no G26 acceptance, no Agent/MCP matrix
credit, and no additional one-shot authorization. The fresh v2 profile remains
unclaimed. This attestation refresh creates a new Candidate descendant, so it
requires a new exact-head 7/7 CI, Harness candidate check, and same-identity
GPT-6 Luna Max review before the single v2 call can be claimed. An inconclusive
result remains terminal and cannot be retried.
