# Run #95 UX-002 — image-bearing reference fidelity audit

Date: 2026-10-23 (JST)

## Scope and evidence

- Audited BangumiAgentKit master `9d7a563adfb17a6220520a775e6c5fb5cd9891f6` against the three preserved UX-002 boards dated 2026-10-20.
- Rendered the current exact source with `scripts/acceptance/render-ux002-reference-fidelity-matrix.mjs` and the fixed local SVG cover fixture. The offline run produced 120 PNGs for four fixtures, three design packs, two palettes, and five widths under `.artifacts/render-theme-matrix-run95-hallmark-review-20261023-v1/fixed-reference-fixture/`.
- Manually inspected the six image-bearing subject-card outputs at 360 px in both palettes and the three light outputs at 320 px and 960 px. This is a focused subject-card audit; it does not claim a manual review of all 120 outputs or all 29 renderer templates.
- The fixture cover is deliberately a simple test-only SVG, SHA-256 `f70b690af8c947b2b8035cc3960298ebeff235644f94a62acfc95f8cab4299e6`. Its illustration is not a production cover and is excluded from the layout/style judgment where it differs from the generated board art.
- Reference board hashes remain those recorded in `run95-ux002-three-design-pack-reference-brief-2026-10-20.md`.

## Findings

### Critical

1. **Tell — Card-in-card.** **Where:** `packages/renderer/src/templates/SubjectCard.tsx:244-275, 277-293, 330-406, 466-484`; outer frame at `packages/renderer/src/components/CardFrame.tsx:71-86`. **Severity:** critical. **Why:** Graphic Zine stacks a clipped outer frame, a separately bordered/clipped content card, another clipped cover, two decorative corner stickers, a title ribbon, a bordered score/progress panel, a nested collection panel, and a separately clipped summary panel. In the 360 px preview these competing outlines and cuts dominate the cover and facts; the reference has one torn cover composition, one score field, and a small number of stickers. **Fix:** Remove the duplicate content-card frame, keep one deliberate cover silhouette and one score field, and remove the extra corner stickers and nested status panel.

2. **Tell — The side-stripe card.** **Where:** `packages/renderer/src/components/TitleBlock.tsx:38-48`. **Severity:** critical. **Why:** Clean Gallery adds a 3 px blue left stripe beside the title, and Graphic Zine adds a 6 px stripe inside its clipped title banner. Neither belongs to the reference boards' title treatments, and the Gallery stripe reads as a generic feature-card motif. **Fix:** Replace the Gallery stripe with its thin gallery rule and let Zine's paper title banner carry the hierarchy without a second vertical stripe.

## Audit result

The three packs remain distinguishable, but the subject-card layouts are not yet at the requested reference quality. Typography stacks are already pack-specific; the main gap is structural restraint and aligning each title/cover/score hierarchy with its board. The audit intentionally does not add facts absent from the view model.

**Hallmark pre-fix count:** 2 critical · 0 major · 0 minor.

## Scope correction — 2026-10-23

The user clarified that an earlier renderer version already looked good and rejected today's redesign direction. This audit used BangumiAgentKit's local `ux002-reference-cover.svg` placeholder, not the richer image-bearing PariyaAgent v19 preview. Its findings apply only to that separate BGK fixture/render path and must not be presented as a verdict on the previously reviewed product output or used alone to justify a redesign.

The historical comparison baseline is PariyaAgent's v19 render candidate `a430f3c0086ec3ea203edd37b753053b72351814`; the corresponding visual sheet was recorded in commit `44d5398d6839904b6d84780bea19b5f569c3b51f`. V18's compact font-family and size direction is the user-approved part; do not imply broader approval. The exploratory renderer changes made after this audit were reverted from the local `codex/ux002-image-bearing-fidelity-20261023` branch. No product source changes from that experiment were committed, merged, or published.

Future reference comparisons must show the approved image-bearing baseline alongside a renderer output using a comparable cover asset and the same information; a flat placeholder fixture can verify layout mechanics but cannot decide product aesthetics.

## Historical baseline reinspection — 2026-10-23

- Reopened the three preserved 320 px v19 sheets from PariyaAgent commit `44d5398d6839904b6d84780bea19b5f569c3b51f` and the three 1536 × 1024 design-pack boards from the reference brief. This reinspection covers the retained mobile sheets (three templates × two palettes), not a fresh render of current production source.
- The sheets preserve the references' distinct image-led compositions: Warm Editorial's warm paper and fine folio rhythm, Clean Gallery's bright mat and open blue/mint data layout, and Graphic Zine's cut-paper image silhouette with cobalt/coral/yellow accents. They retain the compact typography direction the user approved in v18.
- Hallmark visual audit of these retained sheets found no critical, major, or minor anti-pattern to fix. The earlier v19 report remains the stronger exact-Candidate evidence: 24/24 output hashes matched across repeat renders, and the changed full-size Graphic Zine images were individually reviewed against the board.
- This reinspection confirms the historical design baseline only. It does not claim new product acceptance, current-source rendering, installed production fonts, or QQ/TIM client delivery. No renderer source was changed.

## Same-cover subject-card refinement — 2026-10-23 11:01 UTC

The user's latest “完全不行” feedback triggered a working-tree refinement in the existing UX checkout. This is a new visual follow-up; it does not revise the old flat-SVG audit into a product verdict or claim that the user has accepted these latest previews.

- Checkout: `codex/ux002-image-bearing-fidelity-20261023`, base `9d7a563adfb17a6220520a775e6c5fb5cd9891f6`; changes are still uncommitted.
- Compared with the same generated star-harbor cover used by v19, using the same title, date, summary, tags, score, and collection progress. The source image was read from PariyaAgent's v19 fixture path into `/tmp`; no image was copied into this repository.
- `pnpm --filter @bangumi-agent-kit/renderer build`: PASS. A local Playwright renderer script generated 11 same-data previews at 360 CSS px / 2×: six image-bearing pack/palette combinations, two short no-cover fallbacks, and three long mixed-script no-cover cases. No HTTP requests were made.
- The iteration removes the duplicate subject-card frame, shortens no-cover heroes, puts warm score/collection data on one compact row, keeps gallery frames open, reduces Zine's nested panels, and moves a long Zine title below a missing-cover placeholder. The default remains light + warm-editorial; dark mode and the two alternate packs remain selectable.
- Preview output and the local manifest are ignored under `.artifacts/ux002-image-bearing-review-v2/`. Selected image-bearing receipts:

| Pack / palette | CSS height | PNG bytes | SHA-256 |
| --- | ---: | ---: | --- |
| Warm Editorial / light | 551 | 538,197 | `f3dba1441960f20957b948c043e049d729d46cafaedb8cf8dcf98a9229444880` |
| Clean Gallery / light | 575 | 517,958 | `4f19006145465e58edb99da6e37fb059fe27ca95551580a3ef6acc508326f84f` |
| Graphic Zine / light | 517 | 492,223 | `45fdac6a5a7175670ef135a5d23e05c23b8f0fb30903d6d461bbc012e492bcfd` |
| Warm Editorial / dark | 551 | 534,267 | `7366fbf0aaf027488bf28d59c64c2f4940064987e08480cfbe585b9d35ef4efc` |
| Clean Gallery / dark | 575 | 518,983 | `c66be4f8927f62d3b00ebb2176334b84331ade10136d62cf7ad9743110336f59` |
| Graphic Zine / dark | 517 | 490,162 | `c1df00a0cff0f000c43521b6ff39072d5ab87c7efc18f7346beb1a53b4a3048a` |

- Long-title no-cover samples rendered at 525 px (Warm Editorial), 546 px (Clean Gallery), and 528 px (Graphic Zine). The gallery score moves below the title when needed; Zine no longer overlaps its original-language subtitle with the placeholder label.
- This is focused subject-card visual QA, not a new all-29-template audit, production-font/client acceptance, or Harness/PR integration. No tests, one-shot profile, API, OAuth/account, QQ, or TIM action occurred in this refinement.
- Working previews: `.artifacts/ux002-image-bearing-review-v2/manifest.json` plus the six PNGs named by pack and palette. Before UX-002 can close again, bind the source changes to an exact Candidate and complete repository CI, review, integration, and the remaining renderer-scope checks.

## Layout regression matrix — 2026-10-23 11:16 UTC

After the same-cover review, the fixed-reference matrix was rerun on the working-tree source to check mechanics at narrow and wide widths. Its old subject-card assertions required a panel clip and exactly two decorative Zine cover stickers, which contradicted the new reference-led design. The acceptance now checks Warm Editorial's folio/frame curves, Gallery's deliberately open mat/category header, and Zine's single controlled cover cut/title band with no ornamental stickers. Other template mask requirements remain unchanged.

- Command: `PARIYA_UX002_REFERENCE_RUN_ID=run95-ux002-subject-card-refinement-20261023-v3 node scripts/acceptance/render-ux002-reference-fidelity-matrix.mjs`.
- Result: 120/120 PNG receipts generated for four fixtures × three packs × two palettes × five widths. Candidate HEAD/base are both `9d7a563adfb17a6220520a775e6c5fb5cd9891f6`; dirty-source SHA is `b99bfa07b2a6ae52ee5fdf1ba9ae1fd18ffbddfd5e50a67f2894e834764d0a28`; renderer dist SHA is `88ecbd6ca5c7ef14979bbdbffceabbc401877f3ad2b483a235fd48fc02bbb5c9`.
- The contact-sheet generator verified each image's byte length, dimensions, and SHA-256. It reports 120/120 mask-receipt images, 0 unsupported CSS shape masks, and 0 invalid marked panels. The matrix asserts root width equals client width and score-panel overflow is empty; manifest inspection also found zero recorded inner overflows across all 120 images.
- Manually inspected the four pack/palette contact sheets and nine individual subject-card images (all six 320 px variants plus three 960 px light variants). No title clipping or score/status overlap appeared in those checks. These flat-SVG outputs validate layout mechanics only; the same-cover image-bearing previews above remain the aesthetic comparison.
- Matrix/contact sheets are under ignored `.artifacts/render-theme-matrix-run95-ux002-subject-card-refinement-20261023-v3/`. This still does not substitute for a full 29-template current-source audit or exact Candidate CI/review/integration.

## Baseline reconciliation and rejected React iteration — 2026-10-23

The user's latest feedback is correct: today's BGK previews drifted from the previously reviewed PariyaAgent v19 output. The implementation boundaries and evidence were not kept equivalent.

- The exact visual reference is PariyaAgent renderer Candidate `a430f3c0086ec3ea203edd37b753053b72351814`, recorded by evidence commit `44d5398d6839904b6d84780bea19b5f569c3b51f`. Its three design packs intentionally use three separate ImageGen covers: Warm Editorial `24447d3b5f3c7173e5a08ec0001e73d1c9ce9a810ce1567651ca6dee5a7a00ab`, Clean Gallery `bad99048ea09e98e0b106d79c4250260615be194ac6cc6729184c26a8f3cf737`, and Graphic Zine `e6c37e00ea14ee05f8cac5e7bcd6b436b64da7eb1d0eb8ac05de77fc4cb81431`. V18's compact typography direction was explicitly approved. V19 retains pack-specific type profiles, the bundled GenSen Rounded font and Ma Shan Zheng font asset, and the earlier masks/compositions.
- The first BGK same-image preview used `/tmp/ux002-reference-cover-v10.jpg` (SHA-256 `9786f79405c4f26f8dc3d00d2a4c5949776573d0f87bdba2ed4026082fe2ed33`) for all three packs. That is not the v19 image set. The fixed 120-image BGK matrix also uses a flat SVG placeholder for all packs and is valid only for layout mechanics. Both were mistakenly used to make aesthetic claims.
- A second, local-only preview pass supplied the exact v19 pack-specific cover files, but still called `renderHtmlTemplate` with its default resolved typography. It therefore omitted the configurable font files that v19 actually loaded. Visually, the current React SubjectCard still diverged: in particular, Graphic Zine used a hard white title bar instead of the image-integrated title treatment, and the surrounding frame/spacing remained generic. The corrected-cover previews under `.artifacts/ux002-image-bearing-review-v3/` were also rejected; they are not product acceptance.
- The six component edits and the matrix assertion edits from this experiment were saved to `/tmp/run95-ux002-rejected-react-refinement-2026-10-23.patch` and restored in the `codex/ux002-image-bearing-fidelity-20261023` checkout. No renderer source change, PR, CI run, review, or publication resulted. After restoring the design experiment, the local branch was fast-forwarded from `9d7a563adfb17a6220520a775e6c5fb5cd9891f6` to master merge `0e2db352dc7823d9f0b07b06ebd77eda89859f40` for PR #270.
- UX-002 stays ACTIVE at 7/8. Any next implementation must start from the preserved v19 composition/font contract and run through the actual configured typography path, with pack-matched covers and a 320/360px side-by-side review. A no-overflow result alone is not a visual pass.
- Temporary v2/v3 image-bearing previews and the rejected 120-image layout-matrix outputs were removed after their dimensions, hashes, source identity, and findings were captured above. The retained v19 boards/sheets and manifest remain the visual baseline.

## Active Epoch renderer candidate — 2026-10-23 12:48 UTC

This is the first working-tree candidate on the active Harness Epoch branch after reconciling the earlier comparison mistakes. It uses the actual BGK `RenderService` production path and its resolved per-design-pack typography defaults, with the same local synthetic content and pack-specific QA covers for every render. The cover images are local style-matched QA fixtures derived from the preserved v19 boards; they are not the source cover files, production assets, or part of the product bundle.

- Checkout: ordinary clone `/private/tmp/run95-renderer-v19-c07-20261023`, branch `codex/epoch-run95-renderer-v19-c07-two-cohort-v4-20261023`, Base `0e2db352dc7823d9f0b07b06ebd77eda89859f40`. No product commit, PR, or Harness matrix credit exists yet.
- Implemented a single outer subject-card frame, pack-specific image silhouette, open score/collection rows, and a title overlay for Graphic Zine with its original-language subtitle below the cover. Clean Gallery has no generic title stripe; the shared SubjectCard path no longer stacks card-in-card panels. Warm Editorial keeps its serif display direction. Gallery uses the bundled GenSen Rounded body face; Zine uses GenSen Rounded body plus Ma Shan Zheng display. All remain at the approved 0.75 size scale. Custom operator font-file overrides still require their own configured font directory.
- Licensed font assets are WOFF2 and total 10,802,884 bytes: GenSen Rounded 7,552,648 bytes; Ma Shan Zheng 3,250,236 bytes. OFL notices are included next to both assets. Warm Editorial does not embed a bundled face and retains its design-pack stacks.
- Ran `PARIYA_UX002_IMAGE_RUN_ID=run95-ux002-v19-candidate-20261023-v1 node scripts/acceptance/render-ux002-v19-image-bearing-matrix.mjs`. The working-tree source digest is `791b0adf2bef715c62a14720d694501d44f3c43186dc78286ffe90e8f23b683b`. It produced 48 PNGs: three packs × two palettes × widths 320, 360, 375, 414, 520, 640, 768, and 960 CSS px, DPR 2. Every output was individually reviewed. The final matrix has 0 render warnings and 0 external requests; all output dimensions and SHA-256 values are recorded in [`run95-ux002-v19-image-bearing-candidate-matrix-2026-10-23.json`](run95-ux002-v19-image-bearing-candidate-matrix-2026-10-23.json), SHA-256 `363094a4296d49eef75ab9d9997e9d870ebf579df0e609c13d503bb840009669`. Full PNGs and QA covers remain ignored local artifacts; no image bytes are added to the product.
- `pnpm build`: PASS. `pnpm exec vitest run tests/render/render-cards.test.ts tests/render/typography-defaults.test.ts`: PASS (2 files, 19 tests). `pnpm test:render`: PASS (32 files passed, 1 skipped; 166 passed, 2 skipped).
- Hallmark review of the 48 current outputs found no title/subtitle overlap, visible footer clipping, or score/status collisions at the checked widths. This is local synthetic image-bearing QA, not QQ/TIM client proof, full product acceptance, exact-Candidate CI/review/integration, or user approval. UX-002 remains ACTIVE 7/8.

## Next

Continue the separate two-cohort C07 v4 branch within the selected Epoch. Preserve C07 v1/v2/v3 terminal/no-retry dispositions. Complete v4 registry, bounded local fixture, runner/report validator, exact complete/partial visual matrix and focused tests, without a claim. Then refresh the task ledger and recovery checkpoint, commit the first meaningful Epoch Candidate, run exact seven-check CI and `candidate:check`, and obtain same-identity GPT-6 Luna Max review PASS before any one-shot action.


## Regression correction — restored v19 layout — 2026-10-23

The user rejected the first active-Epoch renderer candidate as ugly. A matched 320 px comparison confirmed that the candidate had changed the previously saved layout substantially: it widened and flattened the cover, moved score and collection data into a horizontal row, and changed the title treatment. The earlier statement that its 48-image matrix was visually acceptable was incorrect for the requested reference. The rejected source digest `791b0adf2bef715c62a14720d694501d44f3c43186dc78286ffe90e8f23b683b` and receipt file `run95-ux002-v19-image-bearing-candidate-matrix-rejected-v1-2026-10-23.json` are historical only.

- Restored `SubjectCard.tsx`, `TitleBlock.tsx`, `themes/index.ts`, and their layout assertions to the active Epoch base `0e2db352dc7823d9f0b07b06ebd77eda89859f40`. Retained the approved 0.75 font-size scale, custom local-font configuration, and pack-specific typography defaults. Warm Editorial now uses the exact family stacks from the saved v19 render configuration.
- Built the renderer and ran `PARIYA_UX002_IMAGE_RUN_ID=run95-ux002-v19-restored-layout-20261023-v3 node scripts/acceptance/render-ux002-v19-image-bearing-matrix.mjs`. `pnpm build` passed; the matrix rendered 48 outputs for all three packs, both palettes, and 320/360/375/414/520/640/768/960 CSS px. It recorded 0 render warnings and 0 external requests.
- The 12 saved 320/360 baseline PNGs match the restored output byte-for-byte (12/12 SHA-256 matches and identical dimensions). The remaining 36 PNGs at 375/414/520/640/768/960 were individually inspected in full size. No clipping or layout collision was found. The inherited Zine subtitle remains layered over its cover; its contrast is a separate refinement item, not a new regression.
- Current source digest: `b8cfe39060c142b6633062e9bfb3c3297d7ca6dcd54f568153a12a96fb4cbbe5`. Current receipt manifest: `run95-ux002-v19-image-bearing-candidate-matrix-2026-10-23.json`; this replaces the rejected v1 manifest at the canonical path. The original 12-image baseline manifest remains unchanged.
- UX-002 remains ACTIVE 7/8. This is exact renderer parity with the saved local baseline and synthetic content only; it does not establish user acceptance, full 29-template review, production-font/client proof, exact-Candidate CI/review, or Harness integration.


## Temporary visual QA cleanup — 2026-10-23

Removed rejected v1 and intermediate v2 renderer PNGs, six temporary contact sheets, and duplicate local OTF/TTF/WOFF2 font copies after retaining their compact receipts and review findings. This freed 158,238,930 bytes. The final v3 48-image matrix, saved 12-image baseline, pack-matched QA covers, and licensed WOFF2 renderer assets remain available for active review.


## Graphic Zine caption hierarchy correction — 2026-10-23

The restored 320 px Graphic Zine image exposed a genuine readability problem: the original-language subtitle was still part of the cover overlay. The QA fixture also put the Chinese title into both `nameCn` and `name`, making the subtitle repeat the Chinese title.

- Updated `SubjectCard.tsx` so the cover-integrated title strip contains only the display title. The original-language title now appears once in a quiet body-font caption below the cover and before metadata. The existing 0.75 scale, pack fonts, masks, colors, and overall v19 composition remain in place.
- Corrected the synthetic comparison input to `name=Star Harbor Chronicle` and `nameCn=星港纪行`; the generator now records its own source SHA-256.
- Added a regression assertion for the Graphic Zine caption placement and absence from the cover title block. `pnpm build` passed. Focused renderer tests passed: `pnpm exec vitest run tests/render/render-cards.test.ts tests/render/typography-defaults.test.ts` (2 files / 19 tests).
- The new image-bearing matrix contains 48 PNGs across all three packs, both palettes, and widths 320/360/375/414/520/640/768/960 at DPR 2. It has 0 render warnings and 0 external requests. Two independent runs produced identical SHA-256 values for all 48 PNGs.
- Manually inspected all 48 current images. The six pack/palette combinations at 320 and 360 px show distinct title and subtitle layers without overlap; the remaining widths preserve the same hierarchy and do not clip the caption. Zine widths 375–960 and all Warm/Gallery widths were also inspected individually.
- Receipt: [`run95-ux002-v19-image-bearing-caption-refinement-matrix-2026-10-23.json`](run95-ux002-v19-image-bearing-caption-refinement-matrix-2026-10-23.json), SHA-256 `45e9aa9b4da5392503108a5bf55a85bb8a9f92dbd2096424105d4ffea3ec1be3`. Renderer source digest `4e51c4d861d1482b1c548e8bd354f519183a2f1175ee55a8c5f433711a4e770b`; generation source digest `219b74a6f002620f690852fe6c0f13121281d811749d30b4eae505d7e1a02f49`.
- UX-002 stays ACTIVE 7/8. This is a local synthetic renderer refinement; it is not user acceptance, all-template/client evidence, or Harness integration.
