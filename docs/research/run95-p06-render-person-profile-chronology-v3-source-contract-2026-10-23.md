# Run #95 P06 chronology v3 source contract and selection

Date: 2026-10-23 JST
Scope: one new anonymous, offline, synthetic Agent/MCP matrix profile for `bangumi.render_person_profile`.

## Why this profile is distinct

P06 v1 and v2 both set `includeChronology: false`; their fixed fixtures therefore do not render the optional chronology branch. This profile uses a new epoch, synthetic person and subject IDs, fixed arguments, report path, evidence file, and network mode. It exists to exercise that uncovered renderer branch and its strict detail-read boundary. It does not retry either older profile and does not answer a real-person scenario.

## Source behavior and limits

- `PersonService.getPersonProfile` requests the person, related subjects, and related characters. With `includeChronology: true`, it filters the returned relations to anime, deduplicates by subject ID, samples at most `maxChronologySubjects`, and requests each selected `/v0/subjects/{id}` detail under the existing byte and concurrency caps. See `packages/bangumi-core/src/services/person-service.ts`.
- The related-subject source is an array without documented pagination, total, ordering, or completeness metadata. The chronology model therefore records `sourceCompleteness: undocumented`, relation counts, selected details, and omitted rows. It only interprets a valid subject `date` as the official subject air/release date; it does not establish when a person worked on a title or prove a complete career.
- The v3 fixture fixes four synthetic anime relations and `maxChronologySubjects: 3`. The service's evenly-spaced selection reads relation rows 0, 1, and 3. Those local detail responses have dates `2018-04-01`, `2019-07-14`, and `2020-06-01`; row 2 is intentionally not readable as a detail route. This makes the earliest/latest labels and one omitted sample row observable while proving the fixture rejects every unregistered path.
- The renderer should present the two sample extremes as a compact editorial timeline with readable mixed-script titles, existing calendar icon treatment, theme tokens, and each design pack's existing masks. It must preserve the explicit limitation that upstream relation completeness is undocumented and that official subject dates are not person work dates. The local visual matrix covers all three design packs, both palettes, and 320/360/520/640/960 CSS-pixel widths.

## Fixed profile and acceptance boundary

- Profile: `p06-render-person-profile-offline-agent-mcp-v3`; epoch: `run95-p06-render-person-profile-chronology-v3-20261023`.
- Tool and exact arguments: `bangumi.render_person_profile` with person `990606`, `maxSubjects: 4`, `maxCharacters: 1`, `maxCredits: 2`, `includeChronology: true`, and `maxChronologySubjects: 3`.
- Expected local network operations: one synthetic person response, one synthetic related-subject response, one synthetic related-character response, and exactly three explicitly registered synthetic subject-detail responses. The asset resolver blocks all nonempty URLs. No real Bangumi API, account, OAuth, write, community, QQ, or TIM access is part of this profile.
- Acceptance scope is `agent-mcp-matrix-only`. Even a valid report proves only the fixed offline MCP call, strict fixture routing, and returned render artifact. It does not prove live API behavior, chronology completeness, aesthetic approval, or QQ/TIM display.
- The v3 profile must remain bound to exact Candidate CI through `scripts/lib/agent-mcp-profile-ci-evidence.mjs`, Harness report validation, a same-identity GPT-6 Luna Max review, and the existing create-once claim gate. It may be invoked once only after all gates pass; a failure is terminal and must not be retried.
