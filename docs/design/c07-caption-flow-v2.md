# Magazine v2: original-name visibility

The magazine composition remains the selected direction. Formal review of v1
confirmed that its scope is sufficient, then identified a functional exception:
a valid 180-character original name could exceed the fixed cover height at
320 CSS px and the maximum 1.25 font scale. This is a verified regression reopen,
not a new visual concept. Preserve the v1 registry entry, source and previews.

Artwork now owns its rounded crop. Caption text stays in normal flow and the
frame can grow. Original names longer than 40 characters use a full-width reading
line below the cover pair, keeping both images at their normal proportions.
The threshold chooses presentation; safety does not depend on estimating glyph
width, shrinking type or truncating the name. Shorter captions also remain in
normal flow. Dates and B−A formula tokens stay together when large type reflows.

The same reference, palette, fonts, covers, scores, metric table and user-selectable
pack remain. No new image generation or unrelated template redesign is needed.
The latest baseline is appended as `c07-anime-magazine-v2`, with `supersedes` and
the review finding `anime-magazine-long-name-caption-clip` as its reopen evidence.
The concrete user's aesthetic acceptance remains unobserved; autonomous scoped
designer acceptance and formal Product review are separate.

## Regression coverage

The fixture now includes a 180-CJK original name alongside the five previous
states. The browser audit covers 96 combinations: six states, four widths, two
palettes and both supported extreme font scales. It requires every original name
to remain present and untruncated, and checks text against clipping ancestors,
card/column bounds, loaded custom fonts, contrast, score alignment and wrapping.
The old fixed-height implementation fails the new checks. The corrective layout
passes without hiding source text. A dedicated 320 px, 1.25-scale PNG exercises
the exact reported boundary.

The C07 identity correction also follows the whole execution path: local runner,
actual Harness claim readiness, terminal result, signed report writer, Python
matrix acceptance and final merge reconciliation. The identifier remains an
opaque nonempty handle. Exact identity equality, trusted PASS, Candidate/Base,
seven-check CI, signatures, registry and permanent no-retry bindings remain.
The workload's pinned model/effort is preserved; identifier spelling does not
prove the reviewer's runtime model. Mock claim→terminal→merge, real signed-report
validation and Python shape regressions exercise local-path and URI-like handles,
reject a mismatching identity and retain consumed-claim rejection.

This correction is scoped to the C07 profile family. Other frozen profile/report
contracts retain their history and need their own complete-path audit before
future claims. No spent profile is rerun. The nonblocking suggestion to extract
shared metric presentation metadata is deferred; it is unnecessary for these
two functional corrections and would broaden changes to retained layouts.

The native receipt and source commit in `renderer-baselines.json` identify the
current evidence. Preserve the completed version and resume other acceptance
work. Further change requires another explicit request or reproducible regression.
