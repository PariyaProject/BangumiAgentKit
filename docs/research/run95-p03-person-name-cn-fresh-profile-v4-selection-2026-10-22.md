# Run #95 P03 v4 — fresh public profile source selection

Recorded: 2026-10-22. This is source-selection evidence only; no profile claim, MCP/ToolRegistry call, report, or matrix credit was created.

## Distinct bounded input

- Anonymous `GET /v0/subjects/218707/persons` returned 157 observed person rows; public person ID `54025` appeared with the raw relation `制作进行`.
- Anonymous `GET /v0/persons/54025/subjects` returned 18 observed related-subject rows. The first five each had a non-empty `name_cn` after trimming. Only IDs and aggregate counts are retained here; no person or title names are stored.
- The proposed fixed call is `bangumi.get_person_profile` with `personId=54025`, `includeCredits=true`, `maxSubjects=5`, `maxCharacters=1`, and `includeChronology=false`. This input is absent from the existing profile registry and live-probe report inputs. It is distinct from terminal P03 v1/v2/v3 and terminal synthetic P02 v1/v2.

## Official contract and evidence limits

The current [official Bangumi OpenAPI](https://github.com/bangumi/api/blob/master/open-api/v0.yaml#L826-L842) documents `/v0/persons/{person_id}/subjects` as an array of `v0_RelatedSubject`; its schema contains `name_cn` as a string ([schema](https://github.com/bangumi/api/blob/master/open-api/v0.yaml#L4082-L4110)). The related-person detail endpoint is separate and does not define `name_cn` on `PersonDetail`. The response is a bounded observed array without a total/completeness contract. These reads support only selecting positive rows from the exact returned projection; they do not prove a complete filmography, stable order, or absence of Chinese names in unreturned works. A non-empty `name_cn` value does not by itself prove that a translation occurred.

## Invocation gate and non-retry boundary

The v4 profile may run exactly once, only after the exact Candidate has all seven required checks successful, Harness `candidate:check` passes, and the same-identity GPT-6 Luna Max review records PASS. The only possible matrix credit is the `bangumi.get_person_profile` Agent/MCP cell and only after Harness accepts a sanitized `REPORT_WRITTEN` report. P03 remains `PARTIAL`. Any incomplete attempt is terminal `INCONCLUSIVE`, no-report, `retryAllowed=false`. Do not retry or recreate P02 v1/v2 or P03 v1/v2/v3.

No account/OAuth, community/HTML, write, QQ, or TIM path was used. This selection evidence adds no public API matrix credit.
