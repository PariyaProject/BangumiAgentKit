# ADR 005: Renderer Engine Technology Choice

## Status
Accepted

## Context
`packages/renderer` requires a deterministic, secure, and high-fidelity static image card rendering engine to convert Bangumi domain objects into rich PNG image cards. Key requirements include:
- Complex layout and formatting (CJK typography, flexbox, grid, badges, progress bars).
- Defense against XSS and remote image SSRF / DNS rebinding attacks.
- High performance rendering with browser process isolation and bounded resource consumption.
- Zero network requests inside browser contexts.

## Decision
We adopt **React SSR (`react-dom/server`) + Playwright Chromium**:

1. **React SSR (`ReactDOMServer.renderToStaticMarkup`)**:
   - Compiles strongly-typed TypeScript components into static HTML.
   - Automatically escapes all textual content node outputs, mitigating XSS by default.
   - Requires no client-side JavaScript execution or React hydration in the browser.

2. **Playwright Chromium**:
   - Provides native CSS Flexbox, Grid, CJK text, and subpixel rendering.
   - Enables network isolation (`javaScriptEnabled: false`, `context.route('**/*', route => route.abort())`).
   - Supports precise element-level screenshotting (`page.locator('[data-render-root]').screenshot()`).
   - Managed via a bounded `BrowserPool` sharing a long-lived Chromium process with ephemeral `BrowserContext` instances per render task.

## Rejected Alternatives

- **EJS / Pug / String Interpolation**: Higher risk of XSS escaping bugs, poor component encapsulation, lack of type safety for ViewModels.
- **Next.js / Vite SPA / Client Hydration**: Excessive build and runtime overhead for simple static image generation.
- **Node Canvas / SVG Generators**: Inferior CJK text layout, complex font rendering bugs, limited styling options compared to modern HTML/CSS.
- **Per-render Browser Launch**: High latency (~1s launch overhead per image); `BrowserPool` with isolated contexts is significantly faster (~30-50ms warm render).
