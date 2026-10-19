# Run #95 P02 `get_person_profile` synthetic Agent/MCP v2 contract

Date: 2026-10-19. This contract defines one possible Agent/MCP matrix observation;
it does not establish that the selected profile was invoked or passed.

## Why a distinct profile exists

The earlier P02 v1 profile used person/subject/character IDs 990701/990702/990703
and terminally recorded `INCONCLUSIVE`, no report, and `retryAllowed=false`.
Its permanent claim latch remains spent. This v2 uses new IDs and distinct
profile, claim, network, acknowledgement, and report identities. It does not
repeat or reinterpret the v1 attempt.

## Exact synthetic call

The only eligible tool call is:

```json
{
  "personId": 990711,
  "includeCredits": true,
  "maxSubjects": 1,
  "maxCharacters": 1,
  "includeChronology": false
}
```

The local fixture accepts one GET each for `/v0/persons/990711`,
`/v0/persons/990711/subjects`, and `/v0/persons/990711/characters`. Every
response uses synthetic values with IDs 990711, 990712, and 990713 and contains
no image URLs. It rejects any other origin/path, query, fragment, body,
non-GET, duplicate operation, or Authorization header. This fixture is not an
API-response or account-authentication observation.

## One-shot gates and evidence boundary

The registered profile is
`p02-person-profile-offline-agent-mcp-v2`, selected Epoch
`run95-p02-person-profile-offline-v2-matrix-20261019`, permanent claim label
`harness-r95-p02-person-profile-offline-v2-claimed`, network mode
`run95-p02-person-profile-offline-v2`, and report
`docs/live-probes/p02-person-profile-agent-mcp-v2-run95.json`.

Invoke the profile once only after exact Candidate/Base, seven mandatory CI
checks on that Candidate, Harness `candidate:check`, and the same-identity
GPT-6 Luna Max PASS. The report must bind that exact Candidate/Base/CI/reviewer,
MCP bundle, registry and permanent claim/result latches. Store only signed
sanitized counters and hashes; exclude prompt, answer text, raw rows, raw tool
result, and media. If the invocation is incomplete or ambiguous, terminalize it
once as no-report `INCONCLUSIVE` with `retryAllowed=false`.

Any valid report can add only the `bangumi.get_person_profile` Agent/MCP matrix
cell. P02 remains `PARTIAL`; this profile earns no first/latest participation
scenario credit. The path makes no live API, OAuth/account, community, HTML,
write, QQ, or TIM request. Anonymous public API, no-account denial, and QQ/TIM
acceptance counts remain separate.
