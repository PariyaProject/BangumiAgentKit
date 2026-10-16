# OP-006 Calendar / Schedule Intelligence delivery reconciliation

Checked 2026-10-17 (JST) against BangumiAgentKit master Base
52db4eae381d8009e93380c1a94cf6bbc7ce31d8.

## Conclusion

The bounded calendar-intelligence value documented by OP-006 is delivered. The opportunity log already records
`DELIVERED_IN_PR-7E_FROZEN`, and the frozen implementation, current call paths,
tests, and renderer/Standalone review evidence support that classification.

This is a day-level broadcast schedule with first-air dates and explicit source
coverage. It does not provide the exact time of an upcoming episode, timezone
semantics, personal collection state, or a guarantee beyond the source rows
observed. Those limitations are part of the delivered contract.

## Official source contract

The official [Bangumi API OpenAPI at commit
65d29cff2331e08c0110d30d515f7f1b6488f845](https://github.com/bangumi/api/blob/65d29cff2331e08c0110d30d515f7f1b6488f845/open-api/api.yml)
defines `GET /calendar` as “每日放送” and returns weekday envelopes containing
subject rows. The legacy subject schema documents `air_date` as the broadcast
start date and `air_weekday` as the broadcast weekday; it has no next-episode
time or timezone field. The upstream [issue #285](https://github.com/bangumi/api/issues/285)
asks for the missing concrete next-episode time, which remains outside this
source contract.

This report inspects the versioned OpenAPI document only. No live calendar
endpoint, MCP tool, model, account, or client was invoked.

## Shipped behavior and bounds

Current source in
[calendar-service.ts](../../packages/bangumi-core/src/services/calendar-service.ts)
parses the official legacy response before mapping it into the domain model.
The semantic path calls `GET /calendar` once with cache bypass and no retry.
`buildCalendarIntelligence` preserves weekday envelopes and item order, counts
missing/duplicate/invalid weekdays and conflicting item weekdays, reports
missing fields, and marks incomplete or truncated observations partial. An
upstream failure produces an unavailable result without inventing schedule rows.
Date semantics are `first_air_date`; weekday numbering is Monday=1 through
Sunday=7, while the source timezone remains unspecified.

The parser accepts at most 32 weekday envelopes, 128 items per envelope, and
512 items total. The semantic output defaults to 3 rows per day and 21 total,
with hard caps of 8 per day and 56 total. Results expose observed, returned,
overflow, source coverage, warnings, limitations, and retrieval evidence.

The frozen PR-7E record documents the bounded API, Renderer, and Standalone
capability and its known limits:
[freeze record](../../docs/product/reviews/PR-7E/freeze-record.md),
[product review](../../docs/product/reviews/PR-7E/product-review.md), and
[code review](../../docs/product/reviews/PR-7E/code-review.md). Those legacy
review files are evidence only and are not modified by this Epoch.

## Regression evidence

Current deterministic coverage is in
[services.test.ts](../../tests/unit/services.test.ts). The existing duplicate
envelope case already exercises 20 source envelopes folded into seven weekdays.
This Epoch strengthens it to assert:

- all seven weekday IDs are reported as duplicates;
- source item IDs remain grouped in original order after duplicate envelopes are
  merged;
- observed and returned counts remain 20, with 13 extra envelopes reported;
- the result remains partial and includes the source-day coverage warning.

The same unit file also covers missing weekdays and missing-field counts,
invalid filters, weekday conflicts, malformed and oversized payloads, upstream
failure, one-request behavior, and truthful cache-bypass timestamps.

## Frontier disposition

The product opportunity log says OP-006 was delivered in the frozen PR-7E
cycle, while the canonical frontier had remained PARTIAL with a generic
reconciliation action. Current source, direct unit evidence, frozen review
evidence, and explicit source limitations agree on the bounded product scope.
The OP-006 frontier record is therefore updated to DELIVERED with this report
and the direct implementation/test references.

This disposition does not claim exact episode airing times, account
personalization, exhaustive source completeness, or any additional direct/public,
Agent/MCP, QQ, or TIM acceptance. OP-010 Collection Weekly Schedule remains
separate and unchanged because it requires account-bound collection evidence.
The public 65/65 matrix and all one-shot dispositions remain unchanged.
