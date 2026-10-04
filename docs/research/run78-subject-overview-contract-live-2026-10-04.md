# Run #78: SubjectOverview bounded staff contract

- Date: 2026-10-04 (JST)
- Product base: `313986637a49e0e2af8bfca9fbc9855de7909704`
- Source: official v0 through the public ToolRegistry
- Command: `BANGUMI_SUBJECT_CREDIT_LIVE=1 SUBJECT_CREDIT_ACCEPTANCE_DIR=/tmp/pariya-run78-subject-credit-current-candidate pnpm vitest run tests/integration/live-subject-credit.acceptance.test.ts`
- Result: PASS, 1 file / 1 opt-in test

The test uses public subject 218707 and no OAuth, account data, QQ, or TIM. It
asserts the current `bangumi.get_subject_overview` tool description carries the
raw-role and bounded-absence guidance, then checks current cast/staff identity
links and renders the composed card.

| Capability | Observed result |
| --- | --- |
| `get_subject_cast` | `ok`; 7 observed/returned character rows and 7 actor links; raw labels were 2 `主角` and 5 `配角`; no truncation |
| `get_subject_staff` | `partial`; 100 rows across 22 exact raw relation labels; every grouped member ID resolved to a returned staff identity |
| `get_subject_overview` | `partial`; cast 7 complete, staff 24 rows in 6 bounded groups and truncated, relations 9 complete; 1 warning and 3 limitations |

The live overview Artifact rendered at 360 CSS px / 2x as a 720 × 5228 PNG,
771,034 bytes, SHA-256
`50a061d7c53e848094b410a0e955ffb168abfc2e694b0c40727eb8f33de80422`. It was
read from the local test output and visually inspected. The staff note keeps
the raw-role, bounded-result, and unobserved-does-not-mean-absent wording
readable beside the returned role groups. The generated PNG remains under
`/tmp/pariya-run78-subject-credit-current-candidate/`; it is not committed.

This confirms current public ToolRegistry and Renderer behavior. It does not
validate a natural-language Agent answer or a QQ/TIM client, so G06/G07/G17
remain `PARTIAL`. The stricter exact-source Agent/MCP answer validator and its
current tool-catalog binding still need separate acceptance.

Updating the two overview tool descriptions changed the generated catalog.
After refreshing `docs/tool-catalog.json`, a hash-bound public smoke rechecked
`get_person_activity`, `get_subject_overview`, and `render_subject_overview`;
the generated table now reports 65/65 live-public rows. It reports 93/96
Agent/MCP rows because the prior model reports for those three tools remain
bound to the earlier catalog hash and have not been rerun. Historical reports
and catalog snapshots were not rewritten.
