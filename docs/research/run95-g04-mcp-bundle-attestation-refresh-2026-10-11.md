# Run #95 G04 exact-Candidate MCP bundle attestation refresh

**Recorded:** 2026-10-11 UTC
**Run:** Harness #95
**Epoch:** `run95-g04-person-activity-codex-current-evidence`
**PR:** #128
**Build source revision:** `ab7ad2ba4d9088972c96955b23300a3fca6d0722`
**Base:** `a7185e017eaceec290acd2e7937fb5240e95b279`

## Exact build provenance

On the recorded source revision, `pnpm build` passed. `computeMcpBundleSha256` returned `663a2d185548394812801acef51902f9ac682983355c70fb1110be46ad63b6cf` both before and after a second build. The prior tracked attestation contained `131f7063c53e02391833550e21e521d461e24890ab3f7510ae55e5930bece598`; the refreshed `docs/product/g26-mcp-bundle-attestation.json` now records the stable build digest.

The prior digest was last refreshed by commit `3de59a7` before current Base `a7185e0`. Between those revisions, the only source diff under `apps/mcp` and `packages` was PR #127's change to `apps/mcp/src/result-presenter.ts`, which preserves structured cohort results while producing the appropriate bounded text projection. PR #128 itself has no `apps/mcp` or `packages` source changes. This shared-runtime source change explains why the previous digest no longer identified the current compiled bundle.

This digest is build provenance only; it does not provide a live tool result or increase acceptance coverage.

## Reproduction

From the BangumiAgentKit checkout at source revision `ab7ad2ba4d9088972c96955b23300a3fca6d0722`:

```sh
pnpm build
node --input-type=module -e "import {computeMcpBundleSha256} from './scripts/lib/g26-mcp-bundle.mjs'; console.log(computeMcpBundleSha256(process.cwd()))"
```

Expected digest: `663a2d185548394812801acef51902f9ac682983355c70fb1110be46ad63b6cf`.
