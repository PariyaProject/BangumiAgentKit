# Run #95 R03: offline Agent/MCP matrix profile contract

Checked against synchronized BangumiAgentKit master `ca53e7def0879afc8052c5730ecf2566a7b13653` before implementation. This report defines a local synthetic matrix check only. It makes no Bangumi request, adds no scenario result, and does not count as R03 answer acceptance.

## R03 source and capability boundary

R03 asks which related work has the highest rating within two hops. The official v0 operation `GET /v0/subjects/{subject_id}/subjects` exposes the visible direct rows for one source subject, without pagination, a total, reverse edges, or a completeness contract. The local `bangumi.get_subject_relations` tool preserves each raw relation label and can return an evidence envelope, but an absent row does not prove a relation is absent. The current tool implementation is in `packages/tools/src/definitions/read-tools.ts`; the pinned upstream response shape is in `openapi/upstream/v0.yaml`.

A synthetic offline call sequence can test only the Agent/MCP tool surface and its coverage projection. It cannot establish a real two-hop graph, any subject score, a highest-rated result, or complete graph coverage. R03 therefore remains `UNASSESSED` and receives no scenario or user-answer credit from this profile.

## Fixed profile

- Profile ID: `r03-two-hop-relations-offline-agent-mcp-v1`
- Epoch ID: `run95-r03-two-hop-relations-offline-agent-mcp-20261017`
- Tool: `bangumi.get_subject_relations`
- Scope: `agent-mcp-matrix-only`
- Calls, in order: `{ subjectId: 990910, includeEvidence: true }`, then `{ subjectId: 990911, includeEvidence: true }`.
- Fixture graph: synthetic root 990910 points to synthetic intermediate 990911; the intermediate response contains two synthetic direct targets. Every ID and name is fixture data and does not identify a Bangumi subject.
- Network fence: the fixture allows only one anonymous GET for each exact local route with the production client's exact `Accept` and `User-Agent` headers, rejects missing or extra headers and duplicate calls, and never delegates to the live API client.

The result summary retains only row counts, coverage flags, and the fixture's relation labels. The signed report does not retain relation IDs, names, raw rows, prompts, or tool output.

## Claim and retry contract

The closed profile registry identifies claims by the exact `(toolName, argumentProfile)` pair and includes multiple distinct profiles for the same tool. This R03 profile has a new fixed pair and its own permanent label. Harness must confirm the exact active Epoch, Candidate/Base, seven successful CI checks, same-identity GPT-6 Luna Max review, profile status, and label before the runner can execute. After creating the permanent claim, the runner re-reads the PR, Base, CI, review, and claim immediately before MCP invocation; a changed gate terminalizes its owned claim as inconclusive. The candidate-bound runner then makes exactly the two registered MCP calls. Any failed or ambiguous execution is terminal and cannot be retried.

The R01 offline one-call profile and the R02 three-call public profile are separate terminal claims; this profile does not alter, reuse, or replace either one. Other one-shot dispositions, including A01, C07, S05, and P05, remain untouched. No profile has been invoked yet.
