# Dependency security remediation — Run95, 2026-10-26

Base: `aafcd0d4005c7bcbf61c0d6b46f213a6f7be947a` (A1 evidence PR277 integrated).
This is source security maintenance; no Bangumi/OAuth/account requests, private
payloads, model calls, QQ/TIM messages, production deployment or service restart.
OP-009 stays PARTIAL.

## Evidence and dependency paths

The earlier same-day snapshot had eight GitHub alerts. The fresh pre-edit
GitHub read now reports **23 open alerts / 17 distinct GHSA**, including newly
indexed Zod, Vite, mocker, Fastify and fast-uri entries. The original seven
alerts #21–27 were fixed by PR151 and remain dated history. The separate
same-lock official npm baseline has **24 advisory entries / 20 distinct GHSA**:
5 high, 13 moderate, 6 low. These are separate counting planes, not additive.

[before-github-alerts.json](run95-dependency-security-remediation-2026-10-26/before-github-alerts.json)
is the sanitized read-only API snapshot. The official npm
[baseline](run95-dependency-security-remediation-2026-10-26/before-official-npm-audit.json)
contains only advisory metadata, no local paths or runtime state. The default
registry lacks an audit endpoint; only explicit registry.npmjs.org audit is used.

`pnpm -r why` confirmed these actual paths before editing:

- Root/MCP SDK → Hono; SDK → Express → body-parser;
  SDK → express-rate-limit → ip-address; SDK/AJV → fast-uri 3.
- API/Standalone → Fastify → AJV compiler and fast-json-stringify → fast-uri 3/4.
- Tools/MCP/Standalone/root → Zod 4.4.3. Manifests also allowed vulnerable Zod3.
- Root Vitest → @vitest/mocker; root/Vitest/mocker → Vite.

## Selected fixes

| Family | Previously installed | Minimum patched | Resolved by the new lock |
| --- | --- | --- | --- |
| MCP SDK | 1.31.0 | 1.32.0 | 1.32.2 |
| Hono | 4.13.8 | 4.13.11 | 4.13.11 |
| Vite | 7.3.6 | 7.3.7 | 7.3.7 |
| Vitest / mocker | 4.1.11 | 4.1.12 | 4.1.12 |
| Fastify | 5.12.5 | 5.12.6 | 5.12.7 |
| ip-address | 10.7.2 | 10.7.4 | 10.7.4 |
| Zod | 4.4.3 | 4.6.6 | 4.6.7 |
| body-parser | 2.3.0 | 2.4.0 | 2.4.0 |
| fast-uri 3 / 4 | 3.1.8 / 4.2.1 | 3.1.9 / 4.2.3 | 3.1.9 / 4.2.3 |

Direct manifests set the fixed compatible minimum. Zod dependencies now require
4.6.6 or later instead of accepting unpatched 3.x; the old installed runtime
was already Zod4. Narrow major-specific overrides fix transitive Hono,
ip-address, body-parser and fast-uri. The existing unused fast-uri2 override
is also moved from vulnerable 2.4.5 to patched 2.4.8. Other unrelated overrides,
versions and platform metadata are retained. Registry deprecation/libc metadata
drift for unchanged package versions was removed; frozen install succeeded.

The SDK memory advisory
[GHSA-46jr-4wx8-v453](https://github.com/advisories/GHSA-46jr-4wx8-v453)
requires an opt-in element cap when using high-level `McpServer` over HTTP;
upgrading alone does not enable it. This repository's `apps/mcp/src/server.ts`
uses the low-level `Server`, with `StdioServerTransport` in `stdio.ts`, and has
no SDK Streamable HTTP/SSE entry. The advisory explicitly excludes stdio-only
servers. We do not claim an HTTP deployment was protected or tested, nor enable
one. Any future high-level HTTP MCP entry must configure argument-element and
request-byte limits before exposure. Current application auth/identity controls
are unchanged. Zod's separate oversized-validation fix is present in all current
workspace resolutions.

## Historical A1 versus current checkout

The six original receipt files, derived manifest, source inventory and production
consumer are unchanged. The completed e081 A1 success (two real MCP reads/two
HTTP requests/two rows) remains historical evidence; the deployed runtime is
still the e081 image. No OAuth/A1 replay is permitted.

Changing the dependency lock and relevant manifests deliberately invalidates
current-checkout account credit. The generated table therefore returns to
**0/33 current-source account cells, 33 pending**, while the historical two
successes remain documented. The independent checker still rejects stale
checkmarks. Public 65/65 bounded, denial22/22, Agent86/96, QQ/TIM0/96 and all
frozen profiles/design baselines are preserved.

The old Python test fixture copied the current checkout as if it were the
executed source. Upgrading reproduced five failing assertions. Fixtures now
read the pinned historical Git blobs, keeping positive historical validation
independent of the new graph. The additional dependency HEAD/disk drift case
and actual current-checkout case verify rejection without relaxing production
hashes. **20 focused offline tests pass**. The TS integration test separately
retains the original success facts and checks that no current auth cell borrows
that report after the lock changes.

## Validation and integration status

`pnpm install --frozen-lockfile --registry=https://registry.npmjs.org` passed.
The official post-resolution audit returned zero advisories at this snapshot:
[after-official-npm-audit.json](run95-dependency-security-remediation-2026-10-26/after-official-npm-audit.json).
No advisories were muted or dismissed. This is not a perpetual security guarantee
or proof of production rollout. Local validation passed: `pnpm typecheck`, `pnpm lint`, unit/render **144 files /
1077 tests** (existing one file/two tests skipped), acceptance **317 existing +
20 A1 tests**, and final focused integration **23/23**. The first full SQLite
integration pass had 122 passes, one existing skip and four failures: three
read the old generated table before generation completed, and the fourth was
the Zod primitive-union notation change. After generation, the 18 matrix tests
passed; a narrow recursive equivalence in the catalog test then passed all 96
schemas with a regression that retains constraints and nontrivial branches.
No production schema converter or frozen catalog was changed. The other 22
integration files passed unchanged. Exact-head CI and normal comprehensive
Product review remain required before integration;
GitHub default-branch alerts require a fresh post-merge read before task closure.

## Official advisory inventory

| Package | npm severity | Fixed range | Advisory |
| --- | --- | --- | --- |
| `hono` | moderate | `>=4.13.11` | [GHSA-5r4p-p66f-jhc7](https://github.com/advisories/GHSA-5r4p-p66f-jhc7) |
| `vite` | moderate | `>=7.3.7` | [GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv) |
| `@modelcontextprotocol/sdk` | high | `>=1.32.0` | [GHSA-22jm-h49p-29qw](https://github.com/advisories/GHSA-22jm-h49p-29qw) |
| `@modelcontextprotocol/sdk` | moderate | `>=1.32.0` | [GHSA-6prh-2h8m-c8cw](https://github.com/advisories/GHSA-6prh-2h8m-c8cw) |
| `@modelcontextprotocol/sdk` | high | `>=1.32.0` | [GHSA-46jr-4wx8-v453](https://github.com/advisories/GHSA-46jr-4wx8-v453) |
| `vite` | moderate | `>=7.3.7` | [GHSA-r825-w8mm-5pxw](https://github.com/advisories/GHSA-r825-w8mm-5pxw) |
| `vite` | high | `>=7.3.7` | [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm) |
| `@modelcontextprotocol/sdk` | moderate | `>=1.32.0` | [GHSA-rvq5-wwqv-78pq](https://github.com/advisories/GHSA-rvq5-wwqv-78pq) |
| `vite` | low | `>=7.3.7` | [GHSA-9jrq-w75r-8gcw](https://github.com/advisories/GHSA-9jrq-w75r-8gcw) |
| `vite` | moderate | `>=7.3.7` | [GHSA-rq7h-c2jc-7f22](https://github.com/advisories/GHSA-rq7h-c2jc-7f22) |
| `@vitest/mocker` | moderate | `>=4.1.12` | [GHSA-qxg6-89mg-rqv8](https://github.com/advisories/GHSA-qxg6-89mg-rqv8) |
| `@vitest/mocker` | moderate | `>=4.1.12` | [GHSA-xp26-3454-mjgp](https://github.com/advisories/GHSA-xp26-3454-mjgp) |
| `fastify` | low | `>=5.12.6` | [GHSA-389g-gv7q-r4x8](https://github.com/advisories/GHSA-389g-gv7q-r4x8) |
| `ip-address` | moderate | `>=10.7.4` | [GHSA-rxp7-6hxx-x8q5](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5) |
| `zod` | high | `>=4.6.6` | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) |
| `body-parser` | high | `>=2.4.0` | [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828) |
| `fast-uri` | moderate | `>=4.2.3` | [GHSA-w74x-v6f9-j3xg](https://github.com/advisories/GHSA-w74x-v6f9-j3xg) |
| `fast-uri` | low | `>=4.2.3` | [GHSA-xhq7-xmqj-769h](https://github.com/advisories/GHSA-xhq7-xmqj-769h) |
| `fast-uri` | moderate | `>=4.2.3` | [GHSA-wjr9-j795-jxcr](https://github.com/advisories/GHSA-wjr9-j795-jxcr) |
| `fast-uri` | low | `>=4.2.3` | [GHSA-333x-w4r6-6crp](https://github.com/advisories/GHSA-333x-w4r6-6crp) |

Snapshot prepared 2026-10-26T09:25:07.890460+00:00.
