# Autonomous frontier audit — 2026-08-24

Research-only sidecar for the `AUTONOMOUS_EVOLUTION` run. Primary sources were
checked on 2026-08-24. No reviewer, Product Epoch, GitHub control-plane, or
product/runtime change is authorized by this note.

## Conclusion

| Frontier                                     | Recommendation         | Decision                                                                                                                                                                                                                                      |
| -------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Official v0 subject-stat observation history | `IMPLEMENTATION_READY` | A narrow, opt-in, read-only observation series is supportable if it starts at enablement, uses finite subject/frequency/retention bounds, and never claims event history.                                                                     |
| Public community / Structured Web            | `RESEARCH_READY`       | Public HTML and an anonymously readable live `/p1` surface exist, but neither closes a safe public source contract: `/p1` is identified upstream as private and the site policy requires API-bounded use while reserving user-content rights. |

## Frontier 1 — official v0 statistics

**FACT.** The official v0 `Subject` schema includes `rating` and `collection`
as required fields. `rating` contains `rank`, `total`, a `count` histogram for
scores 1–10, and `score`; `collection` contains `wish`, `collect`, `doing`,
`on_hold`, and `dropped`. The detail operation is
`GET /v0/subjects/{subject_id}` and is marked as cacheable in the official
schema. See the [official v0 OpenAPI source](https://github.com/bangumi/api/blob/master/open-api/v0.yaml#L321-L350)
and [Subject schema](https://github.com/bangumi/api/blob/master/open-api/v0.yaml#L3556-L3702).

**EVIDENCE.** The official server handler obtains the subject, counts its
episodes, applies the caller's NSFW visibility, sets public cache control for
non-NSFW subjects, and serializes the v0 subject response; it does not expose a
historical timestamp or event stream. See the [official subject handler](https://github.com/bangumi/server/blob/master/web/handler/subject/get.go#L487-L545).
An anonymous live request for [subject 41529](https://api.bgm.tv/v0/subjects/41529)
returned the documented aggregate shape on this audit date. The response has
no subject `updated_at` or statistic sample time. The live response advertised
`Cache-Control: public, max-age=3600`; the schema description says 300 seconds,
so neither value should be treated as an archival guarantee.

**REASONING.** This is sufficient for sampled snapshots, not for claims about
individual votes, exact event time, or uninterrupted global history. A bounded
implementation can therefore be closed around this contract:

- opt-in series over an explicit finite subject allowlist; no backfill and no
  current snapshot presented as past data;
- official v0 GET only, no credentials or Bangumi write authority, with a
  descriptive User-Agent following the [official User-Agent guidance](https://raw.githubusercontent.com/bangumi/api/master/docs-raw/user%20agent.md);
- append each successful observation with `observedAt`, subject ID, source
  operation, schema/method version, retrieval state, HTTP status, and coverage;
  preserve missing/error states instead of writing zero;
- enforce finite bounds at the semantic boundary: a configured maximum subject
  count, a minimum per-subject interval of at least one hour under the current
  live cache header, a maximum observation count/age, and serial host-level
  backoff; treat the conflicting five-minute schema hint as revalidation input,
  not as a rate allowance. Retention eviction must be explicit and
  reversible/auditable;
- derive deltas or series only between compatible successful observations and
  return `not_computable` across gaps, schema changes, redirects, or partial
  coverage. Never label a sampled delta as a Bangumi event log.

**CONFIDENCE.** `HIGH` for field availability and read-only operation shape;
`MEDIUM` for long-term stability because the upstream schema is mutable and the
two cache hints differ. The source contract is implementation-ready only for
the narrow bounded variant above, not for a backfilled or unbounded archive.

**ALTERNATIVES / SALVAGE.** If a full history series is too large, retain only score,
rating-total/histogram, collection counts, sample time, and status for a small
allowlist. A single current snapshot remains an ordinary detail read, not a
history capability.

**IMPLEMENTATION IMPLICATION.** Only this bounded v0 variant is a candidate
for implementation; every derived result must carry retrieval time, coverage,
and computability state.

## Frontier 2 — public community / Structured Web

**FACT.** Public community HTML is available: the [subject board](https://bgm.tv/subject/41529/board),
[comments](https://bgm.tv/subject/41529/comments), [reviews](https://bgm.tv/subject/41529/reviews),
[Rakuen](https://bgm.tv/rakuen/topiclist?type=mono), and [group directory](https://bgm.tv/group)
all returned HTML 200 responses in the audit probe. The live [Structured Web
OpenAPI](https://next.bgm.tv/p1/openapi.json) exposes subject topics/comments/reviews,
Rakuen, groups, and trending-topic paths. Anonymous GET probes for the
corresponding `/p1` paths also returned JSON 200 responses with `{data,total}`
shapes and bounded page records.

**CONTRACT STATUS.** Availability is not authorization or a public SLA. The
official [server-private repository](https://github.com/bangumi/server-private#readme)
describes the service as a private API, the live `/p1` schema is titled
“bangumi private api”, and its community GET operations carry
`CookiesSession`/`HTTPBearer` security metadata. The generated official client
also identifies itself as a [private API client](https://raw.githubusercontent.com/bangumi/frontend/master/packages/client/client.ts).
The official [developer platform](https://bgm.tv/dev) points developers to the
API and public archives, while the [copyright/developer agreement](https://bgm.tv/about/copyright#bangumi-%E5%BC%80%E5%8F%91%E8%80%85%E5%B9%B3%E5%8F%B0%E4%BD%BF%E7%94%A8%E5%8D%8F%E8%AE%AE)
says data should be obtained within API-provided interfaces and not collected
by crawlers or similar means in ways that may infringe Bangumi or user rights.
It separately reserves user-authored logs, comments, and images to their
authors, restricts reuse without permission, prohibits transfer of user data
to third parties, and permits access/data-use restrictions or deletion demands.

**ROBOTS AND COPYRIGHT.** The current [bgm.tv robots.txt](https://bgm.tv/robots.txt)
disallows `/pic/`, `/img/`, and `/js/`, but does not list the community HTML
paths. That is crawl guidance, not affirmative permission or a redistribution
license. [next.bgm.tv/robots.txt](https://next.bgm.tv/robots.txt) returned the
SPA HTML shell rather than a robots document during this audit, so it provides
no usable permission signal for `/p1`. The policy page was last updated
2022-10-04 and is not a legal opinion; no first-party community-data API SLA,
field-level retention license, or explicit permission to mirror user text was
found.

**REASONING.** A capability-specific contract cannot safely be closed from
availability alone. The safe salvage question is narrower: can a first-party
owner-confirmed allowlist support current, positive-only community metadata
(for example, count, title, canonical link, source time, and page coverage)
without cookies, broad crawling, raw body storage, user profiling, or
third-party redistribution? Until that permission/contract and its retention
rules are confirmed, do not make `/p1` an official provider and do not use HTML
as a silent fallback. If the contract cannot be obtained, close community
text/trend work as `CLOSED_NO_SAFE_SOURCE`; the v0 metadata provider remains a
safe fallback for non-community questions.

**SALVAGE.** The only plausible next research target is metadata-only
observation: count, title, canonical link, source time, and page coverage;
exclude bodies, author profiling, cookies, broad crawling, and third-party
redistribution. This variant still needs first-party permission/contract and
retention confirmation before implementation.

**IMPLEMENTATION IMPLICATION.** Do not select `/p1` or HTML as a Product
provider, fallback, or history source in the current Epoch. A future
research-only step may seek the missing source-contract evidence; absent that,
the frontier closes as `CLOSED_NO_SAFE_SOURCE`.

**CONFIDENCE.** `HIGH` that the public surfaces exist and that `/p1` is not a
documented public contract; `MEDIUM` on the legal interpretation of the
copyright language. This frontier remains `RESEARCH_READY`, not
`IMPLEMENTATION_READY`.

## Coverage limits

The live observations were single-time, no-cookie probes from one network,
with one subject and small page limits. They do not establish completeness,
NSFW/private visibility, rate quotas, uptime, pagination stability, user
deletion behavior, or permission to retain/republish content. The live p1
schema version observed was `2026-08-22-6169cd7`; it is a moving deployment,
not a versioned public API commitment. Existing repository research notes were
used only as context; the claims above are grounded in the linked upstream
sources.
