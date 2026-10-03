# Run 75 current-master frontier delta audit

- Audit time: `2026-10-03T16:55:02Z`
- Audited base: `1cb1590007cbdfb99c545154e3e1f15d9dc66418`
- Audited-base frontier ledger SHA-256: `aa1eb63480a90ae3f0de015acaba9afe7f640a8676958b0a001953c6790c49e9`
- Discovery policy: `harness-v3.2-frontier-closure-v1`
- Run: #75, autonomous evolution

This is a bounded current-master selection audit, not a trusted
frontier-exhaustion claim. The ledger has 121 records, 22 DELIVERED, 29 PARTIAL,
2 RESEARCH_READY, and 68 UNASSESSED; 99 remain actionable. Run #75 is active.
The prior Run72 audit at `b0a6bb68` selected G04/OP-001. PR #74 is now merged;
its exact delta advances truthful partial person-activity counts and refreshes
catalog-bound G04/G14 evidence. No authentication, provider, persistence,
client, or resource-policy change entered master.

## Six discovery lanes

### 1. Recorded opportunities and deferred work

- G04 and OP-001 remain PARTIAL after PR #74. Partial Renderer and Standalone
  counts now read as observations; neither the 12-calendar-month official-v0
  result nor its relation/detail caps support a complete-window workload claim.
- OP-002's opportunity log records the PR-7G implementation as delivered,
  while the canonical frontier remains PARTIAL. This audit preserves both
  records: G09's single-series sample does not settle the broader Monogatari
  watch-order opportunity.
- OP-003 and `SOURCE-COMMUNITY-STRUCTURED-WEB` remain RESEARCH_READY. The
  capability-specific source contract, including terms/robots evidence,
  attribution, rate/fan-out limits, retention, and untrusted-content isolation,
  is still incomplete. No HTML or community source is selected.
- OP-008 remains PARTIAL for answer-level and client evidence. Historical PR-7G
  review/freeze material remains read-only; no protected cycle or review file is
  reopened.

### 2. Capability maturity and complete user journeys

- G01 remains PARTIAL because official search is experimental and totals are
  estimated. Its ledger `next_action` still asks to localize experimental
  source, estimate, and pagination caveats, but those labels and regressions
  already exist in `DiscoveryResultsCard` and
  `tests/render/discovery-results.test.ts`; do not repeat that localization.
- G04/OP-001 have current catalog-bound public and Agent/MCP evidence at 65/65
  and 96/96 respectively, but actual workload/history, query-specific natural
  language, and QQ/TIM evidence remain outside that claim.
- G05 has a bounded recent-versus-previous release-date comparison and remains
  PARTIAL; its scenario-catalog wording still says no aggregation. That
  documentation mismatch is separate from G09 and does not change G05's
  formula or status here.
- G09 was UNASSESSED despite the shipped
  `bangumi.get_series_watch_order` and renderer. An exact current official-v0
  search resolved the Girls' Last Tour anime as subject 218707. The bounded
  depth-2, maxNodes-8 result contains the root and one direct animated
  derivative (subject 227245, relation `衍生`); eight non-anime relations are
  excluded. The read establishes one bounded recommendation, not a complete
  franchise or canonical order.
- G06/G07/G15 and other PARTIAL journeys retain their existing answer-level or
  current-source gaps. Account collection questions remain protected by the
  auth boundary; discussion velocity still lacks a source contract.

### 3. Agent UX, discoverability, and orchestration

The current generated acceptance matrix has all 96 tools in the generic
Agent/MCP lane. `get_series_watch_order` describes bounded depth/node behavior,
preserves raw relation evidence, and states that its output is not a unique
official order. The G09-specific current-source probe validates the read-tool
result, but this audit does not claim a natural-language Agent answer for that
question. The broader Agent/MCP count does not substitute for G09-specific
answer validation.

### 4. Renderer and Standalone information quality

PR #74's G04 display correction is merged and visually inspected. The existing
`SeriesRelationsCard` preserves relation labels, order reasons, exclusions,
coverage, and the noncanonical-order caveat. The G09 scenario regression
renders the service-emittable observation at 360 and 720 CSS-pixel widths. PNGs
at 360 CSS px × 2 and 720 CSS px × 1 were inspected: the direct derivative,
eight non-anime exclusions, and order limitation remain readable without
clipping. The images remain temporary QA artifacts.

### 5. Correctness, coverage, degraded states, and resource bounds

The G09 live read used official v0, depth 2, maxNodes 8, and `media=anime`.
Retrieved at `2026-10-03T16:55:02.449Z`, it made two relation requests, observed
10 relation rows and 9 unique related IDs, returned one related anime, and
excluded eight non-anime records. The result state was complete within those
declared limits, with no truncation and three explicit limitations. It does
not establish a universal order or exhaustive graph. The Epoch changes no
source endpoint, relation-direction policy, graph traversal, depth, node cap,
authentication, persistence, or QQ/TIM behavior.

### 6. Architecture, maintenance, and testability

The shipped SeriesService, read/render tools, ViewModel, and card already
provide the right seams. The selected work adds one service-emittable G09
fixture and report-backed scenario regression; it does not introduce another
provider, formula, persistence layer, or abstraction. Existing graph and
fixture invariants remain in place.

## Selection and scope salvage

Selected as `IMPLEMENTATION_READY`: G09, “少女终末旅行系列观看顺序。” A
positive-only result is useful: it starts with the requested anime and keeps
the directly related animated derivative as a bounded side-story recommendation
while visibly preserving the raw relation and noncanonical-order caveat. The
eight non-anime relations remain explicit exclusions. G09 advances only from
UNASSESSED to PARTIAL; the sample does not prove a complete series or official
order. The current generic Agent/MCP matrix remains 96/96, but natural-language
G09 acceptance and real QQ/TIM display are separate gates.

### Explicit non-scope

- A unique official order or exhaustive franchise graph: official v0 does not
  supply a canonical order; stronger claims require separate source/policy
  evidence.
- Undocumented HTML, community sources, broad crawling, or untrusted-content
  injection: Charter boundary `PB-BROAD-WEB` and the still-open source contract.
- Authentication, private reads, credentials, or writes: Charter boundary
  `PB-AUTH-TRUST`.
- Real QQ/TIM delivery or login: separate client acceptance; keep login passive
  until a complete batch is ready.
- Person-activity/G05 reconciliation and experimental-search/G01 follow-up:
  separate scenarios and semantics.

**Why not review earlier?** The tools and generic fixtures predated this exact
G09 public scenario. The current official source observation, service-emittable
test, and width-specific Renderer output now share the same bounded relation
contract. Reviewing without the exact root/derivative evidence would leave G09
UNASSESSED.

**Why not extend further?** Canonical sequencing needs different source or
policy evidence; broader graph depth changes the resource contract; natural
language acceptance, QQ/TIM, and account paths have independent validation and
safety boundaries. Adding them would combine unrelated review work.

No OAuth/account, QQ/TIM, NapCat, credential, or external-write action occurred
during this audit. The direct probe is public official-v0 data only; names and
raw response bodies are omitted from its saved report.

## Validation record

- Direct public probe:
  `docs/live-probes/g09-series-watch-order-2026-10-03-165502090-96642.json` —
  5 HTTP requests including exact-title resolution; all G09 assertions passed.
- Scenario-specific service/Renderer regression:
  `pnpm vitest run tests/render/series-watch-order-g09.test.ts` — 1/1 passed.
- Renderer visual QA used the same service-emittable G09 fixture at 360 CSS px
  × 2 and 720 CSS px × 1; both temporary PNGs were inspected.
- `pnpm test:render` — 29 files / 128 tests passed, including the G09
  service-emittable relation and Renderer regression.
- `pnpm typecheck` and `pnpm lint` passed; `git diff --check` passed.
- `pnpm acceptance:check` — 37 evidence validators passed; current matrix is
  96/96 direct execute, 65/65 applicable public API, and 96/96 Agent/MCP; auth
  denial is 22/22, while 33 real account paths and QQ/TIM remain separate.
- `pnpm vitest run tests/integration/tool-e2e-acceptance.test.ts` — 13/13
  passed; current catalog-bound tool evidence remains accepted.
- Candidate frontier validation returned `FRONTIER_LEDGER_VALID`: hash
  `e8aa9d170ed538ca75307d5fc1d95f71eb58cdc68f8ca7ef4d1af3cc6501433b`, 121
  records, 30 PARTIAL, 67 UNASSESSED, and 99 actionable.
- Exact Candidate CI and independent review are pending this Epoch's next
  gates.
