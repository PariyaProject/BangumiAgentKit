# Run #95 UX-002 — renderer typography visual QA

Date: 2026-10-21 (JST) | Selected Epoch: `run95-ux002-renderer-typography-20261021`

## Scope

This change adds operator control for global font-size scale, body/display font stacks, and approved local font files to BangumiAgentKit's React image renderer. The user approved the font and size direction from PariyaAgent v18 previews; that approval does not replace the separate review of BangumiAgentKit's three design packs or establish live QQ/TIM evidence.

The setting applies at render time to the existing 29 templates. Default scale remains `1.0`; supported values are `0.75–1.25`. Local files are read only from an operator-configured directory by basename, resolved through real paths, limited to OTF/TTF/WOFF/WOFF2 and 20 MiB, then embedded for the offline Chromium render. File SHA-256 is part of the cache identity. No font asset or package was added to the repository.

## Full matrix

Run ID: `run95-ux002-typography-scale-075`

- Candidate/Base at capture: `dbb895d02da859c15ce7bef8bc6837a67a8bb45a`.
- Working-tree SHA-256: `52d76b1c305aa75267765c9f29d49c067960a7f7aa6a00f4d13abf846c47bc16` (1,619 included paths).
- Renderer transform SHA-256: `43c0057dd4ee4b2706568676ad09ce2ec40a5877350dd7639ab2df855cc7c5d8` (64 inputs; Node v24.14.0).
- 29 templates, 59 fixture/state groups, 3 design packs, 2 palettes, and five widths (320/360/520/640/960): 1,770 PNGs and 59 contact sheets.
- All 59 contact sheets were inspected. No visible clipping, horizontal overflow, or invalid mask was found. Automated mask receipts report 1,190 images with primary masks, 660 with alternate masks, 30 with progress masks, zero unsupported shapes, and zero invalid marked panels.
- At `0.75`, some dense 320px data labels look small. This is an optional size setting; the default stays at `1.0` to preserve existing output.
- The contact-sheet receipt file records all 59 reviews as `PASS`. Original per-image byte/hash/dimension receipts passed before full-size matrix PNGs were pruned.

Generated with:

```sh
env PARIYA_RENDER_THEME_MATRIX=1 PARIYA_RENDER_DESIGN_PACK_MATRIX=1 \
  PARIYA_RENDER_THEME_MATRIX_RUN_ID=run95-ux002-typography-scale-075 \
  BANGUMI_RENDER_FONT_SIZE_SCALE=0.75 \
  BANGUMI_RENDER_BODY_FONT_FAMILY='GenSen Rounded, Hiragino Sans GB, Noto Sans CJK SC, sans-serif' \
  pnpm exec vitest run tests/unit tests/render --config vitest.mobile-render-audit.config.ts
```

Result: 142 test files, one skipped; 1,019 tests passed, two skipped. Contact sheet generation reported 142 manifests, 1,770 image receipts, 59 fixture groups, 59 sheets, and `receiptVerification: PASS`.

## Local font file browser smoke

A one-off Chromium render at CSS viewport width 320 used the user's local `GenSenRounded2TW-R.otf` file (16,177,104 bytes) as the body face and the same family stack for display text. The font was embedded from the configured local directory; the resulting output visibly used the rounded glyph style and retained the card layout without horizontal overflow. The temporary smoke-test source was removed after the run.

- Default-font comparison: `.artifacts/render-theme-matrix-run95-ux002-typography-scale-075/font-smoke/default-subject-card-320.png`
- Local rounded-font preview: `.artifacts/render-theme-matrix-run95-ux002-typography-scale-075/font-smoke/gensen-rounded-subject-card-320.png`

## Artifact retention

After review, 1,770 full-size matrix PNGs totaling 353,278,969 bytes were deleted. Kept for inspection are the 59 contact sheets, the two 320px font comparison images, all 142 compact render manifests, and the annotated `contact-sheets.json`. This removes about 337 MiB while preserving the visual boards and their receipt metadata. Re-running the contact-sheet generator against this pruned run will require regenerating the matrix images first.

## Checks

- `pnpm typecheck:packages` — PASS.
- `pnpm typecheck:tests` — PASS.
- `pnpm exec vitest run tests/unit/renderer-typography.test.ts tests/unit/render-presentation-tools.test.ts tests/render/render-pool-cache.test.ts` — PASS, 3 files / 24 tests.
- Configured-env render checks for `render-presentation-tools` and `subject-overview` — PASS, 2 files / 16 tests.
- One-off `pnpm exec vitest run tests/render/typography-file-smoke.test.ts --config vitest.mobile-render-audit.config.ts` — PASS, one browser smoke test; temporary test file removed.

This is synthetic/offline renderer evidence. No account-auth, OAuth, community, QQ, or TIM action occurred. OP-013 remains `PARTIAL` pending the remaining design and delivery acceptance boundaries.
