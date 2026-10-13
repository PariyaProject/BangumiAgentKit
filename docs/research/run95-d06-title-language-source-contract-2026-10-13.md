# Run #95 D06 title-language source boundary

Verified 2026-10-13T06:08:19Z on BangumiAgentKit Candidate base `f124ba2a619dee7af061d76adfcdc294b8b35c0f` and the current official public-v0 OpenAPI. This is a source-contract assessment only. No Bangumi search/query, Agent/MCP one-shot, OAuth, account, community, QQ, or TIM request was made.

## Source contract

The official `POST /v0/search/subjects` contract requires a keyword. Its declared filters are type, tag, meta tag, air date, rating, rating count, rank, and NSFW (`filter.meta_tags` is part of the schema even though the prose description does not enumerate it). Pagination is by limit/offset. The operation is explicitly experimental. It declares no filter for `name` or `name_cn` being blank, and no title-language filter.

The official Subject model returns `name` and `name_cn` as strings. It does not label either field with a language identifier or expose a separate Japanese-title field. The current AgentKit discovery candidate carries `name` and optional `nameCn`, along with its bounded evidence fields; the `query_subjects` input has no title-language or missing-name predicate.

The model-facing query schema now has a focused regression that rejects `titleLanguage` and `missingOriginalTitle` arguments while continuing to accept a bounded keyword/media query. This protects the source boundary; it does not test an Agent answer or add matrix credit.

## Validation

- `pnpm vitest run tests/discovery/parity.test.ts`: PASS, 1 file / 3 tests.
- `pnpm harness frontier:check`: PASS, 121 records / 99 actionable; D06 remains PARTIAL at the source-contract layer.
- `pnpm acceptance:check`: PASS, 108/108 validators; Agent/MCP remains 83/96 and no D06/query_subjects credit is added.
- `pnpm harness guard:legacy-paths --base origin/master --product-epoch`; `git diff --check`: PASS.
- No Bangumi query, model call, account, community, QQ, or TIM request was made.

## D06 classification

`D06` is recorded `PARTIAL` as a capability/source assessment only. A caller can inspect title fields in results from an explicitly bounded keyword search, but the API does not support a database-wide search for entries with one title field absent, and it provides no structured language fact proving that a returned original title is or is not Japanese. Search totals are estimates and result coverage is bounded. Therefore no answer may claim an exhaustive list or infer absence from omitted rows.

No current-source Agent/MCP answer was run or accepted, and no `query_subjects` acceptance-matrix credit is added. Any later D06 live attempt must use a distinct unspent profile, exact Candidate/Base CI and Harness review gates, and a sanitized no-retry claim; its result can earn at most bounded/partial scenario evidence.

## Reopen condition

Reassess if public-v0 adds structured title-language metadata or a supported, complete predicate for missing Japanese/original titles. Until then, answer only a bounded observed keyword sample with the source and coverage limitations stated.

## Sources

- [Official Bangumi API v0 OpenAPI: subject search and filters](https://github.com/bangumi/api/blob/master/open-api/v0.yaml#L14-L85)
- [Official Bangumi API v0 OpenAPI: Subject fields](https://github.com/bangumi/api/blob/master/open-api/v0.yaml#L3556-L3594)
- `packages/tools/src/definitions/discovery-tools.ts` (`discoveryQueryInput` and `bangumi.query_subjects`)
- `packages/provider-core/src/providers.ts` (`SubjectDiscoveryCandidate`)
