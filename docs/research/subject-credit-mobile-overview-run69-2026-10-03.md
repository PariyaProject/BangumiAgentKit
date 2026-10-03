# Run #69: subject-credit mobile overview

- Date: 2026-10-03 (JST)
- Candidate branch: `codex/epoch-subject-credit-mobile-overview`
- Base BangumiAgentKit revision: `3aea963a45c52a40f26c55f6daa42148c5274b13`

This is interim evidence from the selected Harness Epoch. The ToolRegistry
implementation is unchanged from the base revision; the mobile renderer and
its regressions are in the candidate worktree. Current-source Antigravity/MCP
and Renderer/MCP evidence is still pending. No OAuth, account data, QQ, TIM,
NapCat, or persistent deployment was used.

## Public ToolRegistry sample

Ran `tests/integration/live-subject-credit.acceptance.test.ts` with
`BANGUMI_SUBJECT_CREDIT_LIVE=1` against official v0 through the public
ToolRegistry. The test resolves one public subject and makes three read-only
tool calls:

| Tool                   | Observed result                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `get_subject_cast`     | `ok`, 7 observed/returned rows, not truncated                                                               |
| `get_subject_staff`    | `partial`, 100 rows across 22 raw source-role groups                                                        |
| `get_subject_overview` | `partial`; cast 7 complete, staff 6 groups and truncated, relations 9 complete; 1 warning and 3 limitations |

The public staff response included source relation labels such as `原画`,
`主题歌作曲`, `动画制作`, and `音响监督`. This sample did not include
`原作`, `导演`, or `脚本` labels. The Agent must not infer those credits from
other roles or imply full staff coverage. The integrated card retains the
source partial state, capped staff groups, and coverage note.

## Mobile renderer changes and visual review

`SubjectCard` and `CastCard` now receive the requested render width. Below 640
CSS px they stack their content instead of squeezing titles and cast rows into
side-by-side columns; very narrow subject cards use a 120px cover. Long CJK,
Japanese, and unbroken Latin names wrap within the card. Exact duplicate
display/original titles omit the redundant subtitle, while distinct original
titles remain visible. Subject media types use localized labels in subject and
related-entry cards. Cast cards use a descriptive heading and retain the
source-provided relation text.

Chromium measurements at 320, 360, and 520 CSS px report no horizontal or
in-element text overflow for long mixed-script titles, multiple actors, missing
cover/avatar images, an actorless row, and a bounded hidden-role count. The separate live
360 CSS px / 2x CastCard shows the seven returned character/actor rows. The
360 CSS px / 2x overview was visually inspected: identity, score, partial staff
sample, cast, relations, and section coverage fit one PNG without clipping.
The full-size/default renderer remains covered by the existing suite.

Current public artifacts were generated locally and visually inspected. Their
PNG bytes and public image assets are intentionally not committed:

```text
/tmp/run69-subject-credit-live/
  subject-card-360.png      720 × 1558, 294158 bytes
  cast-card-360.png         720 × 1960, 202361 bytes
  subject-overview-360.png  720 × 5024, 729860 bytes
```

## Validation

- `pnpm test`: 72 files / 465 tests passed.
- `pnpm test:render`: 28 files / 123 tests passed.
- `pnpm test:integration:sqlite`: 70 passed, 1 expected opt-in test skipped.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`, and changed-file Prettier check passed.
- `pnpm acceptance:check`: 96 tools, 96 direct execute fixtures, 65 public
  evidence rows, 22 no-account auth-denial rows, 33 real OAuth/account rows
  still pending, and QQ/TIM client coverage remains 0/96. The generated table
  now cites the additional live ToolRegistry fixture for its three tools.
- The opt-in current-source public acceptance test passed 1/1 and generated
  the three PNGs above. No model or QQ/TIM client was involved.

## Remaining acceptance

Before Candidate readiness, pin this work at its committed SHA and run one
isolated natural-language Antigravity/MCP overview probe plus one isolated
Renderer/MCP probe. Verify exact tool selection, subject identity, source
relation labels, honest partial coverage, PNG ArtifactRef readback, and the
rendered image. Keep the resulting sanitized reports and images local; do not
count this as OAuth, QQ, TIM, or full-catalog client evidence.
