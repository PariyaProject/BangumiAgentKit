# Run #95 R04 synthetic one-hop watch-order matrix profile v2

## Scope and separation from v1

This is a separately registered synthetic Agent/MCP matrix profile for
`bangumi.get_series_watch_order`. The original v1 profile at PR #186 is
terminal `INCONCLUSIVE`, has no report, and has `retryAllowed=false`. Its
registry entry, claim/terminal labels, report path, fixed input, and disposition
remain unchanged; this v2 profile has a different ID, Epoch, argument profile,
claim label, report path, and synthetic fixture. Neither profile answers the R04
question about whether a theatrical film belongs in a real TV watch order.
R04 remains `UNASSESSED`.

## Fixed synthetic call

The only registered call is:

```json
{
  "subjectId": 990817,
  "depth": 1,
  "maxNodes": 1,
  "media": "anime"
}
```

The isolated fetch fixture accepts exactly four GET paths on
`https://api.bgm.tv`: root detail `990817`, root relations, prequel relations
`990818`, and prequel detail `990818`. The root relation fixture contains one
synthetic `前传` edge. The expected local result contains the synthetic prequel
before the synthetic root and one related row. All image URL fields are empty;
there is no renderer asset route. The fixture rejects other methods, origins,
paths, queries, fragments, bodies, duplicate routes, and Authorization headers.

## Acceptance and evidence boundary

A valid signed report can credit only the `get_series_watch_order` Agent/MCP
matrix cell. It records the exact profile and argument hashes, registry and
source bindings, four local request counts, bounded synthetic ID/placement
summary, and zero Authorization, unexpected-route, duplicate, external API,
asset, shell, non-MCP, or error events. It excludes prompts, model answers, raw
fixture rows, raw tool output, and media bytes.

One invocation is allowed after exact Candidate/Base, seven-check CI,
Harness Candidate PASS, same-identity GPT-6 Luna Max PASS, and a live v2
`UNCLAIMED` profile status. A failed or incomplete attempt must be recorded as
terminal `INCONCLUSIVE` with no report and `retryAllowed=false`; it receives no
matrix credit and is never retried. A successful report still does not establish
canonical order, completeness of a real relation graph, public API coverage,
account behavior, renderer quality, QQ delivery, or TIM delivery. No live
Bangumi, OAuth/account, community, write, QQ, or TIM operation is in scope.
