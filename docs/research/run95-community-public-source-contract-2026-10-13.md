# Run #95 community source contract recheck — no current public allowlist

**Verified:** 2026-10-13T11:40Z. The official source revisions checked were `bangumi/server` `4223d14057fea5078595e40470f8602d3301abb5` and `bangumi/dev-docs` `d959dc6ab2016d00e877712d01038f8cb740ef6c`. **Scope:** official static documentation and the public v0 OpenAPI only. No Bangumi production API, community page/content, HTML, RSS, private `/p1`, account, OAuth, QQ, or TIM request was made.

## Findings

1. The official [`bangumi/server` v0 OpenAPI](https://github.com/bangumi/server/blob/4223d14057fea5078595e40470f8602d3301abb5/openapi/v0.yaml) documents public subject search and subject metadata/relations, but no subject-topic, reply, or discussion-history route or schema. A whole-file search of that exact revision for `topic` and `reply` returned no matches. The documented `GET /v0/subjects/{subject_id}/subjects` operation returns direct subject relations; it is not a discussion feed and has no topic/reply timestamps.
2. The same OpenAPI labels `POST /v0/search/subjects` experimental and defines search `sort=heat` as collection count. That value cannot support a discussion ranking or a weekly discussion-growth claim.
3. Bangumi's [official developer documentation](https://github.com/bangumi/dev-docs/blob/d959dc6ab2016d00e877712d01038f8cb740ef6c/README.md#L235-L245) separates public `/v0` from the new-site private API. It describes `/p1` as frontend-specific, cookie-session authenticated, still in development, and without a compatibility guarantee or cross-origin support. Its existence does not create a third-party public-source contract, so this Epoch did not inspect or call it.
4. The repository's older [`community-source-map.md`](./pr7a2/community-source-map.md) lists private API and public HTML candidates as exploration. That map is not a current terms/robots review or an authorization to read those sources. This Epoch did not visit the listed pages or retain any community data.

## Source decision

No public structured community source is currently allowlisted for Run #95. Public v0 does not expose the required discussion entities or time-window semantics; `/p1` is documented as private; and the earlier public-HTML candidates have not been approved under a current source, terms/robots, attribution, retention, and coverage contract. This is an operational boundary based on the reviewed material, not a blanket claim that public HTML can never be used.

Close `SOURCE-COMMUNITY-STRUCTURED-WEB` as `CLOSED_NO_SAFE_SOURCE` for the current evidence set. Keep **G10** (discussion ranking), **G11** (seven-day growth), **G21** (weekly topic/reply counts), and **OP-003** unresolved as recorded; collection heat, cumulative reply counts, and a latest-activity timestamp do not establish those metrics. No tool acceptance count changes.

## Attribution, isolation, and reopen conditions

- No source content was collected, so this review creates no content-retention or redistribution permission.
- Any future source must be explicitly allowlisted and document source attribution, subject mapping, the source-native activity metric, event timestamps/window boundaries, pagination/completeness, retention, and deletion/privacy handling. It must remain isolated from the official-v0 provider and must not become a silent fallback.
- Reopen only when an official public API adds a documented subject-level discussion contract, or when a specific public HTML source receives a separate current terms/robots and coverage review with an explicit allowlist. Do not use private `/p1`, infer weekly deltas from cumulative counts, or present collection heat as discussion activity.
