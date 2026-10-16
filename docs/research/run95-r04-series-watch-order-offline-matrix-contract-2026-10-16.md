# Run #95 R04 synthetic offline watch-order matrix contract

This file records a separate synthetic offline Agent/MCP matrix profile for `bangumi.get_series_watch_order`. It does not answer the R04 question about whether a theatrical film must be inserted into a TV watch order. R04 remains `UNASSESSED`, and no real series/film ID or live Bangumi response is included.

The registered call uses synthetic subject ID `990801`, `depth=0`, `maxNodes=1`, and `media=anime`. The local fixture permits only `GET /v0/subjects/990801` and `GET /v0/subjects/990801/subjects`; the relation response is empty, so the tool returns the synthetic root as a bounded recommendation. The fixture rejects other paths, methods, queries, duplicates, request bodies, and Authorization headers. No renderer asset route exists.

The report can credit only the `get_series_watch_order` Agent/MCP matrix cell. It adds no scenario credit, makes no mandatory/canonical ordering claim, and changes no public, QQ, or TIM matrix cell. A failed profile call terminalizes `INCONCLUSIVE` with `retryAllowed=false`; the profile must never be retried or replaced.

The source contract in `PariyaAgent/docs/research/run95-r04-theatrical-film-tv-watch-order-source-contract-2026-10-14.md` remains the basis for the scenario boundary: current relation evidence is finite and source-directed, not a canonical order. The post-779d master diff affecting `read-tools.ts` and `docs/tool-catalog.json` is the P02 chronology description only; `get_series_watch_order` and `SeriesService` are unchanged.
