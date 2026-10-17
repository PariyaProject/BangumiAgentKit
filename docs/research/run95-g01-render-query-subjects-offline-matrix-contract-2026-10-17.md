# Run #95 G01 `render_query_subjects` synthetic offline matrix profile

## Purpose and limit

This profile is a fresh, one-tool Agent/MCP matrix check for `bangumi.render_query_subjects`. It uses one fixed synthetic keyword and synthetic subject ID `990920`, with a local fixture intercepting the only expected search and detail requests. A valid report may credit only the `render_query_subjects` Agent/MCP matrix cell. It does not answer the G01 July harem scenario, does not reuse the terminal G01/G02 canaries or the terminal `query-render-title-agent-mcp-v1` profile, and does not establish Bangumi-wide search completeness.

## Fixed input and local fixture boundary

The profile uses `run95 g01 synthetic render query offline 20261017`, media `anime`, `reportedEpisodeCount={min:1,max:1}`, one top result, relevance sort, `explain=none`, and `nsfw=include`. The closed fixture permits exactly one anonymous `POST https://api.bgm.tv/v0/search/subjects?limit=20&offset=0` with the matching keyword, `sort=match`, and media type `[2]`, followed by exactly one anonymous `GET /v0/subjects/990920`. Search deliberately omits `eps`; detail supplies `eps=1`, so this profile exercises the documented bounded detail hydration path as well as rendering. Every other origin, route, method, query, body, duplicate, or authorization header is rejected locally.

The subject has empty image fields. Renderer asset resolution, if requested, returns a built-in one-pixel placeholder; it never performs an asset HTTP request. The temporary artifact store retains image bytes only for the duration of the MCP process. The sanitized report retains dimensions and hashes, not image bytes or raw fixture rows.

## Acceptance gates

The claim is one-shot and requires the clean exact Candidate, unchanged master Base, seven mandatory exact-SHA CI checks, same-identity GPT-6 Luna Max PASS, and exact Candidate MCP bundle. Success requires one Codex MCP event for the sole registered tool, one exact call with the fixed arguments, a complete event stream, exact acknowledgement, valid PNG artifact metadata, zero shell/non-MCP calls, exactly two local fixture responses, zero authorization headers, zero unexpected/duplicate requests, zero external renderer requests, and a sanitized signed report. Any invocation is terminal; an inconclusive claim is never retried.

OAuth/account/community/private `/p1`/HTML/write/QQ/TIM remain outside scope. Public API acceptance stays 65/65. G01 stays PARTIAL and the profile makes no scenario answer or completeness claim.
