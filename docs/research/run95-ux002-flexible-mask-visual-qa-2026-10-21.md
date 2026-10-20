# Run #95 UX-002 — flexible mask visual QA

Date: 2026-10-21 (JST) | PR: #243 — three renderer design packs

Hallmark component-scope review · pre-emit: P4 H4 E4 S5 R4 V5

## User concern

The renderer still felt boxy compared with the generated design boards. Mask fidelity is a separate acceptance criterion: a `clip-path` token or a zero-overflow report alone does not prove that the card silhouettes fit their design pack.

## Design review and correction

The first normalized SVG clip-path attempt was rejected during visual review. Its object-bounding-box coordinates scaled with full component height, creating deep cuts on long cards and clipping score/footer content at wide sizes. Those images remain diagnostic only.

The renderer now uses native CSS `shape()` masks with fixed-pixel edge details and responsive anchors. The three design packs retain distinct silhouettes:

- **Warm Editorial:** asymmetric folio corners, a page-turn wave on hero art, rounded cover masks, soft-edged panels, and stamp-like badges.
- **Clean Gallery:** architectural chamfers, a restrained curved recess, gallery-mat covers, and crisp geometric markers.
- **Graphic Zine:** offset die-cut edges, angular hero and cover masks, sticker-like title plates and tags, and starburst badges.

The latest full-size review found that the largest remaining boxy area was the Person Collaboration list: collaborator cards were plain rectangles even though the frame and summary panels were masked. Candidate `7cfe0cbd554898f648aa8e815e46701649f4780f` now alternates each pack's existing primary/alternate panel masks across collaborator cards and applies the pack's tag mask to context chips. Dense shared-work rows remain straight-edged for scanning. Titles, IDs, badges, warning text, and card boundaries remain inside their masks at 320px.

Hallmark was used component-scope. The existing React 18 renderer, design tokens, font fallbacks, SVG icon registry, and static PNG boundary were reviewed first. No new dependency, data change, or auth behavior was introduced.

## Exact-source identity

- Rendered Candidate HEAD: `7cfe0cbd554898f648aa8e815e46701649f4780f`
- Base: `376ac9231449646bafa201082f03fc8e44f3c675`
- Working-tree SHA-256: `a7aa6fb88e4d5ac2e6fac9a7078557b20502f3668b4e2f7505005b0895a811be` (1,600 paths; this QA report is excluded to avoid self-reference)
- Fixed-reference renderer build SHA-256: `519b4f164d2c757b161795938efc28fe6fefbb693a68707c9c27a0350b618ba2` (224 files)
- Full-matrix Vitest source-transform SHA-256: `6c5d6a59bc90a143c65c24c8fcf5812ac4401e01749bcabe9cd30e528d69121d` (63 inputs, Node v24.14.0)
- Synthetic auth renderer build SHA-256: `a8f5865071905a48ca63f6196f80e17eacd1c44268d0ade90fd0ced7a5f248e9` (504 files)

## Visual evidence

**Fixed-reference matrix:** `.artifacts/render-theme-matrix-run95-ux002-collaborator-mask-fixed-v1/` covers subject card, subject statistics, and revision timeline across 3 packs × 2 palettes × 5 widths (320/360/520/640/960): 90 PNGs and 3 contact sheets. All image and sheet receipts verify. All 90 image hashes and 3 sheet hashes are identical to the previously reviewed Candidate `4baf3ec`; the boards and render output for these templates were unchanged by the collaboration-card-only edit. Mask audit: 210 primary-panel, 20 alternate-panel, and 30 progress masks; zero unsupported shapes and zero invalid marked panels.

**Full renderer matrix:** `.artifacts/render-theme-matrix-run95-ux002-collaborator-mask-full-v2/contact-sheets/contact-sheets.json` covers 29 templates and 59 fixture/state groups: 1,770 PNGs across 32 manifests and 59 contact sheets. Receipt verification passes. Of these, 1,740 PNGs from the 58 unaffected groups and all 58 corresponding contact sheets are SHA-identical to the previously reviewed Candidate `4baf3ec` artifacts. The changed Person Collaboration group contains 30 newly rendered variants; its contact sheet was inspected across all packs, palettes, and widths. Six 320px samples (all three packs in light and dark) and three 960px samples (all three packs in light) were also inspected at full size. The masks read as soft folio, chamfered gallery, and angular die-cut silhouettes respectively; no visible text, ID, badge, warning, or boundary clipping was found. Automated manifests contain no layout, mobile, or mask failures. Mask audit: 1,190 images with primary panel masks, 660 with alternate panel masks, 30 with progress masks; zero unsupported shapes and zero invalid marked panels.

The complete render matrix was generated with:

```sh
PARIYA_RENDER_THEME_MATRIX=1 PARIYA_RENDER_DESIGN_PACK_MATRIX=1 \
PARIYA_RENDER_THEME_MATRIX_RUN_ID=run95-ux002-collaborator-mask-full-v2 \
pnpm exec vitest run tests/render --config vitest.mobile-render-audit.config.ts --maxWorkers=4
```

It passed 31 test files (1 skipped) and 161 tests (2 skipped). The one additional `subject-card/default` fixture group needed to reach the established 59-group matrix was generated from `tests/unit/renderer.test.ts` under the same run ID; all 4 tests passed. The combined report has 59/59 contact sheets marked PASS.

**Synthetic auth/message matrix:** `.artifacts/render/run95-ux002-collaborator-mask-auth-v1/` contains 290 PNGs for 4 callback pages and 9 collection states across 3 packs, 2 palettes, and 5 widths. The 10 current contact sheets and all 290 PNGs are SHA-identical to the previously reviewed Candidate `4baf3ec` synthetic matrix. Automated checks report zero horizontal overflow and zero missing expected text. The callback failure is a synthetic fixture. This is not real OAuth, account, QQ, or TIM delivery evidence; no live OAuth/account requests or QQ/TIM actions occurred.

The first broad matrix attempt failed with `ENOSPC` while writing render PNGs and test temporary files. That incomplete run is diagnostic only and is not counted as acceptance evidence. The complete render-only rerun above used four workers and passed; no prior artifacts or user files were deleted.

Reference boards:

- `docs/research/assets/run95-ux002-warm-editorial-board-2026-10-20.png`
- `docs/research/assets/run95-ux002-clean-gallery-board-2026-10-20.png`
- `docs/research/assets/run95-ux002-graphic-zine-board-2026-10-20.png`

## Checks and acceptance boundary

- `pnpm build` — PASS.
- `pnpm typecheck:tests` — PASS.
- Targeted ESLint, Prettier, and `git diff --check` — PASS.
- `pnpm harness:guard` — PASS.
- Exact-head GitHub CI for Candidate `7cfe0cbd554898f648aa8e815e46701649f4780f` — PASS (`39481397264`).

The latest masks improve the large collaborator cards that made the renderer feel boxy while preserving readable dense rows. These results cover synthetic renderer fixtures and local image output. UX-002 remains ACTIVE 1/7 until the same-identity Harness review and integration gates pass. This report makes no claim about live OAuth, Bangumi account access, QQ/TIM delivery, or client screenshots.
