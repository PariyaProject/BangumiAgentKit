# Run #95 A01 aggregate cohort offline Agent/MCP matrix v3 contract

Recorded: 2026-10-22.

## Scope

This is a fresh, synthetic-only Agent/MCP matrix profile for
`bangumi.aggregate_subject_cohort`. Its profile ID is
`a01-aggregate-cohort-offline-agent-mcp-matrix-v3`, selected only by Epoch
`run95-a01-aggregate-cohort-offline-matrix-v3-20261022`.

The v1 and v2 claims are already terminal `INCONCLUSIVE`, with no report and
`retryAllowed=false`. This profile has a new claim label, argument profile,
search keyword, synthetic subject ID, report path, and selection record. It
reuses the already-reviewed v2 offline transport mode because the local
search/detail boundary is unchanged; the profile ID and arguments still bind
the new fixture. It does not replay or replace either consumed claim.

A valid Harness-acknowledged signed report may credit only the
`bangumi.aggregate_subject_cohort` Agent/MCP matrix cell. A01 remains
`UNASSESSED`; no scenario, public API, real Bangumi, account/OAuth, community,
QQ, TIM, or stability credit is added.

## Fixed input and local fixture

The Agent may invoke the sole exposed tool exactly once with one anime cohort,
`resultMode=all`, `limit=1`, and `maxSubjects=1`. Its unique query keyword is
`run95 fresh synthetic aggregate profile v3 2026-10-22`.

The MCP server permits exactly one local-fixture search POST and one local
detail GET for synthetic subject `991220`. The fixture returns score 7,
collection heat 90, 12 reported episodes, and ten ratings split evenly between
6 and 8 (population standard deviation 1). These requests are satisfied by
the local fixture; external request count must remain zero. Authorization,
proxy-authorization, cookies, API keys, credentialed URLs, unexpected
origins/paths/queries, altered v1/v2 arguments, and repeated operations are
denied.

The profile asks GPT-6 Luna Max for one exact bounded JSON acknowledgement
whose values are fixed by this synthetic fixture. The report independently
checks the exact tool event, exact arguments, structured result, fixture
counters, coverage, and privacy. The acknowledgement is not evidence for the
A01 user scenario or a claim about real data.

## Gates and diagnostics

The runner checks the active Run/Epoch, clean Candidate, current master Base,
all seven exact-Candidate CI checks, same-identity GPT-6 Luna Max PASS, built
MCP bundle attestation, and `UNCLAIMED` v3 status before creating the
create-once claim. Shell, web, browser, computer, apps, plugins, account,
OAuth, community, write, QQ, and TIM paths remain disabled.

Terminal diagnostics are limited to the Harness allowlist of check booleans
and bounded counters. They may include event counts, process byte counts,
answer byte count, and exact-gate booleans. They must omit raw prompt, answer,
tool arguments, result rows, credentials, and event-stream contents. Any
failed invocation is terminal `INCONCLUSIVE` with `retryAllowed=false`.

## Reproduction boundary

This contract is a static profile specification. It does not itself claim an
Agent/MCP invocation, a real API request, cohort completeness, statistical
significance, or visual quality. Only a signed report accepted by the active
Harness can add the one matrix cell.

## Observed Run #95 v3 attempt

The single authorized v3 invocation ran on Candidate
`8d2b3ae18322ac7c92178fb1cfc67834827d3b0b`, Base
`20294c065a9fa41e9bad21daab1e32c287e98e75`, with exact CI run `39690572503`
and a matching locally rebuilt MCP bundle attestation. Harness terminalized
the claim as `INCONCLUSIVE`, `reportWritten=false`, `retryAllowed=false`, with
reason code `A01_AGGREGATE_MATRIX_AGENT_MCP_ASSERTION_FAILED`. The profile is
consumed; it must not be called again.

The bounded diagnostics report `candidateCurrent`, `claimReadbackValid`,
`codexExecutionSucceeded`, `eventStreamParsed`, `turnCompleted`,
`serverSummaryValid`, `answerValid`, and `candidateBundleCurrent` as true.
`structuredReadback`, `exactCallSequence`, `exactToolEvents`,
`resultProjectionValid`, `reportBuildValid`, and `runnerReceiptValid` are
false. Counters include one MCP event, three Codex error items, zero MCP tool
error results, zero non-MCP events, zero shell calls, 469 answer bytes, 5174
stdout bytes, and 905 stderr bytes. The report writer produced no report.

The raw prompt, answer, tool result, rows, and event stream were not saved.
The attempt earns no Agent/MCP matrix cell and no A01 scenario credit; A01
remains `UNASSESSED`. The clean-tree acceptance matrix therefore remains
Agent/MCP 82/96, public API 65/65, no-account denials 22/22, and QQ/TIM 0/96.
