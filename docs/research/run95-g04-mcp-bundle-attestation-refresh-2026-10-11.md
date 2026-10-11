# Run #95 G04 exact-Candidate MCP bundle attestation refresh

**Recorded:** 2026-10-11 UTC
**Run:** Harness #95
**Epoch:** `run95-g04-person-activity-codex-current-evidence`
**PR:** #128
**Candidate before this documentation change:** `ab7ad2ba4d9088972c96955b23300a3fca6d0722`
**Base:** `a7185e017eaceec290acd2e7937fb5240e95b279`

## Preclaim failure and disposition

After the exact Candidate, current Base, seven required exact-SHA CI checks, Harness candidate gate, and same-identity GPT-6 Luna Max PASS were verified, the G04 runner was invoked once. It stopped before creating the local one-shot claim because the built MCP bundle digest did not match the tracked G26 bundle attestation. The G04 claim and sanitized report were absent after that failure. No Codex query, MCP event, Bangumi API request, OAuth/account access, community read, QQ/TIM action, or write occurred. The runner must not be retried until a refreshed Candidate passes its complete CI, Harness review, and bundle preclaim gates.

## Exact build and source provenance

On the exact pre-refresh Candidate, `pnpm build` passed. `computeMcpBundleSha256` returned `663a2d185548394812801acef51902f9ac682983355c70fb1110be46ad63b6cf` both before and after a second build. The tracked attestation still contained `131f7063c53e02391833550e21e521d461e24890ab3f7510ae55e5930bece598`, ruling out a transient build-output change in this checkout.

The tracked digest was last refreshed by commit `3de59a7` before current Base `a7185e0`. Between those revisions, the only source diff under `apps/mcp` and `packages` was PR #127's change to `apps/mcp/src/result-presenter.ts`, which preserves structured cohort results while producing the appropriate bounded text projection. PR #128 itself has no `apps/mcp` or `packages` source changes. The attestation was therefore stale for the current shared runtime build; it is refreshed here to the stable exact-Candidate build digest.

This metadata refresh does not rerun G26 or add any G26/G04 Agent/MCP evidence. G04 remains PARTIAL. The digest covers the compiled MCP/package outputs and is not a claim about live API, account, community, QQ, or TIM behavior.

## Reproduction

From the BangumiAgentKit checkout at the pre-refresh Candidate:

```sh
pnpm build
node --input-type=module -e "import {computeMcpBundleSha256} from './scripts/lib/g26-mcp-bundle.mjs'; console.log(computeMcpBundleSha256(process.cwd()))"
```

Expected digest: `663a2d185548394812801acef51902f9ac682983355c70fb1110be46ad63b6cf`.
