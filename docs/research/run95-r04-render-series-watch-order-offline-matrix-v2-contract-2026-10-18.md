# Run #95 R04 synthetic offline renderer Agent/MCP matrix v2 contract

Recorded: 2026-10-18T00:33:20Z.

## Purpose

This is a separately keyed, synthetic offline check for the existing `bangumi.render_series_watch_order` Agent/MCP tool path. It can add only that tool's Agent/MCP matrix row after a signed report is accepted. It does not answer the R04 theatrical film question, the G09 watch-order question, or establish canonical order or visual quality.

## Previous claim remains terminal

The R04 renderer v1 profile (`r04-render-series-watch-order-offline-agent-mcp-v1`, synthetic subject `990802`) is already `INCONCLUSIVE`, with no report and `retryAllowed=false` on merged PR #198. Keep its claim and terminal label unchanged. The separate `get_series_watch_order` v1 profile is also terminal; neither profile is eligible for replay.

## New v2 profile

- Profile: `r04-render-series-watch-order-offline-agent-mcp-matrix-v2`
- Epoch: `run95-r04-render-series-watch-order-offline-matrix-v2-20261018`
- Tool: `bangumi.render_series_watch_order`
- Fixed input: `{ subjectId: 990803, depth: 0, maxNodes: 1, media: "anime" }`
- Network mode: `run95-r04-render-series-watch-order-offline-v2`
- Report path: `docs/live-probes/r04-render-series-watch-order-offline-agent-mcp-v2-run95.json`
- Scope: one Agent/MCP matrix cell only.

The local fixture answers exactly `GET https://api.bgm.tv/v0/subjects/990803` and `GET https://api.bgm.tv/v0/subjects/990803/subjects`, once each. It denies Authorization, query strings, request bodies, duplicate and unexpected paths, non-GET requests, and every renderer asset fetch. The MCP server keeps the returned PNG only in its in-memory artifact store, so the summary truthfully records `persisted: false`; it still verifies the returned artifact's SHA-256, PNG signature, decode status, and dimensions before reporting metadata. The Codex invocation uses only this one tool with the exact registered arguments; a successful report requires a completed turn, one successful MCP event, no MCP tool errors, no non-MCP tool or shell events, exact acknowledgement, exact artifact metadata readback, and the exact Candidate/bundle.

The report is create-once, sanitized, and signed. It binds the fresh Harness claim to Candidate, Base, exact seven-check CI run, same-identity GPT-6 Luna Max review, tool registry, and MCP bundle. It stores neither prompts or answer text, event streams, fixture row contents, nor image bytes. Bounded non-fatal Codex error-item counts are recorded; they do not pass if the MCP call failed, an extra tool ran, the turn did not complete, or the exact acknowledgement/readback is missing.

## Gates and boundaries

As of this contract, the new Harness Epoch is selected on master `26c9285e6501a7d2c44cf40e0dda236a737a25b8`; no v2 claim or invocation has occurred. Do not invoke until the exact Candidate has current Base, seven successful exact-SHA checks, the same-identity Luna Max review PASS, and a fresh Harness `UNCLAIMED`/eligible profile status.

Even if accepted, R04 stays `UNASSESSED`, G09 remains unchanged, and no public API, scenario, auth, QQ pipeline, or TIM client credit is added. Keep account/OAuth/community, QQ, TIM, live Bangumi requests, writes, and browser asset access passive.
