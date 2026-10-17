# Run #95 R03 v2: direct-relations offline Agent/MCP matrix contract

Selected on synchronized BangumiAgentKit master `4cb18532dabaf277941ac047d1f3a624a991fd64` after the PR #208 R03 profile became terminal. This is a separate matrix-only profile with a new registry identity and new synthetic input. It makes no live Bangumi request and does not assess the real R03 question.

## Product and source boundary

R03 asks which related work has the highest rating within two hops. Official v0 exposes visible direct relation rows for a source subject but gives no pagination, total, reverse-edge, or completeness guarantee. The local `bangumi.get_subject_relations` capability preserves the observed source-to-target direction and reports missing completeness as `not_provided_by_source`.

This profile checks one current-source Agent/MCP invocation against an in-process fixture. The fixture returns one synthetic direct relation from synthetic source `991020` to synthetic target `991021`; both IDs and names are fixture-only. The profile cannot establish real relation paths, a two-hop graph, subject scores, a highest-rated work, or absence/completeness. R03 remains `UNASSESSED`.

## Exact profile

- Profile ID: `r03-direct-relations-offline-agent-mcp-matrix-v2`
- Epoch ID: `run95-r03-direct-relations-offline-agent-mcp-matrix-v2-20261017`
- Tool: `bangumi.get_subject_relations`
- Argument profile: `fixed-r03-synthetic-direct-relations-991020-v2`
- Exact call: `{ subjectId: 991020, includeEvidence: true }`
- Scope: one `get_subject_relations` Agent/MCP matrix cell only
- Report: `docs/live-probes/r03-direct-relations-agent-mcp-matrix-v2-run95.json`
- Permanent claim label: `harness-r95-r03-direct-v2-claimed`

The fixture permits exactly one anonymous `GET https://api.bgm.tv/v0/subjects/991020/subjects`, with the production client's exact `Accept` and fixed `User-Agent` headers. It rejects credentials, unexpected headers, methods, routes, query strings, bodies, duplicate requests, and every other origin. It never delegates to native fetch. The MCP server exposes only the registered tool.

The signed report retains exact candidate/control-plane digests, bounded response counts, the raw relation label, and coverage flags. It does not retain subject IDs, names, raw rows, prompts, answers, or tool results. Only a signed report accepted with this profile's exact Harness `REPORT_WRITTEN` disposition may credit the single Agent/MCP matrix row.

## One-shot and non-scope rules

The v1 profile `r03-two-hop-relations-offline-agent-mcp-v1` on PR #208 is terminal `INCONCLUSIVE`, `reportWritten=false`, and `retryAllowed=false`. Its IDs `990910` and `990911`, profile, claim label, and terminal disposition remain unchanged and must never be retried. This v2 identity is independently registered and uses a fresh synthetic input; it must pass the exact open Epoch PR, Base, Candidate, seven-check CI, same-identity GPT-6 Luna Max review, and new-profile `UNCLAIMED` gates. The runner rechecks those gates immediately before its single MCP call.

No public API probe, OAuth/account action, community/HTML read, write, QQ/TIM action, or R01/R02 scenario query is part of this profile. The public API 65/65 target and PR #173's eight-row exclusion boundary remain unchanged. A successful report does not change R03 from `UNASSESSED` and does not claim real graph or answer acceptance.
