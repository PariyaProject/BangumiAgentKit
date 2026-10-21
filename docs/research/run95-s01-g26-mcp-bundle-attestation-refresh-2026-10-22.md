# Run #95 S01 exact-Candidate MCP bundle attestation refresh

Date: 2026-10-22 (Asia/Tokyo)

Candidate used for reproducible build measurement: 720dd8665efca348aa4c2588a18b28d726b6f619

Base: e2643ab814d3c861ef8c16d14840725011e68283

## Reproducible build evidence

The S01 one-tool MCP runner requires a build-only digest of the exact Candidate's compiled runtime bundle to match docs/product/g26-mcp-bundle-attestation.json. The current runtime bundle inputs are apps/mcp/dist and packages/*/dist.

Two sanitized pnpm build runs on the same clean Candidate completed successfully under Node v24.14.0 and pnpm 9.0.0. After each build, computeMcpBundleSha256 returned:

4f4810c352e12387cf0a61e5eced2efa9fff6335866fa388505dc1ded11a8e10

The previous tracked attestation was 3ab2facc4051a4d791cc5c1fdc472d387fed527dd4534e5523e58f9f1c9f116e. The tracked G26 bundle attestation is refreshed to the reproducible build digest above. The attestation file and this note are outside the bundle input paths, so updating them does not change the measured bundle hash.

## Acceptance boundary

This is reproducible build provenance only. It grants no G26 acceptance, no Agent/MCP matrix credit, and no authorization to invoke a profile. S01 remains PARTIAL; its separate one-tool call is governed by the active Epoch's exact Candidate, Base, CI, Harness review, bundle digest, and one-shot claim gates.
