# G26 current-master runtime attestation refresh

**Recorded:** 2026-10-08 14:14 UTC
**Run:** Harness #95
**Epoch:** `g26-current-master-agent-mcp-acceptance`
**Exact starting Base:** `145d3e446eb6d1be78d9d1a938afc3dab6e254ac`

## Build evidence

- `pnpm build`: PASS on clean synchronized master and rerun after the one-shot preclaim guard/test change; it produced the same bundle digest below.
- `scripts/lib/g26-mcp-bundle.mjs::computeMcpBundleSha256`: `9a95f14e3b434da8ec9d88fb1121f9d21b8f319ec8a59cffd3be3477fc75cc83`
- Previous committed G26 attestation: `1e7b390232b4903da3dfc42a669c553db06faddcd590e532b94e753e97fdcb1a` (stale after S04 updated shared source included in the runtime build).
- `docs/product/g26-mcp-bundle-attestation.json` now binds to the built digest above. The attestation file and this report are outside the bundle hash input (`apps/mcp/dist` and `packages/*/dist`).
- `tests/unit/g26-codex-agent-mcp-runner.test.ts`: focused run passed 10/10; `pnpm typecheck` and `pnpm lint` passed. A new regression verifies that a stale bundle digest is rejected before either canonical or mirrored one-shot claim file is created. The same assertion is used in the exact-build preflight and immediately before claim creation.
- The fresh Run #95 G26 acceptance Epoch is selected; this note does not assert Candidate, CI, review, or live-query readiness.

## Source and safety boundary

The current official OpenAPI marks `POST /v0/search/subjects` experimental and lists the `tag` and `rating_count` filters. G26 uses the exact literal tag `女性向` as an operational facet, not an audience taxonomy; TV remains a platform post-filter, with the 2019–2024 half-open date interval and integer rating threshold >=10001. Search totals and bounded candidate/hydration coverage must remain disclosed. Source contract: [`run95-g26-exact-tag-discovery-contract-2026-10-07.md`](run95-g26-exact-tag-discovery-contract-2026-10-07.md).

No live Bangumi API, OAuth/account, community, QQ, or TIM access occurred for this build/attestation refresh. At this recorded build checkpoint, the canonical one-shot G26 claim and exact sanitized Agent/MCP report were absent. A subsequent runner attempt and the resulting safety correction are recorded below.

## Run #95 one-shot attempt and path-alias correction

After the exact Candidate/Base, seven mandatory exact-SHA CI checks, Harness readiness, and GPT-6 Luna Max review #1 passed, the dedicated G26 runner was invoked once. It stopped before `invokeCodex()` because the canonical claim path under `/private/tmp` and mirror path under `/tmp` refer to the same physical macOS directory but were compared as different strings. The exclusive create wrote the canonical claim and then rejected the apparent second claim.

The local claim remains `CLAIMED`, bound to Candidate `9a91881f29f6afb5973466be808dbf3a5f874525`; it has no execution summary. The sanitized report is absent. No Codex model call, MCP event, or Bangumi API request occurred. Keep G26 `UNASSESSED`; do not delete or rewrite the claim, rerun the runner, or make another G26 query.

The runner now resolves each path through its nearest existing ancestor before comparing physical paths, after validating both requested paths against the local Git-metadata boundary. When canonical and mirror paths alias, it creates and tracks only the canonical claim. A symlink regression verifies one file is created and a second claim attempt is rejected. This is runner-safety evidence only and does not change G26 acceptance coverage.

## Review #2 correction — physical checkout boundary

Independent GPT-6 Luna Max review #2 found that the first alias fix still used lexical paths for the checkout/Git-metadata containment check. An external symlink could therefore point a requested mirror path into the checkout and pass that boundary check. Harness recorded finding `G26-CLAIM-PHYSICAL-BOUNDARY` as P2 and moved PR #112 to `CORRECTIVE_REQUIRED`.

The correction now resolves the requested claim path, checkout root, and Git common directory through their nearest existing ancestors before checking containment with `path.relative`. Paths physically inside the checkout remain allowed only inside the Git common directory. A new regression points an external symlink at the checkout's existing `docs` directory and verifies rejection occurs before either claim is created; the `/tmp` and `/private/tmp` alias regression remains. Focused G26 runner tests pass 12/12. The original G26 claim remains untouched and no model/MCP/API call occurred.
