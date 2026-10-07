# D04 — reported episode-count discovery source contract

**Checked:** 2026-10-07 against official Bangumi OpenAPI and the synchronized
BangumiAgentKit `master` source at `a54ff1b4b8586af84b50f518f6002d7eb6204141`.

**Scenario:** “找出集数少于 13、评分人数超过 3000 的科幻动画。”

## Official source contract

The official `POST /v0/search/subjects` operation supports subject type,
literal tag/meta-tag, air-date, rating, rating-count, rank, and NSFW filters.
Its schema explicitly marks the search API experimental; the operation filter
does not define an episode-count/`eps` predicate. The response schema is
`Paged_Subject`, whose `data` rows reference the official `Subject` schema.
See the [official v0 OpenAPI](https://raw.githubusercontent.com/bangumi/server/master/openapi/v0.yaml).

The official `Subject` schema exposes integer `eps`, described as parsed by the
legacy server from wiki data, and a separate integer `total_episodes`, described
as the database chapter count. They are distinct fields and neither means
personal viewing progress. See the [official Subject schema](https://raw.githubusercontent.com/bangumi/server/master/openapi/components/subject_v0.yaml).

## Bounded salvage

The positive-only variant is: return only candidates observed within the
current official search budget whose anime type, literal `科幻` tag, rating
count, and reported `subject.eps` satisfy the explicit filters. Translate
“fewer than 13” to `episodeCount.max=12` and “more than 3000 ratings” to
`ratingCount.min=3001` because both values are integer counts. The tag is an
exact user-specified facet; it is not a general genre or audience classifier.

`episodeCount` must be a local post-filter, never an upstream search filter.
The existing discovery engine can preserve it as a plan filter and hydrate a
bounded candidate when the search row lacks `eps`. If both candidate and detail
values are absent or detail hydration fails, the candidate stays unresolved and
the result stays partial; absence must not be counted as a non-match.

The existing execution ceilings are 10 pages, 500 candidates, 120 detail
hydrations, and 100 returned items. Search totals are estimated, and the search
operation is experimental, so exhausting a page or the current query budget
cannot prove a Bangumi-wide complete list. UI, Agent, and MCP output must say
that the row count is Bangumi-reported `eps`, not `total_episodes`, aired
episodes, or watched episodes; exact tag and rating-count evidence must remain
visible alongside coverage and any unresolved/truncation warnings.

## Product gap and evidence boundary

At the checked source revision, `query_subjects` accepted media, tags,
rating-count, and coverage bounds, but no episode-count range; the discovery
provider discarded search-row `eps` even though canonical subject detail
already carried `eps` and `total_episodes`. Thus D04 was not yet demonstrated
end to end. This report is source-contract research only: no live Bangumi
search, authenticated request, account data, Agent/MCP canary, QQ, or TIM
operation was performed.

The implementation may advance D04 only to `PARTIAL` with deterministic
provider/compiler/engine/render/Standalone tests and a sanitized exact-current
source anonymous Agent/MCP result. It must not claim complete coverage,
franchise completeness, or a demographic classification.
