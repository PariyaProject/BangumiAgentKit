# Run #95 S01 current-source annual TV voice-activity profile

Updated 2026-10-21 against BangumiAgentKit master `e2643ab814d3c861ef8c16d14840725011e68283`.

## User question and bounded claim

The selected frontier asks how many TV-anime works a voice actor voiced in each year over the recent three-year window. The profile uses one fixed public Bangumi identity and exactly one call to `bangumi.get_person_activity`:

```json
{
  "personId": 5745,
  "kind": "voice",
  "media": "tv",
  "windowMonths": 36,
  "maxRelations": 48,
  "maxSubjectDetails": 16,
  "maxRows": 8
}
```

The public identity was selected from the official [Bangumi person page](https://bgm.tv/person/5745). The profile does not use an account, OAuth, collection data, community pages, writes, QQ, or TIM. Its Agent/MCP result can support one bounded current-source observation only; S01 remains `PARTIAL` and is not a complete career-history claim.

## Current official-source contract

The current upstream [Bangumi v0 OpenAPI](https://github.com/bangumi/server/blob/master/openapi/v0.yaml) defines the public person detail, person-to-character relation, and subject detail operations. For this voice-only query, the bounded adapter permits:

1. `GET /v0/persons/5745`;
2. `GET /v0/persons/5745/characters`;
3. at most 16 `GET /v0/subjects/{subject_id}` requests, where each subject ID must have appeared in the preceding character-relation response.

Requests must use `https://api.bgm.tv`, GET, no query or fragment, no credentials or credential headers, and redirects are errors. The adapter caps each response at 1 MiB and total requests at 18. It rejects other hosts/routes, reordered or repeated identity/relation requests, repeated subject detail requests, and subject IDs absent from the relation response. The durable request-scope summary contains counters only, never requested IDs.

The official `PersonCharacter` relation includes a `subject_id`; the subject detail operation supplies the subject type, date, and platform needed by the product service. The current implementation first requires anime type and then uses the platform-text classifier to include TV and exclude known movie/theatrical, OVA, web, and music markers. Unknown or unrecognized platforms degrade coverage rather than being guessed.

## Time and counting semantics

`windowMonths=36` is the current calendar month plus the 35 previous calendar months, starting on the first day of the earliest month and ending on the as-of date inclusively. The service groups accepted records by the work's first-air calendar year and clips each displayed year range to the actual window. For example, an as-of date of 2026-10-21 gives `2023-11-01` through `2026-10-21`, with four year buckets and partial boundary years.

The answer uses each bucket's `uniqueSubjects` as the number of observed works. It separately reports voice-credit rows and unique characters so multiple character credits for one work are not mistaken for multiple works. The service's `summary.byYear` is computed from accepted rows before the returned-row cap; relation and detail caps still limit the underlying sample.

## Coverage and answer limits

The official character-relation operation exposes an array but no pagination or completeness guarantee. The request selects at most 48 relation rows and hydrates at most 16 unique subject details; the tool returns at most 8 rows while computing aggregate summaries from accepted data before that output cap. The result must preserve its `complete` or `partial` state and expose relation selection, detail success/failure, sampling, and output-truncation counters.

Counts are observations from current Bangumi person-to-character-to-subject relations and current subject first-air dates. They do not identify actual recording years and do not reconstruct historical relations. If coverage is partial, every yearly value is a sampled observation; a zero is not evidence that no work exists. Even complete coverage describes current source records, not a whole-career historical truth.

## One-shot execution gate

The profile and answer checks are added before the one-shot call. The query may run only after the exact Candidate matches the active Epoch/Base, all seven required CI checks pass on that Candidate, the assigned same-identity GPT-6 Luna Max review returns `PASS`, and Harness status confirms this new profile is `UNCLAIMED` for the active PR. The runner then atomically claims once and allows one Agent/MCP tool call. Any failure after claim is terminal `INCONCLUSIVE` with no report or retry; no previous profile is retried or reused.

The signed sanitized report may include fixed-profile/input hashes, exact Candidate/Base/CI/reviewer/registry/bundle bindings, bounded aggregate annual counts, safe coverage counters, request-scope counters, and answer/check hashes. It must not retain the raw answer, names, person or subject IDs, titles, raw tool rows, private data, or image bytes. A passing report can add at most the `get_person_activity` Agent/MCP matrix cell; it does not add public API, auth, QQ, or TIM evidence.

## Verification record

- Upstream schema rechecked 2026-10-21: person detail and related-character operations, `PersonCharacter.subject_id`, subject detail operation, and date/platform data fields in the official v0 OpenAPI.
- Current service inspected at the Candidate base: `packages/bangumi-core/src/services/person-activity-service.ts` and `packages/bangumi-core/src/models/person-activity.ts`.
- No public Bangumi API or Agent/MCP query was executed while preparing this contract.
- Selection evidence reference: `docs/research/s01-voice-actor-annual-tv-count-contract-2026-10-08.md`.

## Round-1 corrective and CI recovery record

The first same-identity review returned CORRECTIVE_REQUIRED on Candidate 11d129142065d6ba992138fa942f5b351f67a63e against Base e2643ab814d3c861ef8c16d14840725011e68283. It identified two issues:

- The answer validator did not bind its declared coverage state to the expected summary state, which could let an answer promote PARTIAL coverage to COMPLETE.
- The summary-level unique-character count was not constrained by total credit rows.

Candidate 43ac40266ccfebd0b0275d9bd5aefd46b6a9182b fixes both. The answer checks now require exact state equality and expose coverageStateMatches; the summary requires uniqueCharacters <= creditRows. Regression tests cover “S01 answer cannot upgrade partial coverage to complete” and “S01 rejects a global unique-character count greater than its credit rows.” The focused S01 test file passed 11/11, and pnpm acceptance:check passed with 284 evidence tests; the current-source matrix stayed at Agent/MCP 82/96, public API 65/65, auth denial 22/22, and QQ/TIM 0/96.

Exact pull_request CI run 39622982266 on Candidate 43ac40266ccfebd0b0275d9bd5aefd46b6a9182b has six successful jobs. provider-foundation reports every step successful but its job and run remain IN_PROGRESS; cancellation and specific-job rerun requests were rejected by GitHub. A same-SHA workflow_dispatch run 39625247769 then completed with all seven jobs successful. GitHub’s commit Check Suites API links that completed suite to PR #249, but the PR statusCheckRollup and merge state still expose only the original pending pull_request suite and remain UNSTABLE. Therefore the manual run is supplemental evidence and does not satisfy the Harness PR Candidate gate. The next Candidate needs a fresh pull_request CI suite on its exact head before candidate:check.
