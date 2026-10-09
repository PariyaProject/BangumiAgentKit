# G22 — discussion-volume and rating-count source boundary

**As of:** 2026-10-09. This is a static review of current official API and developer documentation plus a local catalog regression. No Bangumi API, community content, account, OAuth, QQ, or TIM request was made.

## Metric contract

G22 asks for subjects with the most discussion while having relatively few rating users. Those are separate metrics. The current official [Bangumi server v0 OpenAPI](https://github.com/bangumi/server/blob/master/openapi/v0.yaml#L16-L144) documents `rating_count` as a filter by the number of users who rated a subject. The same operation defines `sort=heat` as the current collection count, not discussion volume. The search endpoint is explicitly experimental; its response does not establish a complete site-wide list. The reviewed v0 specification exposes no subject discussion/comment route or field. That statement is limited to the published v0 contract, not a claim that Bangumi has no community discussions.

Bangumi's [official developer documentation](https://github.com/bangumi/dev-docs/blob/master/README.md#L234-L261) distinguishes the supported `/v0/` public API from the older unversioned API, which has stopped maintenance and is no longer recommended. It also identifies `/p1` as a private frontend API with cookie-session authentication, no compatibility guarantee, and no cross-origin support. This Epoch does not use `/p1`, legacy routes, HTML, or any community source.

## Product boundary and coverage

`bangumi.query_subjects` can order by current collection count and filter by rating-user count; neither value can be relabeled as discussion volume. A `rating_count` filter also cannot identify subjects with few discussion posts. The current official public contract provides no metric that answers the discussion-ranking part of G22, so there is no supported bounded result to report. Search remains experimental and totals are estimated, which independently prevents a complete-list claim.

This boundary is consistent with the G10 heat clarification and the G11/G21 discussion-source review. The new regression protects G22's `PARTIAL` disposition and checks that the current tool catalog does not describe subject-level discussion or comment counts. It does not add public or Agent/MCP acceptance evidence.

## Disposition

G22 remains **PARTIAL**: the rating-user-count dimension is available, but a safe, supported public discussion-volume metric is not. Do not substitute collection heat, rating counts, or a private community endpoint. Reopen only when an official supported public source defines a subject-linked discussion metric and its pagination/coverage contract. OP-003 remains a separate research-ready question about whether any narrowly scoped public HTML source is permitted.
