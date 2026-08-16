# BangumiAgentKit Secure Renderer Architecture

`packages/renderer` provides a secure, deterministic, static image card rendering service for Bangumi domain objects.

## Architecture

```text
Bangumi Semantic Result (Core)
        ↓
ViewModel Builder
        ↓
Versioned RenderViewModel
        ↓
AssetResolver (Node-side DNS + IP filter + fetch + sharp decode)
        ↓
Base64 Data URLs (Zero browser network)
        ↓
React Static HTML (ReactDOMServer.renderToStaticMarkup)
        ↓
Network-Isolated Chromium (BrowserPool: route abort, JS disabled, CSP header)
        ↓
Element Screenshot ([data-render-root])
        ↓
PNG Buffer + RenderResult Metadata
```

## Security & Isolation Layers

1. **Strict Input Boundary**:
   - `RenderService` only accepts versioned `RenderViewModel` objects.
   - Arbitrary HTML, CSS, or script string injection from callers is forbidden.

2. **XSS Mitigation**:
   - Templates are built exclusively using React components (`ReactDOMServer.renderToStaticMarkup`).
   - `dangerouslySetInnerHTML` and `innerHTML` are strictly banned in templates.
   - HTML documents are wrapped with a strict Content Security Policy meta header (`default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; script-src 'none';`).

3. **Multi-layer SSRF Defense (AssetResolver)**:
   - **Protocol Enforcement**: Only `http:` and `https:` schemes allowed. URL credentials/userinfo (`http://user:pass@host`) rejected.
   - **IP Classification**: Using `node:net` and `node:dns/promises` to check resolved IPs against CIDR blocklists (loopback, private IPv4/v6, carrier-grade NAT, cloud metadata `169.254.169.254`, `metadata.google.internal`).
   - **Redirect Handling**: `redirect: 'manual'` with up to 3 redirects, re-evaluating protocol, DNS, and IP policies at every hop.
   - **Streaming Byte Limits**: Max 5MB response payload limit enforced during stream reading; aborts immediately if exceeded.
   - **Format Validation**: Decoded via `sharp` into PNG/WebP base64 data URLs. SVGs and non-image content are rejected.
   - **Graceful Failure**: Asset fetch failures fall back to inline placeholder images without aborting the card render.

4. **Browser Isolation (BrowserPool)**:
   - Chromium instance launched with security flags (`--no-sandbox`, `--disable-setuid-sandbox`, `--disable-gpu`, `--disable-dev-shm-usage`).
   - Ephemeral `BrowserContext` created per render request with `javaScriptEnabled: false` and `serviceWorkers: 'block'`.
   - Playwright route interception (`context.route('**/*', route => route.abort())`) aborts any browser network request.

## Caching & Concurrency

- **Bounded Concurrency**: Managed by `BrowserPool` with configurable limit (`RENDERER_MAX_CONCURRENCY`, default 2–4).
- **Render Cache**: Bounded LRU cache in `RenderService` keyed by canonical JSON hash of `RenderViewModel` + options.
- **Render Timeout**: Configurable per-render timeout (`RENDERER_TIMEOUT_MS`, default 5000–10000ms).

## Template Registry & Error Model

The `TemplateRegistry` maps `RenderViewModel['template']` to React card templates
(`subject-card`, `subject-overview`, `subject-stats`, `search-list`, `discovery-results`, `cast-card`,
`collection-progress`, `collection-intelligence`, `collection-backlog`,
`collection-schedule`, `collection-dashboard`, `calendar`,
`revision-timeline`, `person-profile`, `person-activity`, and `subject-comparison`).
It also includes `series-relations` for bounded Series / Watch-Order evidence.

`subject-comparison` is an image-free, read-only companion card for
`bangumi.get_subject_comparison`. It renders exactly two known subjects side by side,
keeps per-subject coverage, source states, bounded limits, truncation, warnings, and
limitations visible, and shows only deterministic numeric deltas using `B − A`. The
official-v0 and derived-s7 source channels remain separate. Score deltas use one decimal
place; episode, rank, and count deltas use integer precision. Unknown, partial,
unavailable, conflict, and capped values remain explicit, including both conflict
candidates; the card never labels a winner or recommendation and does not fetch network
assets. It also shows shared voice actors and production staff by stable person ID,
preserving the two sides' character names and raw role labels. Shared-person sections
remain explicitly partial or unavailable when either bounded credit source is incomplete;
an empty complete intersection is the only state that supports a “no overlap observed”
reading.

`subject-stats` is an image-free, read-only companion card for
`bangumi.get_subject_stats_intelligence`. It keeps the official v0 rating
histogram and collection buckets next to derived-s7 percentages, histogram
mean, population standard deviation, and completion rate. Formula IDs and
versions, source operations, coverage, conflict candidates, warnings, and
limitations remain visible. Zero populations show `not_computable`; unavailable
and not-found results do not receive invented metrics. The card never fetches
image assets or turns dispersion into a recommendation, quality, community, or
historical claim.

`collection-intelligence` is an image-free, authenticated companion card for
`bangumi.get_collection_intelligence`. It shows only deterministic aggregates
from the current account's bounded official-v0 collection scan. The card
labels source coverage, partial/unavailable states, the versioned formula, and
the fact that “recent updates” are only within the observed sample; it never
renders collection comments or claims a historical trend.

`collection-backlog` is an image-free, authenticated companion card for
`bangumi.get_collection_backlog`. It reads only the current account's bounded
official-v0 animation collection and main-episode progress, and shows source
order, known remaining episodes, completion percentages, per-row airing
finished/ongoing/unknown evidence, unavailable or conflict states, hydration
limits, and the versioned derivation. The episode collection sourceTotal is the
denominator when it is a valid, complete source; SlimSubject.eps keeps its raw
value and validity, and malformed or conflicting evidence is surfaced as a
conflict. A finished airing label means only that every currently reported,
complete, unique main episode has a past structured airdate; it does not prove
that no later episode or hiatus exists. Duplicate, non-main, missing-ID,
missing/malformed-date, changed-total, or incomplete evidence remains unknown.
Auth, permission, and per-row recovery failures keep their code, message, and
next action visible in the card. It does not resolve cover assets, render
comments, join the calendar, or turn missing episode totals into estimates.

`collection-schedule` is an image-free, authenticated companion card for
`bangumi.get_collection_schedule`. It joins the official seven-day legacy
calendar to the current account's bounded animation collection by subject ID,
keeps unmatched rows and collection-envelope progress evidence visible, and
labels pagination, source failure, auth, duplicate, conflict, and unknown
states. Unmatched rows distinguish a complete-scan absence from a filtered
status, malformed collection status, or incomplete source observation. It does not infer an airing time,
timezone, episode-level completion, history, or recommendation, and it never
renders collection comments.

`collection-dashboard` is an image-free, authenticated companion card for
`bangumi.get_collection_dashboard`. It presents the current-account
collection-intelligence, backlog, and seven-day collection schedule sections in
one bounded private result while preserving each section's state, coverage,
warnings, source evidence, and retrieval time. The composition exposes its
aggregate collection-row, episode-row, calendar-row, output-row, and
concurrency bounds; it does not create a transactionally consistent snapshot,
resolve cover assets, enter shared caches, or place artifacts outside the
current principal's private ArtifactStore scope; it also does not read comments,
infer taste/history, recommend items, or perform writes. At narrow widths the sections stack
vertically so the answer remains scannable without horizontal scrolling.

`series-relations` is the bounded Series / Watch-Order companion card. It shows
the selected steps separately from directed relation evidence, preserves raw
labels and exclusion reasons, and reports depth, anime-node, non-anime, edge,
failure, and truncation coverage. The renderer caps visible steps, related
evidence, and edges and marks an otherwise complete model partial when those
display caps hide data. Caller-created oversized models receive explicit
`coverage.renderedOmitted` counts, renderer truncation reasons, and a warning
that names each omitted category. Edge evidence uses compact single-line rows
and a two-column layout at wider widths so the valid 64-edge boundary remains
truthful without producing an unnecessarily tall chat/mobile artifact.
Representative QA must include 640px and 960px widths, CJK text, missing images,
conflicts, partial failures, and a non-computable non-anime root.

The `discovery-results` card is the human-facing companion to
`bangumi.query_subjects`: it preserves controlled query facets, official
source/operation, pushdown versus local plan filters, matched/observed/returned/
rendered coverage, warnings, and bounded-result limitations. It does not claim
that an experimental or budget-bounded search enumerates the complete Bangumi
database.

The `person-activity` card is the image-free companion to
`bangumi.get_person_activity`. It presents a bounded person-to-work activity
window using official person relations plus bounded subject hydration. The
window is assigned by `first_air_date` to calendar months, with explicit
TV-platform, role-family, missing-date, detail-cap, and exclusion evidence.
When a relation or detail budget is reached, selection is a deterministic
even-spread sample over the official relation response order rather than an
ID-ordered prefix; the card reports observed, selected, hydrated, and omitted
IDs and marks the result partial. It preserves partial, unavailable, and
not-computable states, reports the relation/detail/output budgets, and does not
infer labor time, historical trend, popularity, income, or recommendations.
Narrow layouts keep the summary and visible rows readable while reporting
hidden rows separately, including the requested person ID when person detail
hydration fails.

All operations use structured `RendererError` types:

- `RENDER_VALIDATION_ERROR`
- `RENDER_TEMPLATE_NOT_FOUND`
- `RENDER_TIMEOUT`
- `RENDER_BROWSER_ERROR`
- `RENDER_OUTPUT_TOO_LARGE`
- `ASSET_URL_BLOCKED`
- `ASSET_FETCH_FAILED`
- `ASSET_TOO_LARGE`
- `ASSET_INVALID_IMAGE`
- `RENDERER_CLOSED`
