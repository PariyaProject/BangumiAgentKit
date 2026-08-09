# Provider architecture

PR-7B establishes one evidence-bearing capability boundary for Bangumi data.
Providers return a `CapabilityResult<T>` rather than an unannotated value. The
result keeps the normal domain data ergonomic and attaches field-level
`EvidenceRef` entries, coverage, freshness, typed warnings, and conflicts when
those facts matter to a caller.

## Source classes

The public source vocabulary is deliberately closed:

- `official_v0`: the generated Bangumi OpenAPI v0 client and its raw stats
  payloads.
- `official_legacy`: the legacy `/calendar` endpoint retained for calendar
  membership and weekday semantics.
- `structured_web`, `website_embedded`, and `website_html`: future, explicitly
  gated sources. They are not fallback paths.
- `snapshot`: an explicitly configured offline source, never an implicit cache
  or test fixture.
- `derived`: values calculated from evidence already collected by an upstream
  source.

`SourceDescriptor` contains source identity and operation metadata only. It
must not contain tokens, headers, principal identifiers, or raw responses.

## Evidence and states

An `EvidenceRef` records the source, retrieval time, optional entity and field
path, freshness metadata, auth scope, confidence, and formula identifier.
Retrieval age is distinct from source age: a newly read stale upstream value
remains stale. Auth scope is one of `public`, `principal`, or `account`; the
model-facing representation does not expose principal IDs.

Coverage is explicit (`complete`, `partial`, `unknown`, or
`not_applicable`). A provider must not claim complete coverage when a page or
source budget ended early. Capability state distinguishes an unavailable
provider from a valid but non-computable result.

Conflicts preserve typed candidates and their source evidence. Resolution is a
capability-specific policy, not a global “newest source wins” rule.

## Initial source policy

The initial composition root enables the official v0 and official legacy
providers. Structured web, HTML, and snapshot sources remain disabled or
unconfigured until a later plan explicitly enables them. In particular, a v0
failure does not automatically call HTML, and a legacy calendar failure does
not automatically call HTML.

## Formulas

Derived statistics retain their input evidence and identify a versioned formula
descriptor. The subject completion ratio is

```text
collect / (wish + collect + doing + on_hold + dropped)
```

and is recorded as empirically verified rather than an official API contract.
Population standard deviation uses the upstream rating histogram and returns a
`not_computable` result when the population is empty. Upstream score and
derived histogram mean are retained separately so a mismatch is visible.
