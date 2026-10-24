# Run #95 R03 two-hop rating Agent/MCP offline matrix profile v1

## Selection

- Run: #95, R03, Epoch: \`run95-r03-two-hop-rating-agent-mcp-offline-20261023\`
- Base at selection: \`9d7a563adfb17a6220520a775e6c5fb5cd9891f6\`
- Profile: \`r03-two-hop-rating-analysis-offline-agent-mcp-v1\`; matrix scope only.
- Tool: \`bangumi.get_subject_relations\`
- Fixed call: \`{subjectId: 993811, analysisMode: "observed_two_hop_rating"}\`
- Model: GPT-6 Luna Max (\`gpt-6-luna\`, \`max\`).

## Why this is a distinct profile

The existing R01/R02/R03 relation matrix profiles exercise the default direct relation or \`includeEvidence\` contract. Merged PR #213 added the separate \`analysisMode=observed_two_hop_rating\` branch, but explicitly recorded no live API or Agent/MCP invocation and required a fresh matrix profile. This profile covers only that unclaimed call path. The earlier R03 v1/v2 latches remain terminal and are never retried.

## Offline fixture contract

This is a local synthetic fixture, not a live API request. It permits exactly four anonymous GETs, with no query, body, authorization, cookie, proxy-authorization, or API-key header:

1. \`GET /v0/subjects/993811/subjects\` returns the synthetic depth-1 relation to 993812.
2. \`GET /v0/subjects/993812/subjects\` returns the synthetic depth-2 relation to 993813.
3. \`GET /v0/subjects/993812\` returns a synthetic score of 8.1 with 18 ratings.
4. \`GET /v0/subjects/993813\` returns a synthetic score of 9.2 with 37 ratings.

The expected result is one depth-2 path \`[993811, 993812, 993813]\`, labels \`[续集, 续集]\`, and an observed-sample top score of 9.2. The root is never a candidate. The fixture validates this execution path only; it does not establish any real relationship, rating, full graph coverage, public API acceptance, or R03 scenario completion.

## Gates and boundaries

Before any one-shot call, the exact PR Candidate must pass the seven repository checks, Harness \`candidate:check\`, and a same-identity GPT-6 Luna Max review. The signed report and Harness terminal disposition must bind that exact Candidate, Base, review, CI, profile, and bundle. No tool call has been made for this profile yet.

OAuth/account/community/write/QQ/TIM remain passive. No credentials, account identifiers, private messages, or media are part of this profile. R03 remains PARTIAL after matrix-only evidence.
