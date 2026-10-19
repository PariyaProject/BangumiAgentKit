# Run #95 — G14 discovery-results renderer visual polish

Date: 2026-10-19. Harness Epoch: run95-g14-discovery-results-visual-polish-20261019.

## Scope and evidence boundary

This Epoch changes only the user-facing discovery-results Renderer and its offline regression fixtures. It makes no query_subjects or render_query_subjects tool call, public API request, OAuth/account action, QQ/TIM delivery, or Agent/MCP profile claim. The synthetic matrix earns no acceptance credit. G14 stays PARTIAL because a bounded search and exhausted one-shot profile do not establish annual ranking or catalog completeness.

The matrix uses 13 deterministic synthetic rows (12 shown, one disclosed as hidden) and a displayed query limit of 13, one repository-local synthetic poster, and missing-cover fallbacks for the other rows. It renders complete and partial states at 320, 360, 520, 640, and 960 CSS px. Each Base and Candidate matrix used 10 mocked local asset resolutions and zero external requests. Browser layout checks passed for all 10 state/width pairs.

- Base commit: f0175db0a8b5304be9e2ec6fe9ec0de2db29b2c0; renderer blob 0774af8d6f4d1a4d6259bbf813b27fb5af7aefe7; source SHA-256 be26e3bad8c9fce0e1ee2c7dce5ab518b250b5041fc4fcf6be6a36d821d9ee95.
- Candidate renderer source blob: dea2d5095f35183a2f0f0eafee7364f8bedcafbe; source SHA-256 b673cacf8221f2474b32ad70d4046f1c80d59cce4ac50f5a6071b700b34ee214.
- Visual fixture and matrix test: tests/render/discovery-results.test.ts; SHA-256 0e3066a3487e49ea0265b87c104a99276c75c5bcda8b21a7fe4611ac6a7334b7.
- Base image directory: .artifacts/render/discovery-results-visual-polish-base-r2-f0175db/ (ignored local artifacts).
- Candidate image directory: .artifacts/render/discovery-results-visual-polish-candidate-r2-f0175db/ (ignored local artifacts).

All 10 Base PNGs and all 10 Candidate PNGs from this corrected matrix were opened individually and compared by matching state and width. The query limit shown in each image is 13, matching the 13 returned rows; the renderer visibly presents 12 and discloses one hidden row. None showed clipping, overlap, or horizontal spill. Both manifests record 10 local mocked asset resolutions and zero external requests; every manifest dimension, byte length, and SHA-256 is recorded below.

## Change and user-visible result

The card keeps the query facets, coverage counts, total kind, result order, 12 visible rows, hidden-row disclosure, titles, dates, scores, rating counts, collection totals, synthetic poster, and missing-cover fallback. It adds the subject ID on the existing metadata line, following the useful identity cue in the historical search journeys.

The image no longer shows internal planner operation names, source route identifiers, or retrieval timestamps. It presents concise Chinese coverage notes, distinguishes matched-but-not-returned output-cap rows from returned-but-not-rendered rows, and uses a safe fallback for unknown technical reasons. Duplicate execution-budget, hydration-budget, output-cap, and unresolved-field warnings are suppressed only when the corresponding coverage note already states that condition. When execution-budget exhaustion is already explained in the coverage note, the generic bounded-budget limitation is also hidden from the image while remaining in the structured ViewModel. Full plan, source, retrieval time, warning, limitation, and exact reason remain in structured output; no diagnostic evidence was deleted.

## Review round 1 corrections

- Output-cap and unresolved-only warning codes are suppressed from the image only when the exact matching coverage reason is already shown; the structured warnings remain in the ViewModel. The output-cap wording now distinguishes matched rows omitted by the engine from returned rows hidden by the card renderer.
- The 13-row visual fixtures and query facet both use an upper limit of 13. A separate engine-shaped output-cap regression covers 13 matches, 12 returned rows, the 12-row output cap, and its duplicate warning.
- The C++ comparison now follows the pinned `BangumiSubject::SearchGet` search response rather than the subject-detail response.

## Review round 2 correction

- The generic limitation `结果受有界预算限制。` is filtered from the image only when `coverage.budgetExceeded` is true; the underlying ViewModel still retains it. The five partial Candidate images were regenerated and individually compared against the exact-Base images.
- Legacy reason text `Output cap was reached.` now follows the same warning-deduplication path as canonical `output_cap`, with a regression for its single coverage statement.

## Image-by-image receipt

Each Base/Candidate cell lists width×height, PNG bytes, and SHA-256. Height delta is Candidate minus Base.

| State    | Width | Exact Base receipt                                                                   | Exact Candidate receipt                                                              | Height Δ | Candidate image observation                                                                                                                                          |
| -------- | ----: | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | -------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| complete |   320 | 320×2836 / 215178 / d62e43b3b636477bdc595095c7eefaf43842f4a9f2eba94dbbb15f7dfff251d0 | 320×2666 / 196670 / f98dd8ddd068129922cd1fb8b288a03ec7087c9b777ce20ad4b15aea7e8125ef |     -170 | The displayed limit matches 13 returned rows; the local cover and 11 fallback covers render, the long CJK title wraps, and one row is disclosed as hidden.           |
| complete |   360 | 360×2769 / 217075 / 001fae8354939dd79daa18860f83e551d4bafb8e9ec60dce37f64f5fcf9a3d03 | 360×2448 / 195649 / 502852708a8817bde67718e07d1951daecd05347eb06598fa4c7a8423859dde0 |     -321 | Filter chips and ID/date metadata wrap safely; the poster, bilingual title, score, and rating count remain readable.                                                 |
| complete |   520 | 520×2429 / 217094 / 3f40e773c9b3e715adcdf40468889f5422eea095c9e8702b25ce90a316f1a228 | 520×2155 / 196043 / 841360758e6adae241160dc49e2b6aabd13a47ecbb879bb2b8bbfbccf9850e48 |     -274 | Poster-first rows keep the title and facts grouped; all 12 visible rows fit without horizontal spill.                                                                |
| complete |   640 | 640×2399 / 224885 / cd274861ed37ac9b7173f6b671b7a5fbe6cce665b43e03864b4928ad7d7afcd3 | 640×2126 / 203872 / 73c0d4aaf7468493a5edb3e2593676d78c2239b9268519955508f6144091799f |     -273 | The one-column layout keeps IDs and displayed facts inside the canvas.                                                                                               |
| complete |   960 | 960×1569 / 181589 / 3ff53f829fec3ba4cbd773eaf7ed176161667956a2ac10543b76512bb8feeeee | 960×1314 / 160468 / 43decff9236faa81e346f2a2daed58b2ac84458943fdd2504603f5bd3005bd3f |     -255 | The two-column layout preserves row order, poster/title hierarchy, and visible subject IDs.                                                                          |
| partial  |   320 | 320×3104 / 247197 / 0bf90c07358915d8394675f17ce59d3e4bce83949abb776cf2667ac7d4e81520 | 320×2844 / 218698 / df4c79f89ab0fb50f0a8dabe65e89363f107bc9acd70dfb9cb430b05893888e2 |     -260 | The localized coverage note explains the execution limit once; the independent unresolved-field warning remains visible, and the long CJK title wraps without spill. |
| partial  |   360 | 360×3018 / 247767 / 856cf42e7a972172983b63b5ac8186c8bc223972b435facf292e3c7708be9771 | 360×2625 / 217110 / 4a8ea6a6a3bf0832971f5deca1e85609ece5d4cb4942ed55ab81a03fea609ca9 |     -393 | The budget condition appears once; the separate unresolved warning and remaining source/coverage limits stay legible as row facts wrap.                              |
| partial  |   520 | 520×2641 / 248993 / 20efc7d1350e7cc69231bcece2a77d58a71f39d53035b988f699e21e25d10150 | 520×2277 / 217375 / 8063099bf37fc9f619f914ef01d284c9388d60eb662883e335652aeb7f13ef7a |     -364 | Coverage, the one execution-limit note, unresolved warning, and result cards remain distinct with no horizontal spill.                                               |
| partial  |   640 | 640×2575 / 255853 / 887fcdc3ba66f08a2993c563a1f87cddcab8bd9c174ad4ee9a6b9c89de5ce584 | 640×2229 / 225383 / 3e47d9e423af44d56f4205e013e096fd0ce4cc55e43c289b444ae788c3d4a40f |     -346 | The partial notice stays above the 12-row list; the duplicated generic budget limitation is absent and IDs/card facts do not overlap.                                |
| partial  |   960 | 960×1707 / 213320 / 0a2bb549a7280225c279e8b3b0fa92527cc970504fd6b30d22cf78f4d9d2f95e | 960×1417 / 182808 / 5cf16b96db51994603455f9d9df654bf84f7aba332407d1ac6e69cb3958750dd |     -290 | The two-column partial list preserves the coverage note, unresolved warning, and visible fact hierarchy without clipping or horizontal spill.                        |

## Historical journey comparison

At the pinned Bangumi-for-QQ source (https://github.com/Kurarion/Bangumi-for-QQ/tree/b44d493dd6f5044d6fe305292016908ae15ef933), the search response uses an overall match count, numbered results, cover, Chinese/original titles, media type and subject ID, and a subject link. The pinned Bangumi-QQ-Bot-CPP search path is `BangumiSubject::SearchGet` (https://github.com/Kurarion/Bangumi-QQ-Bot-CPP/blob/f1c75bc366755d8bd7bf35ee5c11b513cb066f8e/cc.sirokuma.Bangumi/Bangumi.h#L465-L487): it formats each numbered result with native cover, Chinese/original titles, broadcast date, type and ID, rank, score and rating count, and the subject URL. Both are message journeys with links; the Candidate is a raster image and cannot make its subject ID clickable.

The Candidate retains a visible cover/title/facts hierarchy, adds the subject ID, and provides clearer bounded-coverage wording in narrow layouts. This is a comparison of selected user-visible elements only; it does not establish whole-project superiority or real QQ/TIM delivery.

## Validation commands

- pnpm exec vitest run tests/render/discovery-results.test.ts — 16 passed; one opt-in image-matrix test skipped by default.
- `BANGUMI_DISCOVERY_VISUAL_QA_DIR=.artifacts/render/discovery-results-visual-polish-candidate-r2-f0175db pnpm exec vitest run tests/render/discovery-results.test.ts -t 'renders complete and partial synthetic states at every target width with PNG receipts'` — 10 PNGs, layout checks 10/10, 10 mocked assets, zero external requests.
- Exact Base used the same updated opt-in fixture with the Base `DiscoveryResultsCard.tsx` blob loaded from f0175db; the Candidate source was restored after generation. Both r2 matrices used query limit 13 and the same rows and widths. All 20 PNGs were opened individually and compared by state/width; every manifest receipt matches this table.
- `pnpm typecheck`, targeted ESLint, Prettier checks for the changed TS/TSX/Markdown files, and `git diff --check` — PASS.
- `pnpm harness frontier:check` — `FRONTIER_LEDGER_VALID`, 121 records and 96 actionable; G14 remains PARTIAL.
