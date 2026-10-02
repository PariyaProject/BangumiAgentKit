# Statistics cards readability acceptance — 2026-10-02

Run #63 / Epoch `stats-cards-readable-2026-10-02`
Branch: `codex/epoch-stats-cards-readable-2026-10-02`
Base: `425071ef14913a26ae4c039a1647f8796ff3487c`

## Result

The single-subject card leads with official score, score count, distribution mean, dispersion, collection count, completion rate, and snapshot date. Missing buckets remain `未知` without a zero bar. Warning codes and unrecognized warning messages are converted to safe Chinese labels; formula IDs, evidence paths, source operation names, and codes remain only in structured output. The card explains that completion rate is seen divided by the five collection states and that this formula is sample-verified rather than an official API contract.

The two-subject comparison uses a stacked metric layout below 760 px: each metric has its label, B−A delta, and full-width A/B values. It now includes the actual completion-rate delta from each subject’s statistics, explains the formula denominator, and marks the formula as sample-verified rather than an official API contract. Production-shaped warnings with raw `partial` states or formula IDs are mapped to safe Chinese. Both subjects’ distributions use compact bar grids; field paths, API routes, formula/version IDs, and warning codes stay out of the images.

The statistics renderer ViewModel now carries top-level conflicts with rating and collection conflicts. Both cards label the affected metric and deduplicate repeated root/nested copies before display, so duplicate rating candidates cannot displace a distinct collection conflict. Non-scalar values are summarized in Chinese rather than serialized with internal field names; complete conflict detail remains in structured output. No tool, MCP, authentication, or public schema changed; the catalog remains 96 tools.

## Independent review and corrective response

The first independent Sol review returned three P1 findings: production-shaped warnings could leak formula IDs/raw states; conflict candidates lacked field context and repeated conflicts could crowd out distinct ones; and the comparison fixture lacked a truthful completion-rate delta and formula caveat. The corrective Candidate added real-shaped warning and duplicate-conflict fixtures, field labels and pre-cap conflict deduplication, plus a completion delta computed from the nested statistics. Partial/conflict examples do not fabricate a completion delta. Candidate #2 passed all seven exact-head checks, but its follow-up review found additional warning-semantics issues; see below.

## Second review and final corrective response

The second independent Sol review confirmed the three earlier fixes and reported one P1 and one P2. The P1 reproduced a complete statistics result with the informational `FORMULA_EMPIRICALLY_VERIFIED` warning, which the generic fallback incorrectly described as missing information. The same fallback hid `RATING_TOTAL_MISMATCH`, obscuring a disagreement between official rating count and histogram population. The P2 found repeated `MISSING_FIELD` labels occupying multiple positions before the comparison card's warning cap.

The final corrective change now uses one shared warning-label map for both cards. It gives empirical formula evidence a truthful label, omits that standalone warning when the adjacent methodology note already explains it, identifies rating-total mismatches explicitly, and uses a neutral fallback for unknown codes. Comparison warnings are translated and deduplicated before the display cap, so duplicate labels no longer hide distinct warnings. Regression tests first reproduced all three symptoms on the reviewed candidate, then passed after the fix. Candidate, exact-SHA CI, and integration state remain authoritative in the Harness PR control body; this renderer report records image and local test evidence, not a review or CI pass.

## Visual review

Two render test files generated 14 deterministic PNGs at the renderer’s minimum supported width (640 px); static HTML assertions also cover 480 px and 960 px. Visual review covers complete, sparse, partial, conflict, unavailable, not-found, not-computable, and warning-semantics states. The not-found card keeps values unknown without a stale outage warning. Production-shaped missing-field warnings do not expose formula IDs, field/state machine tokens do not appear in user-facing warning text, duplicated rating conflicts and warning labels appear once, collection conflicts keep their own label, rating-total disagreements remain visible, and completion deltas match the rendered values. Missing values stay explicit and Chinese labels remain inside the cards. The comparison card is taller because it also contains episode, subject, and shared-cast data.

Recreate screenshots with:

```sh
BANGUMI_STATS_RENDER_QA_DIR=.artifacts/stats-cards-2026-10-02 \
  pnpm exec vitest run tests/render/subject-stats.test.ts tests/render/subject-comparison.test.ts
```

The PNGs remain local under ignored `.artifacts/`; these hashes bind the reviewed outputs.

| Image                              |     Size |   Bytes | SHA-256                                                            |
| ---------------------------------- | -------: | ------: | ------------------------------------------------------------------ |
| `comparison-complete.png`          | 640×2302 | 269,875 | `61c9a6e2c2ee392109f9578e428caa0ce32a0df55c056a1f2febc39d861f78ec` |
| `comparison-conflict.png`          | 640×2341 | 282,493 | `bc104a60350ac79a0ce3d418add0f213d3ba63c07196044697e646d2d347e61c` |
| `comparison-not-computable.png`    | 640×2309 | 270,335 | `01d1940c69dd350631da8e76d12fdbd4cda8113b2aaa2fa2b99f43ffd21fc015` |
| `comparison-partial.png`           | 640×2328 | 275,926 | `dd20355f903a80cfed28e7c48093a1875b372c40dee51c9f2e46ee13d96dd717` |
| `comparison-unavailable.png`       | 640×2207 | 264,090 | `d5d27ab782eb35151ee9c38f71eda1ee1955e8a890eb57b6d4393a9b7341d16b` |
| `comparison-warning-semantics.png` | 640×2362 | 284,594 | `57cb0ee8c2db89c3740d9a5810a0d6a3d77753d8cf8b3d67cadf22e4b6d7c9c8` |
| `single-complete.png`              |  640×998 |  80,736 | `988d946d788b749f44aacfb8f456459855f625d7c102d15ba7fad7e0ff64d3cf` |
| `single-conflict.png`              | 640×1146 |  98,516 | `d2e34fe1add86a907ea62baefea18f8a86af584250f52ebb34bb308633ffebf0` |
| `single-not-computable.png`        | 640×1038 |  80,884 | `67b3815afb2379da6fe8c3ce54617d305e32354a2704c92bf912a8caf888d18b` |
| `single-not-found.png`             |  640×389 |  29,653 | `03d2cf138d4fd9681eb4fc3d6c5bac330839bd97d6f239cae5a7a86e656bf97b` |
| `single-partial.png`               | 640×1024 |  85,360 | `b2b5c8d450d1e588f784dd4f357f9ceea9fd649c109d6d6670f2c25d7c3a3368` |
| `single-sparse.png`                |  640×998 |  77,736 | `da505a345cc02ef6ff1a015b5ff949117c86290cc158cf25a8a8d4c12388eb57` |
| `single-unavailable.png`           |  640×389 |  30,470 | `d7ee9360bb1557b2d6158d60eb2e21edc995b722c61fc0004d8ca805677604a4` |
| `single-warning-semantics.png`     | 640×1018 |  85,448 | `061fe8556d17a851fed6d126d279ab7f5635bf04a3131b7b512ac4055380d64a` |

## Verification

- `pnpm build` — pass.
- `pnpm test` — 71 files, 458 tests passed.
- `pnpm test:integration:sqlite` — 21 files, 66 tests passed.
- `pnpm typecheck` and `pnpm lint` — pass.
- `pnpm acceptance:check` — pass: 96 catalog/direct execute, 96 Agent→MCP, 65 partial public API / 31 not applicable; QQ pipeline 0/96 and TIM client 0/96 unchanged.
- Focused renderer suite — 2 files, 11 tests passed; 14 PNGs generated and visually reviewed.
- `git diff --check` — pass.
- Targeted Prettier check passed for every changed renderer and render-test file. Repository-wide `pnpm format:check` still reports 98 unrelated pre-existing files outside this patch.

This is renderer fixture and image evidence only. It does not claim deployment, WebChat, QQ, TIM, OAuth, or live Bangumi account acceptance.
