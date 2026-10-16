# Run #95 P07: bounded person activity by calendar quarter

Checked 2026-10-16 against BangumiAgentKit master `eb45f2928ed3380373a1b183998edba5117e2a53` and the first-party Bangumi v0 OpenAPI master commit `65d29cff2331e08c0110d30d515f7f1b6488f845`. No person-specific API request, ToolRegistry/MCP call, account access, community read, or client action was made for this source-contract check.

## Source contract

- `bangumi.get_person_activity` can return bounded staff rows with an optional `firstAirDate`, derived from each successfully fetched subject's official date field. Its profile input limits the relation sample, detail fan-out, result rows, and calendar window. The person-to-subject API response is an array with no pagination or total field in the current official schema. This cannot establish a complete career distribution.
- The exact P07 profile is a single anonymous `kind=staff`, `media=anime`, 36-calendar-month call with `maxRelations=48`, `maxSubjectDetails=16`, and `maxRows=8`. It uses the fixed public input `personId=3474`; the ID is a query input, not a value derived from response data.
- A bounded salvage is to count only valid dates on rows actually returned and group them into calendar quarters: Q1 January–March, Q2 April–June, Q3 July–September, and Q4 October–December. The wording must say “among the returned sample” and identify the dates as official first-air/release-date observations. These are calendar quarters, not a claim about canonical anime broadcast seasons.
- P07's tag-frequency subquestion is excluded. The activity output does not expose complete per-work tags, and a separate subject-identity fan-out would require a different profile. No tag absence, complete career history, or complete work count may be inferred.

## Current source and safety boundary

The activity service and tool definition were compared with the P07 source-contract Base `779d73451107e6d119825dd48d236ceb57f319e1`; `person-activity-service.ts` is unchanged through current master. The only `read-tools.ts` change in that range updates the separate person-profile chronology description. The current official v0 OpenAPI still defines `/v0/persons/{person_id}/subjects` as an array returned with only the person ID path parameter; it specifies no page, total, or completeness marker.

P07 remains `UNASSESSED` and receives no scenario or Agent/MCP credit from this source work. The new profile must have its own permanent one-shot claim and a live Harness status check on its active PR. Do not invoke it until exact-Candidate CI, `candidate:check`, and the same-identity Luna Max review PASS. Once claimed, any inconclusive result is terminal and no-retry. Preserve all existing P01/P02/P03/P05/C03 and other consumed profiles.

## Evidence references

- BangumiAgentKit tool: `packages/tools/src/definitions/read-tools.ts` (`bangumi.get_person_activity`).
- Local bounded implementation: `packages/bangumi-core/src/services/person-activity-service.ts`.
- Official schema: `https://github.com/bangumi/api/blob/65d29cff2331e08c0110d30d515f7f1b6488f845/open-api/v0.yaml`, `GET /v0/persons/{person_id}/subjects` and the Subject date field.
- Prior source-only P07 assessment and limits: PariyaAgent `docs/research/run95-p07-person-tags-seasons-source-contract-2026-10-14.md`.
