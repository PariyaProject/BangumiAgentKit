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
(`subject-card`, `subject-overview`, `search-list`, `discovery-results`, `cast-card`,
`collection-progress`, `calendar`, `revision-timeline`, and `person-profile`).
It also includes `series-relations` for bounded Series / Watch-Order evidence.

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
