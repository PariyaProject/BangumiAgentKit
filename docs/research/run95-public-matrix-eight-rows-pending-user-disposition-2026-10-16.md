# Run #95 public matrix: eight rows left pending

Date: 2026-10-16

## Decision and current state

The public acceptance target remains 65/65. The user directed that the eight rows originally assigned to parked PR #173 remain pending and that its spent over-budget probe not be repeated. The current matrix therefore records 57/65 applicable public rows, eight pending, and 31 public N/A rows.

Current master had separate, hash-bound reports for these eight tools through merged PR #182. The reports remain unchanged as audit evidence. Per the user's row-level disposition, their public-matrix credit is excluded through `docs/product/public-api-evidence-exclusions.json`, which binds each exclusion to the exact report SHA-256 and tool list. The acceptance generator fails closed if an excluded file changes or its tool set no longer matches. No public probe or API request was run to make this disposition.

## Pending rows and retained reports

| Tool                                        | Retained report                                                                                |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `bangumi.aggregate_subject_cohort`          | `public-tools-2026-10-15-174045481-99856.json`; `public-tools-2026-10-15-185150132-91752.json` |
| `bangumi.compare_subject_cohorts`           | `public-tools-2026-10-15-174045481-99856.json`; `public-tools-2026-10-15-185150132-91752.json` |
| `bangumi.get_person_profile`                | `public-tools-p02-person-profile-chronology-2026-10-15.json`                                   |
| `bangumi.query_subjects`                    | `public-tools-2026-10-15-182145883-4567.json`; `public-tools-2026-10-15-185150132-91752.json`  |
| `bangumi.render_person_profile`             | `public-tools-2026-10-15-151849327-87132.json`; `public-tools-2026-10-15-154413213-10706.json` |
| `bangumi.render_query_subjects`             | `public-tools-2026-10-15-174045481-99856.json`; `public-tools-2026-10-15-185150132-91752.json` |
| `bangumi.render_subject_cohort_aggregation` | `public-tools-2026-10-15-174045481-99856.json`; `public-tools-2026-10-15-185150132-91752.json` |
| `bangumi.render_subject_cohort_comparison`  | `public-tools-2026-10-15-174045481-99856.json`; `public-tools-2026-10-15-185150132-91752.json` |

The six-tool PR #182 report contains 26 requests against its recorded 32-request total limit, with all six assertions passing. The separate person-profile reports each contain four requests against four-request limits, with passing assertions. These observations are preserved but do not satisfy the user-directed current row disposition.

## Boundaries

- PR #173 stays open and parked. Its old 37-request report is not present in current master and is not rerun or credited.
- PR #182 remains merged; its reports are not edited or deleted.
- No scenario, Agent/MCP, authentication, account, community, HTML, write, QQ, or TIM evidence is inferred from these public reports.
- The target remains 65/65; the current accepted count is 57/65 until future separately authorized evidence changes the row disposition.

## Later Run #95 Epoch update — 2026-10-16

The preceding decision records the state when PR #173 was parked. In a later bounded Run #95 Epoch, a distinct set of hash-bound reports refreshed all eight public matrix rows without repeating PR #173's spent 37-request probe or claiming its report. The candidate acceptance table now records 65/65 public rows, zero pending, and 31 N/A; the master baseline at this Epoch's Base was 57/65. The user-directed target remains 65/65 and PR #173 remains parked. These reports add no scenario, Agent/MCP, authentication, account, community, HTML, write, QQ, or TIM credit. The candidate report paths are recorded in `docs/product/frontier-ledger.json` and the generated table at `docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md`.
