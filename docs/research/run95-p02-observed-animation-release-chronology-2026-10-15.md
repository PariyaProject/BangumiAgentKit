# Run #95 P02: observed animation release chronology

Audited 2026-10-15 against the current official Bangumi server OpenAPI files:

- [`GET /v0/persons/{person_id}/subjects` and v0_RelatedSubject](https://raw.githubusercontent.com/bangumi/server/master/openapi/v0.yaml)
- [`Subject.date`](https://raw.githubusercontent.com/bangumi/server/master/openapi/components/subject_v0.yaml)

## Source contract

The person-subject endpoint returns an array of `v0_RelatedSubject`. Its schema
contains `id`, `type`, `staff`, `eps`, `name`, `name_cn`, and `image`; it has no
date field. The operation declares no pagination parameters, total count,
ordering, or completeness guarantee. The absence of those fields in OpenAPI is
a schema observation, not proof of undocumented server behavior.

The official subject detail schema has an optional `date` string described as
an air date in `YYYY-MM-DD` format. For anime relations this supports observing
air dates. It does not provide the person's actual work or participation date.
The endpoint's optional bearer security permits public reads; this capability
does not require account authorization.

## Supported claim and implementation

`bangumi.get_person_profile` and `bangumi.render_person_profile` now accept the
opt-in `includeChronology` flag. The implementation filters returned relation
rows to anime, deduplicates subject IDs in relation order, then either reads all
eligible IDs or selects a deterministic evenly spaced sample. It fetches at
most 48 subject details, with concurrency capped at four and a 1 MiB response
limit per detail.

The result reports the earliest and latest valid official dates observed in
that selected sample, including every subject tied at each extreme. Coverage
includes returned relation counts, local truncation, sampled IDs, successful
and failed detail reads, valid/missing/invalid dates, and omitted anime IDs.
Dates are strictly validated as real `YYYY-MM-DD` calendar dates. If no valid
date is observed, chronology is `not_computable`; that does not imply the person
has no animation work or that all related subjects lack dates.

Whenever chronology is requested it remains partial because upstream relation
completeness and ordering are undocumented. It cannot claim the first or latest
work over the person's career. The default profile path remains opt-out and
makes no additional subject-detail requests. Renderer v1 view models keep the
new chronology field optional for existing callers.

Compact MCP text preserves chronology state, sample coverage, date extrema,
tie counts, and limitations within the existing 3,600-byte UTF-8 budget. It
lists at most two tied subject names per extreme; the structured result retains
the complete tied rows.

## Evidence and boundary

- Service implementation: `packages/bangumi-core/src/services/person-service.ts`
- Tool inputs and semantics: `packages/tools/src/definitions/read-tools.ts`,
  `packages/tools/src/definitions/render-presentation-tools.ts`
- Renderer and compact MCP projection: `packages/renderer/src/`,
  `apps/mcp/src/result-presenter.ts`
- Regressions cover deterministic sampling, 48-detail and concurrency bounds,
  response-byte failure, equal-date ties, missing/invalid dates, no valid dates,
  direct tool pass-through, MCP text limits, tool schemas, and Renderer output.
- No live P02 query was run. P02 remains `PARTIAL`; this change establishes a
  bounded public capability, not a live answer for a complete career.
- OAuth/account/community, writes, QQ, and TIM remain outside scope. C03 stays
  terminal `INCONCLUSIVE` with `retryAllowed=false` and was not retried.
