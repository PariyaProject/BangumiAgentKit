# Run #95 A01 aggregate cohort offline Agent/MCP matrix v2 contract

Recorded: 2026-10-19.

## Scope

This is a fresh, synthetic-only Agent/MCP matrix profile for
`bangumi.aggregate_subject_cohort`. It does not reuse the terminal v1 profile
`a01-aggregate-cohort-offline-agent-mcp-matrix-v1`, its query keyword, or its
synthetic subject ID. The new profile is
`a01-aggregate-cohort-offline-agent-mcp-matrix-v2`, selected only in Epoch
`run95-a01-aggregate-cohort-offline-matrix-v2-20261019`.

A valid, Harness-acknowledged signed report may credit only the
`bangumi.aggregate_subject_cohort` Agent/MCP matrix cell. The A01
standard-deviation significance scenario remains `UNASSESSED`; no public API,
real Bangumi, account/OAuth, community, QQ, TIM, or stability evidence is added.

## Fixed input and local fixture

The Agent may call the sole exposed tool exactly once with the registry's fixed
v2 input: a single anime cohort labeled “Synthetic aggregate matrix v2 sample”
and keyword `run95 fresh synthetic aggregation matrix v2 2026-10-19`, with
`resultMode=all`, `limit=1`, and `maxSubjects=1`.

The MCP server accepts exactly one anonymous local-fixture search POST and one
detail GET for synthetic subject `991219`. The fixture returns score `6.5`,
collection total `71`, `10` reported episodes, and an explicit ten-bin rating
histogram with five ratings at `4` and five at `8` (population standard
deviation `2`). The result summary and final JSON answer are checked against
these values and their coverage states. The fixtures deny authorization,
proxy-authorization, cookies, API-key headers, credentialed URLs, unexpected
origins/paths/queries, altered v1 arguments, and repeated operations. The
configured MCP profile uses a local `fetch` fixture and must record zero
external requests.

## Gates and evidence

The runner first verifies the active Run/Epoch, exact clean Candidate, current
`master` Base, all seven checks on the exact Candidate, the same-identity
GPT-6 Luna Max PASS, built MCP bundle/attestation, and `UNCLAIMED` status for
this v2 profile. It creates a create-once claim only after those gates and then
invokes Codex once with one required MCP server and one exposed tool. Shell,
web, browser, computer, apps, plugins, account, OAuth, community, write, QQ,
and TIM paths remain disabled.

The signed report binds the v2 profile registry and arguments, Candidate,
Base, CI, reviewer, bundle, source/catalog/schema digests, sanitized tool
summary, exact local fixture counters, and answer checks. It stores no prompt,
raw model answer, source rows, title/person identity, credential, or image
bytes. Only an exact Harness `REPORT_WRITTEN` disposition earns the single
matrix row. An inconclusive claim is terminal with `retryAllowed=false`; do
not retry it or the spent v1 profile.

## Explicit non-claims

- The fixture says nothing about the real Bangumi API, population coverage, or
  statistical significance.
- It does not change the A01 scenario status or the public API matrix.
- It does not test OAuth/account access, QQ/TIM delivery, or long-term
  stability.
