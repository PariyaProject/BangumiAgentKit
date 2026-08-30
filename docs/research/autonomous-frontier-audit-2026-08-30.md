# Autonomous frontier audit — 2026-08-30

Research-only sidecar for the `AUTONOMOUS_EVOLUTION` run. Primary sources were
checked on 2026-08-30 against synchronized `master` at
[`65fde83`](https://github.com/PariyaProject/BangumiAgentKit/commit/65fde83ce4bb2c3d72a5bc2436a59444b143aa63).
No reviewer, Product Epoch, GitHub control-plane, or product/runtime change is
authorized by this note.

## Run and repository boundary

Read-only checks at the initial audit baseline, before this note was created:

- `git status --short` was clean and `HEAD` was `65fde83ce4bb2c3d72a5bc2436a59444b143aa63`.
- `pnpm harness discovery:check` returned `RESUME_ACTIVE_RUN` for active Run
  [#44](https://github.com/PariyaProject/BangumiAgentKit/issues/44), with no
  open Epoch PR, no pending Epoch, and `next_action: DISCOVER_NEXT_EPOCH`.
- `pnpm harness status --run 44` reports the `AUTONOMOUS_EVOLUTION` outer
  budget at `2/3` Product-review launches consumed, `2/4` total Sol launches
  consumed, and one unused closure slot. Therefore exactly one Product-review
  launch remains for the next Epoch; this audit does not reserve it.
- `pnpm harness frontier:status` reports 121 ledger records: 18 `DELIVERED`,
  11 `PARTIAL`, 2 `RESEARCH_READY`, and 90 `UNASSESSED`. The ledger and the
  GitHub control plane remain unchanged by this sidecar; see the current
  [frontier ledger](../product/frontier-ledger.json),
  [opportunity log](../product/opportunity-log.md), and the governing
  [AUTONOMOUS_EVOLUTION profile](../agent/goals/AUTONOMOUS_EVOLUTION.md).

During final verification, unrelated in-progress changes appeared in
`packages/discovery/src/index.ts`,
`packages/renderer/src/view-model-builders/index.ts`,
`packages/renderer/src/view-models/index.ts`,
`packages/tools/src/definitions/discovery-tools.ts`, and
`packages/discovery/src/cohort.ts`; this sidecar did not edit, stage, or
otherwise alter those paths. The only path written by this sidecar is this
research note.

The comparison below treats already-shipped capabilities as evidence against a
new Epoch, not as missing work. In particular, the current repository already
has bounded discovery, subject overview, person activity, collection
intelligence, revision intelligence, episode integrity, and bounded series
watch-order tools. The historical OP-008 overview selection is merged and is
not reopened here.

## Conclusion

| Frontier / candidate                                                        | Recommendation         | Decision                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bounded advanced discovery/query beyond the current official filter surface | `NO_SAFE_VARIANT`      | The safe v0 query surface is already implemented with explicit budgets and partial coverage. Creator/role/franchise ontology, true trend velocity, and broad recall would require unsupported filters or unbounded hydration.                                                                                               |
| Multi-hop relation graph / canonical watch order                            | `NO_SAFE_VARIANT`      | The repository already provides a bounded depth-2, max-16-node recommendation with explicit non-canonical semantics. Official relations do not provide a canonical complete watch order.                                                                                                                                    |
| Subject identity/content metadata, ledger C11                               | `IMPLEMENTATION_READY` | Add one separate, text-first, evidence-bearing subject identity view over one official v0 detail response. Preserve raw infobox shape and never turn aliases or `series` into stronger identity/franchise claims. This is the recommended next Epoch.                                                                       |
| Latest metadata revision / “what exactly changed?”, ledger C13              | `RESEARCH_READY`       | v0 exposes revision summaries and a detail payload, but the detail contract says its `data` response is not fixed and does not provide a before/after guarantee. A bounded latest-revision evidence view is plausible; an exact diff is not yet source-closed.                                                              |
| Personal-history / collection transitions                                   | `RESEARCH_READY`       | Current collection and episode progress are readable, but the official collection `updated_at` is explicitly not collection time. A local, opt-in observation series is possible only after consent, retention, and per-account storage semantics are specified; API history/backfill is not available.                     |
| Community Structured Web, including subject-to-index discovery C12          | `RESEARCH_READY`       | Official website and frontend-private structured surfaces exist, but they are not the public v0 contract. The safe metadata-only salvage still needs an owner-confirmed source, attribution, rate/fan-out, retention, privacy, and terms contract. Raw community text or broad HTML crawling is not a safe current variant. |

## Official source baseline

**FACT.** The official [Bangumi v0 API documentation](https://bangumi.github.io/api/)
and its [OpenAPI source](https://github.com/bangumi/api/blob/master/open-api/v0.yaml)
are the baseline source family. The v0 subject detail operation is
`GET /v0/subjects/{subject_id}`, is marked `OptionalHTTPBearer`, returns the
`Subject` schema, and is described as cacheable for 300 seconds. The official
schema also has explicit v0 operations for subject relations, persons,
characters, episodes, users/collections, revisions, and known index IDs; it
does not make the whole Bangumi website a v0 API.

**EVIDENCE.** A small, read-only, anonymous probe of the official
[subject 41529 endpoint](https://api.bgm.tv/v0/subjects/41529) returned the
documented identity/statistics shape on this audit date: `name`, `name_cn`,
`type`, `date`, `platform`, `series`, `volumes`, `eps`, `total_episodes`,
`meta_tags`, `tags`, `infobox`, `rating`, and `collection`. Its `infobox`
contained a `别名` row whose value was an array of `{v}` objects. The official
[relations endpoint](https://api.bgm.tv/v0/subjects/41529/subjects) returned
typed subject IDs and raw relation labels, including book, OST, OP/ED, and
drama relations. These are point observations, not completeness or freshness
claims.

**SOURCE POLICY.** The official [User-Agent guidance](https://raw.githubusercontent.com/bangumi/api/master/docs-raw/user%20agent.md)
asks non-browser API clients to identify the developer, application, version
when distributed, and project homepage; it warns that generic default UAs may
be disabled. The official [developer platform](https://bgm.tv/dev) directs
developers toward the API and public archives, and the official
[copyright/developer agreement](https://bgm.tv/about/copyright) permits apps
based on the API/archive while requiring API-bounded acquisition and
preserving rights in user-authored logs, comments, and images. These rules are
material to the community and personal-history decisions below.

## Frontier 1 — bounded advanced discovery/query

**FACT.** The official `POST /v0/search/subjects` contract supports `type`,
`tag`, `air_date`, `rating`, `rating_count`, `rank`, and `nsfw` filters. The
schema says different filters are ANDed, type values are ORed, tags and date
expressions are ANDed, and sorting is `match`, `heat`, `rank`, or `score`; it
also labels this API experimental, with schema and behavior subject to change.
The `heat` description is 收藏人数 (collection count), not a time-window
velocity metric. See the [search contract](https://github.com/bangumi/api/blob/master/open-api/v0.yaml#L14-L76).

The official `GET /v0/subjects` browse operation requires `type` and supports
`cat`, book-only `series`, game-only `platform`, `sort` (`date`/`rank`),
`year`, and `month`. Its schema describes first-page caching for 24 hours and
later pages for one hour. See the [browse contract](https://github.com/bangumi/api/blob/master/open-api/v0.yaml#L247-L306).
The search schema does not impose a useful hard maximum for `limit`/`offset`,
so the repository’s semantic page/candidate/hydration budgets are the safety
boundary rather than an upstream completeness guarantee.

**CURRENT CAPABILITY.** The repository’s
[`query_subjects` tool](../../packages/tools/src/definitions/discovery-tools.ts)
and discovery engine already compile these official fields into a bounded
semantic query. The current defaults are max 10 pages, 500 candidates, 120
hydrations, concurrency 6, 8 concept probes, and 100 returned items; the
engine records pushdown, local post-filter, derived-filter, page, hydration,
and output coverage in its explain result. Exclusion/category/date-derived
filters are explicitly local and budget-bounded. The engine returns partial
coverage when caps, unresolved hydration, or upstream failure prevent a
complete result; it does not turn `total` into an all-results guarantee. See
[`query.ts`](../../packages/discovery/src/query.ts),
[`compiler.ts`](../../packages/discovery/src/compiler.ts), and
[`engine.ts`](../../packages/discovery/src/engine.ts).

**GAP.** The attractive next questions are “filter by a person’s role,”
“find original/adapted works,” “join relation/franchise membership into
search,” and “sort by current trend.” None is a stable v0 search field. The
official source has no universal original/adaptation ontology or person-role
filter in `searchSubjects`; adding those by hydrating arbitrary results would
turn recall into an unbounded, source-dependent claim. A larger limit would
not repair the missing semantics.

**DECISION.** `NO_SAFE_VARIANT` as a new Product Epoch. The safe positive-only
variant is the current bounded official query capability, already delivered;
its remaining work is maintenance, fixture refresh, or a field-specific bug
fix rather than a distinct high-value frontier. The identity candidate below
is the safer way to recover value from fields the detail endpoint already
provides without expanding discovery fan-out.

**CONFIDENCE.** `HIGH` that the v0 filter surface and current engine bounds are
known; `MEDIUM` for long-term search behavior because the official contract is
explicitly experimental. There is no evidence here that an additional
unlisted query field can be promoted into a public semantic contract.

## Frontier 2 — multi-hop relation graph and watch order

**FACT.** The official subject relation operation is
`GET /v0/subjects/{subject_id}/subjects`, returning an array of
`v0_subject_relation` rows. It provides relation edges and labels, not a
canonical watch-order operation or a complete franchise graph. The official
[BTOOOM! relations page](https://bgm.tv/subject/41529/relations) presents
separate categories such as books, soundtracks, opening/ending songs, and
drama, and links to “series relations”; that experience is useful UX evidence
but does not establish a machine-readable canonical order.

**CURRENT CAPABILITY.** [`SeriesService`](../../packages/bangumi-core/src/services/series-service.ts)
already implements a bounded recommendation: depth 0–2, max 8 nodes by
default and max 16 nodes, deterministic directional traversal, bounded edge
evidence, and a separate non-anime evidence cap. Only stable same-direction
prequel/sequel/side-story-like edges enter the recommended steps; non-anime
relations are retained as evidence but are not silently promoted to anime
watch steps. `complete`, `partial`, and `not_computable` are distinct, and the
result states that it is not an official canonical order. The public
[`get_series_watch_order` contract](../../packages/tools/src/definitions/read-tools.ts)
and existing series tests preserve failures, cap truncation, unresolved
edges, and source limitations.

**GAP.** “All franchise works,” “the one correct order,” heterogeneous
adaptation chains, and multi-hop person/character bridges need either a graph
source that v0 does not provide or a policy that would be mistaken for source
fact. More depth increases fan-out and ambiguity without adding canonical
authority. The current T03/OP-004 collaboration work is similarly bounded and
does not justify a new graph-wide Epoch.

**DECISION.** `NO_SAFE_VARIANT` for a broader multi-hop/canonical-order Epoch.
The current bounded watch-order capability is the safe salvage. A future
review could improve a narrowly evidenced edge label or fixture, but it should
not be framed as complete franchise discovery or authoritative order.

**CONFIDENCE.** `HIGH` for the available edge contract and current traversal
limits; `HIGH` that the official relation source does not state a canonical
watch order. The official website’s category presentation reinforces the
heterogeneous nature of the graph rather than closing that gap.

## Frontier 3 — subject identity and content metadata (C11)

**FACT.** The official `Subject` schema requires and/or exposes the fields
needed for a useful identity view: `id`, numeric `type`, `name`, `name_cn`,
`date`, `platform`, `series`, `volumes`, `eps`, `total_episodes`, `meta_tags`,
`tags`, `images`, `rating`, `collection`, and `infobox`. The schema documents
that `series` means whether a book is the main entry of a book series; it does
not mean franchise membership. It documents `eps` as parsed by the old
server, with books using it for chapter count, while `total_episodes` is the
database chapter count. See the [Subject schema](https://github.com/bangumi/api/blob/master/open-api/v0.yaml#L3556-L3702).

The official `WikiV0` infobox is deliberately flexible: each row has a string
key and a value that is either a string or an array of `{v}` / `{k,v}` objects.
The schema example itself contains a Chinese name and a multi-value alias row.
See the [WikiV0 schema](https://github.com/bangumi/api/blob/master/open-api/v0.yaml#L2880-L2949).
The official [subject experience](https://bgm.tv/subject/41529) confirms the
user-facing need—Chinese name, aliases, platform/airing facts, and links are
shown together—but it is used here only for parity, not as a scraping source.

**CURRENT GAP.** The repository’s
[`DomainSubject`](../../packages/bangumi-core/src/models/subject.ts) carries
name, Chinese-name fallback, summary, type, date, platform, images, ratings,
collection buckets, and episode counts, but no infobox, aliases, meta-tags,
tags, book-series flag, or volumes. `mapSubject` in
[`SubjectService`](../../packages/bangumi-core/src/services/subject-service.ts)
therefore discards those official fields. The current
[`bangumi.get_subject`](../../packages/tools/src/definitions/read-tools.ts)
returns that reduced model, while `get_subject_overview` composes basic
subject data, stats, cast, staff, and relations without a separate identity
section. Widening `DomainSubject` in place would touch many existing callers;
the safer seam is a dedicated metadata model/mapper over the already-generated
official `Subject` type.

**DECISION.** `IMPLEMENTATION_READY` for a focused **Subject Identity &
Metadata v1** capability answering C11: “What are this known subject’s
official names, aliases/identity hints, platform, and bounded content metadata?”
This is the recommended next Product Epoch.

**PROPOSED SOURCE CONTRACT.** Keep the contract deliberately narrower than the
website:

- Accept one positive known `subjectId`; perform one official
  `GET /v0/subjects/{subject_id}` read. Do not discover IDs, crawl HTML, call
  `/p1`, fetch image bytes, traverse relations, or persist a history series.
- Return direct source fields with presence preserved: `id`, `type`, `name`,
  `nameCn` without turning a missing Chinese name into a claim, `date`,
  `platform`, `locked`, `nsfw`, `series` with its book-only meaning,
  `volumes`, `eps`, `totalEpisodes`, bounded `metaTags`/`tags`, and existing
  image URLs as links rather than downloaded assets.
- Return a bounded raw infobox view with source keys and typed string/array
  values. Reuse the existing 1 MiB subject-response guard and add a
  conservative semantic boundary of at most 64 infobox rows, at most 8 nested
  values per row, and at most 1,000 characters per scalar value; the result
  must report observed, returned, malformed, and omitted rows. These are
  product limits, not upstream promises.
- If a recognized alias row is exposed, label it as a derived extraction with
  its original infobox key and raw value. Do not deduplicate aliases across
  subjects, infer canonical identity from spelling, follow infobox URLs, or
  claim that the list is complete. An absent or unrecognized alias row is
  `unknown`/`not_computable`, not an empty proof of no aliases.
- Carry `source: official-v0`, operation, retrieval time, source response
  limit, and a field/row coverage envelope. Honor the official detail cache
  hint without presenting the response as historical or immutable; use the
  project-identifying User-Agent required by the official guidance.

**DEGRADED SEMANTICS.** A successful response with all required identity
fields and no local cap is `complete`; missing optional fields, malformed
infobox rows, recognized-but-unparsed values, or semantic caps are `partial`.
A 404 is `not_found`; network, rate-limit, unavailable, response-too-large, or
schema-drift failures are `unavailable` unless a safely parsed independent
section can be proven partial. A missing alias is not a negative assertion.
Keep `eps` and `totalEpisodes` separate, and never equate `platform` or book
`series` with a global franchise taxonomy. This follows the repository’s
existing [state vocabulary and evidence policy](../agent/PRODUCT_CHARTER.md)
and the current subject-overview failure conventions.

**REVIEWABLE EPOCH SHAPE.** The unit should be one semantic read tool (for
example `bangumi.get_subject_identity`) backed by a separate metadata model,
contract fixtures, and a compact text-first presentation if a renderer is
needed. It should reuse the generated v0 client and existing public error
policy, with no new provider, authentication scope, persistence, or renderer
image pipeline. Required fixtures include string and nested infobox values,
missing/empty Chinese name and platform, malformed rows, row/value caps,
subject 404, rate/network failure, response-too-large, and schema drift. The
boundary is large enough to answer C11 coherently but small enough for the
Run’s one remaining Product-review launch.

**CONFIDENCE.** `HIGH` for source fields, one-request fan-out, and the current
model gap; `MEDIUM` for infobox long-term shape because it is explicitly
flexible and user-maintained. The capability is implementation-ready only for
the bounded, evidence-preserving view above—not for universal alias
normalization, identity merging, or franchise reconstruction.

### Adjacent content candidate — latest revision explanation (C13)

**FACT.** v0 exposes paginated subject revision summaries and a known-revision
detail endpoint. The generic `DetailedRevision.data` schema says the edit
payload’s response type is not fixed; `SubjectRevisionData` lists subject
fields such as `field_infobox`, `field_summary`, `name`, `name_cn`, `platform`,
`subject_id`, `type`, and `field_eps`, but does not promise a before/after
diff. See the [revision operations and schemas](https://github.com/bangumi/api/blob/master/open-api/v0.yaml#L1621-L1665)
and [revision data definitions](https://github.com/bangumi/api/blob/master/open-api/v0.yaml#L2365-L2511).

The live audit probe of [subject 41529’s latest revision page](https://api.bgm.tv/v0/revisions/subjects?subject_id=41529&limit=1&offset=0)
returned a revision summary with `data: null`; its linked
[detail response](https://api.bgm.tv/v0/revisions/subjects/1567985) returned a
payload containing current subject fields and a summary of “内容扩充”. This
demonstrates useful evidence, not a guaranteed diff interpretation.

**CURRENT CAPABILITY.** The repository already has
[`bangumi.get_revision_intelligence`](../../packages/tools/src/definitions/read-tools.ts)
with max 20 rows, bounded text, pagination coverage, official timestamps,
missing/truncated-field warnings, and `historical_growth: not_computable`,
plus `bangumi.get_revision` when the revision ID is already known. It does not
automatically select the latest revision and safely summarize its detail.

**DECISION.** `RESEARCH_READY`. A later bounded “latest revision evidence”
variant could read one summary (`limit=1`, `offset=0`) and then one detail,
returning summary, creator, created-at, and explicitly typed/preserved payload
fields. It must say “latest revision payload/summary,” not “exact fields
changed,” unless upstream semantics or a trustworthy before/after source is
established. A null or unrecognized detail payload is `partial` or
`not_computable`, never a guessed diff. It is not selected for the remaining
Product-review slot because the source semantics are less closed than C11.

## Frontier 4 — personal-history and collection transitions

**FACT.** The official user-collection list is a paged current-state read with
optional bearer authentication; it says private collections need an access
token. Its `UserSubjectCollection` fields include collection type, rating,
comment, tags, episode/volume status, `updated_at`, `private`, and a nested
subject. The official schema explicitly warns that `updated_at` does **not**
represent collection time and may not change when rating, comment, or episode
status changes. See the [collection operation](https://github.com/bangumi/api/blob/master/open-api/v0.yaml#L1054-L1102)
and [UserSubjectCollection schema](https://github.com/bangumi/api/blob/master/open-api/v0.yaml#L3965-L4024).
Authenticated episode collection is also a current paged read, with an
upstream maximum of 1,000 per request and explicit 401/404 outcomes; see the
[episode collection operation](https://github.com/bangumi/api/blob/master/open-api/v0.yaml#L1215-L1273).

**CURRENT CAPABILITY.** The repository already has bounded collection
intelligence, backlog, schedule, dashboard, and series-group tools, with
account/auth scope, pagination, completion rules, and degraded coverage. The
delivered subject-stat observation history is a public aggregate observation
series; it is not a user collection history. No current v0 operation provides
a complete collection-transition event stream or historical snapshots; the
per-row timestamps do not close that history contract.

**DECISION.** `RESEARCH_READY` for a distinct, local, explicitly opt-in
observation variant; `NO_SAFE_VARIANT` for an API-backed claim such as “what I
dropped in the last six months” or “my collection growth,” because the source
does not expose those events. A future safe variant would need all of the
following before implementation:

- explicit user consent and one authenticated account scope; no arbitrary
  public-user history inference and no shared cache of private results;
- observations starting at enablement, never backfilled, with `observedAt`,
  auth scope, subject/episode coverage, retrieval state, and retention/deletion
  policy; the source `updated_at` may be displayed as a source field but never
  used as the event timestamp;
- finite subject/episode/frequency/retention bounds and explicit gaps; a
  transition or trend is `not_computable` unless comparable observations
  bracket it; no claim that a sampled snapshot is an event log;
- no transfer, profiling, or reuse outside the user-authorized application.

The official agreement requires consent, necessary-only collection, no
transfer of user data to third parties, and deletion when the platform ends or
restricts use. Those requirements make this a separate privacy/persistence
research item, not a safe use of the final Product-review slot.

**CONFIDENCE.** `HIGH` that current v0 collection fields are available and
`HIGH` that the documented timestamp warning rules out naive history. `MEDIUM`
for the eventual local observation design because retention and user-facing
consent semantics still need an explicit product contract.

## Frontier 5 — community Structured Web and subject-index discovery (C12)

**FACT.** The official [subject experience](https://bgm.tv/subject/41529)
visibly contains comments, reviews, discussion-board entries, “who watched
this,” recommendations, and a “recommended directories” section. This
establishes user value and website surface, not a public API contract. The
official [v0 index operations](https://github.com/bangumi/api/blob/master/open-api/v0.yaml#L1735-L1828)
allow reading a known `index_id` and its subject page, but expose no v0
operation that discovers every index containing a subject. The existing
`bangumi.get_index` therefore cannot answer C12 from a subject ID alone.

The official frontend also publishes a moving structured `/p1` surface; its
documentation is explicitly titled [Bangumi Private API](https://bangumi.github.io/dev-docs/),
and the official frontend repository’s [client schema](https://github.com/bangumi/frontend/blob/master/packages/client/api.yaml)
is a separate source family from the v0 OpenAPI. A public/no-cookie response,
if observed, would not by itself establish public authorization, an SLA, or
permission to retain user content.

**CONTRACT STATUS.** `RESEARCH_READY` for a capability-specific, metadata-only
allowlist probe. `NO_SAFE_VARIANT` for raw community text, broad HTML crawling,
silent `/p1` fallback, or user profiling under the current authority. The
official [copyright/developer agreement](https://bgm.tv/about/copyright) says
developers should obtain data within API-provided interfaces and not use
crawlers or similar collection in ways that may infringe Bangumi or user
rights; it separately reserves user-authored logs, comments, and images and
requires consent/necessary-only handling of user data.

**SAFE SALVAGE TO RESEARCH.** The only plausible next source question is one
explicit user request over a public, first-party allowlist, returning only
positive metadata such as title, count, canonical link, source time, and page
coverage. Any future provider would need: GET-only behavior; no cookies,
tokens, or private endpoints; finite page/item/fan-out and byte caps; explicit
attribution; short, purpose-bound retention; raw-body isolation or no raw-body
storage; auth/visibility and NSFW states; schema-drift probes; rate/backoff;
robots/terms evidence; and `unsupported`/`partial`/`unavailable` fallbacks.
The official private surface is not a reason to promote `/p1` into the default
v0 provider.

**CONFIDENCE.** `HIGH` that the website surface and known-index v0 reads exist;
`HIGH` that subject-to-index discovery and community bodies are outside the
v0 contract; `MEDIUM` on the long-term availability of the moving private
surface. No source-contract or rights evidence found here closes this as an
implementation-ready Epoch.

## Recommendation — Subject Identity & Metadata v1

Select the C11-shaped candidate above for the one remaining Product-review
launch in Run #44:

1. Add a dedicated, bounded subject metadata model/mapper and one semantic
   read tool over the official v0 detail response.
2. Expose direct identity fields and bounded raw/derived infobox evidence with
   field presence, row coverage, source operation, retrieval time, and the
   explicit alias/series/episode-count limitations above.
3. Keep the result text-first and independent of the historical OP-008
   overview renderer seam. If a presentation is required, add only a compact
   metadata section using existing renderer primitives; do not introduce image
   downloads, HTML, `/p1`, persistence, writes, or new auth scopes.
4. Make the review fixtures prove both positive coverage and degraded truth:
   missing/empty fields, nested infobox variants, malformed rows, caps,
   unknown aliases, 404, rate/network failure, response-too-large, and schema
   drift.

This is a coherent one-endpoint Product Epoch with high agent leverage, direct
official evidence, no new external provider, no privacy/persistence boundary,
and a review surface proportionate to the remaining one Product-review
launch. C13, personal-history, and community research should remain separate
follow-ups rather than being smuggled into this scope.

## Coverage limits

Official API observations were limited to the current OpenAPI, a few direct
read-only v0 probes, official developer/policy pages, and narrow official
`bgm.tv` subject/relations experience. They do not establish global recall,
rate quotas, uptime, all NSFW/private visibility combinations, infobox
completeness, revision ordering semantics beyond the sampled response, or a
license to mirror user content. The official v0 search contract is explicitly
experimental; the `/p1` source is a moving private surface; website labels and
layout are not silently promoted to API fields. Existing repository notes were
used for capability reconciliation, while source claims above are linked to
official primary sources.
