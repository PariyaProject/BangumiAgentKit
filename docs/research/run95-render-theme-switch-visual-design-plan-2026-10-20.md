# Run #95 renderer theme and visual-system plan

Date: 2026-10-20

Opportunity: OP-013, QQ Image Theme Preferences
Prototype: local branch `codex/prototype-run95-card-layouts`, commit
`98953276c614e4e7c84eaaa658249ecf56c9a7b0`.

## User need

The user asked for a one-message way to change image style and called out that
changing only a dark palette would leave the existing cards too text-heavy.
They specifically asked us to carry forward the iconography, color, layout, and
image quality of their earlier Bangumi QQ projects.

## Reference audit

- [Bangumi-for-QQ](https://github.com/Kurarion/Bangumi-for-QQ) includes a
  cover-led subject reply example. Its visual cues are a prominent cover,
  a visible collection state, and the recognizable bot identity.
- [Bangumi-QQ-Bot-CPP](https://github.com/Kurarion/Bangumi-QQ-Bot-CPP) documents
  base and account-linked subject reply images (`subject_base.png` and
  `subject_plus1.png`) and separate extra-information replies. This is useful
  evidence for keeping cover, user state, and detail sections easy to scan.
- Both projects identify their old bot as discontinued in their usage guides.
  Use them as product-design references; do not copy their runtime, assets, or
  account behavior.
- The existing ImageGen board compares clean-gallery, warm-editorial, and
  anime-purple palettes. Since those concepts share one layout, this plan adds
  a structural comparison before production layout changes.

## Prototype finding

Three synthetic, offline card structures were compared in the prototype:

1. **Editorial cover hero** — the cover anchors a subject card; title, score,
   collection state, and three metadata facts form a clear reading order.
2. **Bento statistics** — rating distribution, collection progress, and
   source-covered sections sit in bounded metric panels.
3. **Progress timeline** — dated source observations and personal progress read
   as a sequence, with collection state summarized beside it.

Recommended implementation: use the structure that matches the information.
Use the editorial layout for subjects and cover-led collection cards, bento
panels for statistics and collection summaries, and a timeline for revision or
observation history. Keep lists compact for search results, cast, and high-count
results. Do not apply one card grid to every template.

The prototype uses inline SVG icons and a CSS-only cover illustration. The
production renderer will use semantic inline SVG icons and existing Bangumi
covers from the current asset pipeline. A missing cover uses a deterministic
local placeholder. Generated artwork is a design reference only; it is not
embedded as a Bangumi subject image.

The QQ local information-card fallback follows the same visual system: a
cover-led title area, category icons beside section headings, and separate
content panels in both themes. It lays out the supplied answer text without
turning it into new statistics or identity claims. A synthetic sample was
rendered and visually checked in light and dark; the pinned AstrBot fixture
continues to exercise native JPEG delivery with networking disabled.

## Visual rules

- Clean-gallery light is the QQ default. The current dark palette stays
  selectable with `图片风格 深色`; `图片风格` toggles and
  `图片风格 当前` reports the selection.
- Icons identify content families and are always accompanied by Chinese text.
  Status meaning remains explicit in text and shape, so color alone never
  carries completeness or availability.
- Real covers use the existing resolver and aspect-ratio handling. Missing
  covers stay local and deterministic. No icon CDN, external image URL, or new
  asset service is introduced.
- Charts show the values and populations they represent; decorative marks do
  not imply unsupported scores, recommendations, or trends.
- Text, muted labels, accent labels, scores, success, and warning tokens must
  meet a 4.5:1 contrast ratio on the renderer's three surfaces.

## Implementation and acceptance

1. Complete the per-sender QQ preference path, validate the two-value enum,
   and carry only that enum through Gateway/Runner to the isolated renderer
   environment. Preference commands remain local and bypass the model call.
2. Build shared title/icon treatment in BangumiAgentKit and PariyaAgent, then
   apply editorial, bento, timeline, or compact-list structure by content
   family. Preserve ViewModel semantics, source coverage, and existing image
   resolution.
3. Run the synthetic offline renderer matrix for both themes at 320, 360, 520,
   640, and 960 CSS px. Review every final PNG in template/state contact sheets;
   inspect full-resolution stress, degraded-state, and narrow-width cases.
4. Record per-image SHA-256, dimensions, byte count, layout measurements,
   manual-review status, visual findings, and the exact source Candidate in the
   companion visual QA report.
5. Keep real QQ/TIM delivery and OAuth/account behavior outside this visual
   evidence. The local synthetic host fixture validates command-to-renderer
   routing only.

The renderer has 29 templates and multiple complete, partial, conflict,
unavailable, and not-found fixtures. The first theme-system Candidate passed
exact CI, same-identity review, and Harness integration as PR #241 on
2026-10-20. OP-013 remains `PARTIAL`: that synthetic renderer evidence does not
establish real QQ/TIM delivery. No live QQ/TIM message is claimed.

## Second iteration — visual structure refinement

After reviewing the first 580-image matrix, the user called out that the new
palette and icons still left some cards looking like dense text reports. The
contact sheets support that concern: the theme switch works, but Subject
Overview and Collection Dashboard need stronger content hierarchy. This is a
layout issue, not another palette request.

The new design reference board is
[`run95-render-editorial-bento-timeline-board-2026-10-20.png`](assets/run95-render-editorial-bento-timeline-board-2026-10-20.png).
It compares three structures using the same fictional subject:

- **Editorial cover hero** for a work overview: the real work cover anchors
  the card; title, available score/rank, and public metadata lead. Public
  aggregate collection counts may appear as clearly labeled chips; they never
  imply a personal collection state. Detailed statistics and coverage follow.
- **Bento metrics** for a collection dashboard: three source-backed sections
  have distinct panels and direct summary values, with evidence and limits
  still available at a quieter visual level.
- **Timeline rail** for revision history: dated observations read in sequence,
  while entity, author, missing-field, and coverage details remain explicit.

The generated artwork and copy in the board are not product data. Production
cards use the existing cover resolver, deterministic local fallback, and
code-rendered SVG icon family. Icons remain paired with text; no generated
text, fabricated statistics, external icon, or external image enters a card.

The active Run #95 Epoch `run95-render-editorial-layouts-20261020` implements
these three template-specific structures. The per-sender light/dark command
and cache separation remain unchanged; layout selection follows content type.
Acceptance repeats the complete 29-template, two-theme, five-width synthetic
matrix and records every image receipt. It grants renderer presentation
evidence only, not Agent/MCP, account, OAuth, QQ, or TIM acceptance.

### Long-card density rule

The first high-resolution pass found that a complete Subject Overview still
reached 11,160 physical pixels at the 320 CSS-pixel target because it printed
large staff groups in full. Long revision summaries also dominated narrow
cards. The image may now show a responsive excerpt, while the ViewModel remains
complete. Every excerpt reports the exact number returned and the number shown;
staff rows report visible/total member counts, and omitted groups or relations
are called out. The card never uses an excerpt as evidence that the source had
no more data.
