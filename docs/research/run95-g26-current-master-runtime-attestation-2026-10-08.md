# G26 current-master runtime attestation refresh

**Recorded:** 2026-10-08 14:14 UTC
**Run:** Harness #95
**Epoch:** `g26-current-master-agent-mcp-acceptance`
**Exact starting Base:** `145d3e446eb6d1be78d9d1a938afc3dab6e254ac`

## Build evidence

- `pnpm build`: PASS on the clean synchronized master before this documentation-only Candidate change.
- `scripts/lib/g26-mcp-bundle.mjs::computeMcpBundleSha256`: `9a95f14e3b434da8ec9d88fb1121f9d21b8f319ec8a59cffd3be3477fc75cc83`
- Previous committed G26 attestation: `1e7b390232b4903da3dfc42a669c553db06faddcd590e532b94e753e97fdcb1a` (stale after S04 updated shared source included in the runtime build).
- `docs/product/g26-mcp-bundle-attestation.json` now binds to the built digest above. The attestation file and this report are outside the bundle hash input (`apps/mcp/dist` and `packages/*/dist`).
- The fresh Run #95 G26 acceptance Epoch is selected; this note does not assert Candidate, CI, review, or live-query readiness.

## Source and safety boundary

The current official OpenAPI marks `POST /v0/search/subjects` experimental and lists the `tag` and `rating_count` filters. G26 uses the exact literal tag `女性向` as an operational facet, not an audience taxonomy; TV remains a platform post-filter, with the 2019–2024 half-open date interval and integer rating threshold >=10001. Search totals and bounded candidate/hydration coverage must remain disclosed. Source contract: [`run95-g26-exact-tag-discovery-contract-2026-10-07.md`](run95-g26-exact-tag-discovery-contract-2026-10-07.md).

No live Bangumi API, OAuth/account, community, QQ, or TIM access occurred for this build/attestation refresh. The canonical one-shot G26 claim and the exact sanitized Agent/MCP report were absent at this checkpoint. Execute the dedicated runner once only after exact Candidate/Base, seven mandatory exact-SHA CI checks, Harness readiness, and GPT-6 Luna Max review PASS all match. Keep G26 UNASSESSED unless every answer/source/coverage check passes; on any inconclusive result, keep the claim spent and never retry.
