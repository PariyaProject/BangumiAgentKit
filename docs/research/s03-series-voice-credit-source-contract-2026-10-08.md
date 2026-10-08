# S03 voice credit source contract — 2026-10-08

## Source checked

The repository's vendored official Bangumi v0 OpenAPI source defines
`GET /v0/persons/{person_id}/characters` as an unpaged JSON array of
`PersonCharacter` rows (`openapi/upstream/v0.yaml`, operation
`getRelatedCharactersByPersonId`). The row schema requires numeric character and
subject IDs, the subject type, and subject names; `staff` is an optional string.
The operation has no query parameters for pagination, offset, or a total count.

The same OpenAPI source defines `GET /v0/subjects/{subject_id}/subjects` as a
direct relation array. It does not provide reverse-edge traversal or a
franchise-completeness guarantee. The existing `SeriesService` relation mapper
preserves each source row's relation label and subject ID.

## Safe join and claim scope

The candidate set is the anime anchor plus at most `maxNodes` currently observed
direct anime relations whose exact normalized raw relation label is one of the
existing prequel, sequel, side-story, or recap kinds. Candidate selection is
deterministic by numeric subject ID. Person-character rows join only on numeric
`subject_id`; display names are retained for reading but never used as keys.

The person response is read once through the existing HTTP client, limited to
1 MiB, and locally selected to at most 120 rows. Coverage records observed,
returned, omitted, duplicate, schema-drift, candidate-cap, and source status
counts. The raw `staff` string is preserved when present, including an empty
string. Multiple matching characters under the same subject count as one
work. Only two or more distinct matched subject IDs produce
`multi_work_found`.

The response arrays have no pagination or total count and represent only the
current anonymous-visible rows. Therefore a zero- or one-work result means
only that a multi-work overlap was not established in the observed set; it does
not show that the actor has no other credits. This join does not establish
franchise membership, a canonical order, a complete career, recording dates,
or workload.

## Prepared one-time Agent/MCP case

For the governed S03 call, the fixed public IDs are anchor subject `329906`
(`SPY×FAMILY`) and person `7602` (`後藤ヒロキ`). A read-only source check on
2026-10-08 observed one eligible direct anime relation from subject `329906`:
subject `373267` (`SPY×FAMILY 第2クール`), raw label `续集`. The person response
contained 75 rows; the matching anchor and sequel rows appeared at positions 43
and 56, within the 120-row selection cap. This prepares a bounded positive case;
it is not Agent/MCP acceptance evidence and does not consume the one-time call.

## Implementation boundary

This source contract supports the optional `voiceActorPersonId` path in the
existing `bangumi.get_series_watch_order` and its renderer/Standalone surfaces.
Omitting the option makes no person request and retains the existing result
shape. The feature uses anonymous read-only GETs only; it adds no OAuth,
account, community, QQ, TIM, write, or HTML-fetch path. Agent/MCP evidence is
still pending the governed one-time S03 call after exact Candidate, CI, Harness,
and Luna Max review gates align.
