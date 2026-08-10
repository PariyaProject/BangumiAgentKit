# PR-7E Calendar / Schedule Intelligence

Status: PLAN_CREATED

Base: PR-7D Governance Record (the separate commit that freezes PR-7D)

## Cycle title

Calendar / Schedule Intelligence — bounded official calendar facts with truthful coverage

## Opportunity selection

The existing calendar path already has a stable official legacy source, a provider seam,
and a renderer. It currently exposes a shallow list and loses useful fields such as
air date, rank, type, collection count, and source coverage at the semantic boundary.
Improving this read-only path has high user value and low source risk while remaining
independent of the completed person/staff work.

Representative user questions:

- “今天和本周有哪些动画，什么时候播？”
- “本周日播出的作品有哪些，评分和 Bangumi 类型是什么？”
- “为什么今天的播出日历不完整？”

## Scope

Build a bounded calendar-intelligence result on top of the existing official `/calendar`
source without removing or breaking `bangumi.get_calendar`:

- preserve weekday, air date, score, type, rank, image, and available collection fields;
- add a stable per-day cap, returned/observed counts, overflow, source evidence, and
  `complete`/`partial`/`unavailable` state;
- support a bounded weekday filter and a maximum total rendered item count;
- keep official legacy as the explicit source and preserve public upstream failures;
- add a compact calendar renderer that labels capped samples and missing schedule fields;
- retain the existing calendar API and renderer behavior for compatibility.

## Explicit non-scope

- no personal watchlist, account collections, OAuth, authorization, or write actions;
- no claim that source ordering is a recommendation or popularity ranking;
- no HTML/Structured Web fallback and no historical schedule snapshots;
- no inferred “currently airing” status beyond the source's explicit `air_date` value.

## Evidence and failure contract

The result must distinguish source-returned rows from rendered rows, preserve missing
air-date/rating/type fields as unknown, and expose upstream 404/429/503 or schema-drift
failures without fabricating a complete week. Every derived summary should identify the
official legacy operation and retrieval timestamp.

## Tests and QA

- unit tests for item mapping, type/rating/date preservation, weekday filtering, stable
  caps, overflow arithmetic, empty days, and unknown fields;
- semantic tests for injected transport, request validation, evidence, partial coverage,
  and public failure codes;
- contract tests preserving the existing `bangumi.get_calendar` schema;
- Standalone and renderer tests for narrow width, dense days, empty days, long CJK names,
  partial state, and unavailable state;
- live read-only QA against the official calendar and visual QA at 640px and 960px.

## Resource and security limits

- one official legacy calendar request per result;
- maximum seven weekdays, maximum eight displayed items per day, and maximum 56 rendered
  items;
- existing SSRF-constrained asset resolution and renderer output/timeout limits remain
  in force;
- no credentials, cookies, database migration, or public/shared cache expansion.

## Acceptance criteria

1. Calendar facts useful for “what airs when?” are preserved in a bounded semantic result.
2. Caps, missing fields, source evidence, and unavailable states are machine-readable and
   human-readable.
3. Existing `bangumi.get_calendar` behavior remains backward compatible.
4. Local gates, exact-SHA remote CI, Agent QA, and representative visual QA pass.
5. Both independent Freeze reviewers return PASS before PR-7E is frozen.

## Corrective review findings — candidate `0ab5dd4fd5138fd57c6dc03ce4aa408024606eba`

The independent Freeze reviews both returned `CORRECTIVE_REQUIRED`. The findings are
preserved here before the next implementation candidate:

- P0/P1 schema truthfulness: malformed calendar payloads such as `[{}]`, non-array
  `items`, and incomplete day arrays could be treated as complete or as generic
  unavailability instead of explicit schema drift.
- P1 transport seam: `bangumi.get_calendar_intelligence` used the closure's default
  `HttpClient`, bypassing an injected `ToolRegistry` transport.
- P1 source coverage: the result did not enforce the seven-weekday ceiling or expose
  missing weekday coverage, so arbitrary source day counts could be marked complete.
- P1 compatibility: the existing `render_calendar.weekday` schema was narrowed from
  an unrestricted optional number to integer 1–7 without a compatibility path.
- P1 missing-field semantics: missing Chinese titles, scores, ranks, collection counts,
  and other fields were not machine-readable, and the renderer silently omitted
  unknown values or hid the original title when a Chinese title existed.
- P1 schedule semantics: `air_date` was rendered as a generic “日期” even though it is
  a first-air date rather than a precise current-week episode time.
- P1 visual density: the 640px live artifact was excessively tall and repeated dense
  metadata; the bounded default needed to be smaller and the compact layout clearer.

## Fresh corrective review findings — candidate `b6c927c42acef329f94bf1f80a48b6fce2dfef02`

The fresh independent code review returned `CORRECTIVE_REQUIRED` after exact-SHA CI
passed. These findings must be addressed before another candidate:

- P1 provenance: `retrievedAt` is generated per semantic call even when the legacy
  payload is served from the one-hour transport cache, so the evidence can imply
  freshness that was not observed; failures also receive a retrieval timestamp.
- P1 compatibility semantics: the intentionally broad legacy `render_calendar.weekday`
  number schema allows out-of-range or fractional values to produce an empty result
  marked `complete`; preserve the schema while making the result explicitly partial,
  warned, or unavailable.
- P1 source arithmetic: duplicate weekday IDs are accepted and silently discarded,
  causing `coverage.observed` and item-level evidence to undercount source rows; reject
  duplicate weekday envelopes as schema drift or expose the discarded counts.
- Freeze hygiene: the corrective findings record was intentionally left uncommitted
  during the candidate review; it must be committed as governance metadata before the
  next reviewed candidate is presented with a clean worktree.

The fresh independent product review also returned `CORRECTIVE_REQUIRED`:

- P1 renderer information loss: single-line clipping hides long titles, bilingual names,
  ranks, and collection counts at both 640px and 960px, which fails the stated mobile
  readability objective.
- P1 Agent usability: the weekday input documents only numeric `1–7` without the
  Monday–Sunday mapping or day/time semantics needed for “今天/周日” questions.
- P1 renderer fallback: a valid Japanese weekday can disappear when Chinese and English
  labels are absent because the builder does not fall back to `ja`.

## Fresh corrective review findings — candidate `cf4588ec856d93e3b41c2236150d29ee7b897ced`

The fresh independent code review returned `CORRECTIVE_REQUIRED` after exact-SHA CI and
the product review passed. These findings must be addressed before another candidate:

- P1 request ceiling: calendar intelligence bypasses the cache but still inherits the
  transport default of two retries, so a 429/503/network failure can make three official
  requests instead of the cycle's one-request ceiling. Retry behavior must be disabled
  for this bounded operation and call counts must be tested for each failure class.
- P1 weekday consistency: an item `air_weekday` is not range-checked against its enclosing
  weekday. Out-of-range or contradictory item weekdays can therefore be treated as a
  complete result. Classify them as schema drift or an explicit partial conflict and add
  negative tests.
- P1 renderer evidence: the required narrow/dense/empty/long-CJK/unavailable matrix was
  not actually rendered at both 640px and 960px, and no Standalone calendar-route test
  covered the path.

## Fresh corrective review findings — candidate `0fac59e632d1c6c6f547ec3cde74321db1b6ad2f`

The fresh independent code review returned `CORRECTIVE_REQUIRED` after exact-SHA CI and
the product review passed. These findings must be addressed before another candidate:

- P1 bounded source work: parsing maps every source envelope/item and duplicate weekday
  merging repeatedly copies accumulated arrays before output caps apply. Add explicit
  source envelope and item-count ceilings before full mapping, reject oversized payloads
  truthfully as parser/schema drift, and merge without cumulative array copying. Add
  adversarial oversized and duplicate-envelope tests.
- P1 provenance API: the public `buildCalendarIntelligence` builder defaults
  `retrievedAt` to the current time and always emits official evidence, so direct calls
  with synthetic/cached data can fabricate freshness. Require/accept explicit acquisition
  metadata and omit timestamps when unknown, with a direct-builder regression test.

The product reviewer passed with no P0/P1 blockers; its non-blocking P2 follow-ups were
recorded for a later opportunity: direct Agents to the legacy list tool for exhaustive
enumeration, consider larger mobile metadata, and strengthen visual-regression assertions.
