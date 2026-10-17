# Run #95 G06 `get_subject_cast` synthetic offline matrix contract

## Scope

This selection covers only the missing Agent/MCP matrix cell for
`bangumi.get_subject_cast`. The G06 user scenario remains `PARTIAL`; synthetic
rows cannot answer the Girls' Last Tour cast/CV question or establish source
completeness. The public API cell already has separate current-catalog evidence
in `docs/live-probes/public-tools-2026-10-15-092632892-50913.json` and receives
no credit from this profile.

The prior G06 scenario profile `{subjectId:218707,limit:100}` is terminal
`INCONCLUSIVE`, has no accepted report, and has `retryAllowed=false`. It is never
reused. The new registered matrix profile is
`g06-cast-offline-agent-mcp-matrix-v1`, with fixed arguments
`{subjectId:990804,limit:2}` and its own permanent Harness claim label.

## Tool and source contract

The current tool catalog marks `bangumi.get_subject_cast` as `auth: none` and
`risk: read`. Its implementation calls the official-v0
`GET /v0/subjects/{subject_id}/characters` operation once, validates and
locally limits the returned rows, and reports coverage. The operation defines
no pagination or total count, so even a real successful response would not
prove exhaustive cast coverage.

Relevant current source:

- `docs/tool-catalog.json` — fixed public tool schema and auth/risk metadata.
- `packages/tools/src/definitions/read-tools.ts` — `getSubjectCast` tool input
  and execution path.
- `packages/bangumi-core/src/workflows/subject-cast.ts` — bounded result,
  response-size limit, and explicit pagination/total limitations.
- `packages/bangumi-core/src/services/character-service.ts` — accepted row
  shape and response coverage calculation.
- `packages/bangumi-openapi/src/generated/index.ts` — one GET request to
  `/v0/subjects/{subject_id}/characters` without query parameters.

## Offline fixture boundary

The MCP server exposes only `bangumi.get_subject_cast` for this profile. Its
fetch function accepts exactly one unauthenticated GET to
`https://api.bgm.tv/v0/subjects/990804/characters`. It rejects query strings,
fragments, authorization headers, request bodies, repeated calls, and every
other route. The response contains two synthetic character rows and synthetic
actor data. No live Bangumi request or renderer asset request is part of the
profile.

The runner asks for one exact tool invocation, then requires the fixed
acknowledgement `G06_SYNTHETIC_CAST_MATRIX_EXECUTED`. It retains temporary
event/result bytes only long enough to validate the call. The signed report may
store only bounded checks, counters, catalog/source hashes, and the claim-bound
runner receipt; it must not contain synthetic names/IDs, raw rows, prompt,
answer text, tool output, credentials, or image bytes.

## Credit and limits

A report can earn credit only after exact Candidate/Base CI, Harness profile
eligibility, and same-identity GPT-6 Luna Max PASS; the one-shot is claimed and
executed once. A valid report maps only to the
`bangumi.get_subject_cast` Agent/MCP matrix cell. The report cannot change G06
scenario status, add public API credit, or provide QQ/TIM, OAuth, account,
community, or write evidence. Any claimed failure is terminal and never retried.
