# Run #86 current-source person-activity comparison

- Epoch: `current-person-activity-comparison-evidence` (PR #88)
- Base: `e45f7384b707ffbad137513b4f5189cd70c3f5d7`
- Candidate: `c4acc246551d31ddfc91b54d1031d4454365a7fc`
- Catalog SHA-256: `26672c59d62f41910457fcee14f7925c615b17ff6ff658cac0e3ca053a02e08e`
- Sanitized Agent/MCP evidence: [`person-activity-comparison-run86-c4acc24.json`](../live-probes/person-activity-comparison-run86-c4acc24.json)

## Six-lane selection delta

1. **Recorded opportunities and deferred work.** OP-001 remains PARTIAL and asks whether a bounded voice-actor activity view can answer the useful part of a workload question. The community Structured Web frontier is separate; its source contract is not part of this Epoch.
2. **Capability maturity and user journeys.** G05 and S07 already had deterministic comparison and observed-peak semantics, but lacked a current-source Agent/MCP call with `comparePreviousWindow=true`. This Epoch supplies one exact-Candidate readback and keeps both records PARTIAL.
3. **Agent UX and discoverability.** The MCP presenter now supplies a bounded answer summary with both period boundaries, state-aware count and delta omissions, observed peak, and limitations. CLI 1.2.14 completed one `bangumi.get_person_activity` call; the text result was 3218 bytes, within the 3600-byte cap.
4. **Renderer and Standalone quality.** Prior bounded Person Activity card and Standalone presentation evidence remains in place. The selected change tests the Agent text path and does not change Renderer semantics.
5. **Correctness, evidence, degraded states, and resource bounds.** Both adjacent six-calendar-month windows remained `partial`. The recent period had `rowsEligible=0`, so its summary count was omitted; the previous period exposed one observed subject. The partial delta had no numeric value. The observed peak was April 2026 in the previous window. The sanitized answer checks passed for identity, both boundaries, omissions, coverage, and peak, and found no unqualified actual-workload, complete-career, or historical-trend claim. The MCP summary check confirmed scope-limit text. The result used caps of 48 relations, 12 subject details, and 20 rows.
6. **Architecture, maintenance, and testability.** The Epoch reuses the existing `get_person_activity` ToolRegistry/MCP presenter path. It adds no source, schema, storage, authentication, community, or write boundary. The report is checked by `tests/integration/tool-e2e-acceptance.test.ts`.

## Exact public call

- Isolated Agent CLI version: `1.2.14`; both exact-source QA images carry the Candidate revision label.
- Arguments: `personId=13684`, `kind=voice`, `media=tv`, `windowMonths=6`, `comparePreviousWindow=true`, `maxRelations=48`, `maxSubjectDetails=12`, `maxRows=20`. The adapter matched every expected argument field and reported `passed=true`.
- Process exit: `0`; result status: `SUCCESS`; result count: `1`; target tool outcome: `DONE`; no other Bangumi tool completed. Structured result readback passed. No prompt or answer prose is retained.
- Recent window: 2026-05-01 through 2026-10-04, `partial`; 115 relation rows observed, 48 selected, 67 dropped at the relation cap, 12 detail requests succeeded, and zero rows were eligible. The result omitted its summary count due to coverage.
- Previous window: 2025-11-01 through 2026-04-30, `partial`; 115 relation rows observed, 48 selected, 67 dropped, 12 detail requests succeeded, and one row/subject was eligible and returned.
- Delta: `partial`, numeric values omitted due to coverage. Observed peak: `partial`, one observed unique subject in 2026-04 of the previous window.

## Acceptance boundary

G05, S07, and OP-001 stay PARTIAL. The result measures current official-v0 release-date observations under relation, detail, and output caps. It does not measure labor time or actual workload, reconstruct historical snapshots, provide a full-career total, or establish complete period coverage. The response validation found no unsupported workload, career-total, or trend claim. `qqPipelineTested=false` and `timClientTested=false`; no authentication, account, private, write, community, QQ, or TIM action occurred. Existing 96/96 Agent/MCP tool coverage and 0/96 QQ/TIM counts do not change from this additional scenario.
