# C07 modern anime magazine

The user selected a modern anime magazine direction: cover-led composition,
refined type and comfortable whitespace. They authorized autonomous design
judgment and asked that good alternatives remain selectable. The rejected
old-paper/coastal-brush proposal is not implemented.

This increment adds `anime-magazine` alongside `warm-editorial`, `clean-gallery`
and `graphic-zine`. It does not replace them or change the default. The first
dedicated native layout is the two-cohort comparison card. Other templates
retain their current structure with the shared pack tokens.

## Reference and implementation comparison

| Area                | Native implementation and deliberate limits                                                                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composition         | Two cover-led columns, different curved upper silhouettes, staggered top edge, aligned score row and an open comparison table. No arbitrary rotation or polygons around every row.                                                     |
| Palette             | Cool light paper, blue A, coral B and teal difference; separately legible dark palette. Colours live in pack tokens, not per-row guesses.                                                                                              |
| Type                | Bundled GenSen Rounded, shared configurable body/display stacks and size multiplier. Default smallest text is 12 CSS px. Brush lettering in the generated image is deliberately replaced by actual readable, configurable native text. |
| Artwork             | Two original synthetic illustrations are test fixtures only. Real subjects use public metadata through the existing safe resolver. A missing or failed cover has an explicit compact fallback.                                         |
| Icons               | One existing outline SVG icon system, consistent stroke weight; no emoji stand-ins or separately generated icon font.                                                                                                                  |
| Data                | Real ViewModel means and B−A differences. Partial/conflicting data stays unknown/non-computable. Large count means use compact units; full structured precision is retained.                                                           |
| Information density | Mobile text remains readable, so the cover-to-page ratio differs from the oversized generated mock. The footer preserves actual source, date and limitations. Invented poetry, slogans and quotes are omitted.                         |

This is a reference-led implementation, not a claim of pixel identity. The
native screenshots are the acceptance surface. The image generator's decorative
lettering and invented prose are not a product specification. The scope is
ready to freeze after engineering checks; concrete user aesthetic acceptance
remains unobserved. Formal Product review and integration retain normal gates.

## Objective QA and stop rule

The final native matrix covers complete, partial, missing-cover, long-title and
large-count states, light/dark, and 320/375/414/768 CSS px at DPR 2. A separate
large-font preview exercises the 1.25 maximum. The browser audit measures both
0.75 and 1.25 at all four widths: 80 combinations. It checks actual custom font
usage, text/card and text/column bounds, aligned score rows, missing-cover
caption separation, CJK final-line widows, horizontal overflow, minimum text
size and computed contrast. It makes no network requests.

Concrete regressions found and corrected: an empty search-image field hiding
the hydrated cover; original captions overlapping missing-art placeholders;
long-title widows and misaligned scores; narrow maximum-font delta overflow;
large numeric counts exceeding table columns. At large type, a relative-font
container query moves the difference below the score pair and gives metric
labels their own line. Default composition remains unchanged.

Designer six-axis assessment: **P4 H4 E4 S4 R5 V4**. The cover pair and semantic
data hierarchy answer this brief; contrast and wrapping are measured; decoration
is restrained. These are scoped release judgments, not an absolute beauty score
or user endorsement. Motion/interactive/nav gates are inapplicable to this
static PNG component. Applicable Hallmark checks cover typography, tokens,
single icon vocabulary, honest data, grid bounds and native output. No fake
browser/phone chrome is drawn.

Once the registry is valid, preserve this version and continue C07 integration
and remaining acceptance work. Only a new explicit request or verified
regression reopens this pack/template. More possible aesthetic variations alone
are not a reason to redraw it.

## Generated asset provenance and prompt set

The **built-in image generation tool** produced the selected reference and two
fixture covers. This normalized prompt set records their design brief and
constraints, rather than claiming a verbatim historical tool transcript:

1. **UI mockup:** Modern anime magazine comparison card; two original anime
   covers, cool light paper, blue/coral/teal semantic accents, refined CJK
   typography, comfortable whitespace, asymmetric curved cover masks, A/B mean
   scores and an open metric table. Original synthetic demo works only; no
   browser chrome or copied franchise artwork.
2. **Cover F illustration:** Original anime girl seen from behind at a
   blue-hour harbor, city reflections and a plane trail; portrait cover art,
   no titles, watermark or UI. Use the selected reference for scene direction.
3. **Cover G illustration:** Original anime girl with tote at a seaside train
   stop, bright sky and sea; portrait cover art, no titles, watermark or UI.
   Use the selected reference for scene direction.

Workspace assets: `references/c07-anime-magazine-v1.png` and
`../../tests/fixtures/render/anime-magazine-cover-{f,g}.png`. Hashes, native
receipts and the recovery commit are recorded in `renderer-baselines.json`.
