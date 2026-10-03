# Run 72 current-master frontier audit

- Audit time: 2026-10-03T13:54:15Z
- Audited base: `8b036223584ac7d223fcf2fca04dcbcd3302f6f1`
- Frontier ledger SHA-256: `2ec5b9ed6d5e44db685ec1121d0acf0fad98e98b023eb47a4bbafaa50100c31d`
- Discovery policy: `harness-v3.2-frontier-closure-v1`
- Run: #72, autonomous evolution

This is a bounded selection audit, not a trusted frontier-exhaustion claim.
The canonical ledger has 121 records: 22 delivered, 28 partial, 2 research
ready, and 69 unassessed (99 actionable). The Run remains active and this
Epoch advances only `OP-008`.

## Six discovery lanes

### 1. Recorded opportunities and deferred work

- `OP-008 Subject Intelligence Overview` remains PARTIAL. Its public subject
  card is a high-value, reusable presentation surface. Run #69's current-source
  Agent/MCP and strict Renderer reports still need a clean evidence rerun after
  the earlier ENOSPC failure; QQ/TIM remains a separate external surface.
- `OP-003` and `SOURCE-COMMUNITY-STRUCTURED-WEB` remain RESEARCH_READY. The
  source contract, attribution, rate limits, retention, isolation, and policy
  evidence are incomplete. The current Epoch does not add `/p1`, HTML, cookies,
  or an undocumented fallback.
- `OP-001` remains PARTIAL. Person activity is derived from current official
  relations and subject first-air dates; a calendar-month count is not a
  historical snapshot, labor-time estimate, or exact trailing-365-day count.
- `OP-005` still needs the answer-level role/person assertions and a clean
  strict Renderer report described by its frontier record. It is not merged
  into this card-layout Epoch.

### 2. Capability maturity and user journeys

- G01's July discovery remains PARTIAL because the source is experimental and
  totals are estimated. Its ledger `next_action` still says to localize source,
  estimate, and pagination caveats; merged PR #67 (`d0d68db`) and
  `tests/render/discovery-results.test.ts` already cover those localized
  caveats. Treat that `next_action` as stale; do not repeat the completed
  localization or infer that Agent/MCP and QQ/TIM were thereby accepted.
- G02/G03/G14 retain Run #66's direct and Agent/MCP evidence and remain PARTIAL
  because bounded experimental search does not establish Bangumi-wide
  completeness.
- G04's existing `bangumi.get_person_activity` can report distinct subjects
  for voice relations, conservatively classified TV media, and 12 calendar
  months ending on the as-of date. It preserves relation/detail limits and
  partial coverage. That does not exactly answer a rolling 12-month window;
  no new live G04 result was run.
- G06/G07/G17 remain PARTIAL because current answer-level assertions and/or
  clean strict Renderer reports remain outstanding after Run #69. G08's exact
  Candidate Agent/MCP acceptance is recorded, while QQ/TIM image display remains
  unverified. G15 still needs current-source two-subject Agent/MCP evidence.
- Unassessed collection journeys require real account paths or remain separate
  from the public renderer; discussion velocity candidates lack an authorized
  source contract. Neither is a safe dependency for the selected presentation
  change.

### 3. Agent UX and orchestration

The current `bangumi.render_subject_card` tool already exposes one bounded
render operation over the subject detail ViewModel. This Epoch changes no tool
name, schema, call count, source selection, or natural-language claim. The
observed gap is how an existing result is laid out when a long mixed-script
title reaches the non-compact template branch, not a missing semantic tool.
Answer-level Agent/MCP work for cast/staff journeys remains separately tracked.

### 4. Renderer and Standalone information quality

The historical 720×1546 subject-card image was produced on revision `3aea963`,
before PR #70's `84fefb1` responsive subject-card change. It is not current
phone-width evidence. That change puts the title above the card content when
`width < 640`, and the current browser test verifies 320, 360, and 520 CSS px.

The same current component keeps the title inside the right-hand column at
640px and wider. A current-source long mixed-script fixture measures title
block widths of 358/640 (56%), 438/720 (61%), and 618/900 (69%). At 720 CSS px,
the long Chinese heading and original-language subtitle wrap in the
right-hand column. A full-content-width title row uses the available card
width while leaving the cover/metadata row side by side. The 720 CSS px
before/after PNGs were visually inspected; the after render used a Chinese and
Japanese title fixture. The 360 CSS px after PNG preserves the
already-established compact title-above-content hierarchy.

### 5. Correctness, coverage, and resource bounds

The selected change only repositions the existing display title and
non-duplicate original-language subtitle. It does not change subject identity,
API results, evidence, calculations, claims, or authentication. Browser checks
cover widths 320, 360, 520, 640, 720, and 900 CSS px and reject horizontal
overflow or clipped text. RenderService checks a 720-pixel PNG at 360 CSS px ×
2 and a 720-pixel PNG at 720 CSS px × 1, both below the established 8192-pixel
height limit. No live API request or personal data is needed to verify this
layout-only behavior.

### 6. Architecture, maintenance, and testability

`SubjectCard` already receives its width and uses the shared `TitleBlock`; the
existing real-browser layout helper measures the rendered DOM. Moving one
existing component above the responsive cover/metadata row adds no abstraction,
public contract, provider, or persistence. The focused browser test is the
smallest durable regression surface for the uncovered breakpoint.

## Selection and scope salvage

Selected as `IMPLEMENTATION_READY`: `OP-008`, question “Can BangumiAgentKit
deliver the bounded user value described by Subject Intelligence Overview?”
Give long Chinese/Japanese subject titles one full-content-width hierarchy at
all widths, preserve the existing compact phone composition and wide
cover/metadata row, and prove both with deterministic real-browser fixtures.

This is a positive presentation improvement only. It claims neither complete
subject intelligence nor live Agent/MCP, account, QQ, or TIM acceptance. Keep
`OP-008` PARTIAL until its remaining answer-level and client evidence is
complete.

Explicit non-scope:

- Person activity window/source semantics (G04, OP-001).
- Community data providers or web extraction (OP-003,
  `SOURCE-COMMUNITY-STRUCTURED-WEB`, and Charter boundary `PB-BROAD-WEB`).
- Authentication trust, credentials, and personal-account paths (Charter
  boundaries `PB-AUTH-TRUST` and `PB-CREDENTIALS`).
- Real QQ/TIM delivery, login, or display claims (G08 and BGK-009's separate
  client acceptance rows).
- Cast/staff answer semantics and their pending exact-source reports (G06,
  G07, G17, and OP-005).

No account, OAuth, QQ/TIM, NapCat, or external-write action occurred during
this audit.
