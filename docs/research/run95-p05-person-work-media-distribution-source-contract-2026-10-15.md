# Run #95 P05: person-work subject-type distribution source contract

Rechecked 2026-10-15 against BangumiAgentKit master `244b5426e2ae99006b9eadcf3275db4187ef3288` and the pinned first-party Bangumi API OpenAPI revision `65d29cff2331e08c0110d30d515f7f1b6488f845`. P05 remains `UNASSESSED` until the current gated public observation is recorded. This report contains no person-specific API result.

## Official source contract

- `GET /v0/persons/{person_id}/subjects` returns an array of `v0_RelatedSubject`. The operation takes the person ID as its only documented parameter and does not define pagination, a total, an ordering, or a completeness marker. The related-subject schema includes a `type` code. See the pinned [person-subject endpoint](https://github.com/bangumi/api/blob/65d29cff2331e08c0110d30d515f7f1b6488f845/open-api/v0.yaml#L826-L854) and [related-subject schema](https://github.com/bangumi/api/blob/65d29cff2331e08c0110d30d515f7f1b6488f845/open-api/v0.yaml#L4082-L4113).
- The official `SubjectType` enum maps 1 to book, 2 to anime, 3 to music, 4 to game, and 6 to real. These are Bangumi subject categories, not streaming or distribution platforms. See the pinned [subject-type enum](https://github.com/bangumi/api/blob/65d29cff2331e08c0110d30d515f7f1b6488f845/open-api/v0.yaml#L3790-L3822).

## Current local behavior

- `bangumi.get_person_profile` calls the person, related-subject, and related-character endpoints. It bounds returned relation rows locally, reports observed/returned/truncated counters, and projects `summary.subjectMedia` with relation-row counts, unique-subject counts, normalized type keys, and observed raw type codes. See [`PersonService.getPersonProfile`](../../packages/bangumi-core/src/services/person-service.ts), [`aggregatePersonActivity`](../../packages/bangumi-core/src/services/person-service.ts), and the [`get_person_profile` tool definition](../../packages/tools/src/definitions/read-tools.ts).
- The local mapper maps official codes 1/2/3/4/6 to `book`/`anime`/`music`/`game`/`real`; unknown codes map to `other`. The profile’s `sourceCompleteness` is explicitly `undocumented`. A local state of `complete` cannot establish that the upstream relation array is a complete career graph.
- The dedicated [`run-p05-person-media-public-probe.ts`](../../scripts/acceptance/run-p05-person-media-public-probe.ts) selects only `bangumi.get_person_profile` with `personId=3474`, `includeCredits=false`, `maxSubjects=500`, and `maxCharacters=1`. It verifies the exact reviewed Candidate/Base, seven successful checks, and GPT-6 Luna Max PASS before the read. Before invoking the tool it acquires a permanent repository-scoped create-only GitHub label, writes the exact claim into the active Epoch PR, and reads that claim back. The label serializes attempts across clones and PR replacements; the local Git-metadata claim remains defense in depth. Its summary retains only aggregate subject-type counts, unique-subject counts, raw type codes, and relation coverage counts. It excludes work names, titles, images, relation IDs, and raw response payloads. The existing shared public-probe script stays unchanged so its historical report hashes remain valid.

## Bounded claim and disposition

After the reviewed observation, a valid answer can describe only the Bangumi subject-type distribution among the relation rows returned to that invocation, along with the observed/returned/truncated counts and the undocumented upstream completeness limit. It cannot claim a platform distribution, an exhaustive career-wide distribution, or that unreturned work types do not exist.

No P05 live query has occurred in this Epoch yet. P05 remains `UNASSESSED` until the exact reviewed Candidate’s public probe and summary assertions pass. This direct ToolRegistry observation cannot add Agent/MCP, renderer, QQ, or TIM acceptance.
