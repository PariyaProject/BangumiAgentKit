# Run 95 title query/render Agent/MCP matrix contract

**Selection record:** this file fixes the pre-invocation contract for Epoch `run95-title-query-render-agent-mcp-matrix-20261017`. The signed report and Harness disposition record whether the one-shot invocation ran and what it observed.

## Scope

This profile checks one exact anonymous Agent/MCP turn containing `bangumi.query_subjects` followed by `bangumi.render_query_subjects`. Both calls use the same registered argument object: `keyword=葬送的芙莉莲`, `media=anime`, `resultMode=all`, `limit=1`, `sort=relevance`, `explain=compact`, and `nsfw=false`.

Only the two corresponding Agent/MCP acceptance cells may advance. The report does not answer G01's July 2026 harem query, G02's 2024 isekai ranking, D07's current-rank observation, or any historical, exhaustive-search, or renderer-quality question. Existing one-shot claims remain spent and are not replayed.

## Source boundary

The current `query_subjects` path uses the public discovery interface. The repository's prior G01 and D04 source-contract notes describe official subject search as experimental and its totals as estimated; bounded returned rows do not establish full-catalog coverage. See [`run95-g01-agent-mcp-acceptance-2026-10-05.md`](run95-g01-agent-mcp-acceptance-2026-10-05.md), [`run95-d04-short-anime-discovery-source-contract-2026-10-09.md`](run95-d04-short-anime-discovery-source-contract-2026-10-09.md), and the current tool definitions in `packages/tools/src/definitions/discovery-tools.ts` and `packages/tools/src/definitions/render-presentation-tools.ts`.

The closed profile permits anonymous `POST /v0/search/subjects` and bounded `GET /v0/subjects/{id}` requests to `https://api.bgm.tv`, with redirects rejected and an aggregate cap of eight requests for both calls. It denies credentials, all other routes and origins, and any request beyond the cap; the fetch boundary forces `credentials=omit`. The renderer resolves every cover to a local placeholder and makes zero asset-network requests. It uses the in-memory artifact store and the PNG summary must pass signature, bounded decode, and MCP-dimension checks. Image bytes are never written to the report, and these checks do not establish visual quality.

## Answer and retained evidence

The Agent answer is a small JSON object containing only the query result state, returned item count, PNG MIME type and dimensions, and `notExhaustive=true`. The runner checks every value against the server's sanitized result summaries. The signed report retains identity hashes, check booleans, bounded counters, enumerated warning codes, public request counts, and ephemeral artifact metadata. It omits the prompt, answer text, source names and IDs, raw rows, raw JSONL, and image bytes.

The profile remains matrix-only. The public API target stays 65/65. PR #173 was closed as superseded by four later bounded reports on current master; its excluded 37-request report was not repeated. OAuth/account/community/QQ/TIM paths remain passive. G01, G02, and D07 scenario states are unchanged.
