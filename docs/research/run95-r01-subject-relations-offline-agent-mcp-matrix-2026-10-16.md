# Run #95 R01: Offline Agent/MCP matrix-only profile

**Source base:** BangumiAgentKit master `9947b705c454416ef0fc8c1a1ccaf140ccb15341`.

**Scope:** one new synthetic, offline Agent/MCP matrix profile for `bangumi.get_subject_relations`. No live Bangumi/API request, OAuth, account data, community source, HTML, write, QQ, or TIM action is part of this profile.

## Tool boundary

`bangumi.get_subject_relations` is an anonymous read-only wrapper around official v0 `GET /v0/subjects/{subject_id}/subjects`. Its evidence envelope reports only the visible direct rows observed for the requested source item; the endpoint has no pagination, total, or completeness guarantee. The R01 scenario remains `PARTIAL`: no reverse or transitive graph, complete franchise, or official viewing order can be inferred.

The existing R01 scenario one-shot is terminal `INCONCLUSIVE` with no report and no retry. This matrix-only profile has a separate immutable ID, claim label, argument profile, and report path. It does not replace or retry the R01 scenario claim.

## Fixed offline profile

- Profile: `r01-subject-relations-offline-agent-mcp-v1`.
- Tool and arguments: exactly one `bangumi.get_subject_relations` call with synthetic `subjectId=990902` and `includeEvidence=true`.
- The MCP server intercepts exactly one anonymous `GET https://api.bgm.tv/v0/subjects/990902/subjects` and returns one synthetic direct relation row. It rejects every other route, method, query, duplicate request, request body, and Authorization header. There is no network fallback.
- The model receives only a sanitized projection containing observed row counts, source direction, the synthetic relation label, and the source coverage caveat. The report stores no names, subject IDs, raw rows, prompt, answer text, or credentials.
- A valid signed report can credit only the `get_subject_relations` Agent/MCP matrix cell. It adds no R01 scenario, public API, QQ, or TIM credit.

## Codex CLI approval diagnosis

The local Codex CLI `0.162.0-alpha.17.2` diagnostic used a local synthetic MCP server with the same `--ignore-user-config`, `--strict-config`, `--ephemeral`, JSON event stream, GPT-6 Luna, and read-only sandbox settings as the acceptance runners. With only server-level `default_tools_approval_mode="auto"`, Codex started the server but rejected the sole tool call before its handler. Adding a per-tool `approval_mode="approve"` override for the exact enabled MCP tool made the same call complete and execute. The candidate runner therefore approves only the one registered read-only tool and leaves all other tool exposure disabled.

The diagnostic emitted three blocked/disabled web-search error items both with and without a local MCP call. They produced no non-MCP tool-call event. The report keeps their count and accepts them only when every error item matches the blocked/disabled web-search category, the MCP event is exact and completed, and all non-MCP and shell event counts are zero. Any other error or tool event terminalizes the fresh claim as `INCONCLUSIVE` with no report, no credit, and no retry.

This file records source and runner-selection limits only. It is not a live API result or acceptance report.
