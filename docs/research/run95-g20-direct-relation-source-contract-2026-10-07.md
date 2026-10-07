# Run #95 — G20 direct relation evidence source contract

**Checked:** 2026-10-07
**Frontier:** G20, “某系列中哪些作品是前传、续作、外传，应该按什么顺序看？”

## Supported question and claim

The broad request for every entry in a franchise and a canonical viewing order
is not supported by the public v0 relation operation. The bounded direct
question is:

> For this supplied Bangumi subject ID, which visible direct relation rows did
> the current v0 response return, and what exact relation label did each row
> carry?

The answer names the source subject, target identity, and raw returned label.
It says the rows are only the direct source-to-target observations in this
response. It does not infer reverse edges, transitive membership, missing
relations, or a complete franchise inventory. A separate
`bangumi.get_series_watch_order` result remains a finite local recommendation,
not a source-provided or canonical order.

## Official v0 contract

The official OpenAPI declares `GET /v0/subjects/{subject_id}/subjects` with
the subject ID as its only operation parameter and an array of
`v0_subject_relation` as its success response. It does not declare pagination,
a total count, a completeness marker, or a canonical-order field. The relation
schema exposes the readable relation label; it does not expose a stored
relation-order value. [Operation and response](https://github.com/bangumi/server/blob/master/openapi/v0.yaml#L3061-L3120)
· [Relation schema](https://github.com/bangumi/server/blob/master/openapi/v0.yaml#L3260-L3286).

The current server repository reads rows attached to the requested source
subject and joins the target subject. The handler applies visibility to the
requested subject and targets before returning rows. Therefore an anonymous
response may omit sensitive targets, and a request does not discover reverse
or transitive relations. The repository's stored row ordering is not part of
the returned response contract and does not establish a watch order.
[Repository query](https://github.com/bangumi/server/blob/master/internal/subject/mysql_repository.go#L167-L186)
· [Handler and visibility filtering](https://github.com/bangumi/server/blob/master/web/handler/subject/related_subjects.go#L34-L105).

These direction and completeness conclusions are inferences from the current
official OpenAPI and server implementation. They describe only the contract
reviewed on this date; they do not assert that all Bangumi relation records
have been enumerated.

## Product behavior

`bangumi.get_subject_relations` keeps returning its original relation array by
default for compatibility. With `includeEvidence=true`, it returns an evidence
envelope with:

- the requested source subject ID and operation identity;
- exact target IDs, names, media types, and raw relation labels from the
  returned rows;
- response row counts and schema-drift omissions;
- explicit `not_provided_by_source` completeness, pagination, and total-count
  metadata.

`observed` means the current response was parsed without local omissions. It
does not mean the source relation set is complete. `partial` means local schema
drift caused rows to be dropped. In evidence mode, the MCP text view is
separately capped at 3,600 UTF-8 bytes and reports text omissions; the full
structured result keeps the returned rows.

`get_series_watch_order` is separate: it can derive a finite recommendation
from observed edges with explicit depth/node limits and coverage. A complete
state there means only that no configured local failure or truncation condition
was observed inside that bounded traversal; it does not prove global relation
or franchise completeness.

## Safety and evidence status

This contract uses official public read-only sources. No live Bangumi request,
community topic/reply read, account or OAuth operation, QQ action, or TIM
client action was performed while writing this report. A later G20 acceptance
query is limited to one anonymous `bangumi.get_subject_relations` MCP call with
`includeEvidence=true` after exact Candidate, CI, and Harness review gates. If
result readback fails,
G20 stays PARTIAL and no retry is authorized by this Epoch.
