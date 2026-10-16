# Run 95 A01 render cohort aggregation Agent/MCP matrix contract

## Scope

This profile addresses the pending Agent/MCP acceptance cell for
`bangumi.render_subject_cohort_aggregation` only. Its `auth=none` and
`risk=read` catalog contract is preserved. The user-directed 65/65 public API
target remains separate, and the existing direct-public reports continue to
support only the public/API matrix cell.

The profile deliberately does not assess A01's user question about whether a
subject's rating standard deviation is meaningfully above its seasonal cohort.
It creates no comparison, significance, recommendation, causality, or history
claim. A01 stays `UNASSESSED` until that complete scenario has its own valid
evidence.

## Fixed offline execution

The registered call is one exact `render_subject_cohort_aggregation` invocation
with one synthetic anime query and `maxSubjects=1`. Its only configured MCP
server exposes that tool. A local fetch fixture returns one clearly synthetic
search row and its detail response, rejects authorization headers and every
unexpected or repeated request, and verifies exactly one search plus one detail
request. It never dispatches to Bangumi or any other network destination.

The MCP server returns a sanitized artifact summary to the Agent. The evidence
may include artifact dimensions, PNG validation, byte count, and digest; it does
not retain PNG bytes, source rows, returned subject identifiers, or names. The
runner requires one completed MCP call, no Codex error items, and zero shell or
other tool activity. Codex configuration disables web, browser, computer,
apps, multi-agent, plugins, and shell access.

## Boundaries and credit

The result can credit only this one Agent/MCP matrix cell after the exact
Candidate, Base, seven-check CI, same-identity GPT-6 Luna Max PASS, and durable
Harness claim/result gates succeed. It adds no public API, A01 scenario,
authentication, account, community, HTML, private `/p1`, write, QQ, or TIM
evidence. All observed work is synthetic and offline.

No earlier one-shot claim or input is reused. The profile receives a new
create-once Harness label and a new report path. Any claim that gets created is
permanently consumed; an inconclusive attempt is never retried.
