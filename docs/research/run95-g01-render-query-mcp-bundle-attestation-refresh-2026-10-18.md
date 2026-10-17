# Run #95 G01 v2 exact-Candidate MCP bundle attestation refresh

**Recorded:** 2026-10-18 03:30 JST
**Run:** Harness #95
**Epoch:** `run95-g01-render-query-offline-matrix-v2-call-20261018`
**PR:** #217
**Candidate:** `7e0797b954247b90781ca0bb848ff51743101334`
**Base:** `07bd399570e9bc87f4d502c4fbace5d5e64fddd3`

## Why the attestation needed a refresh

The G01 v2 runner requires the built MCP runtime bundle for the exact Candidate to match `docs/product/g26-mcp-bundle-attestation.json` before it creates the permanent profile claim. The runner stopped at that preflight because the tracked digest was stale after product-source changes merged since attestation commit `e65cae6`.

Two `pnpm build` runs on Candidate `7e0797b` produced the same MCP bundle SHA-256:

```text
461638b89271179c828456c4b1399a7c1ed9c1c6bfbe7212170826784c52d4ba
```

The prior attestation value was `485b60888a01e8b3a1d6100b14966c5221d9e47a7c6b17defffd38a79fe900f3`. Between `e65cae6` and the current Base, bundled source changed in:

- `apps/mcp/codex-one-tool-mcp-server.mjs`
- `apps/mcp/src/result-presenter.ts`
- `packages/bangumi-core/src/index.ts`
- `packages/bangumi-core/src/services/subject-relations-analysis-service.ts`
- `packages/bangumi-core/src/services/subject-service.ts`
- `packages/tools/src/definitions/read-tools.ts`

The refreshed digest is build provenance for the current MCP bundle. The attestation file and this research note are outside the bundle hash input, which covers `apps/mcp/dist` and `packages/*/dist`.

## One-shot disposition and limits

The runner's failed preflight occurred before Harness created a profile claim and before `codex exec` or an MCP call. Harness readback remained `UNCLAIMED` with no disposition; the registered report file was absent. This was not an inconclusive profile result and did not consume the one-shot.

This attestation refresh does not assess G26, revive or repeat its consumed claim, add G01/G26 scenario evidence, change the Agent/MCP matrix, or alter the public API target. G01 remains `PARTIAL`; the v2 profile can credit only its single `bangumi.render_query_subjects` Agent/MCP row after a valid signed report. Before a new runner attempt, this updated Candidate must pass its exact seven-check CI, Harness Candidate gate, and same-identity Luna Max review.
