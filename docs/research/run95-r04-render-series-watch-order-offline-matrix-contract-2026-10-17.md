# Run 95 R04 renderer-only Agent/MCP matrix contract

## Scope

This is a distinct matrix-only profile for `bangumi.render_series_watch_order`. It does not reuse the already terminal `bangumi.get_series_watch_order` profile (`subjectId=990801`) or the terminal A01 cohort-render profile. Its only fixed input is synthetic `subjectId=990802`, `depth=0`, `maxNodes=1`, `media=anime`.

The MCP server returns a fixed synthetic subject at `/v0/subjects/990802` and an empty local relation response at `/v0/subjects/990802/subjects`. It permits one GET to each exact path, with no query, fragment, request body, authorization header, duplicate, or other URL. The renderer has a separate asset resolver that throws and records any asset request; the synthetic subject has no image URLs, so the allowed asset request count is zero.

## Acceptance boundary

The one-shot may credit only the `render_series_watch_order` Agent/MCP matrix row when the exact reviewed Candidate and current Base still match, all seven required checks pass, the same Luna Max reviewer records PASS, exactly one MCP event carries the fixed arguments, the server records exactly two synthetic requests, the JSON text readback matches the server's safe artifact projection, and the returned PNG metadata verifies. The report retains only artifact metadata and hashes, not image bytes, raw tool output, prompt, or final answer.

`R04` stays `UNASSESSED`: a synthetic renderer card does not answer whether a theatrical film belongs in a real TV watch order, establish canonical ordering, or demonstrate visual quality. The existing `get_series_watch_order` one-shot remains terminal INCONCLUSIVE and is never retried. No real Bangumi requests, account/OAuth/community/frontend reads, writes, QQ, or TIM are in scope.
