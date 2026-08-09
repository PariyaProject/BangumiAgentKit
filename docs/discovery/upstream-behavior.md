# PR-7C C0 — Bangumi subject search and browse behavior

Status: research artifact only. This note does not define a PR-7C runtime
contract and does not change production code.

Date checked: 2026-08-09 (Asia/Tokyo)

## Executive result

The pinned v0 OpenAPI describes two different surfaces:

- `POST /v0/search/subjects`: experimental subject search. The JSON body
  requires a `keyword` string, but the schema does not say that it must be
  non-empty. It exposes filter-only-shaped requests syntactically, but empty
  keyword acceptance is not established by the OpenAPI alone.
- `GET /v0/subjects`: subject browse. It requires `type` and supports
  `cat`, book-only `series`, game-only `platform`, `sort=date|rank`, `year`,
  and `month`.

The official server source currently forwards the search keyword to the
Meilisearch query even when it is empty, and implements the documented search
filters. A bounded live run against `api.bgm.tv` on 2026-08-09 returned HTTP
200 with a valid `Paged_Subject` shape for all 24 cases, including
`keyword: ""`. That is a time-bounded observation, not a permanent contract;
the probe remains opt-in and is not a CI prerequisite.

## Evidence and provenance

### Repository-pinned contract

- Local pinned file: [`openapi/upstream/v0.yaml`](../../openapi/upstream/v0.yaml)
  (the repository history records it at commit
  `ae69c19f0360e5825a22477813c6685caa7c13b2`; local SHA-256
  `5a7ddb7ddec132293b1aa08102e6ac63e31b2925574658e927d6f931df2519da`).
- Official API mirror:
  [`bangumi/api/open-api/v0.yaml`](https://github.com/bangumi/api/blob/master/open-api/v0.yaml).
  The API repository README says that this file is synchronized from
  `bangumi/server`:
  [`bangumi/api/README.md`](https://github.com/bangumi/api/blob/master/README.md).
- Original server OpenAPI:
  [`bangumi/server/openapi/v0.yaml`](https://github.com/bangumi/server/blob/master/openapi/v0.yaml).

The current shallow source checkout used for this note was
`bangumi/server` commit
[`10084d67069e6de6275b085775987cf8f9c708e1`](https://github.com/bangumi/server/tree/10084d67069e6de6275b085775987cf8f9c708e1).
Its `openapi/v0.yaml` blob is
`44250854bf85d0d5ddba72f95bff566ae115bd26`. The local pinned YAML is
formatting-different from that blob but has the same relevant search/browse
definitions in this audit; the pinned file remains the repository contract.

### Official implementation sources

The behavior observations below come directly from these first-party source
files at the server commit above:

- [search handler](https://github.com/bangumi/server/blob/10084d67069e6de6275b085775987cf8f9c708e1/internal/search/subject/handle.go)
  — request filters, search forwarding, sort mapping, and search limits.
- [search index document](https://github.com/bangumi/server/blob/10084d67069e6de6275b085775987cf8f9c708e1/internal/search/subject/doc.go)
  — indexed fields and the `heat` value.
- [browse handler](https://github.com/bangumi/server/blob/10084d67069e6de6275b085775987cf8f9c708e1/web/handler/subject/browse.go)
  — browse query parsing and validation.
- [browse repository](https://github.com/bangumi/server/blob/10084d67069e6de6275b085775987cf8f9c708e1/internal/subject/mysql_repository.go)
  — SQL-side filter and ordering behavior.
- [pagination parser](https://github.com/bangumi/server/blob/10084d67069e6de6275b085775987cf8f9c708e1/web/req/page.go)
  — default, maximum, and validation behavior.
- [search package note](https://github.com/bangumi/server/blob/10084d67069e6de6275b085775987cf8f9c708e1/internal/search/readme.md)
  — date representation used for Meilisearch comparisons.

For live probing, follow the official [User-Agent guidance](https://github.com/bangumi/api/blob/master/docs-raw/user%20agent.md).

### Bounded live observation

The opt-in probe was run once at `2026-08-09T14:30:21Z` with 1100 ms between
requests and a 12 s per-request timeout. It sent 24 read-only requests; all
returned HTTP 200, parsed as JSON, and passed the generic paged-subject schema
check. The raw JSON report was kept in `/tmp/pr7c-c0-live.json`, not added to
the repository.

| Probe group                  | Live observation                                                                                                                                                                                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty keyword                | Accepted: `POST /v0/search/subjects` with `keyword: ""` returned 200, `limit=10`, `offset=0`.                                                                                                                                                                                      |
| Type filter                  | `type=[2]` returned 200; every row on the sampled page had type 2.                                                                                                                                                                                                                 |
| Date filter                  | `>=2026-07-01` and `<2026-10-01` returned 200; every sampled row had a date in the requested half-open range.                                                                                                                                                                      |
| Tag/meta/rating/rating-count | `后宫`, `原创`, `>=8`, and `>=5000` each returned 200; every checkable sampled row satisfied its requested predicate.                                                                                                                                                              |
| Search sorts                 | `match`, `heat`, `rank`, and `score` each returned 200. The sampled `heat` page was descending; sampled `rank` and `score` response fields were all tied/zero, so their order is not proven from returned fields. `match` has no response metric that proves relevance ordering.   |
| Search pagination            | `limit=5` at offsets 0 and 5 echoed correctly. Requested `limit=50` returned effective `limit=20`, confirming the current deployed search soft cap.                                                                                                                                |
| Browse baseline              | `type=2` returned 200 with `total=29009`, default `limit=30`, `offset=0`.                                                                                                                                                                                                          |
| Browse filters               | `cat=1` returned `total=9628`; `year=2026` returned `total=872`; `year=2026&month=7` returned `total=139`; the July sample's dates were checkable and passed. The year-only sample omitted `date` in the response rows, so the row-level date check is **unknown**, not a failure. |
| Browse sorts                 | `sort=rank`, `sort=date`, and July+rank returned 200 and sampled rows were monotonic in the expected directions.                                                                                                                                                                   |
| Browse pagination/limit      | `limit=5&offset=5` echoed correctly; `limit=50` returned 50 rows and the intentionally out-of-pinned-contract `limit=100` also returned 100 rows. This matches the current source's 100 limit and conflicts with the pinned OpenAPI maximum of 50.                                 |

Many unfiltered/loosely filtered search responses reported `total=1000`.
The current server source maps Meilisearch's `estimatedTotalHits` into the
page `total`, so this must not be treated as an exact database count or as
proof that more than 1000 results are unavailable. Browse totals were larger
and came from the source's database count path.

## `POST /v0/search/subjects`

### Contract behavior

The pinned OpenAPI marks `keyword` as required and typed `string`; it does not
declare a non-empty constraint. The request also accepts `sort`:

| Search sort       | Official OpenAPI meaning                                       |
| ----------------- | -------------------------------------------------------------- |
| `match` (default) | Meilisearch default ordering by match/relevance                |
| `heat`            | 收藏人数 (collection/popularity count in the contract wording) |
| `rank`            | Rank, high-ranked subjects first                               |
| `score`           | Score                                                          |

The body filter has these documented fields:

- `type[]`: OR within the array.
- `tag[]`, `meta_tags[]`, `air_date[]`, `rating[]`, `rating_count[]`, and
  `rank[]`: AND within each field; different filter fields are ANDed.
- `nsfw`: omitted/null, true-only, or false-only, subject to permission. The
  contract says unauthorized callers cannot use it to obtain NSFW results.
- Range values are strings such as `>=2020-07-01`, `<2020-10-01`, `>=8`, or
  `>=5000`. The OpenAPI description also documents `-tag`/`-meta_tag` style
  exclusion for the corresponding tag arrays.

The response is `Paged_Subject`: `total`, `limit`, `offset`, and `data[]`.
PR-7C records this as `totalKind: "estimated"` for search because the
current source derives `total` from Meilisearch `estimatedTotalHits`; a search
total never proves that the source result set is exhausted.
The pinned search operation declares `limit` and `offset` as integer query
parameters but does not declare their defaults or maximums.

### Source-level behavior

At server commit `10084d67`, the request decoder stores the keyword as a plain
string and passes it directly to `Meilisearch.SearchRaw`; there is no
non-empty check in the handler. The source therefore supports an
empty-keyword request path at the implementation level. This does not replace
a live observation of the deployed service.

The current source translates filters as follows:

| Input               | Current source mapping                              |
| ------------------- | --------------------------------------------------- |
| `type`              | one Meilisearch equality expression per type, ORed  |
| `tag`               | `tag = "..."`, one expression per value, ANDed      |
| `meta_tags`         | `meta_tag = "..."`, one expression per value, ANDed |
| `air_date`          | comparator over an integer `YYYYMMDD` value         |
| `rating`            | comparator over indexed `score`                     |
| `rating_count`      | comparator over indexed `rating_count`              |
| `rank`              | comparator over indexed `rank`                      |
| unauthorized `nsfw` | forced to `nsfw = false`                            |

The source validates numeric comparators and dates before querying. The
OpenAPI's documented leading-minus exclusion syntax is not visibly translated
by this source path. A narrow live probe on 2026-08-10 compared
`meta_tags: ["原创"]` with `meta_tags: ["原创", "-科幻"]`: both requests returned
HTTP 200, the first returned `total=1000` and sampled rows including subject
50 with `meta_tags` containing `科幻`, while the second returned `total=0` and
no rows. The deployed result does not establish negative exclusion semantics;
the zero result is also compatible with treating `-科幻` as a literal value.
PR-7C therefore treats exclusion as a canonical hydrated post-filter rather
than trusted pushdown. The probe has no known excluded sample because the
negative case returned no rows.

### Empty keyword and filter-only requests

| Question                                                                         | Result of this audit                                                                                                                             |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Is `keyword: ""` allowed by schema?                                              | Yes, the field is a string with no `minLength`.                                                                                                  |
| Does the current official source reject it before search?                        | No such rejection is present; the string is forwarded to Meilisearch.                                                                            |
| Did deployed `api.bgm.tv` return 200 for the sampled empty-keyword/filter cases? | Yes, all sampled cases returned 200 and valid page shapes; checkable sample rows satisfied the requested predicates.                             |
| Is filter-only search exhaustive and permanently stable?                         | Not proven. Search is explicitly experimental, the sampled `total` is estimated/capped, and the live result is only a point-in-time observation. |
| Can PR-7C call this “filter-only search” as a proven capability?                 | It can model it as a verified current capability with bounded/experimental confidence, not as an unbounded exact query.                          |

The probe covers these exact cases with `keyword: ""`: anime type,
`2026-07-01 <= air_date < 2026-10-01`, tag `后宫`, meta tag `原创`, rating
`>=8`, rating count `>=5000`, and all four search sort values.

## Search sort details and uncertainty

The official source maps the sort values to:

- `score` → `score:desc`;
- `heat` → `heat:desc`;
- `rank` → `rank:asc`;
- `match`/omitted → no explicit sort override, so the configured
  Meilisearch ranking rules apply.

The current index source defines `heat` as
`OnHold + Doing + Dropped + Wish + Collect`. Therefore:

- Do not rename `heat` to recent trend, seven-day popularity, discussion heat,
  or growth; no official source supports those meanings here.

PR-7C keeps source-native order when the public `order` is omitted: search
`heat` and `score` default to descending, search `rank` defaults to ascending,
search relevance preserves upstream match order, browse `rank` is ascending,
and browse `date` is descending. A reverse request is only a local ordering
operation and cannot claim a global Top-N result before the relevant source is
exhausted.
- The OpenAPI's short wording (“收藏人数”) and the current source's sum of
  all five collection states should be retained as two pieces of provenance.
  The exact deployed value/order remains a live observation item.
- `match` is relevance/ranking behavior, not a deterministic numeric field in
  the response. A probe can report returned order but cannot prove the full
  Meilisearch ranking formula from response JSON alone.
- Ties and missing/zero ranks are not specified as a stable secondary-order
  contract by the API. Do not promise deterministic tie ordering in a planner.

## Pagination and limits

### Search

The current server source uses `defaultLimit = 10` and calls a soft-limit
parser with `maxLimit = 20`; non-positive limits are rejected and negative
offsets are rejected. The handler returns the effective `limit` and requested
`offset` in the page envelope. The downstream search function contains an
additional fallback/cap (`0 → 10`, `>50 → 50`), but the handler's `20` soft cap
is the effective path for normal requests.

This is not fully reflected in the pinned OpenAPI, which leaves search limit
bounds/defaults unspecified. Treat the source values as observed implementation
details, not a durable public contract. The probe requests `limit=5` at offsets
`0` and `5`, and requests `limit=50` to record the deployed effective value.

The response `total` is produced from Meilisearch's
`estimatedTotalHits` in the current source. Do not silently describe it as an
exact database count without further upstream evidence. Search pagination is
considered exhausted only after an empty page, a short page relative to the
effective returned limit, or another explicit pagination signal.

### Browse

The pinned OpenAPI declares the shared `default_query_limit` as `1..50` with
default `30`, and `offset >= 0` with default `0`. The current server source's
generic browse parser uses `DefaultPageLimit = 30` and
`DefaultMaxPageLimit = 100`, so a request above 50 is a pinned-contract/source
discrepancy. The browse handler rejects invalid/non-positive limits, negative
offsets, and offsets greater than the counted result set; an empty result still
returns a valid empty page.

The probe requests the default browse page, `limit=5&offset=5`, `limit=50`,
and the source/OpenAPI boundary case `limit=100`. The live deployment accepted
all four and echoed the requested effective limits, including `100`.

## `GET /v0/subjects` browse behavior

### Contract and source mapping

`type` is required and uses the official subject type enum:

| Type | Meaning |
| ---: | ------- |
|    1 | book    |
|    2 | anime   |
|    3 | music   |
|    4 | game    |
|    6 | real    |

The browse query fields are:

| Query       | Contract/source behavior                                                                              |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| `cat`       | category enum validated for the selected type; source applies it as the stored platform/category code |
| `series`    | parsed only for books; filters book series when provided                                              |
| `platform`  | parsed only for games; source matches the platform marker in game infobox data                        |
| `sort=date` | source orders newest date first                                                                       |
| `sort=rank` | source excludes rank `0` and orders ascending rank number                                             |
| `year`      | source accepts 1900–3000 and filters the stored year                                                  |
| `month`     | source accepts 1–12 and filters the stored month                                                      |

For anime categories, the pinned enum includes `0` other, `1` TV, `2` OVA,
`3` Movie, and `5` WEB. The type/category code is not returned as a dedicated
numeric category field in the subject response, so a probe cannot always prove
`cat` filtering from response rows alone.

The browse handler performs a count first, then applies `limit`/`offset`, and
returns `total`, effective `limit`, `offset`, and `data`. It also documents a
cache policy in the OpenAPI description: first page 24h, later pages 1h. That
cache statement is not a freshness guarantee for discovery results.
PR-7C records browse pages as `totalKind: "exact"`; only this source-native
exact count may prove exhaustion by `offset + rows >= total`.

## Probe artifact and execution policy

The opt-in probe is [`probe-subject-search.mjs`](../../scripts/research/pr7c/probe-subject-search.mjs).

- Default invocation is dry-plan only and sends zero network requests.
- `--live` is required to send requests; only `POST /v0/search/subjects` and
  `GET /v0/subjects` are used.
- No cookies, bearer tokens, or mutation methods are sent.
- Requests are sequential and separated by `--delay-ms` (default 1000 ms).
- A caller-identifying `--user-agent` or `BANGUMI_USER_AGENT` is required for
  live mode, following the official guidance.
- JSON output records HTTP status, content type, schema validity, response
  page fields, first IDs, and conservative filter/order checks. It does not
  dump full subject payloads.
- The script is not a package script and is not a CI prerequisite. A live API
  outage, rate limit, index state, or deployment change must not block tests.

## Uncertainty register

1. **Empty keyword online acceptance** — observed as 200 on the sampled
   deployment; still experimental and not a durable guarantee.
2. **Filter-only completeness** — a 200 response would show acceptance, but
   it would not by itself prove that every filter combination is exhaustive.
3. **Negative tag/meta-tag syntax** — documented in OpenAPI, but the targeted
   deployment probe returned no rows for the mixed positive/negative case and
   did not prove exclusion semantics; runtime uses canonical post-filtering.
4. **Search limit** — pinned schema has no bounds; current source says 20 at
   the handler boundary and contains a separate 50 cap downstream. The live
   run observed `limit=50` becoming `limit=20`.
5. **Browse limit** — pinned OpenAPI says 50; current generic handler constant
   is 100.
6. **`heat` wording versus calculation** — OpenAPI says collection count;
   current index source sums all collection states. Do not infer recency or
   trend semantics.
7. **Tie order and total exactness** — neither is a stable public guarantee;
   search total is an estimated hit count in current source.
8. **Deployed index freshness** — official source and pinned contract do not
   prove that the public index is populated or synchronized beyond this probe
   time.

## C0 implementation consequence

The live probe records successful empty-keyword responses and sampled filter
checks, so PR-7C may model filter-only discovery as a current verified
capability with bounded/experimental confidence. It must not treat this as an
unbounded exact query: search is experimental, totals are estimated/capped,
and filter combinations need their own bounded coverage. It should keep
search and browse as separate source-native operations. Negative meta-tag
exclusion remains a hydrated canonical post-filter. No PR-7C production code
is implemented by this C0 artifact.
