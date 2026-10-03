# Run 66 — advanced discovery source and scope audit

**Date:** 2026-10-03
**BangumiAgentKit master reviewed:** `d0d68db68e54c9d86ea192be3de11c0c04e76a35`
**Harness:** Run #66, Epoch `advanced-discovery-ranking`
**Purpose:** record current-source selection and evidence boundaries before product implementation. This note is not live query, OAuth, QQ, or TIM acceptance.

## Selection

Advance G02, G03, and G14 as one query capability: constrained official discovery with exact facet semantics, stable score ranking, bounded evidence, and a readable mobile result card. G02 and G03 exercise filters already represented in the current query contract; G14 reveals a concrete missing behavior because `query_subjects` has only one sort key and cannot express the requested rating-count tie-break.

The bounded variants are:

- **G02:** anime, 2024 air-date window, exact `异世界` tag, official `heat` order, top 10. In the upstream API, `heat` means collection count. The answer must describe current collection count, not discussion activity, historical popularity, or a complete list of all 2024 anime.
- **G03:** anime, a five-year half-open date window, score at least 8, exact `原创` meta-tag, rating count strictly greater than 5,000. Since rating count is an integer, the lower bound is 5,001. Keep unknown or absent concept evidence out of positive claims.
- **G14:** 2026 spring TV anime with exact `原创` meta-tag, score descending, and rating count descending for score ties. Keep upstream order as the final stable tie-break. Continue across pages until a lower-scored row proves the cutoff tie group; if page/candidate limits stop earlier, return partial coverage.

The work uses existing discovery/provider seams. It does not add a new source, scrape HTML, or create account/session behavior.

## Six-lane discovery comparison

1. **Recorded opportunities and deferred work.** Most OP-001–OP-012 entries are delivered or partial. OP-003 Community Discussion Spike and `SOURCE-COMMUNITY-STRUCTURED-WEB` remain `RESEARCH_READY`; their source contract is still incomplete. They do not authorize use of an undocumented endpoint or HTML fallback.
2. **Capability maturity and user journeys.** G02, G03, and G14 are high-value everyday discovery questions and are currently unassessed as end-to-end journeys. G01 was just queried/rendered and its caveats localized in the preceding merged Epoch, so it will not be repeated here.
3. **Agent UX and discoverability.** The current `bangumi.query_subjects` contract already names exact concepts and bounded filters, but the G14 ranking intent cannot be serialized. The Epoch tests the same query input through ToolRegistry/MCP and carries sort semantics into the result plan and image card.
4. **Renderer and Standalone quality.** The 360 CSS-pixel / 2x chat target and Chromium 320/360/520 checks are current. No new cross-template clipping defect is known. The G14 card still needs to show the secondary ordering and boundary caveat plainly; G02 must label “heat” as current collection count.
5. **Correctness, evidence, and bounds.** Official v0 search is explicitly experimental. The current compiler declares date, tag, meta-tag/concept, score, rating-count, and heat behavior; the engine bounds pages, candidates, hydrations, and returned items. A query result must not imply complete database enumeration.
6. **Architecture, maintenance, and testability.** Existing `DiscoveryEngine.query`, `SubjectDiscoveryProvider`, MCP ToolRegistry, and Renderer seams are sufficient. Adding one typed secondary key is smaller and safer than adding a new provider/service or private API. The selected tests cover the provider boundary, public tool schema/output, and rendered artifact.

## Source contract — selected official query path

The first-party [Bangumi server v0 OpenAPI](https://github.com/bangumi/server/blob/master/openapi/v0.yaml) describes `POST /v0/search/subjects` as experimental, documents `type`, `tag`, `air_date`, `rating`, `rating_count`, `rank`, and `nsfw` filters, and defines `heat` as 收藏人数. “Experimental” and its changeability must remain visible in response coverage; it is not a guarantee of a complete Bangumi-wide index.

The current project mapping agrees: `packages/discovery/src/capabilities.ts` marks date, exact tags/meta-tags/concepts, rating, rating count, and heat; `packages/discovery/src/query.ts` normalizes half-open date windows and bounded execution budgets; `packages/discovery/src/engine.ts` propagates coverage, warnings, evidence, and budget state. Existing golden planning fixtures already include G02 and G03; the missing G14 behavior is the score tie-break across a page boundary.

## Why community Structured Web is not the next implementation

The current first-party `/p1/openapi.json` returned HTTP 200 during this audit with title **`bangumi private api`** and version `2026-09-19-e170542`; community GET operations carry `CookiesSession`/`HTTPBearer` security metadata. This is a live schema observation, not an assertion that every endpoint requires login in every deployment, and it does not establish a public API contract.

The [current Bangumi developer platform page](https://bgm.tv/dev) promotes API and public archive access. The [developer agreement and copyright statement](https://bgm.tv/about/copyright) says developers should obtain data through API-provided interfaces and not use crawlers where collection may infringe Bangumi or user rights; it also says user-authored logs, comments, and images remain their authors’ content absent permission. The page says it was last updated on 2022-10-04. An anonymous GET of [robots.txt](https://bgm.tv/robots.txt) currently disallows `/pic/`, `/img/`, and `/js/`; that crawl file is not affirmative permission to retain or republish community content.

A metadata-only variant (counts, canonical links, page/time coverage; no post bodies, author profiling, cookies, or third-party redistribution) is still the only plausible salvage, but it needs first-party permission/contract and retention rules that were not established. Keep OP-003 and `SOURCE-COMMUNITY-STRUCTURED-WEB` research-ready; do not select `/p1` or HTML as a production provider or fallback.

## Test seams and evidence limits

The Epoch’s already-recorded acceptance criteria select these public seams:

- `DiscoveryEngine.query` with a provider-boundary fixture for cross-page ties and budget exhaustion;
- the exact `bangumi.query_subjects` schema/ToolRegistry output for deterministic filter and tie-break semantics;
- `bangumi.render_query_subjects` / `DiscoveryResultsCard` for the 360 CSS-pixel, 2x image plus 320/360/520 CSS-pixel overflow checks.

These fixtures prove behavior at those seams only. A separate current-source Antigravity→MCP probe is required for each of G02/G03/G14; Renderer fixture tests do not imply actual chat delivery. Account/OAuth and QQ/TIM remain separately tracked acceptance layers and are not part of this public, unauthenticated query contract.

## Primary references

- [Bangumi server v0 OpenAPI](https://github.com/bangumi/server/blob/master/openapi/v0.yaml)
- [Bangumi API repository](https://github.com/bangumi/api)
- [Bangumi developer platform](https://bgm.tv/dev)
- [Bangumi developer agreement and copyright statement](https://bgm.tv/about/copyright)
- [Bangumi robots.txt](https://bgm.tv/robots.txt)
- [First-party `/p1` OpenAPI JSON](https://next.bgm.tv/p1/openapi.json)
- Local scenarios: `docs/research/user-scenario-catalog.md` (G02/G03/G14)
- Local query contract: `packages/tools/src/definitions/discovery-tools.ts`, `packages/discovery/src/capabilities.ts`, `packages/discovery/src/query.ts`, `packages/discovery/src/engine.ts`
