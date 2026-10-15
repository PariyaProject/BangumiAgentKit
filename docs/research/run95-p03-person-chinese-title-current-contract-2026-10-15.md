# Run #95 P03: person Chinese-title evidence and source coverage

Reverified 2026-10-15 on current BangumiAgentKit `master` at `2884aff638512652cfe99e4b496dd915332ad052` after PR #166 merged. This records source-contract and implementation semantics; it does not by itself credit a scenario answer.

## Official source contract

- `GET /v0/persons/{person_id}/subjects` accepts the person ID and returns an array of `v0_RelatedSubject`. The checked OpenAPI path has no pagination, total, cursor, ordering, or completeness parameters.
- `v0_RelatedSubject` requires `name` and `name_cn` as strings. The schema allows an empty string and does not define whether empty means “no Chinese title.” A missing or invalid field is runtime schema drift, not a normal contract value.
- The person-service mapper previously used `raw.name_cn || raw.name || ''`, making an empty or absent `name_cn` indistinguishable from a fallback to `name`. P03 can make a positive statement that the source records a Chinese name when raw `name_cn` remains non-empty after trimming, whether it equals `name` or differs from it. Empty/missing values are unknown evidence and do not establish that a work has no Chinese name.

The local first-party schema is `openapi/upstream/v0.yaml` at `/v0/persons/{person_id}/subjects` and `components.schemas.v0_RelatedSubject`.

## Bounded product behavior

- Person-work rows preserve the existing display `nameCn` fallback and carry `nameCnSource` separately. The source field is the raw string, including an explicit empty string; `null` represents an absent or invalid runtime field.
- `get_person_profile` reports `coverage.subjects.sourceCompleteness = "undocumented"`. Its local `complete` state means only that the received rows were not locally capped and selected identity fields were present; it does not establish that the endpoint returned every person-work relation. The P03 fixed profile leaves `includeChronology` at its default false, so it does not request subject-detail dates.
- MCP text reports counts for present, empty (including whitespace-only), and unavailable `nameCnSource` values among included credit rows. An unavailable value combines an absent field with an invalid non-string value; when credit rows are excluded, these counts and row metrics are unavailable. It lists up to six positive rows within a 3600-byte UTF-8 limit and counts any additional positive rows omitted from text; the full returned result remains in `structuredContent`.
- The rendered profile card labels the returned scope and shows whether each displayed row has a source title value, an empty field, or an unavailable field (absent or invalid).

This source contract supports only bounded positive `name_cn` evidence. It does not establish a career-wide list, negative conclusion, or complete relation graph; any current Agent/MCP answer must be accepted against its separate profile and report evidence. C03 remains terminal INCONCLUSIVE and is not retried.

## P03 Epoch profile boundary

The selected Run #95 Agent/MCP profile makes one anonymous `bangumi.get_person_profile` call for public person ID 4765, with `includeCredits=true`, `maxSubjects=500`, and `maxCharacters=1`. It lists at most six positive rows visible in compact MCP text, retains present/empty/unavailable counts and observed/returned/truncated subject coverage, and remains PARTIAL. A non-empty trimmed `nameCnSource` establishes that official `name_cn` was supplied; it does not establish that the value differs from the original name or prove a complete translation catalog.
