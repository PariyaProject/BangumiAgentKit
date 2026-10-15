# Run #95 current public matrix probe request-budget deviation

The selected Epoch planned at most four HTTP requests per tool and 32 total.
The single sequential `scripts/smoke-public-tools-online.ts` run selected eight
fixed `auth=none`, `risk=read` tools against the current catalog and observed
37 requests. All eight bounded assertion sets passed. The four cohort tools
each made seven requests with `maxSubjects=1`; the other tools made one to three
requests each. The five-request difference is a deviation from the selected
Epoch's numeric criterion, not evidence that the original cap was met.

The exact sanitized report is
`docs/live-probes/public-tools-2026-10-15-100937400-22734.json` (SHA-256
`5f2f25821439032d857b0afb2b449e539f7eb759ef8832f44321c09346df6369`), bound to catalog SHA-256
`2e8e47b37a4ebcc2511ff3fe8727abd9496edc4f5bebf4cd0ea798b4936b0c92` and probe
script SHA-256
`aa5e20c363a6787a6b1bc7735b4813dbd018caf537fec422e1e4e57215a935c3`. The
probe was sequential with 1.2-second spacing, anonymous public reads only, and
summary-only persistence. No OAuth, account, community, HTML, writes, QQ, or
TIM path was used. No raw rows or image bytes were saved, and the report will
not be repeated.

The report is retained as a record of the direct observations, but it is
explicitly marked `acceptanceEligible: false` because it exceeded the selected
Epoch request budget. All eight rows are excluded from the public API
acceptance matrix, which remains at 57/65 with those eight rows pending. The
observations do not add Agent/MCP or scenario-answer credit; A01 stays
UNASSESSED, and no renderer visual-quality claim is made. The exclusion does
not amend the selected criterion or claim it passed.
