# Run #95 C07 two-cohort renderer visual redesign

Date: 2026-10-24 (JST)
Status: implementation and candidate visual QA in progress; user aesthetic acceptance not recorded.

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
- New Candidate output is reserved for v22; v19 and v21 remain historical.

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
