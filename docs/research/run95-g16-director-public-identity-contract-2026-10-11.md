# Run 95 G16 public director identity and bounded source contract

Date: 2026-10-11 (UTC time of the identity response was not separately captured).

## Identity evidence

- Source: official public Bangumi v0 endpoint [`GET /v0/subjects/218707/persons`](https://api.bgm.tv/v0/subjects/218707/persons).
- Request was an anonymous, read-only GET; response status was 200 and contained 157 relation rows.
- One returned relation had the exact role label `导演` and public person ID `6154`.
- No person-activity query, OAuth/account request, community request, QQ/TIM interaction, write, or destructive operation was made during this identity check.
- The response body and public names were not retained. The endpoint, row count, exact role, and fixed public ID are the sanitized evidence needed to bind the upcoming fixed profile.

## G16 query scope

The existing official-v0 `bangumi.get_person_activity` contract supports `kind=staff`, `staffRole=director`, `media=tv`, and a 36-calendar-month window. The Run 95 fixed profile is person ID 6154 with `maxRelations=48`, `maxSubjectDetails=16`, and `maxRows=20`. The matching direct profile is gated behind the exact reviewed Candidate, current master Base, all seven exact-SHA checks, and the same-identity GPT-6 Luna Max PASS.

The result remains a bounded current-response observation. Date membership uses `first_air_date`; role matching uses the exact normalized director labels supported by the product contract; TV filtering can exclude non-TV and unknown-platform rows. Relation sampling, detail limits, missing dates, unknown roles, and output caps remain visible. The result cannot establish a complete director filmography, historical career, actual labor time, or absence of unreturned works. G16 stays PARTIAL.

## Next action

Finish the G16 create-once runner, exact answer checker, sanitized report, and acceptance-matrix validation. Do not invoke Agent/MCP until the active G16 Candidate passes exact-SHA CI, Harness `candidate:check`, and the assigned same-identity GPT-6 Luna Max review. After the one permitted call, preserve any failure as consumed and never retry it.
