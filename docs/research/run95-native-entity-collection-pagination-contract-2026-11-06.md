# Run95 person collection native pagination: source contract

Research date: 2026-11-06. This is primary-source research and a prospective
design boundary. It is not deployed-API evidence, a Product verdict, an execution
profile, an account acceptance receipt, or authorization for a request.

## Finding

The pinned official server establishes a real bounded native page: the person
collection list passes its parsed limit and offset into the collection query,
whose generated DAO forwards both to GORM. Therefore a prospective
`limit=1&offset=0` request can be justified from source. This supports preparing
a distinct narrow account-read path; it establishes neither deployment
compatibility nor deterministic selection of a particular person. The query
orders only by collection creation time descending. [List handler][handler],
[collection repository][repo], [generated query][query]

The bound concerns returned collection rows. A count is still performed over
the matching collection population; it is not a bound on count work, scanned
rows, bytes, latency, or global upstream cost. The repository performs count
and list separately, without a transaction/snapshot in this path. Concurrent
changes can make their observations disagree. [Collection repository][repo]

The exact route is
`GET /v0/users/{username}/collections/-/persons`. A token is optional at this
route, and the handler does not consult the authenticated principal. For a
future account-bound flow, authenticated identity resolution can identify the
target username under existing policy, but the resulting list is public target
data, not a private-data unlock. [Routes][routes], [token middleware][auth]

## Fixed primary-source basis

All server citations below use
`bangumi/server@243e2cd5dd22995fb2340d77b48bc851a12ea5b6`; all API-repository
citations use `bangumi/api@65d29cff2331e08c0110d30d515f7f1b6488f845`.
The API repository identifies the server repository as the owner of its v0
specification. Neither repository revision identifies the deployed API revision.
[API README][api-readme]

SHA256 values are over the raw, unmodified fetched files. Only narrow public
GitHub source fetches were used. No Bangumi API, account, OAuth, model, QQ/TIM,
service/container, native-proof, or profile execution was performed. No
upstream implementation is incorporated into product code.

| Repository / file                                                     | SHA256                                                             |
| --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| server / [web/handler/user/list_person_collections.go][handler]       | `0b1d2267e016d54ea08b2d47aa1017035893ce833b1db164ed8f626d1b4ffbfa` |
| server / [web/handler/user/list_character_collections.go][characters] | `467610be9cd51b56f7cc6476298156ce9ac785dd5d53ee42c9e0db6c152f4460` |
| server / [web/handler/user/get_person_collection.go][single]          | `c40128aede2e3184103445760c61c8b1bd062657ec551ab13dc55f40f6349f9c` |
| server / [web/req/page.go][page]                                      | `8c4ba31ee618460e04cf6939f3cd00bfc7d834159a43f17c89b96d15c97ea1f5` |
| server / [internal/collections/infra/mysql_repo.go][repo]             | `acdc1cd4ccf16a23a5cfe59c238f2ddc768149d0938ca4248ccea2d0c75b99de` |
| server / [dal/query/chii_person_collects.gen.go][query]               | `fef9cc894dd929eda8be524b97914de0efc996db79a90f7388395146c614e2d2` |
| server / [dal/dao/chii_person_collects.gen.go][dao]                   | `921cac6b4ad2176a55cd0f45c2ee3906f09812ee2349a457644b3ca49e6c678f` |
| server / [internal/collections/domain/collection/model.go][model]     | `30fc218b873fc0862f5594f12ef6a07d417a487ee60147efa693220642efa885` |
| server / [web/routes.go][routes]                                      | `2b3153a2ab68af0b050c585f0fb7d17f48b0d6c35100a26a43d0281ce0b9c687` |
| server / [web/handler/common/access_token.go][auth]                   | `7cffadf2ed726b53812c837e608779d6e3464f2879b22ea3dab2af6140c232cd` |
| server / [web/mw/rate-limit.go][rate]                                 | `81c475e8275a4151fb726f21ff963eb7dd2bf2afae1f4ae0011a472e1e48b809` |
| server / [internal/user/mysql_repository.go][users]                   | `ab75f54852c8b06e94b42b86bcbb5d7658b3f18a9c738d3a6e1a071f29d2965b` |
| server / [internal/person/mysql_repository.go][persons]               | `3c87289e35cf3513d9fd284a6094101e6638522eae7b2964346aa8dec345ba8c` |
| server / [web/res/page.go][paged]                                     | `7f274e29dc150b07ca7d91dc94440279266ded56941ec15b3cd9ea8c1fc08fcb` |
| server / [web/res/collection.go][serializer]                          | `42b6de71d1f3c7c5a763229cbcc585647a5ce13673bee2229fdfd87a2071620e` |
| server / [web/res/error.go][errors]                                   | `0faf73e1dc33ff541ac73e1927254aa7692f73e17f89f23e8d391e32d144afb1` |
| server / [web/error.go][error-handler]                                | `413a3a56fbbdf556e0c58720a4dfcbe21bdc64cd341b24db0b1e5fa92afb42d5` |
| server / [openapi/v0.yaml][server-spec]                               | `e415ffb14fefb7df2833c7afe789107297217ed624668f1c63fbfb0a361df807` |
| api / [open-api/v0.yaml][api-spec]                                    | `5a7ddb7ddec132293b1aa08102e6ac63e31b2925574658e927d6f931df2519da` |
| api / [README.md][api-readme]                                         | `a70408119ff247ae4deca24f6bd44174e59bc8fe16c6304010eb72aa504414f5` |

## Parsing, bounds, and error order

`ListPersonCollection` calls strict `GetPageQuery`, not the adjacent soft-limit
helper. Parsing precedes user lookup. The following are source facts from
`web/req/page.go` lines 25–35 and 74–109. [Pagination parser][page]

| Input or condition                                    | Source behavior                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| Omitted or empty `limit`                              | Default 30.                                                        |
| Parsed integer `limit` from 1 through 100 inclusive   | Accepted unchanged.                                                |
| `limit=0`, negative, or greater than 100              | HTTP 400; no clamping.                                             |
| Omitted or empty `offset`                             | Default 0.                                                         |
| Parsed nonnegative integer `offset`                   | Accepted by parser.                                                |
| Negative offset or unparsable integer in either field | HTTP 400.                                                          |
| Integer outside `strconv.Atoi` representability       | Parse failure; no platform-independent larger ceiling is declared. |
| Positive count and `offset > count`                   | `PageQuery.Check` returns HTTP 400.                                |
| `offset == count`                                     | Check permits it.                                                  |

There is no explicit fixed maximum offset. For a nonempty population, its count
provides the later ceiling. The zero-count branch bypasses that check: any
successfully parsed nonnegative offset yields HTTP 200 with empty `data`,
`total: 0`, and the parsed/defaulted limit and offset. [List handler][handler]

`res.BadRequest` and `res.NotFound` create HTTP errors; the central error handler
serializes their status and description. Query errors are not evidence that a
user exists, since parsing runs first. Authentication and rate limiting can
stop the request before the endpoint. [Error constructors][errors],
[error handler][error-handler], [routes][routes]

## Data, order, identity, and visibility semantics

The repository counts by user ID and category, and lists that same predicate
with native limit/offset. Category `prsn` selects persons, while `crt` is
characters. Its only explicit list ordering is `CreatedTime DESC`; there is no
ID tie-breaker or cursor. Equal timestamps have no source-established stable
relative order. Offset traversal does not establish a stable snapshot or
complete collection. [Collection repository][repo], [collection model][model]

The returned page hydrates only its selected person IDs. A collection whose
person is absent from that map is skipped, without decrementing `total`.
Thus `data.length` can be smaller than the requested limit even when the count
is positive. `limit` and `offset` echo the page settings; they are not the
number of successfully hydrated objects. [List handler][handler],
[person lookup][persons], [page envelope][paged]

Person-collection storage and its domain model contain identity, category,
target, user and creation time, with no private flag. There is no owner/private
branch or visibility predicate on this read. This is a statement about the
inspected source path, not proof about all website privacy settings or deployed
data. The subject-collection privacy model must not be imported into this
endpoint's meaning. [Person-collection DAO][dao], [collection model][model]

The route has no `NeedLogin` or `NeedScope`. No Authorization header proceeds
anonymously; a supplied header with a missing separator, a non-`Bearer` scheme,
an unknown token or an expired token returns HTTP 401. A valid token sets the
principal, but does not introduce a different list predicate. Rate limiting
distinguishes logged-in users from anonymous IPs and may return HTTP 429; no
deployed rate allowance was established here. [Routes][routes],
[token middleware][auth], [rate limiter][rate]

Username lookup uses `Member.Username.Eq(username)`. This path contains no
numeric user-ID fallback or current-user `-` substitution. The route's later
literal `/-/` segment is structural. Do not reinterpret an identity lookup
failure by trying another spelling or numeric identity. [User repository][users],
[routes][routes]

## Result and failure cases

These are source-derived expectations, assuming earlier middleware succeeds;
they are not observations of the public service.

| Case                                          | Interpretation                                                                                  |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Positive count, offset equal to count         | Allowed; a stable fixture yields an empty page. Concurrent mutation can change the later query. |
| Missing target user                           | 404 after valid query parsing.                                                                  |
| Empty username passed directly to the handler | 400; a URL that fails routing can instead hit the default 404 handler.                          |
| Count/list/hydration repository failure       | Error propagated; central handling ordinarily yields 500, not an invented empty success.        |

An empty successful page is distinct from a 404. Positive total with no returned
objects does not prove an empty collection. [List handler][handler],
[collection repository][repo], [error handler][error-handler]

The optional exact follow-up is a different endpoint:
`GET /v0/users/{username}/collections/-/persons/{person_id}`. Its handler first
looks up the person, then the user, then the collection. HTTP 404 can therefore
mean a missing person, missing user, or absent membership; a later 404 after list
selection is not proof of any one cause. It returns one serialized membership,
not a detail/profile search. [Single-person handler][single]

The serializer emits person ID, name, type, images and creation time; it does
not emit career. The already completed missing-career repair remains separate
and is not reopened or retested by this research. [Collection serializer][serializer]

## Specification discrepancy

Both pinned v0 specifications declare only the username path parameter for
`getUserPersonCollections`, omitting limit/offset and list-query HTTP 400.
Both describe a paged response; its `limit` property has schema default zero,
which does not describe the handler's request default of 30. They also require
career on `UserPersonCollection`, unlike the serializer. A generated client's
absence of query options is therefore consistent with these specifications;
it does not refute the server implementation. [API specification][api-spec],
[paged response schema][api-page-schema], [person membership schema][api-person-schema],
[server specification][server-spec], [pagination parser][page],
[collection serializer][serializer]

## Direct character-list comparison

`GET /v0/users/{username}/collections/-/characters` uses the same strict parser,
defaults and maximum. It calls the same count/list repository methods with
category `crt`, preserves the zero-count check bypass and page echoes, and skips
missing hydrated characters. Its route has the same optional authentication.
Consequently the same row bound, timestamp-order limitation and empty-page
semantics apply. [Character-list handler][characters], [routes][routes]

Both specifications also omit query parameters for `getUserCharacterCollections`.
This supports considering one coherent additive native-pagination source
supplement for the two list operations, with separate route/category fixtures.
It does not establish deployed support for either, require a broader selector,
or investigate single-character behavior. [API character-list specification][api-character-spec],
[server character-list specification][server-character-spec]

## Minimal prospective contract and offline preparation

The following is a design inference from the source, not a declaration that
BangumiAgentKit implements it or that any future account use is authorized.

1. Add an explicitly documented native-page contract at a suitable additive
   source/client/service seam. Bind it to the pinned owner sources above and
   reconcile it with the generated schema's omission. Choose a narrow reviewed
   source supplement or an intentional schema migration; neither hand-edit
   generated output nor grant generic arbitrary query escape hatches. There is
   no need to regenerate the whole API merely to prove this one discrepancy.
2. A first selector flow may resolve the bound account's canonical username
   using existing validated identity policy, then make exactly one list request
   with explicit native `limit=1, offset=0`. Preserve the actual target and
   query in the request contract. Existing `maxItems` postfetch truncation is
   a separate output policy and cannot supply this upstream bound.
3. Validate the successful envelope and echoed page values, finite nonnegative
   integer total, array shape, at most one returned row, and a valid observed
   positive person ID. Reject missing/mismatched paging metadata or more rows
   than requested as incompatible; do not silently truncate them into success.
   Do not require `total == data.length`, or infer a stable unique winner from
   timestamp order. Preserve missing-career-as-unknown semantics.
4. Empty data terminates selection without fallback. Distinguish `total=0`
   from a positive count with no returned candidate. After a valid observed
   candidate, permit at most one exact single-person membership read for that
   ID and the same target, validating returned identity. Never follow an empty
   page, 404, parser error, mismatch or uncertain identity with numeric-username
   retry, automatic continuation, another profile/detail endpoint, or search.
5. Preserve existing credential/public-override policy, finite response-byte
   caps, timeout/cancellation and request-count limits. A page cap does not
   replace them. Metadata failures, authentication errors, rate limits and
   upstream failures remain explicit failures; no claim of private access,
   full-collection coverage or stable-selector credit follows.

Before any real request, finite synthetic fixtures can establish faithful
request construction, generated/source supplement compatibility, local
validation, service/Registry exposure, response mapping, byte/cancellation
limits, and the two-request maximum. Useful new negative fixtures include:

| Fixture                                                                    | Required prospective behavior                                                       |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Fractional/nonfinite/negative offset; limit 0 or above supported/local cap | Reject locally before I/O; do not coerce or clamp.                                  |
| `limit=1, offset=0` request                                                | Verify exact route/query at the real client seam; output slicing alone cannot pass. |
| Missing/mismatched page metadata; two rows for limit 1                     | Compatibility failure; no second request.                                           |
| Empty page with total zero or positive                                     | Separate terminal outcomes; zero follow-up calls.                                   |
| Malformed/nonpositive candidate ID                                         | Parser failure; no follow-up calls.                                                 |
| One valid row; matching exact single response                              | At most two calls, same target, observed ID only.                                   |
| Follow-up 404 or mismatched returned ID                                    | Honest not-found/compatibility result; no replacement candidate.                    |
| 400/401/429/500, cancellation or byte-cap failure                          | Preserve bounded failure classification; no automatic fallback.                     |
| Synthetic equal creation times or count/page disagreement                  | No deterministic-ID or snapshot/completeness assertion.                             |

Fixtures can demonstrate our behavior against the source contract; they cannot
prove deployment honors the query. Source inspection establishes the upstream
row bound without executing the AGPL server, installing dependencies or copying
its implementation. If a future implementation changes shared module/schema
hashes, it also needs fresh, exact-source compiled/native compatibility evidence
before source-bound historical references can be reused. This report executes
none of that work and grants no acceptance credit.

## Exact unknowns and decisions before execution

- The deployed revision, middleware configuration, actual query acceptance and
  echo behavior are unobserved. An older deployment could ignore query
  parameters; response validation detects some incompatibilities after a
  request but cannot retroactively bound its upstream retrieval.
- No source-backed stable tie-breaker, cursor, transactional snapshot, private
  collection representation, fixed byte/latency bound, or current numeric
  offset ceiling beyond parser/count checks has been established.
- The source supplement/schema ownership, additive public tool/service
  surface, local page/offset caps, result wording, and finite identity-resolution
  budget remain implementation decisions. A generalized paging feature needs
  its own explicit bounded continuation policy; the proposed first flow uses
  offset zero only.
- Any deployment compatibility observation, real-account identity/read,
  optional exact follow-up, fresh execution profile and evidence claim require
  their own scoped contract and existing governance/consent gates. This source
  report is sufficient to prepare offline implementation, not to activate one.

Project constraints read for this report were BangumiAgentKit's Product Charter,
HARNESS §2/§2a, Run95 recovery plan, and the earlier career source-contract note.
PR290's repair is treated as completed. Historical A1–A9 outcomes, unknown
failure causes, spent claims and exact-source evidence remain intact; this is
not a renamed retry or a diagnosis of those failures. No formal review slot,
Goal/Run/PR mutation or new runtime-state claim is made here.

[handler]: https://github.com/bangumi/server/blob/243e2cd5dd22995fb2340d77b48bc851a12ea5b6/web/handler/user/list_person_collections.go#L33-L102
[characters]: https://github.com/bangumi/server/blob/243e2cd5dd22995fb2340d77b48bc851a12ea5b6/web/handler/user/list_character_collections.go#L33-L103
[page]: https://github.com/bangumi/server/blob/243e2cd5dd22995fb2340d77b48bc851a12ea5b6/web/req/page.go#L25-L109
[repo]: https://github.com/bangumi/server/blob/243e2cd5dd22995fb2340d77b48bc851a12ea5b6/internal/collections/infra/mysql_repo.go#L788-L830
[query]: https://github.com/bangumi/server/blob/243e2cd5dd22995fb2340d77b48bc851a12ea5b6/dal/query/chii_person_collects.gen.go#L196-L202
[dao]: https://github.com/bangumi/server/blob/243e2cd5dd22995fb2340d77b48bc851a12ea5b6/dal/dao/chii_person_collects.gen.go#L7-L20
[model]: https://github.com/bangumi/server/blob/243e2cd5dd22995fb2340d77b48bc851a12ea5b6/internal/collections/domain/collection/model.go#L23-L69
[routes]: https://github.com/bangumi/server/blob/243e2cd5dd22995fb2340d77b48bc851a12ea5b6/web/routes.go#L49-L102
[auth]: https://github.com/bangumi/server/blob/243e2cd5dd22995fb2340d77b48bc851a12ea5b6/web/handler/common/access_token.go#L31-L64
[users]: https://github.com/bangumi/server/blob/243e2cd5dd22995fb2340d77b48bc851a12ea5b6/internal/user/mysql_repository.go#L95-L105
[persons]: https://github.com/bangumi/server/blob/243e2cd5dd22995fb2340d77b48bc851a12ea5b6/internal/person/mysql_repository.go#L99-L111
[paged]: https://github.com/bangumi/server/blob/243e2cd5dd22995fb2340d77b48bc851a12ea5b6/web/res/page.go#L21-L33
[serializer]: https://github.com/bangumi/server/blob/243e2cd5dd22995fb2340d77b48bc851a12ea5b6/web/res/collection.go#L62-L80
[errors]: https://github.com/bangumi/server/blob/243e2cd5dd22995fb2340d77b48bc851a12ea5b6/web/res/error.go#L87-L101
[error-handler]: https://github.com/bangumi/server/blob/243e2cd5dd22995fb2340d77b48bc851a12ea5b6/web/error.go#L32-L99
[rate]: https://github.com/bangumi/server/blob/243e2cd5dd22995fb2340d77b48bc851a12ea5b6/web/mw/rate-limit.go#L39-L84
[single]: https://github.com/bangumi/server/blob/243e2cd5dd22995fb2340d77b48bc851a12ea5b6/web/handler/user/get_person_collection.go#L32-L77
[api-readme]: https://github.com/bangumi/api/blob/65d29cff2331e08c0110d30d515f7f1b6488f845/README.md#L9
[api-spec]: https://github.com/bangumi/api/blob/65d29cff2331e08c0110d30d515f7f1b6488f845/open-api/v0.yaml#L1467-L1515
[api-page-schema]: https://github.com/bangumi/api/blob/65d29cff2331e08c0110d30d515f7f1b6488f845/open-api/v0.yaml#L3159-L3180
[api-person-schema]: https://github.com/bangumi/api/blob/65d29cff2331e08c0110d30d515f7f1b6488f845/open-api/v0.yaml#L3500-L3534
[server-spec]: https://github.com/bangumi/server/blob/243e2cd5dd22995fb2340d77b48bc851a12ea5b6/openapi/v0.yaml#L1488-L1536
[api-character-spec]: https://github.com/bangumi/api/blob/65d29cff2331e08c0110d30d515f7f1b6488f845/open-api/v0.yaml#L1418-L1438
[server-character-spec]: https://github.com/bangumi/server/blob/243e2cd5dd22995fb2340d77b48bc851a12ea5b6/openapi/v0.yaml#L1438-L1458

## Selected implementation contract

The additive `NativeCollectionPageClient` belongs to the source-owned OpenAPI
package supplement, with reproducibly generated named delegates. The pinned
schema, existing generated method signatures, raw operation IDs and legacy
aggregate service methods remain unchanged. Dedicated person and character
list tools use new page service methods: maxItems1–50 (default50) is sent as
native limit; offset is an optional safe nonnegative integer (default0).
The client source contract itself permits limit1–100. There is one logical GET,
no automatic next page or retry, a256KiB response cap and10s lifetime deadline
through body consumption. The same injected transport and principal resolution
remain in use; this does not add a private-data unlock.

Page envelopes must echo exact requested bounds, have a safe nonnegative total,
and return no more than the requested row limit. Invalid individual entity rows
are counted rather than turned into selector candidates. Count/list disagreement
removes the untrustworthy total and continuation. Otherwise nextOffset advances
by the requested native window, even when hydration omitted rows; it never
advances by the number of valid returned rows. Source order is creation time
descending, ties are unspecified, and no stable snapshot is claimed.

Initial original-Registry fixtures were RED6/GREEN2 on the old implementation:
missing native query, unsupported explicit offset, and silently accepted limit
mismatch. New boundary/service/Registry fixtures test faithful transport,
identity, invalid inputs, count/empty/hydration semantics, streamed response-byte
rejection, total-body deadline/cancellation, zero retry, and unchanged raw
operation semantics. This is offline engineering evidence only. Actual compiled
MCP and a new sealed exact-source successor for the historical twelve inputs
remain required before integration; old frozen producers/importers/claims are
not modified. No source-bound account credit is inherited by an unproved new
development graph. PR290 and prior calendar/design/native cases remain DONE.

## First engineering validation

The five affected boundary/Registry/direct-execute/documentation files pass69
checks; package and test typechecks and changed-file ESLint pass. Body-byte
failure and cancellation during body consumption are observed, not inferred
from a header-only timeout. A successful call clears its deadline timer. Source
maximum100 remains distinct from the dedicated tool's existing50-item ceiling.
The additive seam also rejects dot-only usernames before URL normalization can
leave the fixed endpoint family (two tests RED then GREEN). Existing raw method
signatures/operation registry, old aggregate service paths, completed singleton
metadata repair, and all frozen proof programs remain intact. This does not
complete the Epoch: current-source compiled MCP, strict historical compatibility,
full readiness and independent Product review remain pending.
