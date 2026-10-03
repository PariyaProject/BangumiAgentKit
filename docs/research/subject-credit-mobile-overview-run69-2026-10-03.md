# Run #69: subject-credit mobile overview

- Date: 2026-10-03 (JST)
- Candidate branch: `codex/epoch-subject-credit-mobile-overview`
- Base BangumiAgentKit revision: `3aea963a45c52a40f26c55f6daa42148c5274b13`
- First candidate revision: `84fefb172b9ac9c5d7d885dad495de6009293b22`

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

## Exact candidate-SHA probes

After commit `84fefb172b9ac9c5d7d885dad495de6009293b22`, the same three
read-only ToolRegistry calls were repeated and passed 1/1. The exact-source
Antigravity/MCP overview probe also passed: `get_subject_overview` was the only
Bangumi tool exposed and was called once; the CLI exited 0, the JSON stream had
126 valid lines and no invalid lines, and the sanitized report is retained
locally in PariyaAgent at
`.runtime/research/agent-standard-full-tool-get_subject_overview-subject-218707.json`.

The isolated Renderer/MCP container ran at the same candidate revision and
produced a 720×3440 PNG (519545 bytes; SHA-256
`2511447cf7e65feda9bdc142ff72143fb1f2ad945ac1c3518b385115ff8f5d0b`). The
probe's renderer path reached `renderer_artifact_metadata`, read the PNG back
from the host ArtifactRef store, then exited with `ENOSPC` while attempting to
write an additional local copy. The command therefore returned failure and did
not persist its consolidated strict JSON report. The PNG was recovered from
that run's own temporary artifact directory, visually inspected, and retained
locally in PariyaAgent at
`.runtime/research/run69-subject-credit-overview-84fefb1.png`. It clearly shows
identity, date/type/score, cast, staff, relations, and partial-coverage labels;
the probe's QA arguments capped each section at one returned row. A separate
current-source live Renderer fixture has 7 cast rows, 6 bounded staff groups,
and 9 relations in a 720×5024 PNG.

Renderer artifact generation, host readback, and visual review are proven, but
the combined Renderer/MCP probe is not marked PASS because its strict report
was lost on the storage error. Re-run the isolated probe when Docker and local
storage can record the complete result. No OAuth/account, QQ, TIM, NapCat, or
persistent deployment was used.
