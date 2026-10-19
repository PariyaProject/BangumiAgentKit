# Run 95 C03 synthetic person activity Agent/MCP matrix v2

Selected Epoch: `run95-c03-person-activity-offline-agent-mcp-matrix-v2-20261019`.
The only accepted scope is the `bangumi.get_person_activity` Agent/MCP matrix
cell. This synthetic profile does not assess the C03 two-voice-actor comparison
scenario and cannot add scenario or public API evidence.

## Fixed call

The registered profile calls `bangumi.get_person_activity` once with a synthetic
person ID and fixed 12-month voice/TV arguments. The local transport fixture
serves exactly three ordered GET paths: `/v0/persons/991237`,
`/v0/persons/991237/characters`, and `/v0/subjects/991238`. Any other method,
path, or fourth request receives 404 and increments the unexpected-request
counter. Authorization headers are counted and must remain absent. The source
contracts for this tool and its official v0 route usage are recorded in
`run95-c03-two-voice-actors-common-works-and-lead-role-share-source-contract-2026-10-14.md`.

No request reaches Bangumi or another network endpoint. The fixture contains
synthetic names and rows; the persisted report contains only the bounded result
projection and fixture operation counters, never raw names, role labels,
source rows, prompts, or model output.

## Agent/MCP checks

The run is eligible only after the exact Candidate has current-base Harness
Candidate approval, all seven required CI checks, and a same-identity GPT-6 Luna
Max PASS. Codex is limited to the registered MCP server and one enabled tool,
with web, apps, browser, computer, shell, and multi-agent features disabled. A
JSON output schema constrains the final response. The runner accepts either
MCP `structuredContent` or a single exact JSON text projection, but if both are
present they must agree; the final JSON response must equal that projection.

The signed report binds the exact profile registry, selection note, tool
catalog/schema, Candidate, Base, CI, reviewer, built MCP bundle, one MCP call,
sanitized result projection, local fixture counters, and event stream. It stores
no raw tool result or answer. A failed or ambiguous invocation is terminal and
must never be retried under this profile. A successful report credits only the
Agent/MCP matrix row; C03 remains `UNASSESSED` as a comparison scenario.

## Boundaries

No real Bangumi identifiers, live/public API requests, OAuth, account data,
community content, writes, QQ, TIM, external people, or maintainer requests are
part of this profile. The old C03 v1 claim remains terminal and is not reused.
