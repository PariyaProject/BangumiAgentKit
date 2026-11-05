# Person collection wire metadata: absent career is unknown

The REC06 account census at Base `2e48101bfe081796140996aaffb6e7490cc6890a`
leaves21 account rows: seven write/destructive and fourteen reads. The current generated client and frozen list contracts expose no pagination;
maxItems cannot be treated as an upstream one-row selector. A1–A9, failed subject/numeric routes and all earlier one-shot
claims remain spent. This increment performs no live account/provider/client
operation and does not select another execution profile.

## Fixed primary-source basis

The official API repository says its v0 specification is synchronized from
`bangumi/server`. The inspected API repository is
`65d29cff2331e08c0110d30d515f7f1b6488f845`; the inspected server is
`243e2cd5dd22995fb2340d77b48bc851a12ea5b6` (November2). Repository source is not
proof of the currently deployed API revision.

- [Single person handler](https://github.com/bangumi/server/blob/243e2cd5dd22995fb2340d77b48bc851a12ea5b6/web/handler/user/get_person_collection.go)
  returns the collection serializer. A404 may mean missing user, missing entity
  or uncollected entity; it does not by itself identify which condition applies.
- [Collection serializer](https://github.com/bangumi/server/blob/243e2cd5dd22995fb2340d77b48bc851a12ea5b6/web/res/collection.go)
  emits person identity, name/type, images and creation time, without career.
  Source-file SHA256:
  `42b6de71d1f3c7c5a763229cbcc585647a5ce13673bee2229fdfd87a2071620e`.
- [Person-list handler](https://github.com/bangumi/server/blob/243e2cd5dd22995fb2340d77b48bc851a12ea5b6/web/handler/user/list_person_collections.go)
  uses the same serializer, confirming that the missing-career shape applies to
  both single and list reads. It also accepts page queries in this server
  revision, unlike the checked-in generated API contract. Source SHA256:
  `0b1d2267e016d54ea08b2d47aa1017035893ce833b1db164ed8f626d1b4ffbfa`.
  This is a genuinely different future bounded-selector opportunity, not proof
  that the deployed API accepts it. Adding native pagination/schema policy is
  separate from this missing-metadata repair; no request is rewritten to fake
  the old one-row boundary.
- The checked-in generated OpenAPI type declares career required. Updating that
  entire generated API/catalog is unnecessary for this targeted runtime
  compatibility repair; the discrepancy is handled at the service boundary.

## Reproduction and semantics

A deterministic synthetic fixture with the serializer's shape reaches the
actual UserService through its generated-client seam. Before correction,
single-person mapping throws `raw.career is not iterable`; list mapping counts
the otherwise valid row as invalid and discards it. The same fixture with a
career array succeeds. The initial3-case diagnostic is RED2/GREEN1; focused
service/consistency regressions were also run RED before the correction.
No captured personal payload or upstream implementation code is copied here.

Career omitted means unknown, distinct from a supplied empty array. Supplied
raw labels, including future labels, are preserved. A malformed supplied value
is not valid metadata: list coverage counts its invalid row, while a malformed
single response returns a nonretryable parser error. A different returned
person ID is also a parser error; a genuine404 retains found:false. No detail
hydration, profile request, fallback search or request-count expansion is added.

Consistency joins keep valid collected persons by stable ID when career is
unknown. Unknown versus known career is not a conflict. The first later known
observation enriches an initially unknown duplicate, so a subsequent
contradictory known array still produces a career conflict. Explicit empty and
nonempty known arrays remain distinct. Existing name/type conflict and output
limits remain intact; this does not infer work, preference or source completeness.

## Evidence boundary and unfinished work

Unit and original Registry fixtures use synthetic in-memory account/token state,
an explicit finite HTTP fixture and no real provider. Public overrides remain
anonymous; omitted usernames use the original bound-client policy; no binding
refuses before I/O. These are offline proofs, not account acceptance or QQ/TIM
evidence. The historical A8/A9 failure fields remain UNKNOWN; this separate
endpoint discrepancy is not retroactively assigned as their cause.

Before integration, the same Epoch must supply actual compiled-MCP proof and
a strict fresh closed-source compatibility witness for the unchanged twelve
historical A2–A7 inputs. Shared source hashes change, so the old importers cannot
be silently relaxed or old receipts rehashed. The new proof must bind full
compiler provenance, actual loaded changed modules, network/module denials,
private image decoding and cleanup, while preserving original producers,
claims, inputs and source-bound evidence. No new account credit is earned.
The compiled witness and importer remain pending at the first engineering
commit; this document does not claim their completion or authorize a live run.

The original public65/65, Agent86/96, account12/33 on integrated master and
QQ/TIM0/96 counters remain scoped. The development branch must prove its new
graph before reusing source-bound account references. Four design packs,
fonts, scale0.75, C07 and the completed calendar live journey remain preserved.
