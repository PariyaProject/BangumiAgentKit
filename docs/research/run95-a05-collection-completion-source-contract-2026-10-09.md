# Run 95 A05: collection-status share source contract

## Scope and evidence boundary

This report records a static source review for the bounded A05 discovery filter. The upstream Bangumi source was checked at commit `4223d14057fea5078595e40470f8602d3301abb5` in the official `bangumi/server` repository (local read-only checkout). No Bangumi runtime/API request, account access, community source, QQ, or TIM action was performed for this review.

## Official v0 fields and search limits

- The official `POST /v0/search/subjects` schema calls search experimental and documents rating as an available search filter. Its response is `Paged_Subject`. See [the pinned search operation](https://github.com/bangumi/server/blob/4223d14057fea5078595e40470f8602d3301abb5/openapi/v0.yaml#L17-L35) and [its request/response schema](https://github.com/bangumi/server/blob/4223d14057fea5078595e40470f8602d3301abb5/openapi/v0.yaml#L109-L124).
- The public `GET /v0/subjects/{subject_id}` operation returns the official `Subject` schema. That schema defines `rating.score` as a number and requires the five current collection counters: `wish`, `collect`, `doing`, `on_hold`, and `dropped`. See [the subject endpoint](https://github.com/bangumi/server/blob/4223d14057fea5078595e40470f8602d3301abb5/openapi/v0.yaml#L340-L369) and [the rating and collection fields](https://github.com/bangumi/server/blob/4223d14057fea5078595e40470f8602d3301abb5/openapi/components/subject_v0.yaml#L73-L140).
- The search handler returns Meilisearch `EstimatedTotalHits` as the page total. Results and totals therefore do not establish complete database coverage. See [the pinned handler](https://github.com/bangumi/server/blob/4223d14057fea5078595e40470f8602d3301abb5/internal/search/subject/handle.go#L149-L154) and [the response field](https://github.com/bangumi/server/blob/4223d14057fea5078595e40470f8602d3301abb5/internal/search/subject/handle.go#L203-L205).

## Derived metric contract

The local formula registry already defines `bangumi.subject.completion.v1` with evidence status `empirically_verified` and description `collect / (wish + collect + doing + on_hold + dropped)`. The implementation emits a warning that the formula matched five prior live samples and is not an official API contract. See [`formulas.ts`](../packages/provider-core/src/formulas.ts#L33-L40) and [the computation and warning](../packages/provider-core/src/formulas.ts#L152-L198).

A05 reuses that formula as a local post-filter over the five official `Subject.collection` counters. It is a current collection-status share within the bounded observed candidate sample. It is not an official Bangumi formula, episode or chapter completion, a user's personal viewing progress, taste, or preference. Missing, invalid, conflicting, or zero-denominator buckets remain unresolved and are reported as partial coverage; they are never converted to zero or counted as confirmed non-matches. Rating score remains an official search pushdown; the derived ratio is not sent to Bangumi.

## Acceptance limits

This source review supports field provenance and the caveats above. It does not demonstrate that a live query returned results, that the result sample is representative, or that the search endpoint is stable. A05's one-shot anonymous Agent/MCP probe remains gated on an exact Candidate, exact-SHA CI, and GPT-6 Luna Max PASS review. If that single probe is inconclusive, it must not be retried or used to advance A05.
