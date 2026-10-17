# Run #95 C07 renderer matrix: distinct offline profile contract

Checked on BangumiAgentKit master `28dd9fc92da2ccbbdd8a99b779d8311a3e70bce5` before any new claim or tool call.

## Existing terminal profile

The legacy C07 profile used the synthetic A/B argument profile in `scripts/lib/c07-cohort-render-offline-fixture.mjs`. Its only allowed renderer invocations were already consumed on PR #140 and ended `INCONCLUSIVE` without a report. The C07 frontier ledger says not to invoke that renderer runner again. This profile and its fixed A/B arguments are permanently excluded.

## New matrix-only profile

The selected Epoch creates a new profile ID, argument profile, network mode, claim label, and report path for one call to `bangumi.render_subject_cohort_comparison`. Its exact input contains one synthetic cohort C, one unique synthetic keyword, `media=anime`, `resultMode=all`, and `limit=1`; the fixed subject response is also synthetic. These arguments differ from the consumed A/B profile. The call tests only the renderer's Agent/MCP matrix cell. It does not answer the C07 scenario and does not credit `bangumi.compare_subject_cohorts`.

The renderer implementation calls `compareSubjectCohorts` internally, then creates a local artifact. The new closed fetch fixture will allow exactly one POST search and one GET subject detail response for the synthetic record, with empty images and a rejecting asset resolver. It will fail closed on authorization, duplicate or unexpected requests, query drift, remote fallback, renderer assets, and write routes. No live Bangumi request is permitted.

## Claim and evidence requirements

The new profile will be registered independently in the profile registry and use the existing profile-ID claim interface. The acceptance validator will add an explicit new-profile route while leaving the legacy C07 validator and terminal history untouched. The signed report will contain only the exact profile/argument identity, fixed request counters, booleans, hashes, and sanitized PNG metadata. It will omit raw cohort rows, titles, names, IDs, prompt, answer, tool output, credentials, and image bytes.

Only a validated report may credit `bangumi.render_subject_cohort_comparison` Agent/MCP. The C07 frontier remains `UNASSESSED`; the report adds no C07 scenario claim, no compare-tool credit, and no public API evidence. A terminal `INCONCLUSIVE` result is no-credit and non-retryable. Any invocation requires a clean exact Candidate, current Base, all seven exact-SHA CI checks, Harness eligibility, and same-identity GPT-6 Luna Max PASS; the report refresh requires fresh exact-SHA CI and review before merge.

No API/MCP call, account action, OAuth action, community read, QQ/TIM action, or profile claim occurred during this source-contract check.
