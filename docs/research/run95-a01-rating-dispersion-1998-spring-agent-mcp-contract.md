# Run #95 A01 rating-dispersion Agent/MCP profile

## Question and scope

Frontier A01 asks whether an animation's rating standard deviation is clearly above the same-season average. This profile exercises the current anonymous `bangumi.compare_subject_cohorts` Agent/MCP path once, using Cardcaptor Sakura TV (subject ID 1940, 1998 spring) as the fixed target and a bounded 1998-spring anime response as the comparison sample.

The profile can document the returned rows and the tool's bounded rating-standard-deviation summaries. It cannot establish statistical significance or decide that the target is meaningfully above the season population. The expected answer must say that the observed sample is insufficient to determine that claim. A valid report therefore supports only a partial A01 observation and the registered tool's Agent/MCP evidence; it does not mark the A01 question answered.

## Fixed call and request boundary

The canonical arguments are stored in `scripts/acceptance/agent-mcp-profile-registry.json` under `a01-rating-dispersion-1998-spring-v1`. The only MCP tool is `bangumi.compare_subject_cohorts`, called once with two cohorts, `maxSubjects=4`, and a per-cohort budget of one search page, 20 candidate rows, four detail hydrations, concurrency two, one concept probe, and at most four returned rows.

The runner allows anonymous HTTPS requests only to `api.bgm.tv`: `POST /v0/search/subjects?limit=20&offset=0` and `GET /v0/subjects/{positive-id}`. The total HTTP request cap is 20. Credentials, private `/p1` routes, other hosts, query parameters, redirects, writes, community data, OAuth, QQ, and TIM are outside scope and rejected or unavailable to the profile.

## Evidence and limits

The runner is gated by the exact Run #95 Candidate, current master Base, all seven required CI checks, and a same-identity GPT-6 Luna Max PASS. Harness owns the one-shot profile claim and terminal result. The signed report retains only answer and event hashes, bounded numeric/status summaries, request counters, tool descriptor hashes, and the runner receipt. It does not retain the prompt, answer text, raw tool result, response bodies, or credentials.

The comparison remains a snapshot of rows returned under the fixed search and hydration budgets. Estimated totals, partial results, missing metrics, conflicts, and omitted rows remain explicit limitations. No result from this profile may be described as a complete season comparison, a significance test, a cause, a quality judgment, a polarization assessment, or a recommendation.

## Terminal handling

The profile is permanently one-shot. Once Harness records CLAIMED, every outcome is terminal; an inconclusive run receives no report or acceptance credit and must not be repeated. A report is credited only when its exact Candidate, claim, signed receipt, current tool catalog, and Harness REPORT_WRITTEN disposition all validate.
