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
