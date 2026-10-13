# Run #95 dependency security remediation source contract

Verified 2026-10-13T06:49:24Z on synchronized BangumiAgentKit master `8ace283ab00c3f2cb15c92bd1dfc0f6c7590e771`, immediately before dependency edits. GitHub Dependabot was queried read-only for `PariyaProject/BangumiAgentKit`; all seven alerts below were OPEN in `pnpm-lock.yaml`. Exact affected versions and dependency chains were confirmed with `pnpm -r why`. This report describes the repository and advisory evidence only. No Bangumi request, OAuth/account operation, user data, community, QQ, or TIM action occurred.

## Current alert inventory

| Alert | Package | Severity | Current locked version(s) | Vulnerable range | First fixed version | Advisory |
| --- | --- | --- | --- | --- | --- | --- |
| #24 | `proxy-addr` | Critical | `2.0.7` | `>=1.1.0 <2.0.8` | `2.0.8` | [GHSA-jqcg-44mw-7w3h / CVE-2026-90711](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) |
| #27 | `@modelcontextprotocol/sdk` | High | `1.30.0` | `>=1.12.0 <1.31.0` | `1.31.0` | [GHSA-6qxp-vccf-f47h / CVE-2026-104850](https://github.com/advisories/GHSA-6qxp-vccf-f47h) |
| #26 | `sharp` | High | `0.35.4` | `<0.35.5` | `0.35.5` | [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w), transitive librsvg CVE-2026-96889 |
| #25 | `source-map-js` | High | `1.2.1` | `>=1.0.0 <1.2.2` | `1.2.2` | [GHSA-68fv-2mgg-jv7q / CVE-2026-93749](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) |
| #23 | `brace-expansion` | Medium | `1.1.18` | `<1.1.21` | `1.1.21` | [GHSA-q2hr-2g5m-vwhr / CVE-2026-102277](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) |
| #22 | `brace-expansion` | Medium | `2.1.4` | `>=2.0.0 <2.1.7` | `2.1.7` | [GHSA-q2hr-2g5m-vwhr / CVE-2026-102277](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) |
| #21 | `brace-expansion` | Medium | `5.0.9` | `>=4.0.0 <5.0.12` | `5.0.12` | [GHSA-q2hr-2g5m-vwhr / CVE-2026-102277](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) |

## Dependency paths

- `@modelcontextprotocol/sdk` is a direct dependency of `apps/mcp` and a root development dependency. Its alert concerns the OAuth client forwarding credentials to an authorization server selected by an MCP server; this makes the patch directly relevant to the private-collection/MCP boundary, but it is not evidence of a real OAuth flow.
- `proxy-addr` is resolved below the SDK's Express path in the MCP app and the root tooling graph.
- `sharp` is a direct runtime dependency of `packages/renderer` and is used through the tools package by API, MCP, and Standalone.
- `source-map-js` is in the Vite/PostCSS development graph.
- The three `brace-expansion` major lines are in the minimatch-based lint, TypeScript, and OpenAPI tooling graph.

## Remediation boundary and acceptance

Update only the direct manifests that hold the MCP SDK and sharp, plus compatible transitive lockfile resolutions for all seven alerts. Do not dismiss alerts or upgrade unrelated dependency families. Verify each affected major line resolves to its first fixed version or later; run the relevant repository checks and exact-head CI; after integration, query Dependabot again and close each task item only when GitHub reports the corresponding alert fixed.

The security work may update OP-009's security evidence, but OP-009 remains `PARTIAL`. It does not test OAuth consent, bind an account, read or write user data, add profile-metadata editing, or change auth semantics. The advisory does not authorize a client/account action.

## Source and verification

- GitHub Dependabot Alerts API, read-only snapshot at the verification time above: `https://api.github.com/repos/PariyaProject/BangumiAgentKit/dependabot/alerts?per_page=100`.
- Official advisory pages are linked in the inventory.
- Exact package graph inspection: `pnpm -r why @modelcontextprotocol/sdk`; `pnpm -r why proxy-addr`; `pnpm -r why sharp`; `pnpm -r why source-map-js`; `pnpm -r why brace-expansion`.
- Pre-edit lockfile check: `pnpm-lock.yaml` resolves `@modelcontextprotocol/sdk` 1.30.0, `proxy-addr` 2.0.7, `sharp` 0.35.4, `source-map-js` 1.2.1, and `brace-expansion` 1.1.18 / 2.1.4 / 5.0.9.


## Candidate-local resolution and validation

Recorded 2026-10-13T06:55:05Z on the active security Epoch branch before Candidate establishment:

- `pnpm install --frozen-lockfile`: PASS. The direct MCP SDK and Renderer manifests resolve to `@modelcontextprotocol/sdk` 1.31.0 and `sharp` 0.35.5. The lock and installed workspace graph resolve `proxy-addr` 2.0.8, `source-map-js` 1.2.2, and brace-expansion 1.1.21 / 2.1.7 / 5.0.12; none of the prior vulnerable versions remains in the lock graph.
- The SDK 1.31.0 dependency closure also resolves its related Express/OAuth dependencies, including Express 5.3.0 and proxy-addr 2.0.8. The Renderer patch updates its matching sharp platform/libvips packages. The unrelated Hono node-server metadata drift from an initial lockfile resolution was removed; current Hono state matches the SDK-required graph and frozen install succeeds.
- `pnpm typecheck`: PASS; `pnpm lint`: PASS; `pnpm acceptance:check`: PASS, 108/108 validators, Agent/MCP remains 83/96, auth pending 33, QQ/TIM 0/96.
- `pnpm test`: PASS, 124 files / 884 tests.
- `pnpm test:integration:sqlite`: PASS, 23 files / 111 tests; 1 file and 1 test skipped by the existing suite.
- `pnpm harness frontier:check`: PASS, 121 records / 99 actionable, hash `60d08fa0753a3651d797c238b2cb50c9e79bd08bcd06b294dbef9aabd04b7495`; OP-009 remains PARTIAL.
- `pnpm harness guard:legacy-paths --base origin/master --product-epoch`: PASS; `git diff --check`: PASS.

These are local branch results, not post-merge alert closure. The seven GitHub Dependabot alerts remain pending confirmation after integration. No OAuth/account, community, QQ, or TIM action was performed.
