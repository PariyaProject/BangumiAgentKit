# Compact magazine calendar — native candidate

The existing `anime-magazine` selector now uses an open, cover-led calendar.
The three other packs retain their full-week composition. On the same synthetic
three-entry 375px specimen, height falls from 955px to 636px. This is a source
candidate, not deployment, account compatibility or new-client acceptance.

The masthead, weekday rail, portrait covers, restrained curve, sequence markers
and open rows follow the
[generated reference](run95-compact-calendar-native-qa-2026-11-05/reference.png).
Actual supplied titles, metadata and coverage take precedence over the reference's
placeholder copy. Shared fonts / 0.75 default, palette, icon implementation, C07,
catalog and provider semantics are unchanged. Pack selection already provides
switching; no public layout parameter was added.

The rail distinguishes displayed counts, known zero, unknown and not displayed.
Missing or conflicting weekdays remain explicit. Unavailable source data does
not become an observed zero. Both names, first-air dates, known zero statistics,
warnings and supplied limits survive. Empty weekday groups no longer create
six tall content panels around a three-entry sample.

## Measured native checks

The [sealed bundle](run95-compact-calendar-native-qa-2026-11-05/manifest.json)
records exact source, font and artifact hashes. Measurements were made in the
working tree based on `ec350dd7`; receipt source-file hashes bind the implementation
independently of that prepared HEAD. They must match the engineering commit.

- 104 actual RenderService PNGs: eight semantic states × four widths × two
 palettes, additional 320px maximum-font cases, and 24 old-pack comparisons.
 All pass, with 0 external requests. The actual browser-input HTML is captured
 at the BrowserPool seam rather than recreated by the audit.
- 128 separate DOM text audits cover all eight states × 320/375/414/768 ×
 light/dark ×0.75/1.25. No outside-card text, isolated punctuation or final
 single-glyph title lines remain. Minimum measured text contrast is5.467:1.
- All 80 magazine PNG cases use a bundled custom font for actual rendered glyphs,
 confirmed through Chromium CDP, alongside loaded-face hashes.
- All 24 unaffected pack samples retain identical HTML, PNG and cache hashes.
 The calendar/magazine cache namespace changes; global renderer version and
 other identities remain. The locked C07 baseline validator passes.
- Six focused semantic/payload regression checks and both existing Calendar PNG
 checks pass; renderer build/typecheck and scoped lint pass. The full Epoch
 remains unfinished and is not yet a review Candidate.

Selected images include
[default375](run95-compact-calendar-native-qa-2026-11-05/anime-magazine-partial-three-bangumi-light-375-0.75.png),
[long titles375](run95-compact-calendar-native-qa-2026-11-05/anime-magazine-long-missing-covers-bangumi-light-375-0.75.png),
[maximum type320](run95-compact-calendar-native-qa-2026-11-05/anime-magazine-long-missing-covers-bangumi-dark-320-1.25.png),
[weekday conflicts](run95-compact-calendar-native-qa-2026-11-05/anime-magazine-weekday-conflict-bangumi-light-375-0.75.png),
[known empty](run95-compact-calendar-native-qa-2026-11-05/anime-magazine-known-empty-bangumi-light-375-0.75.png),
[unavailable](run95-compact-calendar-native-qa-2026-11-05/anime-magazine-unavailable-bangumi-light-375-0.75.png)
and the
[56-entry case](run95-compact-calendar-native-qa-2026-11-05/anime-magazine-bounded-large-bangumi-light-375-0.75.png).
These were visually inspected; the receipts cover the complete matrix. Photographic
fixtures are synthetic artwork and never replace real Bangumi covers.

## Failures retained and fixed

The first expanded run completed 60 cases, then failed at 56 dense entries.
Its missing terminal receipt exposed a QA recovery gap: the producer now flushes
each completed result and writes bounded failure state. The failed run and its
partial status are preserved, not relabelled PASS.

A cold 56-entry reproduction failed in 875ms with185,230,345 bytes of HTML;
28 entries succeeded. The first hypothesis, that existing image normalization
alone would solve the issue, was falsified: production processing still left
174,047,561 bytes and failed. Keeping all 56 entries while creating display-sized
covers produced 15,735,273 bytes and succeeded in 965ms. The exact Chromium or
transport failure mechanism is unproven; oversized image payload is the observed
trigger. Production timeouts and data counts were not raised or reduced.

Calendar/magazine cover preparation now shares its 72/96 CSS-pixel dimensions
with the component and includes DPR. It runs inside existing asset concurrency
and deadline bounds. All other packs/templates preserve their asset bytes.
A regression at the real RenderService→BrowserPool seam fails before this fix
at 184,889,673 bytes, then passes below 24MiB while retaining all 56 entries.

The initial 128-case text audit separately found four configurations with final
single-glyph title lines. Balanced wrapping fixes them; top alignment keeps covers
beside long text, and reduced internal placeholder padding prevents “暂无封面”
from leaving one glyph alone. The four focused counterexamples and final full
128-case audit pass. The earlier failing text receipt remains in the bundle.

## Design judgment and remaining work

Component-scope Hallmark assessment: Philosophy 4, Hierarchy 4, Execution 4,
Specificity 4, Restraint 4, Variety 4. Existing semantic tokens and one icon family
are used. Static source states replace interactive/motion demos. This is the
designer's bounded recommendation for the native component, not user aesthetic
approval or formal Product PASS. User aesthetic acceptance remains unobserved.

Preserve this measured composition unless a reproducible regression or review
finding requires a correction. Continue the same PR with the separately sealed
twelve-input compiled-MCP compatibility witness. Current-source account/client
readers correctly reject the changed runtime; old receipts are immutable.
The completed old TIM observation cannot accept these new pixels. New-output
client acceptance follows reviewed source and deployment separately; no spent
profile or completed client journey is replayed here.

Reproduction, from a built checkout, uses fresh owned outputs:

```sh
node scripts/acceptance/render-calendar-magazine-qa.mjs --output /fresh/native-dir --baseline /path/to/before-change/receipt.json
node scripts/acceptance/audit-calendar-magazine-text.mjs /fresh/text-audit.json
```

The before-change receipt is retained in PariyaAgent's November5 source-impact
audit bundle. These are closed synthetic QA programs, not an account/profile
runner, and grant no new matrix credit.

<!-- Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4; component-scope; user acceptance unobserved -->
