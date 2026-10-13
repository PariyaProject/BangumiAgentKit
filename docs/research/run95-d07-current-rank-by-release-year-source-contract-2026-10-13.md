# Run 95 D07 current-rank-by-release-year source contract

Checked: 2026-10-13T12:31Z

Official source: [`bangumi/server` OpenAPI `openapi/v0.yaml` at `4223d14057fea5078595e40470f8602d3301abb5`](https://github.com/bangumi/server/blob/4223d14057fea5078595e40470f8602d3301abb5/openapi/v0.yaml), [browse handler](https://github.com/bangumi/server/blob/4223d14057fea5078595e40470f8602d3301abb5/web/handler/subject/browse.go), and [rank ordering](https://github.com/bangumi/server/blob/4223d14057fea5078595e40470f8602d3301abb5/internal/subject/mysql_repository.go#L293-L303).

BangumiAgentKit base inspected: `b052d8038d458cd976b4d4fed9e5b2cd320f47ee`

## Bounded question

D07 asks which anime ranked first in each of the past ten years. The term “ranked first” can mean either a historical rank snapshot from each year or the anime that is highest-ranked today among anime returned for Bangumi’s source-reported year filter. This contract only evaluates the second, narrower reading for the ten completed calendar years 2016–2025. It cannot recover an anime’s rank as of a past date.

## Documented route and existing implementation

The pinned official v0 OpenAPI documents `GET /v0/subjects` with required `type`, optional `year`, optional `sort` (`date` or `rank`), and pagination. The route is marked with optional bearer security; this Epoch uses its anonymous read-only path. The specification says its first page is cached for 24 hours and subsequent pages for one hour. At the same pinned server revision, `web/handler/subject/browse.go` passes the selected `year` and `sort` into the browse filter; `internal/subject/mysql_repository.go` implements `sort=rank` by excluding rank 0 and ordering the positive rank field ascending. This gives the current best-ranked returned subject first for the source-reported year. The contract has no year-by-year historical-rank snapshot parameter or series.

On the inspected BangumiAgentKit base, the existing `bangumi.query_subjects` tool maps an unkeyworded anime/year/rank query to the official `browseSubjects` provider path and preserves the returned page’s retrieval time and coverage. The response is labeled by the Bangumi source year field; this Epoch does not infer a more precise air date than that source field provides. This allows one bounded `limit=1` request per release year. It does not turn the ten current observations into historical snapshots, and each response is still limited to the source’s returned page and cache behavior.

The same OpenAPI also marks `POST /v0/search/subjects` experimental. The D07 profile does not need that search route: it uses the existing browse path. No production API, account, OAuth, community, HTML, `/p1`, QQ, or TIM request was made while establishing this source contract.

## Accepted interpretation and limitations

If the exact Candidate and review gates later authorize the one-shot, the Agent may make ten anonymous `bangumi.query_subjects` calls for 2016 through 2025, with anime media, rank sort, top mode, and `limit=1`. The answer must label each row as the current top-ranked result among the observed anime for that release year, record that it is a current observation, and state that it does not establish which title held the rank at that time in the past. Missing/failed years remain missing or partial; they must not be filled with zero or inferred from neighboring years.

This is a bounded present-day sample, not a global-completeness guarantee or historical ranking dataset. D07 must remain `PARTIAL` if an accepted report is written; source research alone adds no Agent/MCP or public-API acceptance credit. Any D07 query attempt is create-once and terminal on ambiguity or failure; never retry it.

## Reopen condition

Revisit the historical interpretation only if an official supported source provides rank snapshots or another verifiable historical ranking series with explicit dates and coverage. Revisit the present-rank interpretation if the official browse semantics, cache contract, or the existing query tool changes.
