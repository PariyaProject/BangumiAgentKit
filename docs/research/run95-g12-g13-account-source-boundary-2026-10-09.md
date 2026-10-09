# G12/G13 — current-account source boundary and fail-closed acceptance

**As of:** 2026-10-09. This is an official-source and local-code review plus a fake-client auth-gate regression. No Bangumi account, OAuth authorization, user collection, QQ, or TIM request was made.

## Official source contract

The current [Bangumi v0 OpenAPI](https://github.com/bangumi/server/blob/master/openapi/v0.yaml#L1061-L1109) exposes `GET /v0/users/{username}/collections` as a paged collection read. Its description says private collections require an access token; the route uses optional bearer authentication because public profile collections can also be visible. A response for a public username is therefore not evidence of the current user's private collection. Collection rows expose status and reported episode progress, but this request must be scoped to the currently bound user for these scenarios.

G13 also needs per-episode collection state. The current [episode collection operation](https://github.com/bangumi/server/blob/master/openapi/v0.yaml#L1222-L1280) uses HTTP Bearer authentication, is paged, allows up to 1000 rows per page, and documents `401` when unauthorized. Bangumi's [developer documentation](https://github.com/bangumi/dev-docs/blob/master/README.md#L220-L225) describes `/v0` as its supported public API and says user authentication uses an access token. No token or account was used in this review.

## Local tool boundary

`bangumi.get_collection_schedule` and `bangumi.get_collection_backlog` both declare `auth: required` and `read:collection`; their inputs do not accept an arbitrary username. The schedule tool joins the legacy seven-day `/calendar` result with the current bound account's animation collections by subject ID. Its default collection states include `wish`, `doing`, and `on_hold`; G12's exact “currently watching” scope therefore requires `statuses: ["doing"]`. The legacy calendar does not provide a precise airing time or time zone, and source/page limits remain visible.

The backlog tool combines the current bound account's collections and episode progress. Its `finished` state is a bounded local inference from complete observed episode dates having passed; it is not Bangumi's official completion flag and does not rule out hiatus or future unannounced episodes. Missing/incomplete pages, disagreement between reported totals, or invalid progress must remain partial/not-computable rather than being presented as exact completion.

The new regression exercises only local tool definitions with a fake HTTP client. Without an `executionSession` or authenticated client provider, both tools must return `AUTH_REQUIRED` before making any HTTP request. It also verifies `read:collection` and rejects caller-selected usernames. This guards the passive auth boundary; it is not current-source Agent/MCP or user-account acceptance.

## Disposition

G12 and G13 remain **UNASSESSED**. Static source and mocked auth-gate tests do not establish an exact current-source Agent/MCP answer for a real bound account, and they do not advance public, auth, or client acceptance counts. No OAuth start, account binding, collection read, or personal data access was performed.

Only revisit direct scenario acceptance after the user explicitly authorizes the real account path and a bound account is already available through the normal flow. Keep the tests and source audit separate from that evidence; do not use another account, an arbitrary username, cached/private data, or a fabricated fixture as live acceptance.
