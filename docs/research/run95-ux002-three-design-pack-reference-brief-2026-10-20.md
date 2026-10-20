# Run #95 UX-002 — three renderer design-pack references

Date: 2026-10-20

Epoch: `run95-ux002-three-render-design-packs-20261020`

Base: `376ac9231449646bafa201082f03fc8e44f3c675`

## Purpose and comparison method

These three ImageGen boards compare complete visual systems for the same three message-card roles: a cover-led subject card (`subject-card`), rating statistics (`subject-stats`), and a revision-event timeline (`revision-timeline`). They are art-direction references only. Each board uses the same fictional subject title and core facts, but independent generation introduced slightly different cover crops and extra/mislabelled copy. Product fixtures use one identical cover file and fixed ViewModels across every pack so image variation comes from renderer design, not input data.

The generated image text is not authoritative. In particular, the boards' timeline card sometimes substitutes episode-airing copy for revision events and one board invents extra dashboard sections. Production templates must retain their actual event semantics and only display fields in their ViewModel. No generated mockup pixels, generated cover art, slogans, or unverified statistics enter product output.

## Reference boards

| Pack           | Reference                                                       | SHA-256                                                            | Direction                                                                                                                                                                                                                                                                              |
| -------------- | --------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Warm Editorial | [board](assets/run95-ux002-warm-editorial-board-2026-10-20.png) | `76188fd045c1cea5754ce16c1bcb46de174136953e121698453635a7c0bcfc86` | Warm ivory paper, ink typography, large cover/title moment, vermilion details, folio/rule rhythm, restrained semantic stamp icons.                                                                                                                                                     |
| Clean Gallery  | [board](assets/run95-ux002-clean-gallery-board-2026-10-20.png)  | `64b496f51239b8ad2d903c392d93591c3deab6a40ac30a69076731773e1a2eed` | Bright white gallery mats, spacious asymmetric grid, clean sans-serif hierarchy, clear blue/mint outline icons, crisp data panels and generous margins.                                                                                                                                |
| Graphic Zine   | [board](assets/run95-ux002-graphic-zine-board-2026-10-20.png)   | `2d5e6cbab5cecba6cecbc4b1567ca9ceb061a438e8a9ca95c2e44c2ff1350bcc` | Bold display type, angled panel cuts, numbered/sticker-like markers, original heavy-silhouette icons, cobalt/coral/sun-yellow accents. Keep the production light palette warm-white-dominant; the board's deep blue illustration panels must not turn the renderer into a night theme. |

All boards are 1536 × 1024 PNG. Each shows the same fictional title, rating, progress, and three card types. Their independently generated cover artwork is only a composition cue. The fixed comparison uses one purpose-drawn local SVG in `tests/render/fixtures/ux002-reference-cover.svg` to keep the wide hero crop crisp; it is test-only and does not enter runtime output. Runtime output continues to use the existing cover resolver and deterministic missing-cover fallback.

## Fixed synthetic comparison fixture

Use the exact same synthetic facts and SVG cover bytes for all packs and palettes:

- Subject: `星港纪行`, fictional 2025 TV anime, 12 episodes, science-fiction/adventure.
- Aggregate score: 8.4/10 from 1,284 fictional ratings. To make the visible chart deterministic, counts are: score 3: 2, 4: 8, 5: 24, 6: 50, 7: 130, 8: 360, 9: 500, 10: 210. Total = 1,284; weighted mean = 8.4486, displayed to one decimal as 8.4.
- Personal progress: 9/12 episodes (75%) in the isolated synthetic linked-account fixture only. Anonymous fixtures never show this value. A renderer progress bar is visible only when the validated watched/total pair is available.
- Secondary layout-only collection histogram for `subject-stats`: want 2, collected 4, watching 2, on hold 1, dropped 1 (10 synthetic entries total). It exercises the five status rows and is not a product fact.
- History template: fixed synthetic revision events from the revision ViewModel, with a visible demo disclosure. Never replace revision events with airing schedule rows.
- Auth/message states: synthetic unlinked, linked, expired/reauthorization-required, and insufficient-permission cases. Do not use real account identifiers, OAuth results, or QQ/TIM messages.

## Implementation rules frozen from comparison

1. **Three packs, separate from palette.** The pack controls layout and component treatment; light/dark controls surfaces and contrast. Each pack needs its own information hierarchy, spacing/grid rules, type scale, icon construction and cover treatment, not merely different colors.
2. **Pack-specific structure by content family.** Subject/collection cards may lead with a cover or image mat; statistics use bounded, source-backed panels; timelines use the actual timeline event model; dense search/cast/list templates retain compact rows appropriate to their data.
3. **Icons carry meaning with text.** Editorial uses fine stamp-like outlines, Gallery uses precise geometric strokes, and Zine uses bolder filled silhouettes. Each semantic icon has a stable accessible label and an adjacent Chinese text label; status is never color-only.
4. **Mobile first, truthful density.** At 320/360 px avoid title/cover collisions, horizontal spill, compressed labels, and clipped content. Any bounded excerpt states shown/returned counts and preserves source coverage.
5. **Light is the welcoming default.** Warm Editorial and Clean Gallery use bright surfaces. Graphic Zine keeps a light canvas with controlled bold blocks; dark palette remains a separately selectable subdued counterpart.
6. **Asset and data safety.** Use existing local cover/avatar resolvers, shared local synthetic assets, and code-drawn SVG. No external icon/image CDN and no generated copy/data in the product.

The fixed board-comparison suite is 3 templates × 3 packs × 2 palettes × 5 widths = 90 images, rendered from the same title, rating histogram, local cover bytes, synthetic linked progress, and revision-event model. The next visual QA report must bind every final PNG to its exact renderer Candidate and fixture, record dimensions/bytes/SHA/layout measurements and reviewer disposition, compare every template/state contact sheet, and inspect full-resolution stress cases. The three boards do not count as renderer acceptance or QQ/TIM client evidence.
