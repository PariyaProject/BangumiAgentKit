# Run #95 UX-002 — default 0.75 render matrix visual QA

Date: 2026-10-22 (JST) | Epoch: `run95-ux002-compact-typography-default-075-20261022`

## Scope

This change makes the existing `0.75` font-size scale the React Renderer default. Explicit per-call scale overrides, body/display CSS family stacks, and trusted operator-provided local font files remain available. No font file or font package was added. The default cache identity now uses the same scale as rendering.

The user approved the compact typography direction from three preview images. This review checks that direction in all existing renderer templates and design packs. It considers hierarchy, spacing, type size, long-text wrapping, and how masks meet text at narrow widths. It does not establish system-font installation or delivery through QQ/TIM.

The visual pass also corrected three narrow-layout issues found in the reviewed outputs:

- Episode-integrity counters and episode metadata were clipped by lower-left panel masks at compact sizes. Narrow counters now use a two-column layout with safe height; episode metadata sits under the title column.
- The subject-identity “image links” value exceeded its metadata grid cell by 3px. It now spans the full metadata grid row.
- High-cardinality subject-overlap evidence could exceed its container by 3–4px. Cast and staff evidence now render as per-credit rows; wide cards use two columns and narrow cards use one.

The mobile layout audit now fails on any content overflow, in addition to checking viewport overflow. This makes the receipt check cover text inside a card as well as the card boundary.

## Reviewed R7 baseline no-override matrix

Run ID: `run95-ux002-default075-no-override-r7-20261022`.

- All `BANGUMI_RENDER_*` typography variables were unset. The renderer used its default scale and each design pack's default font stack.
- Matrix coverage: 29 templates, 59 fixture/state groups, 3 design packs, 2 palettes, and 5 CSS widths (`320`, `360`, `520`, `640`, `960`).
- Result: 1,770 PNGs; 142 test files passed, 1 skipped; 1,020 tests passed, 2 skipped.
- Receipt verification: PASS. All 1,770 image receipts have no viewport overflow or text/content overflow. Mask audit: 1,190 images with primary-panel masks, 660 with alternate-panel masks, and 30 with progress masks; zero unsupported masks and zero invalid marked panels.
- This is the reviewed R7 baseline, not the final Candidate run. The exact implementation Candidate matrix is recorded below.

Provenance for the final matrix:

- Working-tree source SHA-256: `8f425798e7798af80e34e4ac193ab39ead034febadf69be99f57c9bf2bf808c3` (1,630 included paths).
- Renderer transform SHA-256: `06ccad6f00ac28354c56b4b335948b5faaa002f4fac67f8f863873ab6ef624be` (64 inputs; Node v24.14.0).
- Machine-readable receipts and generated contact sheets: `.artifacts/render-theme-matrix-run95-ux002-default075-no-override-r7-20261022/`.

## Visual review carried forward to the exact Candidate

- Reviewed all 59 final contact sheets, representing all 1,770 theme/pack/width images. Compared with the first no-override matrix, 55 contact-sheet hashes match; four fixture groups changed: episode-integrity conflict and partial, subject-identity complete, and subject-overlap partial.
- Reviewed one full-size 320px warm-editorial light original for each of the 59 fixture groups. For the changed fixture groups, also reviewed full-size 320px output across all three packs and both palettes. The wide subject-overlap evidence layout was reviewed at full size at 640px.
- The changed contact sheets and full-size samples show no clipped text, overlap, broken wrapping, or mask/content collision. The subject-identity link value now gets its own full-width metadata row. The subject-overlap evidence rows use the available width at desktop sizes and remain single-column on phones.
- Compared image receipts with the earlier matrix: 84 output variants changed across the three corrected templates; all other image hashes are unchanged. The current contact-sheet JSON and every image manifest record `visualReview.decision = PASS`.

The exact implementation Candidate produces byte-identical output for all 1,770 PNGs and 59 contact sheets, so the R7 manual review applies to the exact Candidate without a second pixel review. The machine-readable receipt summary includes every image and sheet SHA-256 and byte count: `docs/research/assets/run95-ux002-default075-exact-matrix-ed45febb-summary.json`.

## Verification and current gate

- Exact implementation Candidate `ed45febb787301d44080756fa6edc2792897fe53`, Base `ac20862dd85165a3263ea6b1015cd92553e63703`: full no-override renderer matrix PASS. Run ID: `run95-ux002-default075-no-override-candidate-ed45febb-20261022`; 142 files passed/1 skipped, 1,020 tests passed/2 skipped, 1,770 PNGs, 59 contact sheets.
- Every image and contact-sheet SHA-256 and byte count matches both the previous exact Candidate `cf3b19e0bafcbc52736456f9d745d08c2a697239` and reviewed R7. Zero viewport/content overflow; zero invalid/unsupported masks. Candidate source SHA-256: `99196ccac0429d99a25ab1f9eaf62ed641953f7f964752b68898049fcc098946` (1,631 included paths); renderer transform SHA-256: `823c331a4d502e85cf994808af9238e5884ccd4a5f62caf99d010ba26e18950b`.
- Exact Candidate CI run [`39666755725`](https://github.com/PariyaProject/BangumiAgentKit/actions/runs/39666755725) passed all seven required checks. Source-bound `pnpm acceptance:check` passed 285 tests, including catalog/direct execution 96/96 and public evidence 65/65; the frontier check reported 122 records/97 actionable and the product-epoch legacy-path guard passed.
- The generated acceptance table remains the source of truth for current Agent/MCP rows and per-profile validation. This visual report adds no Agent/MCP credit and makes no new profile claim.
- Harness review round 1 requested a tracked evidence correction because this report and the frontier next actions still described the exact matrix as pending. This section and the receipt summary resolve that documentation finding; current review and profile-call state remain governed by Harness PR #250.
- Focused subject-identity mobile matrix: PASS, 3/3 tests; the updated 320px clean-gallery receipt has no content overflow.
- Focused subject-overlap mobile matrix: PASS, 2/2 tests; all 30 pack/theme/width receipts have no content overflow.
- Focused episode-integrity matrix: PASS, 4/4 tests; both warm-editorial light 320px states were re-rendered and visually checked after the mask repair.
- This report records renderer visual QA only; it does not complete UX-002, establish production-font installation or QQ/TIM delivery, or credit the separate fresh Agent/MCP v2 cell.

This is synthetic/offline rendering evidence. No account, OAuth, community API, QQ, TIM, or maintainer action occurred. The full-size PNGs are temporary review media; the contact sheets, manifests, and this report retain the review evidence.
