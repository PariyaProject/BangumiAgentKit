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
`030614e34fa3819504459c82129fb1245e317babccd34d392ecf48a092939d25`), bound
to catalog SHA-256
`2e8e47b37a4ebcc2511ff3fe8727abd9496edc4f5bebf4cd0ea798b4936b0c92` and probe
script SHA-256
`aa5e20c363a6787a6b1bc7735b4813dbd018caf537fec422e1e4e57215a935c3`. The
probe was sequential with 1.2-second spacing, anonymous public reads only, and
summary-only persistence. No OAuth, account, community, HTML, writes, QQ, or
TIM path was used. No raw rows or image bytes were saved, and the report will
not be repeated.

If integrated, this report supports only the eight direct public API matrix
rows. It does not add Agent/MCP or scenario-answer credit; A01 stays
UNASSESSED, and no renderer visual-quality claim is made. Before integration,
the same-identity review must explicitly assess the documented deviation
against the selected Epoch's `<=4/tool`, `<=32 total` criterion. No validation
record or review prompt should claim that criterion passed.
