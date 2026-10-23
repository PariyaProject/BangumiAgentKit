# Run #95 C07 two-cohort renderer visual redesign

Date: 2026-10-24 (JST)
Status: v34 corrective visual QA recorded; exact candidate delivery gates pending; user aesthetic acceptance not recorded.

## Why this iteration exists

The user rejected the v21 C07 image as completely unacceptable. The v21 matrix had passed structural and exact-receipt checks, but those checks did not establish visual quality. A same-template 360 CSS px comparison against v19 confirmed that the updated cohort pairing and score lead still read as a long technical report: the header, cohort summary, metric rows, warning, limitations, formula, and source citation each formed a separate text block.

The v19 subject-detail image with an anime cover is a different template and is not used as the C07 comparison-card reference. C07 has no cover field; no cover artwork is added.

## Reference board

Generated a C07-specific three-pack triptych from the exact comparison content. It is a composition reference only; production output remains native React/SVG and uses real ViewModel values.

- Reference: [`run95-c07-two-cohort-reference-board-2026-10-24.jpg`](assets/run95-c07-two-cohort-reference-board-2026-10-24.jpg)
- Compressed 1536 × 1024 JPEG, 284,490 bytes; SHA-256 `00a25f1c4364ff55932cc7db22d363facf8d5cd659c597164c5b77a0abcaa918`.
- Fixed comparison values: average score 6.40 / 8.10 / +1.70; collection 31 / 97 / +66; reported episodes 12 / 24 / +12; rating dispersion 0.49 / 0.30 / −0.19; one bounded sample per group.
- The reference proposes a connected A/B score focal point, open supporting rows, clearer type scale, and a quiet scope note. The three panels have separate Warm Editorial, Clean Gallery, and Graphic Zine structures.

## Implementation direction

- Clean Gallery: let the A/B average scores carry the focal point, joined visually to a neutral B − A delta; render secondary metrics as open rows without normalized bars; keep the public-sample boundary, experimental-source warning, calculation method, and date in a compact footnote hierarchy.
- Keep A/B values and missing/partial states explicit. Do not infer zero for missing data, imply significance, or frame positive/negative deltas as recommendations.
- Preserve the existing bundled GenSen Rounded font and 0.75 typography scale; use smaller type for provenance and limitation notes.
- Apply only pack-appropriate shape treatments. Do not add arbitrary masks, nested card frames, or invented cover imagery.

## Exact renderer comparison sources

- C07 baseline: `.artifacts/render/c07-cohort-comparison-v4-visual-qa-candidate-bound-20261024-v19/complete-two-cohort-clean-gallery-bangumi-light-360.png`.
- User-rejected Candidate: `.artifacts/render/c07-cohort-comparison-v4-visual-qa-candidate-bound-20261024-v21/complete-two-cohort-clean-gallery-bangumi-light-360.png`.
- New Candidate output is reserved for v28; v19, v21, v22, and v27 remain historical.

## Candidate evidence and limits

### v22 visual iteration — 2026-10-24 JST

- Output: `.artifacts/render/c07-cohort-comparison-v4-visual-qa-candidate-bound-20261024-v22/`.
- Exact 60-image matrix: 2 states × 3 packs × 2 themes × 5 widths; every image was individually opened and reviewed. No clipping, overlap, or horizontal overflow was found. Complete numeric deltas are correct; partial values remain unknown and deltas remain non-computable.
- Clean Gallery complete/light/360px height is 895 CSS px, down from 1,029 CSS px in user-rejected v21 (13.0% shorter). The A/B score bridge, open rows, and compact method notes follow the new reference board.
- Manifest: [`run95-c07-render-comparison-offline-agent-mcp-matrix-v4-visual-qa-2026-10-24-v22.json`](run95-c07-render-comparison-offline-agent-mcp-matrix-v4-visual-qa-2026-10-24-v22.json), SHA-256 `5b08bf4e7bab48d2f5784247f12d160005f288ba2f4eef7bc5ba0d56518a49de`.
- Bundle SHA-256 `774efc9a0027680a6e3643961682b6399053713e22c492a197a2ab7d3643840c`; generation-source SHA-256 `cb1c889f2915895eedd74bbea81fb7559fb8fbaedccad346cb8f75a7b75e5269`.
- Local checks: `pnpm build`, `pnpm lint`, `pnpm typecheck:tests`, `pnpm test:render` (172 passed / 2 skipped), focused C07 renderer test (13/13), exact visual-manifest Harness test (3/3), `pnpm acceptance:check` (311/311), `pnpm harness:test` (886/886), frontier validation (122 records / 97 actionable, hash `281bd03a9a2fb44924208133cb8774778bd06cf7a90fb92347b36957c77317eb`), and the legacy-path guard all passed.
- At the time this v22 report was prepared, the source edit was not committed or pushed. PR #271's existing review covers only 283c44cb and does not apply to v22. Do not run the one-shot profile or merge until the new exact Candidate has current CI, Candidate readiness, and same-identity review; C07 remains UNASSESSED.
- The user has rejected v21. v22 is synthetic QA and a new design attempt; no user aesthetic acceptance is claimed. No API, OAuth/account, community, write, QQ, or TIM action occurred.

### v27 visual recovery — 2026-10-24 JST

- The v26 Graphic Zine render still used the theme's `Impact`/`Arial Black` display stack and embedded Ma Shan Zheng face. The earlier serif override had only reached the warm-editorial branch, so the score values retained the brush font. This mismatch explains the type and visual hierarchy regression reported by the user.
- The renderer now uses a restrained system-serif display stack for Graphic Zine, smaller title scale/weight, two centered paper score fields with a separate central B − A strip, and open cream metric rows over the cobalt poster. The redundant “聚合指标” heading is omitted for two-cohort Gallery/Zine layouts. Narrow comparison subtitles are shortened at 320/360px to prevent orphaned final words.
- Output: `.artifacts/render/c07-cohort-comparison-v4-visual-qa-candidate-bound-20261024-v27/`. All 60 exact images were opened and inspected individually: complete/partial, three packs, light/dark, and 320/360/520/640/960 CSS px. No visible clipping, overlap, or horizontal overflow. Complete A/B values and signed deltas remain legible; partial values remain unknown and deltas non-computable.
- Receipt: [`run95-c07-render-comparison-offline-agent-mcp-matrix-v4-visual-qa-2026-10-24-v27.json`](run95-c07-render-comparison-offline-agent-mcp-matrix-v4-visual-qa-2026-10-24-v27.json), SHA-256 `74b1380c71cb451d79bebc1d7f06a300a1e5544a4d7c0536af812a028aa9db74`. Bundle SHA-256 `b04264ac012856f614b6f5e1d6f25901fcad3550bde3abff7a8df86b1804f1f1`; generation-source SHA-256 `9ba8f325782688d8624abaa3fbe48f30cde90802c5ee6e3d44cf38d96a22ef84`.
- `pnpm build` passed; focused renderer and typography suites passed 19/19; strict v27 visual-evidence validation passed against all 60 PNG receipts, the manifest, source, and bundle hashes. The visual review records local renderer QA only. It is not user aesthetic acceptance, production-font evidence, real Bangumi scenario proof, or QQ/TIM delivery; C07 remains UNASSESSED and profile v4 remains unclaimed.

### v28 watercolor poster recovery — 2026-10-24 JST

- The user rejected v27 as visually unacceptable. Its geometric “paper on blue slab” treatment still did not match the reference board, so its layout was not treated as an aesthetic success.
- Graphic Zine now uses an open cream canvas with a watercolor harbor panorama, two editorial cohort headings, a centered B−A wave, A/B score values, and open metric rows. The large rectangular frame and stacked query-metadata blocks are removed from this two-cohort presentation; bounded query coverage, warnings, limitations, calculation method, and retrieval date remain in the footnotes.
- The harbor artwork was generated with built-in ImageGen from the C07 Zine reference board as a style guide, with no embedded text. The transparent 1983×793 PNG is stored at `packages/renderer/assets/illustrations/run95-c07-waterfront-watercolor-2026-10-24.png` (about 1.2 MB) and embedded into renderer HTML, so the output needs no network request or extra runtime package.
- The comparison now uses the renderer’s own icon system: star, bookmark, document, and bar chart. A/B colors and coral deltas come from Graphic Zine theme tokens. Relevant text and semantic color pairs exceed WCAG 4.5:1 against the paper and dark surfaces; the minimum checked ratio was 7.09:1 in light mode and 7.44:1 in dark mode.
- Output: `.artifacts/render/c07-cohort-comparison-v4-visual-qa-candidate-bound-20261024-v28/`. The 60 images cover complete/partial data, three design packs, light/dark palettes, and 320/360/520/640/960 CSS px. I inspected all 60 in twelve five-width sheets; no clipping, overlap, horizontal overflow, or missing-value/delta ambiguity appeared.
- Receipt: [`run95-c07-render-comparison-offline-agent-mcp-matrix-v4-visual-qa-2026-10-24-v28.json`](run95-c07-render-comparison-offline-agent-mcp-matrix-v4-visual-qa-2026-10-24-v28.json), SHA-256 `cc26e6ac9fbd8e84edcb4de03efc051fd1db59d79ea829d9594218a2781ab41f`. Bundle SHA-256 `eae7b5eba1498e0cfce25fff67e4e5811a9813bb4dc3f80a42e536a53d17745a`; generation-source SHA-256 `3d0159e3d1dbd248dd559a340c7a8542df7ab9fa15ea0bdbccaf3157bbc93dce`. Strict validation passes for the exact 60 receipts, manifest bytes, source, and bundle.
- `pnpm build` passed after the v28 renderer changes. Full renderer/Harness checks and PR #271 exact-head gates remain pending. This is synthetic renderer QA only, not user aesthetic acceptance, real Bangumi scenario proof, or QQ/TIM delivery. C07 remains UNASSESSED and the v4 profile remains UNCLAIMED.

### v32 reference-board recovery — 2026-10-24 JST

- The user pointed out that the earlier Graphic Zine direction had felt stronger and that the pale v28 watercolor report looked like a regression. Side-by-side review confirmed it had discarded the reference board's dark cobalt poster field, torn ivory paper, coral sun, yellow delta label, and cut-paper coast. Geometry checks alone had incorrectly been treated as a visual pass.
- v32 restores that composition in the C07 comparison card: a clipped cobalt poster surface, a paper title plate, two asymmetrical cohort sheets, two A/B score sheets, a yellow B−A label, irregular metric strips, a coral sun stamp, and a textured shore illustration. Theme-specific foreground colors preserve dark-mode contrast. No additional runtime dependency or network asset is used.
- New illustration: `packages/renderer/assets/illustrations/run95-c07-cut-paper-coast-zine-2026-10-24.png`, transparent RGBA 1983×793 PNG (~1.3 MB), generated for this card from the reference-board palette and cut-paper treatment. The older v28 watercolor asset remains for historical reproducibility.
- Final output: `.artifacts/render/c07-cohort-comparison-v4-visual-qa-candidate-bound-20261024-v32/`; exact receipt: [`run95-c07-render-comparison-offline-agent-mcp-matrix-v4-visual-qa-2026-10-24-v32.json`](run95-c07-render-comparison-offline-agent-mcp-matrix-v4-visual-qa-2026-10-24-v32.json).
- All 60 outputs were accounted for across two states, three design packs, two themes, and five CSS widths. The 40 non-Zine PNGs are byte-identical to previously reviewed v30 outputs; all 20 changed Zine PNGs were inspected in four five-width sheets. No clipping, overlap, or horizontal overflow was found. Missing values remain unknown and their deltas remain non-computable.
- Manifest SHA-256 `98d3ad9e2dc65d4588a6e5237d91c767f14ccb9a6743a8f39bf6b366d2d1ae4c`; bundle SHA-256 `1f305b7b8ddd9d51d80b9371a94d55e90bb150a6d1ee43e1af05db4d29510757`; generation-source SHA-256 `5c63da069d03f25aa4252f5d105fe22c30a06c08e7c0a7cf8b96f40f5d557dfc`. Strict evidence validation passes. This is still synthetic renderer QA, not user aesthetic acceptance, real Bangumi scenario proof, or QQ/TIM delivery. C07 remains UNASSESSED and v4 remains UNCLAIMED.

### v34 reviewer correction and final local layout — 2026-10-24 JST

- Round-5 review found the global Graphic Zine font changes had widened scope without current-source SubjectCard evidence. Shared defaults in `packages/renderer/src/themes/index.ts` and `packages/renderer/src/typography.ts` are restored to the prior PASS Candidate; the serif display treatment is implemented entirely inside the C07 two-cohort card. The shared `TitleBlock` component remains unchanged.
- C07 no longer repeats the same A/B identity above separate score cards. Each irregular paper panel now presents its cohort label, work title, average score, coverage, and bounded query detail together. The separate yellow B−A strip remains between the paired papers and secondary metric rows. Narrow metric labels, values, and coverage labels were increased for legibility.
- Final output directory: `.artifacts/render/c07-cohort-comparison-v4-visual-qa-candidate-bound-20261024-v34/`; tracked receipt: [`run95-c07-render-comparison-offline-agent-mcp-matrix-v4-visual-qa-2026-10-24-v34.json`](run95-c07-render-comparison-offline-agent-mcp-matrix-v4-visual-qa-2026-10-24-v34.json). It contains all 60 current-source images: two states × three design packs × light/dark × 320/360/520/640/960 CSS px.
- Relative to v32, 20 Graphic Zine images changed and were individually inspected in v33. Every v34 PNG SHA-256 matches its individually reviewed v33 image; all 40 non-Zine outputs also match the previously inspected v30 PNGs. Strict current-source receipt test passes 3/3. The complete/light/360 image is 698 CSS px tall, down from v32's 719 CSS px (2.9% shorter).
- Manifest SHA-256 `11b20ad2963296bf104e14bf3dae0598651472db0c14dd74507fe84453ad2df7`; bundle SHA-256 `9576a30413a18119c5f19b42bda6e1edd9f63f9d7ec39d03a58537bcc1ce6371`; generation-source SHA-256 `999e046606032ad6a571e117ce4b6835c2a6daf3810ffc197a65d0c8ce62beeb`. Strict validation binds these hashes and every PNG.
- Focused C07 renderer and typography tests pass 19/19; `pnpm build` passes. Broader local checks, exact-Candidate CI, Harness refresh, and round-6 review are still pending. This remains local synthetic rendering evidence; user aesthetic acceptance, real Bangumi scenario coverage, and QQ/TIM delivery are not claimed. C07 remains UNASSESSED and v4 UNCLAIMED.
