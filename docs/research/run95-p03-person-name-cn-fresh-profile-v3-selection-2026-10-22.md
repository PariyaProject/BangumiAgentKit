# Run #95 P03 v3 fresh public person selection

Read-only source selection for the new P03 v3 matrix profile, checked 2026-10-22. No profile claim, MCP/ToolRegistry invocation, account/OAuth/community/write/QQ/TIM action, or report creation occurred.

## Distinct bounded input

- The official public Bangumi v0 `GET /v0/subjects/218707/persons` response contained 157 person rows. The selected `personId=58609` was not present in any existing registered `bangumi.get_person_profile` profile input; four already-registered inputs were excluded from selection.
- The official public `GET /v0/persons/58609/subjects` response contained 35 observed subject rows. Of the first five rows, all five had a non-empty `name_cn` after trimming. Only identifiers and aggregate counts were retained here; no person/title names or raw rows are stored.
- The new registered profile is distinct from P03 v1 (`personId=4765`), P03 v2 (`personId=19306`), and P02 v1/v2. It uses `personId=58609`, `maxSubjects=5`, `maxCharacters=1`, `includeCredits=true`, and `includeChronology=false`, with a unique profile/claim/report identity.

## Evidence limits and invocation gate

These observations are selection evidence only. They do not establish complete person-work relationships, stable ordering, a career-wide list, or that any omitted row lacks a Chinese name. The actual one-shot must validate the contemporaneous returned coverage and exact positive rows, disclose truncation and source limitations, and earn only the `bangumi.get_person_profile` Agent/MCP matrix cell. P03 remains `PARTIAL`.

The runner may accept at most three Codex error items only when the local sanitizer classifies every item as an explicitly blocked/disabled web-search error. Unclassified errors and all non-MCP tool events still fail; the report stores only category counts, never error text. This classification does not enable web search.

The profile may be invoked exactly once only after its exact Candidate, current Base, seven exact-SHA CI checks, Harness Candidate gate, and same-identity Luna Max review pass. Any post-claim failure is terminal `INCONCLUSIVE` with no report and no retry. The terminal P03 v1/v2 and P02 v1/v2 claims are never retried.
