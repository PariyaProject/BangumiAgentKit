# Run 72 current-master frontier delta audit

- Audit time: 2026-10-03T14:41:52Z
- Audited base: `b0a6bb68aed2be491b6412f7efa150440069c1d9`
- Frontier ledger at selection: `9249dd8d7a62156d3d71efaa68500157dcd3518bb3fad6d61c19c7979334fda4`
- Discovery policy: `harness-v3.2-frontier-closure-v1`
- Run: #72, autonomous evolution

This is a bounded current-master delta audit, not a trusted frontier-exhaustion
claim. Run #72 remains active. The preceding six-lane audit at
`docs/research/run72-frontier-audit-2026-10-03.md` covered base
`8b036223584ac7d223fcf2fca04dcbcd3302f6f1`. The exact merge delta from that
base to `b0a6bb68` contains only the OP-008 SubjectCard title hierarchy, its
real-browser tests, the OP-008 evidence row, and the earlier audit report. It
does not change the findings for the other lanes.

## Six discovery lanes

### 1. Recorded opportunities and deferred work

- `OP-001 Voice Actor Workload` remains PARTIAL. The bounded comparison over
  current official-v0 person relations and `first_air_date` is useful for
  release observations; it does not measure labor time or preserve historical
  person snapshots.
- `G04` was still UNASSESSED in the current ledger even though
  `bangumi.get_person_activity` already supported voice relations, a 12-month
  calendar window, conservative TV classification, stable-ID deduplication,
  and coverage. A new bounded public read found a specific user-facing gap in
  how partial counts are summarized; this Epoch advances G04 and OP-001 only.
- `OP-003` and `SOURCE-COMMUNITY-STRUCTURED-WEB` remain RESEARCH_READY because
  attribution, rate limits, caching, retention, isolation, and policy evidence
  are incomplete. No community provider, HTML extraction, or fallback is
  included.
- PR #73 improved OP-008's long-title hierarchy at all widths. OP-008 remains
  PARTIAL for its remaining answer-level and client evidence; this Epoch does
  not repeat that work.

### 2. Capability maturity and complete user journeys

A single read-only official-v0 `bangumi.get_person_activity` execution used
`kind=voice`, `media=tv`, and `windowMonths=12` against the current public
person record. At retrieval time `2026-10-03T14:17:13.764Z`, the result was
`partial`, with a window from `2025-11-01` through `2026-10-03` using
`calendar_months_ending_on_as_of_date` semantics. It observed 324 relation rows
and selected 120; 204 relation rows were omitted at the local cap. It selected
120 subject IDs, requested 48 details, successfully hydrated all 48 requested
details, and left 72 selected subject details unrequested. Two rows were
eligible and returned. The result included `RELATION_LIMIT_REACHED`,
`SUBJECT_DETAIL_COVERAGE`, and `MEDIA_UNKNOWN` warnings.

This supports only a positive count of rows observed under those bounds. It
does not establish the complete number for the window or an exact trailing-365-
day result. Current relation/subject data also cannot establish actual voice
work dates or historical workload. G05 remains a separate bounded two-window
release-date comparison; G06/G07/G17 and other answer-level/client gaps remain
as recorded in the prior audit.

The existing G05 frontier record describes that bounded comparison as PARTIAL,
while the scenario-catalog table still says there is no aggregation. This is a
stale documentation mismatch; this Epoch does not change G05's comparison
formula or status and leaves that catalog reconciliation for a separately
scoped follow-up.

### 3. Agent UX, discoverability, and orchestration

The existing semantic tool returns state, summary, coverage, warnings,
limitations, and source evidence, so it does not need another call or output
schema. At the audited base its description explained sampling and coverage but
did not explicitly tell an Agent that summary counts in `partial` state are
observed counts, not full-window totals. This Epoch clarifies that guidance and
preserves the existing machine-readable state and coverage contract.

### 4. Renderer and Standalone information quality

At the audited base, `PersonActivityCard` visibly showed `部分覆盖` and detailed
coverage, but labeled partial summary metrics as plain `去重作品` and `关系行`.
Standalone showed state, window, coverage, and rows but did not show the
summary's unique-subject, relation-row, and character counts. This made the
bounded positive result harder to use consistently across human surfaces.

The selected presentation change uses observation labels and one concise
partial-coverage explanation in the card. Standalone shows the same summary
counts, qualifies them when partial, and marks them unavailable when there are
no eligible rows to count. Its row heading also states that partial rows are
observations.

### 5. Correctness, coverage, degraded states, and resource bounds

The observed partial state was caused by real declared bounds and an unknown
media value, not by an empty or complete source result. Current service logic
already reports selected/omitted relations, requested/successful/unrequested
details, eligible/returned rows, exclusions, warnings, and limitations. The
Epoch changes no source, date formula, filter, fan-out, response byte cap,
relation/detail/output cap, or deduplication rule. Tests cover partial-positive,
partial-empty, complete, unavailable, and observed-count text behavior.

### 6. Architecture, maintenance, and testability

The gap sits at the existing semantic-description, Renderer-summary, and
Standalone-presenter seams. No new provider, persistence, formula, ViewModel
abstraction, tool, or authentication behavior is needed. Semantic, real HTML
Renderer, and presenter tests exercise the state/coverage presentation where it
is consumed.

## Selection and scope salvage

Selected as `IMPLEMENTATION_READY`: `G04` and `OP-001`. The supported question
is: “在官方 v0 当前关系与作品详情的有界观察中，过去 12 个日历月有哪些
可判断为 TV 的声优作品？” A partial answer must say that its displayed counts
cover the current selected relations and successfully hydrated details only;
it must never be phrased as the full time-window total. The selection is
positive-only and retains the current calendar-month semantics and all current
resource bounds.

### Explicit non-scope

- Exact trailing-365-day intervals or a complete Bangumi-wide count: separate
  source/semantic evidence is required; the current result cannot support
  either claim.
- Historical workload, labor time, growth, and person-history snapshots:
  frontier G05 and a compatible history/retention contract remain separate.
- Account authentication, credentials, private reads, and writes: Charter
  boundary `PB-AUTH-TRUST`.
- Real QQ/TIM delivery or login: separate client frontier; keep QQ login
  passive until a complete client batch is ready.
- Community providers and HTML/Structured Web fallback: Charter boundary
  `PB-BROAD-WEB` and the still-incomplete `SOURCE-COMMUNITY-STRUCTURED-WEB`
  contract.
- Changing source fan-out, relation/detail/output caps, or response budgets:
  independent source-load and resource-policy work.

### Scope closure

**Why not review earlier?** The semantic guidance, Renderer labels, Standalone
summary, and tests express one shared rule: partial summary counts are observed
values. Reviewing only one surface would leave the same answer misleading or
missing in another; all four work packages reuse the same source and state
semantics.

**Why not extend further?** Exact rolling-day windows, complete relation
coverage, historical workload, and real QQ/TIM acceptance require independent
source evidence, contracts, or client conditions. Adding those would change the
claim and substantially widen reviewer scope. The current Epoch ends at truthful
presentation of the existing bounded result.

No OAuth/account, QQ/TIM, NapCat, credential, or external-write action occurred
for this audit or selection. The live query used public official-v0 data only;
no names or titles are retained in this report.

## Validation record

- Focused semantic, Renderer, and Standalone tests: `pnpm vitest run tests/semantic/person-activity.test.ts tests/render/person-activity.test.ts tests/standalone/person-activity-presenter.test.ts` — 3 files, 12 tests passed, including partial positive/empty, complete, unavailable, comparison-period, and observed-count presentation checks.
- Mandatory unit/Renderer suite: `pnpm test` — 72 files, 469 tests passed.
- Semantic suite: `pnpm test:semantic` — 22 files, 126 tests passed.
- Standalone build and suite: `pnpm test:standalone` — `pnpm build` passed; 23 files, 78 tests passed.
- `pnpm typecheck` passed for packages and tests; `pnpm lint` passed.
- `pnpm harness frontier:check` returned `FRONTIER_LEDGER_VALID`, 121 records, 99 actionable, ledger hash `aa1eb63480a90ae3f0de015acaba9afe7f640a8676958b0a001953c6790c49e9`.
- `pnpm harness guard:legacy-paths --base origin/master --product-epoch` returned `LEGACY_RUNTIME_PATH_GUARD_PASS`; `git diff --check` passed.
- RenderService generated a 720 CSS-pixel partial-state card at 1x and a 360 CSS-pixel partial-state card at 2x. Both PNGs were visually inspected; the count labels and partial-coverage explanation fit without clipping.
- A non-mandatory full-repository `pnpm format:check` run reported formatting warnings in 111 files and made no edits. `pnpm lint` passed.
