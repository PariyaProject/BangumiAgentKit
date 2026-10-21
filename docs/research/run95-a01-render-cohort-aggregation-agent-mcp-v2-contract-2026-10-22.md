# Run 95 A01 render cohort aggregation Agent/MCP v2 contract

## Scope

This fresh profile can earn only the Agent/MCP matrix cell for
`bangumi.render_subject_cohort_aggregation`. It does not assess A01's rating
dispersion question or make a comparison, significance, causality, history, or
real Bangumi cohort claim. A01 remains `UNASSESSED`.

The earlier v1 claim on PR #197 is terminal
`INCONCLUSIVE`/no-report/`retryAllowed=false`. Its input and latch are spent;
v2 does not retry or reconcile that claim.

## Fixed offline call

The profile is `a01-render-cohort-aggregation-agent-mcp-offline-v2` in the
`run95-a01-render-cohort-aggregation-offline-matrix-v2-20261022` Epoch. It calls
the registered tool exactly once with:

```json
{
  "cohort": {
    "label": "Run95 synthetic aggregation sample v2",
    "query": {
      "keyword": "run95 A01 render cohort synthetic v2 2026-10-22",
      "media": "anime",
      "resultMode": "all",
      "limit": 1
    }
  },
  "maxSubjects": 1
}
```

The only configured MCP server is
`bgk_a01_render_cohort_aggregation_offline_v2`, and it exposes only
`bangumi.render_subject_cohort_aggregation`. An in-process fixture accepts
exactly one synthetic subject search and one matching detail read for subject
`990104`. It rejects repeated or unexpected operations, any authorization
header, and every other network destination. The result may report validated
PNG metadata (dimensions, byte length, digest, signature, decode, and dimension
match); it does not persist PNG bytes, source rows, subject identity, or media.

Codex runs with ephemeral history and without shell, web, browser, computer,
apps, plugins, or multi-agent access. No external API request, account/OAuth,
community/HTML source, private endpoint, write, QQ, or TIM action is allowed.

## Durable evidence and credit

The one-shot claim label is
`harness-r95-a01-render-cohort-agg-v2-claimed`; the terminal label is derived
from that fresh label. The create-once sanitized report path is
`docs/live-probes/a01-render-cohort-aggregation-agent-mcp-v2-run95.json`.
The report retains only exact Candidate/Base/CI/reviewer/bundle/registry/profile
binding, one-call counters, local fixture counters, artifact metadata, hashes,
and a signed runner receipt. It does not store prompts, answers, event streams,
raw tool results, source rows, PNG bytes, or credentials.

The report is eligible only after the exact Candidate, unchanged Base, all
seven exact-SHA CI checks, same-identity GPT-6 Luna Max review PASS,
`candidate:check`, and fresh Harness latch eligibility are verified. A passing
report can add only the single renderer Agent/MCP matrix cell. A failed claim
is permanently terminal `INCONCLUSIVE`/no-report/`retryAllowed=false`.

This is a protocol/PNG validity check, not visual design approval. The separate
renderer quality bar still requires real visual review of typography, Chinese
and Japanese glyphs, hierarchy, wrapping, clipping, density, responsive sizes,
and image/card composition on deterministic local fixtures.
