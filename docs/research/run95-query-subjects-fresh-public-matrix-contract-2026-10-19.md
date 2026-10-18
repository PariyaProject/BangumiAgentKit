# Run #95 fresh `query_subjects` Agent/MCP matrix contract

Date: 2026-10-19 JST. Epoch: `run95-query-subjects-fresh-public-matrix-20261019`.

## Purpose and acceptance boundary

This contract supports one new, bounded, anonymous `bangumi.query_subjects`
Agent/MCP matrix observation. The exact registered input is
`{"keyword":"进击的巨人","media":"anime","resultMode":"top","limit":1,"sort":"relevance","explain":"compact","nsfw":false}`.
The registry and source guard reject any change to this input, and selection
checks that no earlier registered `query_subjects` profile uses the same
argument object.

This advances only the current Agent/MCP matrix cell for `bangumi.query_subjects`.
It does not close frontier G14, establish ranking or catalog completeness,
cover `render_query_subjects`, or earn account, OAuth, renderer, QQ, or TIM
acceptance. G14 remains `PARTIAL`; a successful bounded search is not a global
completeness claim.

## Network and privacy bounds

The dedicated MCP profile exposes one read-only tool and permits only anonymous
HTTPS `POST https://api.bgm.tv/v0/search/subjects` requests. The query must use
the exact fixed keyword, the anime type filter, `nsfw: false`, match sorting,
and the tool's bounded pagination shape. Each page is limited to 20 items, the
request budget is at most eight pages, credentials are forced to `omit`, and
redirects are rejected. Other hosts, routes, methods, bodies, credential
headers, and over-budget requests fail closed.

The run uses GPT-6 Luna Max with one exact tool call, no shell or web tools, and
no account or community access. The temporary event stream is hashed and then
removed. The committed report contains only bounded result counts, coverage
state, request counters, source hashes, and a signed receipt; it does not store
the prompt, answer text, subject names or IDs, account data, or credentials.
The only assistant response accepted by the runner is the fixed acknowledgement
`QUERY_SUBJECTS_PUBLIC_MATRIX_OK`.

## Source basis and execution gates

The public-v0 route, experimental search semantics, local post-filtering, and
coverage limitations were cross-checked against Bangumi's
[public v0 OpenAPI](https://raw.githubusercontent.com/bangumi/server/master/openapi/v0.yaml).
`POST /v0/search/subjects` is the bounded keyword-search route; the product
keeps its estimated totals and partial coverage explicit. This profile does not
treat a search response's estimated total as exact catalog coverage.

The runner refuses to claim the one-shot until the Harness reports the exact
current Candidate and Base, all seven required CI checks pass on the Candidate,
the active Epoch is ready, and its latest GPT-6 Luna Max reviewer identity has
passed that same Candidate/Base. It checks these conditions again immediately
before and after the tool call. Every terminal disposition has
`retryAllowed: false`.

No network probe has been invoked by authoring this contract or its tests. A
successful report may be recorded only after the guarded one-call runtime and
Harness `REPORT_WRITTEN` readback both succeed.
