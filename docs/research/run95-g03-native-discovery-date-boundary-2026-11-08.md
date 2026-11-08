# G03 explicit search date boundaries

The native G03 query pushed the expected half-open date range
`>=2021-10-03` and `<2026-10-03`, exact `原创` concept, rating at least 8,
and at least 5,001 ratings. At base `5d702059`, the engine rejected an
upstream candidate at 5,000 ratings and another with a 7.9 score. When the
synthetic search page also included a row one day before the window and a
row on the exclusive end date, the engine returned both as matches.

The fix at `b9d1f910` checks known full calendar dates against the same
explicit bounds after any existing detail hydration. The compiler records
that local check. Unusable dates retain their existing upstream-dependent
status, which the result and card explain. The change adds zero detail
requests and leaves year, month, and season selectors on their existing
paths.

The fixed real SDK stdio run included the original query plus a query and a
PNG request with all six synthetic rows. Both contradictory-response calls
kept exactly the two qualifying rows. The query recorded six observed,
two matched, and four rejected. The 720 × 1550 PNG at a 360 CSS px chat width
showed both titles, dates, scores, rating counts, the exclusive end
boundary, and the estimated experimental-source caveat. Its SHA-256 is
`3241ea94f26daa605fa866ae38546de47085972cb17a842cbbfe8ad1e44bab09`.

The fixed synthetic receipt SHA-256 is
`6dc53bdd8b20217e3007275529a9aad34f40d45a65c7d794437346eb7e197b31`.
The baseline receipt SHA-256 is
`4ae1f212fe240464a9ebddb19a4a70d7901cbdf862989795e0d21ef9e8c45800`.
Each run used three local fixture responses, a memory database, a real
Chromium renderer, and a disposable local artifact store. G03 remains
PARTIAL. The historical Run 66 evidence retains its original revision and
scope. These fixtures add zero live, model, account, or client matrix credit.

Of 209 compiled modules, only the discovery compiler and engine changed.
All 136 previously sealed account modules match. The [exact compatibility
receipt](../live-probes/run95-discovery-date-account-compatibility-2026-11-08.json)
preserves the twelve existing observations through the prior presenter
receipt.
