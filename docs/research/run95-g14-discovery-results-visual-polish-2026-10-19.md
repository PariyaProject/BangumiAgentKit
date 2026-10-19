# Run #95 — G14 discovery-results renderer visual polish

Date: 2026-10-19. Harness Epoch: run95-g14-discovery-results-visual-polish-20261019.

## Scope and evidence boundary

This Epoch changes only the user-facing discovery-results Renderer and its offline regression fixtures. It makes no query_subjects or render_query_subjects tool call, public API request, OAuth/account action, QQ/TIM delivery, or Agent/MCP profile claim. The synthetic matrix earns no acceptance credit. G14 stays PARTIAL because a bounded search and exhausted one-shot profile do not establish annual ranking or catalog completeness.

The matrix uses 13 deterministic synthetic rows (12 shown, one disclosed as hidden), one repository-local synthetic poster, and missing-cover fallbacks for the other rows. It renders complete and partial states at 320, 360, 520, 640, and 960 CSS px. Each Base and Candidate matrix used 10 mocked local asset resolutions and zero external requests. Browser layout checks passed for all 10 state/width pairs.

- Base commit: f0175db0a8b5304be9e2ec6fe9ec0de2db29b2c0; renderer blob 0774af8d6f4d1a4d6259bbf813b27fb5af7aefe7; source SHA-256 be26e3bad8c9fce0e1ee2c7dce5ab518b250b5041fc4fcf6be6a36d821d9ee95.
- Candidate renderer source blob: 7f29aa7d7cdc69bd157174cf6683feb63a212d5b; source SHA-256 b50799e641bf366be95b9cca34b780e74f3c46a40caa15da72d98e771ae8779f.
- Visual fixture and matrix test: tests/render/discovery-results.test.ts; SHA-256 8c072a80820892b347962b0c8e889402b5799bfa40e8946176954b4014c48c93.
- Base image directory: .artifacts/render/discovery-results-visual-polish-base-f0175db/ (ignored local artifacts).
- Candidate image directory: .artifacts/render/discovery-results-visual-polish-candidate-f0175db/ (ignored local artifacts).

All 10 final Base PNGs and all 10 Candidate PNGs were opened individually. Each Candidate was compared with the same state and width on Base. The five complete-state images were reopened after correcting the complete synthetic fixture to remove an inconsistent estimated-total limitation; the partial-state image hashes did not change and remain the individually reviewed files. None showed clipping, overlap, or horizontal spill.

## Change and user-visible result

The card keeps the query facets, coverage counts, total kind, result order, 12 visible rows, hidden-row disclosure, titles, dates, scores, rating counts, collection totals, synthetic poster, and missing-cover fallback. It adds the subject ID on the existing metadata line, following the useful identity cue in the historical search journeys.

The image no longer shows internal planner operation names, source route identifiers, or retrieval timestamps. It presents a concise Chinese coverage note, localizes known execution/hydration reasons, and uses a safe fallback for unknown technical reasons. Duplicate budget warnings are suppressed when the coverage summary already says the same thing. Full plan, source, retrieval time, warning, limitation, and exact reason remain in the structured ViewModel; no diagnostic evidence was deleted.

## Image-by-image receipt

Each Base/Candidate cell lists width×height, PNG bytes, and SHA-256. Height delta is Candidate minus Base.

| State    | Width | Exact Base receipt                                                                   | Exact Candidate receipt                                                              | Height Δ | Candidate image observation                                                                                                                     |
| -------- | ----: | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | -------: | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| complete |   320 | 320×2836 / 215278 / 036c133ca444e940d56a7c23fb611fc9c65d35b9d2bbb7d6379a5858f02a5bbf | 320×2666 / 196671 / 9176768010486956ce1321a87f4b9bb1c2c2df7107ea2d3ef043359b23d61854 |     -170 | 12 rows remain; the local synthetic poster is visible, other rows use the missing-cover fallback, and the long CJK title wraps inside its card. |
| complete |   360 | 360×2769 / 217180 / 7dfac3d3798f9e2ee66049a3bd1657ed48587c76f58a2542a750554881f0e2a6 | 360×2448 / 195651 / 28d44cb3165d73d26d68ce626a080b9c98b93696f6f2f5dfa3e82c4dbbdbdbd4 |     -321 | Filter chips and the ID/date line wrap safely; the poster, bilingual title, score, and rating count remain readable.                            |
| complete |   520 | 520×2429 / 217085 / a982abfea4445c8f5d6b4e84de487253fcdbed9aee258736f3a5619a38c73ed5 | 520×2155 / 196043 / 39b10c952f2b71bafd82bc420a93069a05aad4fe001c4338a13cc083daccc2e6 |     -274 | Poster-first card and facts stay grouped; no horizontal spill.                                                                                  |
| complete |   640 | 640×2399 / 224877 / 8220fd7c75902a42ce9beb0df051437a14ca6ff046d4458352f404eb88887dd3 | 640×2126 / 203874 / f83e025f9790b2e1d445f3e11ef7725a061ea46091336ba19fc981682c5d7efc |     -273 | One-column layout remains balanced; IDs and all displayed facts stay inside the canvas.                                                         |
| complete |   960 | 960×1569 / 181573 / 07fb3d132a2b39aaafef8d20c3501ae46df1b4ab26af1a8dea676016f03b16ce | 960×1314 / 160462 / d466aace89aae76fbc490c51d4a9fe0264a3639ce5475cdcdc1015e370b538a7 |     -255 | Two-column cards retain the poster/title hierarchy and the visible subject ID; no overlap.                                                      |
| partial  |   320 | 320×3104 / 248057 / cfbd2d1fbff642c7ba671d4eac565a3a26847074ed34ceaa1ed659a81c62f90a | 320×2844 / 220016 / 554a632249c909de60486d3be1e797e8d21a5593ed0ba4131b77b61951a9d389 |     -260 | Localized scope note and unresolved-field warning appear before results; English execution text and planner details are absent.                 |
| partial  |   360 | 360×3018 / 248854 / 197c5551dbe866075ada6eff379576077611636ff7312062670e7f611c29f816 | 360×2644 / 217950 / 4beb7ef7503c6c20dacd1a4b8590d06d00f4843c80c979e3661a5eb0d1c92c80 |     -374 | Partial state stays distinct; the scope and warning lines wrap without clipping.                                                                |
| partial  |   520 | 520×2641 / 249980 / a74cfce2bae46948d66a3e99f26ff2b59e936ae5a35bc7d2f3465008e13a4ff8 | 520×2277 / 218761 / e686940c9357180f291fb7250aa9a0807247d85f46dcb9cc7ce4505552fa4bd1 |     -364 | Coverage counts, uncertainty, and results stay visually separated; no horizontal spill.                                                         |
| partial  |   640 | 640×2575 / 257042 / 1a793321683d9ea40f8af3df1921196c7b7a1b26f3a79b876c6d88ef5798525c | 640×2229 / 226601 / 1a947249ebcfea9250717ee15192cb1ea4c2ef6033542fa228c2294abb351e30 |     -346 | The partial warning remains visible above the 12-row list; card facts do not overlap.                                                           |
| partial  |   960 | 960×1707 / 214232 / 0d537c291cb292d6504a63b5231fcf5b80b34c79dd2e19cbd2f54a414c084245 | 960×1417 / 183991 / 144a3374aa0d26580d14e80b0b84bc1e7739a83dae19c35bd9f329977baff3fd |     -290 | Two-column partial results preserve the warning and visible ID/fact hierarchy without clipping.                                                 |

## Historical journey comparison

At the pinned Bangumi-for-QQ source (https://github.com/Kurarion/Bangumi-for-QQ/tree/b44d493dd6f5044d6fe305292016908ae15ef933), the search response uses an overall match count, numbered results, cover, Chinese/original titles, media type and subject ID, and a subject link. The pinned Bangumi-QQ-Bot-CPP source (https://github.com/Kurarion/Bangumi-QQ-Bot-CPP/tree/f1c75bc366755d8bd7bf35ee5c11b513cb066f8e) documents native cover delivery with title, summary, rating distribution, collection count, and a link in its subject response; that is a related message journey, not a one-to-one search image.

The Candidate retains a visible cover/title/facts hierarchy, adds the subject ID, and provides clearer bounded-coverage wording in narrow layouts. The raster image still cannot provide a clickable subject link. This is a comparison of selected user-visible elements only; it does not establish whole-project superiority or real QQ/TIM delivery.

## Validation commands

- pnpm exec vitest run tests/render/discovery-results.test.ts — 14 passed; optional image-matrix test skipped by default.
- BANGUMI_DISCOVERY_VISUAL_QA_DIR=.artifacts/render/discovery-results-visual-polish-candidate-f0175db pnpm exec vitest run tests/render/discovery-results.test.ts -t 'renders complete and partial synthetic states at every target width with PNG receipts' — 10 PNGs, layout checks 10/10, 10 mocked assets, zero external requests.
- Exact Base used the same opt-in matrix with the Base DiscoveryResultsCard.tsx blob loaded from f0175db; the Candidate file was restored after generation. The same Base/Candidate fixture and width set were used.
