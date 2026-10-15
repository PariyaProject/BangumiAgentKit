# Run #95 P02 offline Agent/MCP matrix profile

## Scope

This profile is a synthetic, local-fixture execution check for the single
`bangumi.get_person_profile` Agent/MCP tool-matrix cell. It does not answer P02's
user question about a person's first or most recent anime participation and
cannot change P02 from `PARTIAL`.

The fixed profile uses synthetic person `990701`, subject `990702`, and
character `990703`. The actual MCP server and ToolRegistry run against a strict
fetch fixture which allows one GET each to:

- `/v0/persons/990701`
- `/v0/persons/990701/subjects`
- `/v0/persons/990701/characters`

The fixture rejects any other origin, path, method, query, fragment, request
body, duplicate route, or Authorization header. Synthetic rows have no image
URLs. Chronology is disabled, and there is no subject-detail, renderer, or asset
request path in this profile.

## Acceptance boundary

A valid report proves only that the selected registered read tool executed once
through Codex → MCP → ToolRegistry with the exact synthetic arguments, exactly
three local responses, zero live Bangumi API requests, zero authorization headers,
and no shell/non-MCP/error events. The report stores hashes, counters, and
coverage metadata; it excludes prompts, answers, raw fixture rows, raw tool
results, and asset bytes.

The report must bind the exact Run #95 Epoch, Candidate, Base, seven-check CI,
same-identity Luna Max review, immutable profile/registry/arguments, MCP bundle,
and permanent Harness claim and terminal latches. One invocation is allowed;
an unsuccessful or incomplete attempt is terminal `INCONCLUSIVE` with
`retryAllowed=false`.

This synthetic check adds no public API evidence, does not alter the eight
user-directed pending public rows, and adds no P02 scenario credit. Existing
P02 source evidence remains bounded: person-related-subject responses do not
document ordering, pagination, or completeness, while optional subject detail
dates describe release/air dates rather than actual participation dates.

No account, OAuth, community, HTML, private-/p1, write, QQ, or TIM path is used.
Codex/Harness control-plane traffic is outside the synthetic data-plane claim.
