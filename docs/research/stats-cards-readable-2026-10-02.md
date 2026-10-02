# Statistics cards readability acceptance — 2026-10-02

Run #63 / Epoch `stats-cards-readable-2026-10-02`
Branch: `codex/epoch-stats-cards-readable-2026-10-02`
Base: `425071ef14913a26ae4c039a1647f8796ff3487c`

## Result

The single-subject card now leads with official score, score count, distribution mean, dispersion, collection count, completion rate, and snapshot date. It keeps the full distributions, displays missing buckets as `未知` without drawing a zero bar, humanizes warnings, and shows one concise method/snapshot note. Formula IDs, evidence paths, source operation names, and warning codes remain in structured output and are absent from the image.

The two-subject comparison uses a stacked metric layout below 760 px: each metric has its label, B−A delta, and full-width A/B values. Both subjects’ statistics distributions use compact bar grids. The card hides internal source labels, formula/version IDs, field paths, API routes, and warning codes. Coverage and limitations remain in natural Chinese. Missing counts stay `未知` with no bar.

The statistics renderer ViewModel previously dropped top-level conflicts. It now carries them with rating and collection conflicts, and the card de-duplicates repeated copies before display. Non-scalar conflict values are summarized in Chinese rather than serialized as JSON with internal field names; complete values remain in structured output. No tool, MCP, authentication, or public schema changed; the catalog remains 96 tools.

## Visual review

Two render test files generated 11 deterministic PNGs at the renderer’s minimum supported width (640 px). Static HTML assertions also exercise 480 px and 960 px. I visually checked complete, partial, conflict, unavailable, and not-computable states. Chinese labels remain inside the card; missing values are explicit; conflict candidates use human source labels. The comparison card is taller because it also contains episode, subject, and shared-cast data, while its narrow-width metric rows avoid four-column wrapping.

Recreate screenshots with:

```sh
BANGUMI_STATS_RENDER_QA_DIR=.artifacts/stats-cards-2026-10-02 \
  pnpm exec vitest run tests/render/subject-stats.test.ts tests/render/subject-comparison.test.ts
```

The PNGs remain local under ignored `.artifacts/`; these hashes bind the reviewed outputs.

| Image                           |      Size |   Bytes | SHA-256                                                            |
| ------------------------------- | --------: | ------: | ------------------------------------------------------------------ |
| `single-complete.png`           |   640×998 |  76,470 | `2fc82f00733df846706971fc7f2a45a0242d23e444d6979056776473ae0016cf` |
| `single-sparse.png`             |   640×998 |  73,484 | `c2f4387d14a5e5ef6e80265d8c6646cc56e0fb84cd2bcc8bb5a78b32d158a29c` |
| `single-partial.png`            | 640×1,024 |  82,083 | `2482744e227e51221c65eb261eec1fce44ba42d20e7ba1021c7c7b61b3f695c4` |
| `single-conflict.png`           | 640×1,104 |  90,224 | `7ab37afe262194199a468ab3ecacd40297f3a310e2da01a728434c737e302c2f` |
| `single-not-computable.png`     | 640×1,038 |  76,647 | `389ea2204afb55d785d62bcc9e85fc90736717e964167cee25627ef909de4f5e` |
| `single-unavailable.png`        |   640×426 |  37,484 | `290af1b2f575e3ee9367174bf9ee61799b6afb698a6ab1bbed4bb2bbcf1ba651` |
| `comparison-complete.png`       | 640×2,203 | 255,021 | `c9152f75d18f3a83071fa63de12518185a991fba6af3d10cb299f41a3320ba2d` |
| `comparison-partial.png`        | 640×2,208 | 256,765 | `7c205ceee4c32ca83d387668627b565050f121e3345f3426b431ade2db9c99de` |
| `comparison-conflict.png`       | 640×2,242 | 264,317 | `fc4df14f04aafb47688cc9c21970818299616c8d388cbdec43cb518e9fb63dc0` |
| `comparison-not-computable.png` | 640×2,210 | 255,353 | `8694b0ebeb3a57a6b69d29b2bc50b1d31694f1261706a569218a7049baffd127` |
| `comparison-unavailable.png`    | 640×2,108 | 249,121 | `342a434f41d1b0d1cd49a269dfc51da4dc89d8dfc05f3b31f740bf505ae57818` |

## Verification

- `pnpm build` — pass.
- `pnpm test` — 71 files, 454 tests passed.
- `pnpm test:integration:sqlite` — 21 files, 66 tests passed.
- `pnpm typecheck` and `pnpm lint` — pass.
- `pnpm acceptance:check` — pass: 96 catalog/direct execute, 96 Agent→MCP, 65 partial public API / 31 not applicable; QQ pipeline 0/96 and TIM client 0/96 unchanged.
- Focused renderer suite — 2 files, 7 tests passed; 11 PNGs generated and visually reviewed.
- `git diff --check` — pass.
- `pnpm format:check` reports 98 repository files outside this patch. The six changed source/test files are formatted and absent from that failure list.

This is renderer fixture and image evidence only. It does not claim deployment, WebChat, QQ, TIM, OAuth, or live Bangumi account acceptance.
