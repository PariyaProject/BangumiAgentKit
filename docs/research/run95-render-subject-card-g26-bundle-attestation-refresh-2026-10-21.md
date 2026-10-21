# Run #95 `render_subject_card` G26 bundle attestation refresh

Date: 2026-10-21 (Asia/Tokyo)
Run: #95, active PR #247
Prior reviewed Candidate: `3e92af537ee1297f0e7d01d60019f9a2fe5fdfd9`
Base: `e867b2f6a22d50148493a028d93bff14ee602707`

## Trigger and one-shot state

After the same-identity Luna Max review returned PASS and the profile gate became eligible, the runner's exact-Candidate build preflight compared the built MCP bundle to `docs/product/g26-mcp-bundle-attestation.json` and found a mismatch. The prior tracked digest was `3afe88786b6433e5f51f5eb5d8bbaabc034b3f17b3b0051fd309486b5c939e7f`; the current build produced a different digest. The runner stopped before acquiring a profile claim or invoking Codex. Profile `render-subject-card-offline-agent-mcp-v1` remains UNCLAIMED, with no claim or terminal label. No MCP tool, API, account/OAuth, community, QQ, or TIM action occurred.

## Reproducible build evidence

Two `pnpm build` runs on the same clean Candidate `3e92af537ee1297f0e7d01d60019f9a2fe5fdfd9` both exited successfully. After each build, `computeMcpBundleSha256` returned:

`3ab2facc4051a4d791cc5c1fdc472d387fed527dd4534e5523e58f9f1c9f116e`

The prior attestation did not match either build. `docs/product/g26-mcp-bundle-attestation.json` is updated to this reproducible exact-Candidate build digest. The attestation and this research note are outside the bundle input paths (`apps/mcp/dist` and `packages/*/dist`), so updating these records does not change the measured bundle hash.

## Acceptance boundary

This is build provenance only; it adds no G26 acceptance or Agent/MCP matrix credit. The previous CI, Candidate check, and review PASS apply to Candidate `3e92af5`; this post-PASS attestation refresh is a new descendant Candidate. It requires a fresh exact-SHA seven-check CI, Harness Candidate check, and same-identity GPT-6 Luna Max review before the one-shot can be claimed. The one-shot remains unclaimed and is never retried after an inconclusive result.
