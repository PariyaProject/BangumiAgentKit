# Run #95 UX-002 — flexible mask visual QA

Date: 2026-10-21 (JST)
PR: #243 — three renderer design packs

Hallmark component-scope review · pre-emit: P4 H4 E4 S5 R4 V5

## User concern

The renderer still felt too boxy and its masks did not carry the flexible silhouettes of the generated reference boards. This review treats silhouette quality and reference fidelity as separate acceptance criteria; a `clip-path` token or a zero-overflow report alone is not enough.

## Design and implementation

The first normalized SVG clip-path attempt was rejected during visual review. Its object-bounding-box coordinates scaled with full component height, creating deep cuts on long cards and clipping score/footer content at wide sizes. Those screenshots remain diagnostic evidence only.

The replacement uses native CSS `shape()` masks with fixed-pixel edge details and responsive percentage anchors. This keeps a portrait cover, wide hero, badge, and tall report from deriving their corner depth from the full component height. Chromium support is asserted by the reference-fidelity matrix.

The three packs now use different silhouettes as well as different color and type systems:

- **Warm Editorial:** asymmetrical folio corners, a small page-turn wave on hero art, rounded cover masks, soft-edged panels, and stamp-like badges.
- **Clean Gallery:** architectural chamfers, a restrained curved recess, gallery-mat covers, and crisp geometric markers.
- **Graphic Zine:** offset die-cut edges, angular hero and cover masks, sticker-like title plates and tags, and starburst badges.

Masks are concentrated on the outer frame, hero/cover, title plate, key data panels, progress surfaces, tags, and icon badges. Dense comparison rows and chart labels keep straight edges so their values stay easy to scan. A compact Warm Editorial collection-status panel trial clipped its 320px progress track and was rejected; the final status panel keeps a safe primary mask.

No ViewModel facts, auth state, synthetic disclosures, or message copy were changed. No package was added. Hallmark was used in component-scope: the existing React renderer, tokens, typography, SVG icon registry, and static PNG boundary were checked before the mask review; page macrostructure and interaction states do not apply to these static cards.

## Exact-source identity

- Candidate HEAD: `6f8244a9f5f87333ea1029c18afd4f37fa3552f2`
- Base: `376ac9231449646bafa201082f03fc8e44f3c675`
- Working-tree SHA-256: `bd81ea3ea1d8990a55aff3922e658d3c37496c7fa2848628bdbebad4e52c7480` (1,599 paths)
- Renderer build SHA-256: `d72576889166203d82df0262b97f7e7c6be272c32aa2aeb87efed0f382f0f6e7` (224 files)

## Visual evidence

**Fixed reference matrix:** `.artifacts/render-theme-matrix-run95-ux002-fluid-mask-organic-v12/` binds the three core fixtures to that exact source identity. It covers subject card, subject statistics, and revision timeline across 3 packs × 2 palettes × 5 widths (320/360/520/640/960): 90 PNG receipts and 3 contact sheets. All image and sheet hashes, byte lengths, and dimensions verify. All 90 variants were reviewed through their contact sheets against the three design boards; six Warm Editorial samples (320px and 960px for all three templates) were inspected at full resolution. Mask receipts: 210 primary-panel, 20 alternate-panel, and 30 progress masks; zero unsupported shapes and zero invalid marked panels.

**Full renderer matrix:** `.artifacts/render-theme-matrix-run95-ux002-mask-flex-full-r4/contact-sheets/contact-sheets.json` records the full run and its candidate identity. It covers 29 templates, 59 template/state groups, 3 packs, 2 palettes, and the same five widths: 1,770 images across 141 manifests and 59 contact sheets. All 1,770 image receipts and all sheet receipts were rehashed and matched. Every contact sheet and image receipt is marked PASS after visual review. Twenty-two selected full-resolution stress images were checked across Person Collaboration, Subject Overview, Character Credit Integrity, Episode Guide, and Subject Comparison. Mask receipts: 1,190 images with a primary panel mask, 660 with an alternate panel mask, 30 with a progress mask; zero unsupported shapes and zero invalid marked panels. Layout overflow entries and scroll/client-width mismatches are zero.

**Synthetic auth/message matrix:** `.artifacts/render/run95-ux002-flex-mask-auth-20261021-r1/` binds to the same source and build. It contains 290 PNGs covering four callback outcomes and nine collection states. The ten contact sheets cover all callback widths and all collection-state variants across the three packs, two palettes, and five widths. All 290 image receipts and ten contact-sheet receipts match; zero horizontal overflow and zero missing expected-text checks. Fourteen full-resolution stress images cover long callback identity and long mixed-script collection cards at 320px and 960px. The synthetic callback failure is a fixture. The manifest records zero live OAuth/account requests and zero QQ/TIM actions; this is not real OAuth or client-delivery evidence.

Reference boards:

- `docs/research/assets/run95-ux002-warm-editorial-board-2026-10-20.png`
- `docs/research/assets/run95-ux002-clean-gallery-board-2026-10-20.png`
- `docs/research/assets/run95-ux002-graphic-zine-board-2026-10-20.png`

## Checks

- `pnpm build` — PASS.
- `pnpm test` — PASS: 141 files passed / 1 skipped; 1,011 tests passed / 2 skipped.
- `pnpm test:render` — PASS: 31 files passed / 1 skipped; 161 tests passed / 2 skipped.
- `PARIYA_RENDER_THEME_MATRIX=1 PARIYA_RENDER_DESIGN_PACK_MATRIX=1 PARIYA_RENDER_THEME_MATRIX_RUN_ID=run95-ux002-mask-flex-full-r4 pnpm exec vitest run tests/unit tests/render --config vitest.mobile-render-audit.config.ts` — PASS: 141 files passed / 1 skipped; 1,011 tests passed / 2 skipped; full 1,770-image matrix generated.
- Playwright `CSS.supports('clip-path', ...)` — PASS for all 25 non-`none` mask tokens in Chromium 151.0.7922.34.
- Targeted ESLint, Prettier, and `git diff --check` — PASS.

## Acceptance boundary

The visual mask and synthetic auth/message render checks pass for this exact working tree. CSS `shape()` support is verified in the renderer's Chromium runtime. The callback pages remain utility status views; this report makes no claim about real OAuth, Bangumi account access, QQ/TIM delivery, or client screenshots. UX-002 remains ACTIVE 1/7 until the exact committed Candidate passes current CI, Harness review, and integration gates.
