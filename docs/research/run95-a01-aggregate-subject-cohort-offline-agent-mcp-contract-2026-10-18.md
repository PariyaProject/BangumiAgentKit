# Run #95 A01 aggregate cohort offline Agent/MCP matrix contract

## Scope

This is a new, separate Agent/MCP matrix profile for `bangumi.aggregate_subject_cohort` only. It uses the catalogued `auth=none`, `risk=read` contract and one fresh fixed argument profile. It is not the consumed A01 aggregate-scenario attempt, the 1998-spring rating-dispersion comparison, or the already registered render-aggregation profile. The profile earns no A01 scenario, public API, comparison, significance, recommendation, or history credit. A01 remains `UNASSESSED`.

## Exact synthetic call and source boundary

The configured Agent may call only `bangumi.aggregate_subject_cohort`, exactly once, with the registry's fixed synthetic anime query and `maxSubjects=1`. The MCP server installs a local fetch fixture that accepts exactly one anonymous `POST https://api.bgm.tv/v0/search/subjects?limit=20&offset=0` with the expected keyword/filter/sort and one `GET https://api.bgm.tv/v0/subjects/990184`. Both responses are synthetic and locally generated. Authorization, proxy-authorization, cookie, and API-key headers; credentialed URLs; any other origin/path/query; unexpected method; and repeated call are rejected with a synthetic error response and counted. The tool call performs no external network request.

The synthetic detail supplies score 7.0, collection total 56, 12 reported episodes, and a complete ten-bin rating histogram with five ratings of 6 and five ratings of 8 (population standard deviation 1.0). The Agent receives only a bounded projection: one cohort's query/detail coverage, four metric states and averages, and aggregate limits. The MCP summary drops names, titles, subject ids, source rows, evidence bodies, and artifact bytes. The final answer is an exact compact JSON projection checked against the returned structured result.

## One-shot gates and report

The runner may claim only after the profile is `UNCLAIMED` and the active Run #95 Epoch, PR, exact Candidate, current `master` Base, seven required exact-head CI checks, same-identity GPT-6 Luna Max `PASS`, and bundle attestation all match. It rechecks the durable claim and gates immediately before Codex. The Agent has one required MCP server and tool; shell, web, browser, computer, apps, plugins, and multi-agent access are disabled.

A successful invocation writes one create-once signed report bound to the profile registry and arguments, selection contract, Candidate/Base/CI/reviewer, catalog/schema, MCP bundle, server summary, synthetic result summary, and answer hash. It stores no prompt, answer text, Codex stdout/stderr, subject name/id, source row, or artifact bytes. Only a Harness-validated `REPORT_WRITTEN` disposition can credit the single Agent/MCP matrix row. A claim that reaches `CLAIMED` is permanently consumed; `INCONCLUSIVE` earns no accepted report or matrix credit and has `retryAllowed=false`. If a report file was written before Harness acknowledgement failed, it remains an unaccepted artifact and does not authorize a retry or matrix credit.

## Failure diagnostics

Terminal failure diagnostics use a fixed reason-code enum, booleans for process-spawn/timeout and validation gates, the numeric exit code when available, and bounded stdout/stderr byte counts. No raw Codex output, error message, stack, prompt, answer, or tool arguments are persisted. Diagnostics may accompany only the initial `INCONCLUSIVE` Harness result and become immutable with that terminal claim.

## Validation boundary

Tests must prove fixed profile/argument binding; the exact two-operation offline fixture; denial of credentials, unexpected/repeated operations; sanitized structured summary and answer matching; exact Candidate/Base/CI/reviewer/claim binding; report signature and create-once path; terminal claim no-retry behavior; diagnostics allowlisting, bounds, and rejection of raw fields. A valid result supports only `bangumi.aggregate_subject_cohort` Agent/MCP matrix evidence; it says nothing about QQ/TIM, real Bangumi sources, or complete cohort coverage.
